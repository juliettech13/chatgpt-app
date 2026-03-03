import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";

import { FullscreenLayout } from "./components/FullscreenLayout";
import { MapPanel } from "./components/MapPanel";
import { ParkingCarousel } from "./components/ParkingCarousel";
import type { DisplayMode, ParkingLot, SearchStructuredContent, WidgetState } from "./types";

import "./css/component.css";
import "./css/parking-lot-card.css";

const DEFAULT_CAMPUS_ADDRESS = "123 Market St, San Francisco, CA";

type OpenAiGlobals = {
  displayMode?: DisplayMode;
  toolOutput?: { structuredContent?: Partial<SearchStructuredContent> } | Partial<SearchStructuredContent>;
  widgetState?: WidgetState;
};

type OpenAIApi = {
  requestDisplayMode?: (params: { mode: DisplayMode }) => Promise<{ mode: DisplayMode }>;
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
    openai?: OpenAiGlobals & OpenAIApi;
  }
}

function extractStructuredContentFromHost(
  value: { structuredContent?: Partial<SearchStructuredContent> } | Partial<SearchStructuredContent> | undefined
): Partial<SearchStructuredContent> | undefined {
  if (!value || typeof value !== "object") return undefined;

  if ("structuredContent" in value) return value.structuredContent;

  return value as Partial<SearchStructuredContent>;
}

function normalizeSearchResults(structuredContent?: Partial<SearchStructuredContent>) {
  const results = Array.isArray(structuredContent?.results) ? structuredContent.results : [];

  return {
    date: structuredContent?.date ?? new Date().toISOString().slice(0, 10),
    query: structuredContent?.query ?? "Parking discovery",
    results
  };
}

function App() {
  const [searchResults, setSearchResults] = useState(() => normalizeSearchResults());
  const [selectedLotId, setSelectedLotId] = useState("");
  const [displayMode, setDisplayMode] = useState("inline" as DisplayMode);
  const [bookingMessage, setBookingMessage] = useState(null as string | null);
  const [isSubmittingBooking, setIsSubmittingBooking] = useState(false);
  const [isInspectorOpen, setInspectorOpen] = useState(true);
  const hasAppliedRef = useRef(false);
  const lastSignatureRef = useRef("");

  useEffect(() => {
    function getResultsSignature(content: Partial<SearchStructuredContent>) {
      const ids = Array.isArray(content.results) ? content.results.map((result) => result.id).join(",") : "";
      return `${content.date || ""}|${ids}`;
    }

    function applyResults(content: Partial<SearchStructuredContent> | undefined, mode: "initialize" | "tool-result") {
      if (!content || !Array.isArray(content.results)) return;

      const next = normalizeSearchResults(content);
      const signature = getResultsSignature(next);
      if (signature === lastSignatureRef.current) return;

      lastSignatureRef.current = signature;
      setSearchResults(next);
      if (mode === "initialize" && !hasAppliedRef.current) {
        const preferredLotId = window.openai?.widgetState?.selectedLotId;
        if (preferredLotId && next.results.some((lot) => lot.id === preferredLotId)) {
          setSelectedLotId(preferredLotId);
        } else {
          setSelectedLotId(next.results[0]?.id ?? "");
        }
      } else {
        setSelectedLotId(next.results[0]?.id ?? "");
      }
      hasAppliedRef.current = true;
    }

    function syncFromHost(mode: "initialize" | "tool-result") {
      const hostOutput = extractStructuredContentFromHost(window.openai?.toolOutput);
      applyResults(hostOutput, mode);
    }

    const hostMode = window.openai?.displayMode;
    if (hostMode === "inline" || hostMode === "fullscreen") {
      setDisplayMode(hostMode);
    }

    syncFromHost("initialize");

    function onSetGlobals() {
      const nextMode = window.openai?.displayMode;
      if (nextMode === "inline" || nextMode === "fullscreen") {
        setDisplayMode(nextMode);
      }
      syncFromHost(hasAppliedRef.current ? "tool-result" : "initialize");
    }

    window.addEventListener("openai:set_globals", onSetGlobals, { passive: true });

    return () => {
      window.removeEventListener("openai:set_globals", onSetGlobals);
    };
  }, []);

  const selectedLot = searchResults.results.find((lot) => lot.id === selectedLotId) || searchResults.results[0];
  const isFullscreen = displayMode === "fullscreen" && Boolean(selectedLot);

  function syncContext(nextLotId: string) {
    const lot = searchResults.results.find((item) => item.id === nextLotId);
    if (!lot) return;

    window.openai?.setWidgetState?.({
      selectedLotId: nextLotId
    });
    window.openai?.updateModelContext?.({
      selectedLotId: nextLotId,
      selectedDate: searchResults.date,
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

  async function openFullscreen(lotId: string) {
    if (lotId !== selectedLotId) setSelectedLotId(lotId);
    setInspectorOpen(true);
    setDisplayMode("fullscreen");
    syncContext(lotId);

    await window.openai?.requestDisplayMode?.({ mode: "fullscreen" });
  }

  function handleFullscreenSelectLot(lotId: string) {
    setSelectedLotId(lotId);
    setInspectorOpen(true);
    syncContext(lotId);
  }

  async function handleMapMarkerActivate(lotId: string) {
    if (displayMode === "fullscreen") {
      handleFullscreenSelectLot(lotId);
      return;
    }

    await openFullscreen(lotId);
  }

  async function handleMockBook(lot: ParkingLot) {
    if (isSubmittingBooking) return;

    setIsSubmittingBooking(true);
    if (!window.openai?.callTool) {
      setBookingMessage(`Mock booking requested for ${lot.name}.`);
      setIsSubmittingBooking(false);
      return;
    }

    try {
      const response = await window.openai.callTool("book_parking", {
        lotId: lot.id,
        date: searchResults.date
      });
      const message =
        response?.content?.find((item) => item.type === "text")?.text ||
        `Mock booking confirmed for ${lot.name} on ${searchResults.date}.`;
      setBookingMessage(message);
      window.openai?.sendFollowUpMessage?.({ text: message });
    } finally {
      setIsSubmittingBooking(false);
    }
  }

  const activeLotId = selectedLot?.id || "";

  return (
    <main className="app-shell">
      <section className={`app-view ${isFullscreen ? "app-view--fullscreen" : "app-view--inline"}`}>
        <MapPanel
          lots={searchResults.results}
          selectedLotId={activeLotId}
          mode={isFullscreen ? "fullscreen" : "inline"}
          onMarkerActivate={handleMapMarkerActivate}
          className="app-view__map"
        />

        {isFullscreen && selectedLot ? (
          <FullscreenLayout
            lots={searchResults.results}
            selectedLotId={selectedLot.id}
            onSelectLot={handleFullscreenSelectLot}
            onBook={handleMockBook}
            bookingMessage={bookingMessage}
            campusAddress={DEFAULT_CAMPUS_ADDRESS}
            isSubmittingBooking={isSubmittingBooking}
            isInspectorOpen={isInspectorOpen}
            onCloseInspector={() => setInspectorOpen(false)}
          />
        ) : searchResults.results.length ? (
          <ParkingCarousel
            lots={searchResults.results}
            selectedLotId={activeLotId}
            onOpenFullscreen={openFullscreen}
          />
        ) : null}
      </section>
    </main>
  );
}

const rootElement = document.getElementById("root");
if (rootElement) {
  createRoot(rootElement).render(<App />);
}
