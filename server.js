import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { WebClient } from "@slack/web-api";
import { createServer } from "http";
import { z } from "zod";

const slack = new WebClient(process.env.SLACK_BOT_TOKEN);

/* =========================
   MCP Server（1回だけ作成）
   ========================= */
const mcpServer = new McpServer({
  name: "slack-mcp",
  version: "1.0.0",

  // ★超重要：対応プロトコルを明示
  protocolVersion: "2024-11-05",

  capabilities: {
    tools: {},
  },
});

/* ---------- Tools ---------- */

mcpServer.tool("list_channels", "List Slack channels", {}, async () => {
  const result = await slack.conversations.list();
  const channels = (result.channels ?? [])
    .map(c => `${c.name} (${c.id})`)
    .join("\n");

  return {
    content: [{ type: "text", text: channels || "No channels found" }],
  };
});

mcpServer.tool(
  "send_message",
  "Send a message to a Slack channel",
  {
    channel: z.string(),
    text: z.string(),
  },
  async ({ channel, text }) => {
    await slack.chat.postMessage({ channel, text });
    return {
      content: [{ type: "text", text: "Message sent!" }],
    };
  }
);

mcpServer.tool(
  "get_history",
  "Get message history from a channel",
  {
    channel: z.string(),
    limit: z.number().optional(),
  },
  async ({ channel, limit = 10 }) => {
    const result = await slack.conversations.history({ channel, limit });
    const messages = (result.messages ?? [])
      .map(m => `${m.ts}: ${m.text}`)
      .join("\n");

    return {
      content: [{ type: "text", text: messages || "No messages" }],
    };
  }
);

/* =========================
   Transport（1回だけ）
   ========================= */
const transport = new StreamableHTTPServerTransport({
  path: "/mcp",
});

await mcpServer.connect(transport);

/* =========================
   HTTP Server
   ========================= */
const httpServer = createServer((req, res) => {
  if (req.url === "/mcp") {
    transport.handleRequest(req, res);
    return;
  }

  res.writeHead(404);
  res.end("Not found");
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Slack MCP server running on port ${PORT}`);
});
