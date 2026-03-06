# ACME Parking Assistant

ACME Parking Assistant is a ChatGPT app built using OpenAI Apps SDK with a remote MCP server and an embedded React UI for parking search and booking.

## Overview

**- MCP transport:** streamable HTTP at `/mcp`
**- Model capabilities:** `search`, `book_lot`
**- UI surface:** inline map + carousel, fullscreen lot inspection, in-widget booking
**- Data source:** SQLite-backed daily inventory seeded from `server/data/parking-seed.json`
**- External dependencies:** Mapbox for maps, optional Sentry for telemetry

## Local setup

### Prerequisites

- Node.js 20+
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

### 3. Add the app to ChatGPT

In ChatGPT web:

1. Open `Settings → Apps → Advanced settings`
2. Enable developer mode
3. Open `Settings → Apps → Create app`
4. Register the app with values like:

- Name: `Acme`
- Description: `Browse ACME parking options and inspect lot details.`
- URL: `https://<your-public-host>/mcp`
- Authentication: `No auth`

### 4. Test in chat

Open a new chat, type `/acme` and press enter. Then ask for parking availability or refinements.

> [!NOTE]
> If you change the tool schema, tool description, or widget metadata, restart the server and "reconnect" the app in ChatGPT before testing again. You may need to delete the App and create it again if the changes are not reflected and/or restart the ngrok tunnel to get the latest changes without ChatGPT's cache.

## Architecture

### Server

The server is implemented in [server/index.ts] registers:

- two tools: `search`, `book_lot`
- one UI resource: `ui://parking/parking-browser.v4.html`

The search service in [server/lib/parking-service.ts]:
- reads live inventory from SQLite,
- resolves the target date, applies filters, computes distance to HQ
- Returns:
  - `structuredContent` for the widget
  - concise text output for the model transcript

The booking service in [server/lib/booking-service.ts]:
- persists bookings in SQLite
- enforces one booking per `bookingContextId` per date
- decrements availability by incrementing `reserved`
- returns refreshed results for widget-initiated updates

### Widget

The widget entrypoint is [web/src/component.tsx].

The built assets are read from `web/dist` and inlined into the MCP resource response.

The widget:

- reads tool output from `window.openai`
- renders Mapbox markers and a lot carousel inline
- opens a fullscreen inspector view for deeper comparison
- allows booking from the fullscreen inspector
- writes the selected lot back to widget state
- enables widget-triggered bookings

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

## Golden prompt set

Use these prompts to validate the experience quickly:

1. `Help me book parking for Wednesday`
2. `How far is this from HQ?`
3. `Is this covered?`
4. `What’s the nearest alternative if this fills up?`
5. `Show me only covered parking with EV charging.`
6. `Exclude EV charging and keep it within 0.3 miles.`
7. `I need a garage with no more than 2 spots left.`
8. `Find a covered lot with 50 open spaces.`

These cover:

- initial booking intent
- in-chat follow-up questions about a selected lot
- nearest-alternative reasoning after search
- follow-up refinement with a fresh tool call
- date handling
- attribute filters
- max/min availability filters
- no-results behavior

## Current limitations

- chat-triggered bookings are less reliable when they try to replace an active fullscreen widget; the most stable path is still one widget-rendering `search` turn plus widget-originated interaction
- seeded SQLite inventory rather than a live parking system
- no auth, no payment
- no automated tests configured yet, although Sentry is enabled for telemetry
