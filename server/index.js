import "dotenv/config";
import fs from "node:fs";
import path from "node:path";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";

import {
  alternativesInputSchema,
  bookInputSchema,
  fetchInputSchema,
  searchInputSchema,
  textContent
} from "./lib/schemas.js";
import { parseLotFiltersWithSampling } from "./lib/filter-parser.js";
import { createParkingService, loadSeedData } from "./lib/parking-service.js";

const APP_VERSION = "1.0.0";
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";
const RESOURCE_URI = "ui://parking/parking-browser.v2.html";
const PROJECT_ROOT = process.cwd();

function createServer() {
  const parkingService = createParkingService(loadSeedData(PROJECT_ROOT));
  const server = new McpServer({
    name: "acme-parking-assistant",
    version: APP_VERSION
  });

function readWidgetBundle() {
  const bundlePath = path.join(PROJECT_ROOT, "web", "dist", "component.js");
  if (!fs.existsSync(bundlePath)) {
    return "console.warn('Widget bundle missing. Run: npm run build:web');";
  }
  return fs.readFileSync(bundlePath, "utf8");
}

function readWidgetStyles() {
  const cssPath = path.join(PROJECT_ROOT, "web", "dist", "component.css");
  if (!fs.existsSync(cssPath)) {
    return "";
  }
  return fs.readFileSync(cssPath, "utf8");
}

function buildWidgetHtml() {
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
      mimeType: "text/html+skybridge"
    },
    async () => ({
      contents: [
        {
          uri: RESOURCE_URI,
          mimeType: "text/html+skybridge",
          text: buildWidgetHtml(),
          _meta: {
            "openai/widgetDescription": "Browse ACME parking options, inspect lot details, and mock-book a spot.",
            "openai/widgetDomain": "https://acme-parking.example.com",
            "openai/widgetCSP": {
              connect_domains: ["https://api.mapbox.com", "https://events.mapbox.com"],
              resource_domains: ["https://api.mapbox.com"],
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
      "Search ACME parking lots for a user request. Prefer passing canonical filters when possible. This tool defaults to today and renders the widget from this call.",
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
  async ({ query, filters }, extra) => {
    const interpretedFilters = filters || (await parseLotFiltersWithSampling(query, extra));
    const { date, lots } = parkingService.searchLots(interpretedFilters);
    const results = parkingService.toSearchResults(lots);
    const totalAvailable = lots.reduce((acc, lot) => acc + lot.availableSpots, 0);
    const nearest = lots
      .slice(0, 2)
      .map((lot) => lot.name)
      .join(" and ");

    return {
      structuredContent: {
        date,
        query,
        appliedFilters: interpretedFilters,
        campus: parkingService.campus,
        results,
        parkingResults: lots
      },
      content: textContent(
        lots.length
          ? [
              `Found ${lots.length} parking options near ACME HQ for ${date}, with ${totalAvailable} total spots currently available.`,
              nearest ? `Closest options include ${nearest}.` : "",
              "Use the widget to compare locations, then tell me your preferences (covered, EV charging, accessibility, or max walking distance) and I can refine further."
            ].join("\n")
          : `No parking lots matched "${query}" for ${date}. Try broadening your filter (for example, lower the minimum spots or remove one attribute constraint).`
      )
    };
  }
);

  server.registerTool(
  "fetch",
  {
    title: "Fetch parking lot details",
    description: "Fetch detailed information for a specific parking lot.",
    inputSchema: fetchInputSchema,
    annotations: {
      readOnlyHint: true,
      openWorldHint: false
    }
  },
  async ({ id }) => {
    const lot = parkingService.getLotById(id);
    if (!lot) {
      return {
        structuredContent: { error: `Lot ${id} was not found.` },
        content: textContent(`No parking lot found for id "${id}".`)
      };
    }

    const document = parkingService.toFetchDocument(lot);
    return {
      structuredContent: document,
      content: textContent(JSON.stringify(document))
    };
  }
);

  server.registerTool(
  "get_parking_alternatives",
  {
    title: "Get nearest parking alternatives",
    description: "Find nearest alternatives to the currently selected parking lot.",
    inputSchema: alternativesInputSchema,
    annotations: {
      readOnlyHint: true,
      openWorldHint: false
    }
  },
  async ({ lotId, date, maxResults }) => {
    const resolvedDate = parkingService.resolveDateOrToday(date);
    const alternatives = parkingService.getNearestAlternatives(lotId, resolvedDate, maxResults || 3);
    return {
      structuredContent: {
        lotId,
        date: resolvedDate,
        alternatives
      },
      content: textContent(
        alternatives.length
          ? `Found ${alternatives.length} alternatives near ${lotId} for ${resolvedDate}.`
          : `No alternatives found for ${lotId} on ${resolvedDate}.`
      )
    };
  }
);

  server.registerTool(
  "book_parking",
  {
    title: "Mock book parking spot",
    description: "Mock booking action for a parking lot and date without mutating inventory.",
    inputSchema: bookInputSchema,
    annotations: {
      readOnlyHint: false,
      openWorldHint: false,
      destructiveHint: false
    }
  },
  async ({ lotId, date }) => {
    const resolvedDate = parkingService.resolveDateOrToday(date);
    const selectedLot = parkingService.getLotById(lotId, resolvedDate);
    if (!selectedLot) {
      return {
        structuredContent: {
          success: false,
          message: `Lot ${lotId} not found.`,
          lotId,
          date: resolvedDate
        },
        content: textContent(`Unable to mock-book. Lot ${lotId} was not found for ${resolvedDate}.`)
      };
    }

    const confirmationCode = `MOCK-${selectedLot.id}-${resolvedDate.replaceAll("-", "")}`;
    return {
      structuredContent: {
        success: true,
        mock: true,
        lotId: selectedLot.id,
        lotName: selectedLot.name,
        date: resolvedDate,
        confirmationCode
      },
      content: textContent(
        `Mock booking confirmed for ${selectedLot.name} on ${resolvedDate}. Confirmation: ${confirmationCode}.`
      )
    };
  }
  );

  return server;
}

const app = createMcpExpressApp({
  host: HOST
});

app.post("/mcp", async (req, res) => {
  const server = createServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error("Error handling MCP request", error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null
      });
    }
  } finally {
    if (!res.writableEnded) {
      res.end();
    }
    transport.close();
    await server.close();
  }
});

app.get("/health", (_req, res) => {
  res.status(200).json({ ok: true, name: "acme-parking-assistant", version: APP_VERSION });
});

app.listen(PORT, HOST, (error) => {
  if (error) {
    console.error("Failed to start MCP server", error);
    process.exit(1);
  }
  console.log(`ACME parking MCP server listening on http://${HOST}:${PORT}/mcp`);
});
