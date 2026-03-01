import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { FullscreenLayout } from "./components/FullscreenLayout";
import { ParkingCarousel } from "./components/ParkingCarousel";
import type { ParkingLot, ToolOutput, WidgetState } from "./types";
import "./css/component.css";

type OpenAIBridge = {
  toolOutput?: Partial<ToolOutput> & { parkingResults?: ParkingLot[] };
  widgetState?: WidgetState;
  requestDisplayMode?: (params: { mode: "inline" | "fullscreen" }) => Promise<{ mode: "inline" | "fullscreen" }>;
  setWidgetState?: (state: WidgetState & Record<string, unknown>) => void;
  callTool?: (name: string, args: Record<string, unknown>) => Promise<{
    structuredContent?: Record<string, unknown>;
    content?: Array<{ type: string; text?: string }>;
  }>;
  sendFollowUpMessage?: (params: { text: string }) => void;
  updateModelContext?: (payload: Record<string, unknown>) => Promise<void>;
};

declare global {
  interface Window {
    openai?: OpenAIBridge;
  }
}

function normalizeOutput(toolOutput?: Partial<ToolOutput> & { parkingResults?: ParkingLot[] }): ToolOutput {
  const lots = toolOutput?.lots?.length ? toolOutput.lots : toolOutput?.parkingResults || [];
  return {
    date: toolOutput?.date || new Date().toISOString().slice(0, 10),
    query: toolOutput?.query || "Parking discovery",
    campus: toolOutput?.campus || {
      id: "acme_hq",
      name: "ACME Corp HQ",
      address: "123 Market St, San Francisco, CA",
      location: { lat: 37.789887, lng: -122.401075 }
    },
    lots,
    policy: toolOutput?.policy
  };
}

function App() {
  const bridge = window.openai;
  const [output, setOutput] = useState(() => normalizeOutput(window.openai?.toolOutput));
  const initialState = window.openai?.widgetState || {};
  const initialLotId = initialState.selectedLotId || output.lots[0]?.id || "";

  const [selectedLotId, setSelectedLotId] = useState(initialLotId);
  const [displayMode, setDisplayMode] = useState<"inline" | "fullscreen">(initialState.displayMode || "inline");
  const [bookingMessage, setBookingMessage] = useState<string | null>(null);

  useEffect(() => {
    const syncFromBridge = () => {
      setOutput(normalizeOutput(window.openai?.toolOutput));
    };

    const onMessage = (event: MessageEvent) => {
      const method = event?.data?.method;
      if (method === "ui/initialize" || method === "ui/notifications/tool-result") {
        syncFromBridge();
      }
    };

    syncFromBridge();
    window.addEventListener("message", onMessage);
    const intervalId = window.setInterval(syncFromBridge, 500);

    return () => {
      window.removeEventListener("message", onMessage);
      window.clearInterval(intervalId);
    };
  }, []);

  const selectedLot = output.lots.find((lot) => lot.id === selectedLotId) || output.lots[0];

  function syncContext(nextLotId: string, nextDisplayMode: "inline" | "fullscreen") {
    const lot = output.lots.find((item) => item.id === nextLotId);
    if (!lot) {
      return;
    }
    const nextState = {
      selectedLotId: nextLotId,
      selectedDate: output.date,
      displayMode: nextDisplayMode,
      selectedLotName: lot.name,
      covered: lot.attributes.covered,
      accessible: lot.attributes.accessible,
      distanceToHQMeters: lot.distanceToHQMeters,
      availableSpots: lot.availableSpots
    };
    bridge?.setWidgetState?.(nextState);
    bridge?.updateModelContext?.({
      selectedLotId: nextLotId,
      selectedDate: output.date,
      selectedLot: {
        id: lot.id,
        name: lot.name,
        covered: lot.attributes.covered,
        accessible: lot.attributes.accessible,
        distanceToHQMeters: lot.distanceToHQMeters,
        availableSpots: lot.availableSpots
      }
    });
  }

  async function openFullscreen(lotId = selectedLotId) {
    if (lotId !== selectedLotId) {
      setSelectedLotId(lotId);
    }
    setDisplayMode("fullscreen");
    syncContext(lotId, "fullscreen");
    await bridge?.requestDisplayMode?.({ mode: "fullscreen" });
  }

  function handleSelectLot(lotId: string) {
    setSelectedLotId(lotId);
    syncContext(lotId, displayMode);
  }

  async function handleMockBook(lot: ParkingLot) {
    if (!bridge?.callTool) {
      setBookingMessage(`Mock booking requested for ${lot.name}.`);
      return;
    }
    const response = await bridge.callTool("book_parking", {
      lotId: lot.id,
      date: output.date
    });
    const message =
      response?.content?.find((item) => item.type === "text")?.text ||
      `Mock booking confirmed for ${lot.name} on ${output.date}.`;
    setBookingMessage(message);
    bridge?.sendFollowUpMessage?.({ text: message });
  }

  if (!output.lots.length) {
    return (
      <main className="app-shell">
        <p>No parking lots were provided to this widget yet.</p>
      </main>
    );
  }

  return (
    <main className="app-shell">
      {displayMode === "fullscreen" && selectedLot ? (
        <FullscreenLayout
          lots={output.lots}
          selectedLotId={selectedLot.id}
          onSelectLot={handleSelectLot}
          onBook={handleMockBook}
          bookingMessage={bookingMessage}
          campusAddress={output.campus.address}
        />
      ) : (
        <ParkingCarousel
          lots={output.lots}
          selectedLotId={selectedLot?.id || output.lots[0].id}
          onSelectLot={handleSelectLot}
          onOpenFullscreen={openFullscreen}
        />
      )}
    </main>
  );
}

const rootElement = document.getElementById("root");
if (rootElement) {
  createRoot(rootElement).render(<App />);
}
