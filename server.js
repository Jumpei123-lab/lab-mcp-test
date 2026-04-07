import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { WebClient } from "@slack/web-api";
import { createServer } from "http";
import { z } from "zod";

const slack = new WebClient(process.env.SLACK_BOT_TOKEN);

function createMcpServer() {
  const server = new McpServer({
    name: "slack-mcp",
    version: "1.0.0",
  });

  server.tool("list_channels", "List Slack channels", {}, async () => {
    const result = await slack.conversations.list();
    const channels = result.channels.map(c => `${c.name} (${c.id})`).join("\n");
    return { content: [{ type: "text", text: channels }] };
  });

  server.tool(
    "send_message",
    "Send a message to a Slack channel",
    {
      channel: z.string().describe("Channel ID or name"),
      text: z.string().describe("Message text"),
    },
    async ({ channel, text }) => {
      await slack.chat.postMessage({ channel, text });
      return { content: [{ type: "text", text: "Message sent!" }] };
    }
  );

  server.tool(
    "get_history",
    "Get message history from a channel",
    {
      channel: z.string().describe("Channel ID"),
      limit: z.number().optional().describe("Number of messages (default 10)"),
    },
    async ({ channel, limit = 10 }) => {
      const result = await slack.conversations.history({ channel, limit });
      const messages = result.messages.map(m => `${m.ts}: ${m.text}`).join("\n");
      return { content: [{ type: "text", text: messages }] };
    }
  );

  return server;
}

// セッション管理
const sessions = {};

const httpServer = createServer(async (req, res) => {
  if (req.url !== "/mcp") {
    res.writeHead(404);
    res.end("Not found");
    return;
  }

  const transport = new StreamableHTTPServerTransport({
    path: "/mcp",
    sessionIdGenerator: () => crypto.randomUUID(),
  });

  const server = createMcpServer();
  await server.connect(transport);
  await transport.handleRequest(req, res);
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Slack MCP server running on port ${PORT}`);
});
