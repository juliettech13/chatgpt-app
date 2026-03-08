# ACME Parking Assistant

ACME Parking Assistant is a ChatGPT app built using OpenAI Apps SDK with a remote MCP server and an embedded React UI for parking search and booking.

## Get started ⚡️

### Prerequisites

- Node.js 20+
- a Mapbox public token

### Install packages 

```bash
npm install
npm --prefix web install
```

### Configure environment

```bash
cp .env-example .env
```

Add your Mapbox public token or [use mine](https://share.1password.com/s#zDiHS1lTTMuxhOL_3HNg11H6ek2BZQrjp5TiADBmPBU).
Sentry setup is optional. 

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

From your terminal, copy the public HTTPS URL with `/mcp` appended, for example:

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

Open a new chat, type `/acme` and press enter. Then ask for parking availability through the chat.

## Golden prompt set 🏆

Use these prompts to validate the experience quickly:

1. `Help me book parking for Wednesday`
2. `How far is this from HQ?`
3. `Is this covered?`
4. `What’s the nearest alternative if this fills up?`
5. `Show me only covered parking with EV charging.`
6. `Is this lot booked?`
7. `Book this lot.`

These cover:

- initial booking intent
- in-chat follow-up questions about a selected lot
- nearest-alternative reasoning after search
- in-chat originated booking
- booking-aware follow-up questions about the selected lot

## Architecture 🏡

### Server

The server is implemented in `server/index.ts` and registers:

- three tools: `search`, `book_lot`, `refine_widget_results`
- one UI resource: `ui://parking/parking-browser.v4.html`

#### Tools

- `search`
  - chat/composer discovery entrypoint
  - the only widget-producing tool
- `refine_widget_results`
  - widget-only refresh path for fullscreen filters and date changes
  - keeps the mounted fullscreen widget in sync without depending on a fresh chat turn
- `book_lot`
  - mutation tool for booking
  - if done through the widget, booking succeeds first, then the widget refreshes its current filtered view
  - if done through chat, booking succeeds and sends a confirmation message in text

#### Services

1) The search service in `server/lib/parking-service.ts`:
- reads live inventory from SQLite,
- resolves the target date, applies filters, computes distance to HQ
- Returns:
  - `structuredContent` for the widget
  - concise text output for the model transcript

2) The booking service in `server/lib/booking-service.ts`:
- persists bookings in SQLite
- enforces one booking per `bookingContextId` per date
- decrements availability by incrementing `reserved`
- returns refreshed results for widget-initiated updates

### Widget

The widget entrypoint is `web/src/component.tsx`.

The built assets are read from `web/dist` and inlined into the MCP resource response.

#### Functionality

- reads tool output from `window.openai`
- renders Mapbox markers and a carousel inline for lots that match the current search request
- opens a fullscreen inspector view for deeper comparison
- shows a fullscreen-only refinement bar for date, covered, EV, and accessibility filters
- applies fullscreen refinements through `refine_widget_results` to showcase filtered lots
- allows booking from the fullscreen inspector
- handles the selected lot and changes it in the map, carousel, inspector panel, and for chat
- enables widget-triggered bookings
- showcases booking success and error notifications at the fullscreen layout

#### Fullscreen behavior

Fullscreen is the primary browse-and-book surface:

- the left options panel lists lots
- the map shows pins/markers of lots that match the current search request
- the right inspector shows the currently selected lot

## Current limitations 👀

- seeded SQLite inventory rather than a live parking system
- no auth, no payment
- no automated tests configured yet, although Sentry is enabled for telemetry

## Next step: Auth 👩🏻‍💻

![Auth flow](https://res.cloudinary.com/dacofvu8m/image/upload/v1772984113/acme-openai/CleanShot_2026-03-08_at_11.33.49_2x_xd5764.png)
