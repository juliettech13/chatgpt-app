import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";

import { FullscreenLayout } from "./components/FullscreenLayout";
import { MapPanel } from "./components/MapPanel";
import { ParkingCarousel } from "./components/ParkingCarousel";
import { useOpenAiGlobal } from "./lib/use-openai-global";
import { useWidgetProps } from "./lib/use-widget-props";
import type { DisplayMode, SearchStructuredContent } from "./types";

import "./css/component.css";

const DEFAULT_CAMPUS_ADDRESS = "123 Market St, San Francisco, CA";
const DEFAULT_SEARCH_RESULTS: SearchStructuredContent = {
  date: new Date().toISOString().slice(0, 10),
  query: "Parking discovery",
  results: []
};

function normalizeSearchResults(structuredContent?: Partial<SearchStructuredContent>) {
  const results = Array.isArray(structuredContent?.results) ? structuredContent.results : [];

  return {
    date: structuredContent?.date ?? new Date().toISOString().slice(0, 10),
    query: structuredContent?.query ?? "Parking discovery",
    results
  };
}

function App() {
  const hostDisplayMode = useOpenAiGlobal("displayMode", "inline" as DisplayMode);
  const toolProps = useWidgetProps<SearchStructuredContent>(DEFAULT_SEARCH_RESULTS);

  const searchResults = normalizeSearchResults(toolProps);

  const [currentActiveLotId, setCurrentActiveLotId] = useState("");
  const [isInspectorOpen, setInspectorOpen] = useState(true);
  const lastSignatureRef = useRef("");

  useEffect(() => {
    const signatureParts = searchResults.results.map((lot) =>
      [
        lot.id,
        lot.availableSpots,
        lot.capacity,
        lot.reserved,
        lot.attributes.covered,
        lot.attributes.accessible,
        lot.attributes.ev_charging,
        lot.distanceToHQMiles
      ].join(":")
    );
    const signature = `${searchResults.date}|${signatureParts.join("|")}`;

    const dataChanged = signature !== lastSignatureRef.current;

    if (dataChanged) {
      lastSignatureRef.current = signature;
      const preferredLotId = window.openai?.widgetState?.selectedLotId;
      const preferredInResults = preferredLotId != null && searchResults.results.some((lot) => lot.id === preferredLotId);
      setCurrentActiveLotId(preferredInResults ? preferredLotId : (searchResults.results[0]?.id ?? ""));
    }
    if (hostDisplayMode === "fullscreen" && searchResults.results.length) {
      setInspectorOpen(true);
    }
  }, [hostDisplayMode, searchResults]);

  const selectedLot = searchResults.results.find((lot) => lot.id === currentActiveLotId) || searchResults.results[0];

  const isFullscreen = hostDisplayMode === "fullscreen" && Boolean(selectedLot);

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

  useEffect(() => {
    if (!currentActiveLotId) return;

    syncContext(currentActiveLotId);
  }, [currentActiveLotId, searchResults.date, searchResults.results]);

  async function openFullscreen(lotId: string) {
    if (lotId !== currentActiveLotId) setCurrentActiveLotId(lotId);
    setInspectorOpen(true);
    syncContext(lotId);

    await window.openai?.requestDisplayMode?.({ mode: "fullscreen" });
  }

  function handleFullscreenSelectLot(lotId: string) {
    setCurrentActiveLotId(lotId);
    setInspectorOpen(true);
    syncContext(lotId);
  }

  async function handleMapMarkerActivate(lotId: string) {
    if (hostDisplayMode === "fullscreen") {
      handleFullscreenSelectLot(lotId);
      return;
    }

    await openFullscreen(lotId);
  }

  const activeLotId = selectedLot?.id || "";

  return (
    <main className="app-shell">
      <section className={`app-view ${isFullscreen ? "app-view--fullscreen" : "app-view--inline"}`}>
        <MapPanel
          lots={searchResults.results}
          activeLotId={activeLotId}
          mode={isFullscreen ? "fullscreen" : "inline"}
          onMarkerActivate={handleMapMarkerActivate}
          className="app-view__map"
        />

        {isFullscreen && selectedLot ? (
          <FullscreenLayout
            lots={searchResults.results}
            activeLotId={selectedLot.id}
            onSelectLot={handleFullscreenSelectLot}
            campusAddress={DEFAULT_CAMPUS_ADDRESS}
            isInspectorOpen={isInspectorOpen}
            onCloseInspector={() => setInspectorOpen(false)}
          />
        ) : searchResults.results.length ? (
          <ParkingCarousel
            lots={searchResults.results}
            activeLotId={activeLotId}
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
