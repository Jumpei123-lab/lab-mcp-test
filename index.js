import express from "express";

const app = express();

/**
 * ✅ 重要
 * JSONを一度「UTF-8文字列」として受信してから自前で parse
 * これで PowerShell / curl / Node すべて文字化けしなくなる
 */
app.use(express.text({ type: "*/*" }));

app.post("/mcp", async (req, res) => {
  let body;

  try {
    // ✅ UTF-8 として JSON に変換
    body = JSON.parse(req.body);
  } catch (e) {
    return res.status(400).json({
      jsonrpc: "2.0",
      id: null,
      error: { message: "Invalid JSON" }
    });
  }

  const { jsonrpc, id, method, params } = body;

  if (method !== "slack.postMessage") {
    return res.status(400).json({
      jsonrpc: "2.0",
      id,
      error: { message: "Unknown method" }
    });
  }

  // ✅ Slack API へ UTF-8 明示送信
  const slackRes = await fetch(
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

  const result = await slackRes.json();

  res.json({
    jsonrpc: "2.0",
    id,
    result
  });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`MCP Server running on port ${port}`);
});
