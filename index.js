import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

app.post("/mcp", async (req, res) => {
  const { jsonrpc, method, params, id } = req.body;

  if (method === "slack.postMessage") {
    const response = await fetch(
      "https://slack.com/api/chat.postMessage",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.SLACK_BOT_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          channel: params.channel,
          text: params.text,
        }),
      }
    );

    const result = await response.json();

    return res.json({
      jsonrpc: "2.0",
      id,
      result,
    });
  }

  res.status(400).json({
    jsonrpc: "2.0",
    id,
    error: { message: "Unknown method" },
  });
});

app.listen(3000, () => {
  console.log("MCP Server running");
});
