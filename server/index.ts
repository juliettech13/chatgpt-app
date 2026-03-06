import "dotenv/config";
import fs from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";
import { randomUUID } from "node:crypto";
import * as Sentry from "@sentry/node";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";

import {
  bookLotInputSchema,
  searchInputSchema,
  textContent
} from "./lib/schemas.js";
import { createParkingService } from "./lib/parking-service.js";
import { createDatabase } from "./lib/database.js";
import { createBookingService } from "./lib/booking-service.js";

const APP_VERSION: string = "1.0.0";
const PORT: number = Number(process.env.PORT || 3000);
const HOST: string = process.env.HOST || "0.0.0.0";
const RESOURCE_URI: string = "ui://parking/parking-browser.v4.html";
const PROJECT_ROOT: string = process.cwd();
const MIMETYPE: string = "text/html+skybridge";
const SENTRY_DSN: string = process.env.SENTRY_DSN || "";
const SENTRY_ENABLED: boolean = Boolean(SENTRY_DSN);
const SENTRY_TRACES_SAMPLE_RATE: number = Number(process.env.SENTRY_TRACES_SAMPLE_RATE || 0.1);

type HttpResponse = {
  headersSent: boolean;
  writableEnded: boolean;
  setHeader: (name: string, value: string) => void;
  status: (statusCode: number) => { json: (payload: unknown) => void };
  sendStatus: (statusCode: number) => void;
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

const database = createDatabase(PROJECT_ROOT);
const bookingService = createBookingService(database);
const parkingService = createParkingService(database, bookingService.getBookingForDate);

function createServer(): McpServer {
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
        "Search ACME parking lots for a user request and return the latest authoritative availability for map/list rendering. This is the required tool for any request to find, browse, compare, refresh, or re-check parking availability. Convert natural language intent into canonical `filters` whenever possible, and keep `query` as the original user phrasing. Omit unknown filter fields instead of guessing. For booking requests, call this tool first, show the available options, and ask the user which lot they want before calling `book_lot`. Never auto-book a lot without explicit user confirmation. After any successful chat-triggered `book_lot`, call this tool again with the same bookingContextId and date so the parking browser refreshes. If the user asks to change, narrow, widen, sort, compare, or refresh the list of lots in any way, you MUST call this tool again with updated filters instead of answering from earlier results. This includes requests like covered only, EV only, covered plus EV, accessible only, nearest option, nearest alternative, max distance, minimum spots, maximum spots, tomorrow, Wednesday, Friday, and any request about which lots should be shown next. Do NOT manually filter or summarize prior results in prose when the user is asking for a new filtered or refreshed view. Do NOT answer availability questions from stale prior results. This tool defaults to today if no date is provided by the user and renders the parking widget.",
      inputSchema: searchInputSchema,
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
      },
      _meta: {
        ui: {
          resourceUri: RESOURCE_URI,
        },
        "openai/outputTemplate": RESOURCE_URI,
        "openai/toolInvocation/invoking":
          "Finding available parking near campus...",
        "openai/toolInvocation/invoked": "Loaded parking options",
      },
    },
    async ({ query, bookingContextId, filters }) => {
      const resolvedBookingContextId = bookingContextId || randomUUID();
      const interpretedFilters = filters || {};

      const { date, lots, booking } = parkingService.searchLots(
        resolvedBookingContextId,
        interpretedFilters,
      );
      const results = parkingService.toSearchResults(lots);
      const totalAvailableSpots = lots.reduce(
        (acc, lot) => acc + lot.availableSpots,
        0,
      );
      const nearest = lots
        .slice(0, 2)
        .map((lot) => lot.name)
        .join(" and ");

      return {
        structuredContent: {
          date,
          query,
          bookingContextId: resolvedBookingContextId,
          booking,
          appliedFilters: interpretedFilters,
          totalMatches: results.length,
          totalAvailableSpots,
          results,
        },
        content: textContent(
          lots.length
            ? [
                `Found ${lots.length} parking options near ACME HQ for ${date}, with ${totalAvailableSpots} total spots currently available.`,
                nearest ? `Closest options include ${nearest}.` : "",
                booking
                  ? `You already have ${booking.lotName} booked for ${date} with confirmation ID ${booking.confirmationId}.`
                  : "Use the widget to compare locations, then tell me your preferences (covered, EV charging, accessibility, or max walking distance) and I can refine further.",
              ].join("\n")
            : `No parking lots matched "${query}" for ${date}. Try broadening your filter (for example, lower the minimum spots or remove one attribute constraint).`,
        ),
        _meta: {
          "openai/outputTemplate": RESOURCE_URI
        },
      };
    },
  );

  server.registerTool(
    "book_lot",
    {
      title: "Book a parking lot",
      description:
        "Book exactly one parking space in a selected ACME parking lot for a specific date after the user explicitly chooses a lot. This tool updates the live inventory immediately, enforces one booking per booking context per date, and returns refreshed structured data for widget-initiated updates. If this tool is called from chat, after a successful booking you should call `search` again with the same bookingContextId and date so the parking widget rerenders through the normal search path. Do NOT offer to change the date or lot after the booking is confirmed.",
      inputSchema: bookLotInputSchema,
      annotations: {
        readOnlyHint: false,
        openWorldHint: false
      },
      _meta: {
        ui: {
          resourceUri: RESOURCE_URI
        },
        "openai/widgetAccessible": true,
        "openai/toolInvocation/invoking": "Booking your parking spot...",
        "openai/toolInvocation/invoked": "Parking spot booked"
      }
    },
    async ({ bookingContextId, lotId, date, query }) => {
      try {
        const booking = bookingService.bookLot({ bookingContextId, lotId, date });
        const { lots } = parkingService.searchLots(bookingContextId, { date });
        const results = parkingService.toSearchResults(lots);
        const totalAvailableSpots = lots.reduce((acc, lot) => acc + lot.availableSpots, 0);

        return {
          structuredContent: {
            date,
            query: query || `Booking for ${date}`,
            bookingContextId,
            booking,
            totalMatches: results.length,
            totalAvailableSpots,
            results
          },
          content: textContent(
            `Booked ${booking.lotName} for ${date}. Confirmation ID: ${booking.confirmationId}.`
          ),
        };
      } catch (error) {
        return {
          isError: true,
          content: textContent(
            error instanceof Error ? error.message : "Failed to book the selected lot."
          )
        };
      }
    }
  );

  return server;
}

const app = createMcpExpressApp({
  host: HOST
});

type McpRequest = IncomingMessage & { auth?: AuthInfo; body?: unknown };

app.options("/mcp", (_req: unknown, res: unknown) => {
  const response = res as HttpResponse;
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "POST, GET, DELETE, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "content-type, mcp-session-id");
  response.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id");
  response.sendStatus(204);
});

app.all("/mcp", async (req: unknown, res: unknown) => {
  const request = req as McpRequest;
  const response = res as HttpResponse;

  if (!request.method || !["POST", "GET", "DELETE"].includes(request.method)) {
    response.status(405).json({
      jsonrpc: "2.0",
      error: { code: -32601, message: "Method not allowed" },
      id: null
    });
    return;
  }

  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id");

  const server = createServer();
  const transport = new StreamableHTTPServerTransport({
    enableJsonResponse: true
  } as ConstructorParameters<typeof StreamableHTTPServerTransport>[0]);
  const transportWithClose = Object.assign(transport, {
    onclose: transport.onclose ?? (() => {})
  }) as Transport;

  let cleanedUp = false;

  async function cleanup() {
    if (cleanedUp) return;
    cleanedUp = true;
    await transport.close();
    await server.close();
  }

  const nodeResponse = response as unknown as ServerResponse;

  nodeResponse.on("close", () => {
    void cleanup();
  });

  try {
    await server.connect(transportWithClose);
    await transport.handleRequest(request, nodeResponse, request.body);
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
    await cleanup();
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
