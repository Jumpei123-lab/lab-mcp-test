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

// セッションをIDで管理
const transports = new Map();

const httpServer = createServer(async (req, res) => {
  if (req.url !== "/mcp") {
    res.writeHead(404);
    res.end("Not found");
    return;
  }

  try {
    // セッションIDをヘッダーから取得
    const sessionId = req.headers["mcp-session-id"];

    if (req.method === "POST") {
      let transport;

      if (sessionId && transports.has(sessionId)) {
        // 既存セッションを再利用
        transport = transports.get(sessionId);
      } else {
        // 新規セッションを作成
        transport = new StreamableHTTPServerTransport({
          path: "/mcp",
          sessionIdGenerator: () => crypto.randomUUID(),
        });

        transport.onclose = () => {
          if (transport.sessionId) {
            transports.delete(transport.sessionId);
          }
        };

        const server = createMcpServer();
        await server.connect(transport);

        if (transport.sessionId) {
          transports.set(transport.sessionId, transport);
        }
      }

      await transport.handleRequest(req, res);
      return;
    }

    if (req.method === "GET") {
      if (sessionId && transports.has(sessionId)) {
        const transport = transports.get(sessionId);
        await transport.handleRequest(req, res);
      } else {
        res.writeHead(400);
        res.end("Session ID required for GET");
      }
      return;
    }

    if (req.method === "DELETE") {
      if (sessionId && transports.has(sessionId)) {
        const transport = transports.get(sessionId);
        await transport.handleRequest(req, res);
        transports.delete(sessionId);
      } else {
        res.writeHead(404);
        res.end("Session not found");
      }
      return;
    }

    res.writeHead(405);
    res.end("Method not allowed");

  } catch (err) {
    console.error("Error handling request:", err);
    res.writeHead(500);
    res.end("Internal server error");
  }
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Slack MCP server running on port ${PORT}`);
});
