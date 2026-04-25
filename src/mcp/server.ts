import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import type { Request, Response } from "express";
import * as z from "zod/v4";
import { MonopolyDealSimulation } from "./simulation";

const simulation = new MonopolyDealSimulation();

const jsonToolResult = (value: unknown) => ({
  content: [
    {
      type: "text" as const,
      text: JSON.stringify(value, null, 2)
    }
  ]
});

const jsonResource = (uri: string, value: unknown) => ({
  contents: [
    {
      uri,
      mimeType: "application/json",
      text: JSON.stringify(value, null, 2)
    }
  ]
});

export const createMonopolyDealMcpServer = () => {
  const server = new McpServer({
    name: "monopoly-deal-simulation",
    version: "0.1.0"
  });

  server.registerTool(
    "monopoly_list_strategies",
    {
      title: "List Bot Strategies",
      description: "List every registered Monopoly Deal bot strategy plugin.",
      inputSchema: {}
    },
    async () => jsonToolResult(simulation.strategies())
  );

  server.registerTool(
    "monopoly_new_bot_game",
    {
      title: "New Bot Game",
      description:
        "Start a new headless bot self-play game. Strategy ids cycle when fewer strategies than players are provided.",
      inputSchema: {
        playerCount: z.number().int().min(2).max(5).optional(),
        lineup: z.array(z.string()).optional(),
        gameId: z.string().min(1).optional(),
        seed: z.string().min(1).optional()
      }
    },
    async (input) => jsonToolResult(simulation.newBotGame(input))
  );

  server.registerTool(
    "monopoly_new_human_game",
    {
      title: "New Human Game",
      description:
        "Start a two-player game with one human seat and an easy, medium, or hard dealer bot.",
      inputSchema: {
        dealerStrategyId: z.enum(["easy", "medium", "hard"]).optional(),
        gameId: z.string().min(1).optional(),
        seed: z.string().min(1).optional()
      }
    },
    async (input) => jsonToolResult(simulation.newHumanGame(input))
  );

  server.registerTool(
    "monopoly_state",
    {
      title: "Read Simulation State",
      description:
        "Read the current simulation snapshot, table cards, turn info, and optionally all hands.",
      inputSchema: {
        includeHands: z.boolean().optional()
      }
    },
    async (input) => jsonToolResult(simulation.view(input))
  );

  server.registerTool(
    "monopoly_recent_events",
    {
      title: "Read Recent Events",
      description: "Read the newest event-sourced domain events from the active simulation.",
      inputSchema: {
        limit: z.number().int().min(1).max(200).optional()
      }
    },
    async ({ limit }) => jsonToolResult(simulation.recentEvents(limit))
  );

  server.registerTool(
    "monopoly_step_bot",
    {
      title: "Step Current Bot",
      description: "Apply one decision for the current bot player, if the current player is a bot.",
      inputSchema: {}
    },
    async () => jsonToolResult(simulation.stepBot())
  );

  server.registerTool(
    "monopoly_run_bots",
    {
      title: "Run Bots",
      description:
        "Advance the active simulation by up to the requested number of bot decisions, stopping early on a win or non-bot turn.",
      inputSchema: {
        steps: z.number().int().min(1).max(5000).optional()
      }
    },
    async (input) => jsonToolResult(simulation.runBots(input))
  );

  server.registerResource(
    "monopoly-state",
    "monopoly://state",
    {
      title: "Current Monopoly Deal State",
      description: "Current headless Monopoly Deal simulation state.",
      mimeType: "application/json"
    },
    async (uri) => jsonResource(uri.href, simulation.view())
  );

  server.registerResource(
    "monopoly-events",
    "monopoly://events/recent",
    {
      title: "Recent Monopoly Deal Events",
      description: "Newest event-sourced domain events from the active simulation.",
      mimeType: "application/json"
    },
    async (uri) => jsonResource(uri.href, simulation.recentEvents(50))
  );

  server.registerResource(
    "monopoly-strategies",
    "monopoly://strategies",
    {
      title: "Monopoly Deal Bot Strategies",
      description: "Registered bot strategy plugins available to simulation tools.",
      mimeType: "application/json"
    },
    async (uri) => jsonResource(uri.href, simulation.strategies())
  );

  return server;
};

const runStdio = async () => {
  const server = createMonopolyDealMcpServer();
  await server.connect(new StdioServerTransport());
  console.error("Monopoly Deal MCP server running on stdio.");
};

const runHttp = () => {
  const host = process.env.MCP_HOST ?? "127.0.0.1";
  const port = Number(process.env.MCP_PORT ?? 3334);
  const app = createMcpExpressApp({ host });
  const transports: Record<string, StreamableHTTPServerTransport> = {};

  app.get("/healthz", (_req: Request, res: Response) => {
    res.json({
      ok: true,
      transport: "streamable-http",
      endpoint: "/mcp",
      state: simulation.view().snapshot
    });
  });

  app.post("/mcp", async (req: Request, res: Response) => {
    const sessionId = req.headers["mcp-session-id"];
    try {
      let transport: StreamableHTTPServerTransport;

      if (typeof sessionId === "string" && transports[sessionId]) {
        transport = transports[sessionId];
      } else if (!sessionId && isInitializeRequest(req.body)) {
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (newSessionId) => {
            transports[newSessionId] = transport;
          }
        });
        transport.onclose = () => {
          if (transport.sessionId) {
            delete transports[transport.sessionId];
          }
        };
        await createMonopolyDealMcpServer().connect(transport);
      } else {
        res.status(400).json({
          jsonrpc: "2.0",
          error: {
            code: -32000,
            message: "Bad Request: missing or invalid MCP session id."
          },
          id: null
        });
        return;
      }

      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      console.error("MCP request failed:", error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: {
            code: -32603,
            message: "Internal server error"
          },
          id: null
        });
      }
    }
  });

  app.get("/mcp", async (req: Request, res: Response) => {
    const sessionId = req.headers["mcp-session-id"];
    if (typeof sessionId !== "string" || !transports[sessionId]) {
      res.status(400).send("Invalid or missing MCP session id.");
      return;
    }
    await transports[sessionId].handleRequest(req, res);
  });

  app.delete("/mcp", async (req: Request, res: Response) => {
    const sessionId = req.headers["mcp-session-id"];
    if (typeof sessionId !== "string" || !transports[sessionId]) {
      res.status(400).send("Invalid or missing MCP session id.");
      return;
    }
    await transports[sessionId].handleRequest(req, res);
  });

  app.listen(port, host, () => {
    console.error(`Monopoly Deal MCP server listening at http://${host}:${port}/mcp`);
  });
};

if (process.argv.includes("--stdio")) {
  runStdio().catch((error) => {
    console.error("MCP stdio server failed:", error);
    process.exit(1);
  });
} else {
  runHttp();
}
