import express from "express";

const app = express();

// JSONをそのまま安全に受け取る設定
app.use(express.json({ strict: false }));

// MCP エンドポイント
app.post("/mcp", async (req, res) => {
  try {
    const { jsonrpc, id, method, params } = req.body;

    // 今回は Slack 投稿のみ対応
    if (method !== "slack.postMessage") {
      return res.status(400).json({
        jsonrpc: "2.0",
        id,
        error: { message: "Unknown method" }
      });
    }

    // Slack Web API 呼び出し
    const slackResponse = await fetch(
      "https://slack.com/api/chat.postMessage",
      {
        method: "POST",
        headers: {
          // ✅ Bot トークン
          "Authorization": `Bearer ${process.env.SLACK_BOT_TOKEN}`,

          // ✅ ここが超重要（日本語文字化け対策）
          "Content-Type": "application/json; charset=utf-8"
        },
        body: JSON.stringify({
          channel: params.channel,
          text: params.text
        })
      }
    );

    const result = await slackResponse.json();

    // MCP（JSON-RPC）形式でレスポンス
    return res.json({
      jsonrpc: "2.0",
      id,
      result
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
