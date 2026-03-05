# ACME Parking Assistant

ACME Parking Assistant is a ChatGPT app built on the Apps SDK with a remote MCP server and an embedded React widget.

## Overview

**- MCP transport:** streamable HTTP at `/mcp`
**- Model capability:** `search`
**- UI surface:** inline map + carousel, fullscreen lot inspection
**- Data source:** local seed inventory in `server/data/parking-seed.json`
**- External dependencies:** Mapbox for maps, optional Sentry for telemetry

## Architecture

### Server

The server is implemented in [server/index.ts](/Users/juliettech.eth/code/juliettech13/acme/server/index.ts). It registers:

- one tool: `search`
- one UI resource: `ui://parking/parking-browser.v4.html`

The tool accepts a natural-language query plus optional canonical filters defined in [server/lib/schemas.ts](/Users/juliettech.eth/code/juliettech13/acme/server/lib/schemas.ts).

The search service in [server/lib/parking-service.ts](/Users/juliettech.eth/code/juliettech13/acme/server/lib/parking-service.ts) loads seed inventory, resolves the target date, applies filters, computes distance to HQ, and returns:
- `structuredContent` for the widget
- concise text output for the model transcript

### Widget

The widget entrypoint is [web/src/component.tsx](/Users/juliettech.eth/code/juliettech13/acme/web/src/component.tsx).

The built assets are read from `web/dist` and inlined into the MCP resource response.

The widget:

- reads tool output from `window.openai`
- renders Mapbox markers and a lot carousel inline
- opens a fullscreen inspector view for deeper comparison
- writes the selected lot back to widget state and model context

## Repository layout

```text
server/
  index.ts
  lib/parking-service.ts
  lib/schemas.ts
  data/parking-seed.json
web/
  src/component.tsx
  src/components/*
  src/lib/*
```

## Local setup

### Prerequisites

- Node.js 20+
- npm
- a Mapbox public token

### Install

```bash
npm install
npm --prefix web install
```

### Configure environment

```bash
cp .env-example .env
```

Required:

```bash
PORT=3000
HOST=0.0.0.0
MAPBOX_PUBLIC_TOKEN=pk.your-mapbox-public-token
```

Optional:

```bash
SENTRY_DSN=
SENTRY_ENVIRONMENT=development
SENTRY_RELEASE=
SENTRY_TRACES_SAMPLE_RATE=0.1
```

## Run locally

> [!IMPORTANT]
> Build the widget before starting the server. The MCP resource served to ChatGPT inlines `web/dist/component.js` and `web/dist/component.css`.

```bash
npm run build:web
npm run dev
```

Useful endpoints:

- `GET /` health/status
- `POST /mcp` MCP endpoint

## Connect to ChatGPT in developer mode

For local development, run the app locally and expose it through a tunnel using a tool like ngrok.

### 1. Start the local server

```bash
npm run build:server
npm run build:web
npm run dev
```

### 2. Create an HTTPS tunnel in another terminal

Example with ngrok:

```bash
ngrok http 3000
```

Use the public HTTPS URL with `/mcp` appended, for example:

```text
https://abc123.ngrok.app/mcp
```

### 3. Add the connector in ChatGPT

In ChatGPT web:

1. Open `Settings → Apps → Advanced settings`
2. Enable developer mode
3. Open `Settings → Apps → Create app`
4. Register the app with values like:

- Name: `Acme Parking Assistant`
- Description: `Browse ACME parking options and inspect lot details.`
- URL: `https://<your-public-host>/mcp`
- Authentication: `No auth`

### 4. Test in chat

Open a new chat, type `/acme-parking-assistant` and press enter. Then ask for parking availability or refinements.

> [!NOTE]
> If you change the tool schema, tool description, or widget metadata, restart the server and "reconnect" the app in ChatGPT before testing again. You may need to delete the App and create it again if the changes are not reflected and/or restart the ngrok tunnel.

## Debugging

Use MCP Inspector before ChatGPT if you want protocol-level validation:

```bash
npx @modelcontextprotocol/inspector@latest
```

Target:

```text
http://127.0.0.1:3000/mcp
```

Check that:

- `search` is registered
- the input schema matches the intended filters
- `structuredContent` contains `date`, `query`, and `results`
- the widget loads without runtime errors

## Golden prompt set

Use these prompts to validate the experience quickly:

1. `Find parking near ACME HQ for today.`
2. `Show me only covered parking with EV charging.`
3. `What is the closest accessible option with at least 5 spots tomorrow?`
4. `Exclude EV charging and keep it within 0.3 miles.`
5. `I need a garage with no more than 2 spots left.`
6. `Find a covered lot with 50 open spaces.`

These cover:

- initial tool invocation
- follow-up refinement with a fresh tool call
- date handling
- attribute filters
- max/min availability filters
- no-results behavior

## Current limitations

- read-only search experience; no booking workflow yet
- seed-data-backed rather than connected to a live parking system
- no auth, no payment
- no automated tests configured yet
