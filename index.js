import express from "express";

const app = express();

// JSON を安全に受け取る
app.use(express.json({ strict: false }));

// MCP エンドポイント
app.post("/mcp", async (req, res) => {
  try {
    const { jsonrpc, id, method, params } = req.body;

    if (method !== "slack.postMessage") {
      return res.status(400).json({
        jsonrpc: "2.0",
        id,
        error: { message: "Unknown method" }
      });
    }

    const slackResponse = await fetch(
      "https://slack.com/api/chat.postMessage",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
          "Content-Type": "application/json; charset=utf-8"
        },
        body: JSON.stringify({
          channel: params.channel,
          text: params.text
        })
      }
    );

    const result = await slackResponse.json();

    return res.json({
      jsonrpc: "2.0",
      id,
      result
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({
      jsonrpc: "2.0",
      id: null,
      error: { message: "Internal Server Error" }
    });
  }
});

// ✅ Render 用ポート設定（これがないと起動しない）
const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`MCP Server running on port ${port}`);
});
