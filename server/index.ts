import "dotenv/config";
import fs from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";
import * as Sentry from "@sentry/node";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";

import {
  searchInputSchema,
  textContent
} from "./lib/schemas.js";
import { createParkingService, loadSeedData } from "./lib/parking-service.js";

const APP_VERSION: string = "1.0.0";
const PORT: number = Number(process.env.PORT || 3000);
const HOST: string = process.env.HOST || "0.0.0.0";
const RESOURCE_URI: string = "ui://parking/parking-browser.v4.html";
const PROJECT_ROOT: string = process.cwd();
const MIMETYPE: string = "text/html;profile=mcp-app";
const SENTRY_DSN: string = process.env.SENTRY_DSN || "";
const SENTRY_ENABLED: boolean = Boolean(SENTRY_DSN);
const SENTRY_TRACES_SAMPLE_RATE: number = Number(process.env.SENTRY_TRACES_SAMPLE_RATE || 0.1);

type HttpResponse = {
  headersSent: boolean;
  writableEnded: boolean;
  status: (statusCode: number) => { json: (payload: unknown) => void };
  end: () => void;
};

if (SENTRY_ENABLED) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || "development",
    release: process.env.SENTRY_RELEASE,
    tracesSampleRate: SENTRY_TRACES_SAMPLE_RATE
  });
}

function createServer(): McpServer {
  const parkingService = createParkingService(loadSeedData(PROJECT_ROOT));

  const baseServer = new McpServer({
    name: "acme-parking-assistant",
    version: APP_VERSION
  });

  const server = (SENTRY_ENABLED ? Sentry.wrapMcpServerWithSentry(baseServer) : baseServer) as McpServer;

  function readWidgetBundle(): string {
    const bundlePath = path.join(PROJECT_ROOT, "web", "dist", "component.js");

    if (!fs.existsSync(bundlePath)) {
      return "console.warn('Widget bundle missing. Run: npm run build:web');";
    }

    return fs.readFileSync(bundlePath, "utf8");
  }

  function readWidgetStyles(): string {
    const cssPath = path.join(PROJECT_ROOT, "web", "dist", "component.css");
    if (!fs.existsSync(cssPath)) {
      return "";
    }
    return fs.readFileSync(cssPath, "utf8");
  }

  function buildWidgetHtml(): string {
    const widgetJs = readWidgetBundle();
    const widgetCss = readWidgetStyles();
    const mapboxPublicToken = (process.env.MAPBOX_PUBLIC_TOKEN || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');

    return `<!doctype html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>ACME Parking Assistant</title>
        <style>${widgetCss}</style>
      </head>
      <body>
        <div id="root"></div>
        <script>window.__MAPBOX_PUBLIC_TOKEN__="${mapboxPublicToken}";</script>
        <script type="module">${widgetJs}</script>
      </body>
    </html>`;
  }

  server.registerResource(
    "parking-browser-widget",
    RESOURCE_URI,
    {
      title: "ACME Parking Browser Widget",
      description: "Interactive parking browser for ACME employees.",
      mimeType: MIMETYPE
    },
    async () => ({
      contents: [
        {
          uri: RESOURCE_URI,
          mimeType: MIMETYPE,
          text: buildWidgetHtml(),
          _meta: {
            "openai/widgetDescription": "Browse ACME parking options and inspect lot details.",
            "openai/widgetDomain": "https://acme-parking.example.com",
            "openai/widgetCSP": {
              connect_domains: ["https://api.mapbox.com", "https://events.mapbox.com"],
              resource_domains: ["https://api.mapbox.com", "https://res.cloudinary.com"],
              frame_domains: []
            }
          }
        }
      ]
    })
  );

  server.registerTool(
    "search",
    {
      title: "Search parking availability",
      description:
        "Search ACME parking lots for a user request and return the latest authoritative availability for map/list rendering. Convert natural language intent into canonical `filters` whenever possible, and keep `query` as the original user phrasing. Omit unknown filter fields instead of guessing. IMPORTANT: if the user refines criteria after any previous result (date, max/min spots, covered, accessible, EV, lot type, distance, sorting, or nearest alternatives), you MUST call this tool again with updated filters instead of answering from earlier results. Examples that REQUIRE re-calling this tool: 'show only covered', '5 spots or less', 'what about tomorrow', 'closest option', 'exclude EV'. This tool defaults to today if no date is provided by the user and renders the widget from this call.",
      inputSchema: searchInputSchema,
      annotations: {
        readOnlyHint: true,
        openWorldHint: false
      },
      _meta: {
        ui: {
          resourceUri: RESOURCE_URI
        },
        "openai/outputTemplate": RESOURCE_URI,
        "openai/toolInvocation/invoking": "Finding available parking near campus...",
        "openai/toolInvocation/invoked": "Loaded parking options"
      }
    },
    async ({ query, filters }) => {
      const interpretedFilters = filters || {};

      const { date, lots } = parkingService.searchLots(interpretedFilters);
      const results = parkingService.toSearchResults(lots);
      const totalAvailableSpots = lots.reduce((acc, lot) => acc + lot.availableSpots, 0);
      const nearest = lots
        .slice(0, 2)
        .map((lot) => lot.name)
        .join(" and ");

      return {
        structuredContent: {
          date,
          query,
          appliedFilters: interpretedFilters,
          totalMatches: results.length,
          totalAvailableSpots,
          results
        },
        content: textContent(
          lots.length
            ? [
                `Found ${lots.length} parking options near ACME HQ for ${date}, with ${totalAvailableSpots} total spots currently available.`,
                nearest ? `Closest options include ${nearest}.` : "",
                "Use the widget to compare locations, then tell me your preferences (covered, EV charging, accessibility, or max walking distance) and I can refine further."
              ].join("\n")
            : `No parking lots matched "${query}" for ${date}. Try broadening your filter (for example, lower the minimum spots or remove one attribute constraint).`
        )
      };
    }
  );

  return server;
}

const app = createMcpExpressApp({
  host: HOST
});

type McpRequest = IncomingMessage & { auth?: AuthInfo; body?: unknown };

app.post("/mcp", async (req: unknown, res: unknown) => {
  const server = createServer();
  const request = req as McpRequest;
  const response = res as HttpResponse;
  const transport = new StreamableHTTPServerTransport();
  const transportWithClose = Object.assign(transport, { onclose: transport.onclose ?? (() => {}) }) as Transport;

  try {
    await server.connect(transportWithClose);
    await transport.handleRequest(request, response as unknown as ServerResponse, request.body);
  } catch (error) {
    console.error("Error handling MCP request", error);

    if (SENTRY_ENABLED) {
      Sentry.captureException(error);
    }

    if (!response.headersSent) {
      response.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null
      });
    }
  } finally {
    if (!response.writableEnded) {
      response.end();
    }
    transport.close();
    await server.close();
  }
});

app.get("/", (_req: unknown, res: HttpResponse) => {
  res
    .status(200)
    .json({ ok: true, name: "acme-parking-assistant", version: APP_VERSION });
});

app.listen(PORT, HOST, (error?: Error) => {
  if (error) {
    console.error("Failed to start MCP server", error);
    if (SENTRY_ENABLED) {
      Sentry.captureException(error);
    }
    process.exit(1);
  }
  console.log(`ACME parking MCP server listening on http://${HOST}:${PORT}/mcp`);
});
