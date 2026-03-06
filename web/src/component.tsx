import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";

import { FullscreenLayout } from "./components/FullscreenLayout";
import { MapPanel } from "./components/MapPanel";
import { ParkingCarousel } from "./components/ParkingCarousel";
import { useOpenAiGlobal } from "./lib/use-openai-global";
import { useWidgetProps } from "./lib/use-widget-props";
import type { DisplayMode, SearchStructuredContent, ToolCallResult } from "./types";

import "./css/component.css";

const DEFAULT_CAMPUS_ADDRESS = "123 Market St, San Francisco, CA";
const DEFAULT_SEARCH_RESULTS: SearchStructuredContent = {
  date: new Date().toISOString().slice(0, 10),
  query: "Parking discovery",
  bookingContextId: "",
  currentDateBooking: null,
  results: []
};

function normalizeSearchResults(structuredContent?: Partial<SearchStructuredContent>) {
  const results = Array.isArray(structuredContent?.results) ? structuredContent.results : [];

  return {
    date: structuredContent?.date ?? new Date().toISOString().slice(0, 10),
    query: structuredContent?.query ?? "Parking discovery",
    bookingContextId: structuredContent?.bookingContextId ?? "",
    currentDateBooking: structuredContent?.currentDateBooking ?? null,
    appliedFilters: structuredContent?.appliedFilters,
    totalMatches: structuredContent?.totalMatches,
    totalAvailableSpots: structuredContent?.totalAvailableSpots,
    results
  };
}

function extractResultText(result?: ToolCallResult): string {
  if (!Array.isArray(result?.content)) return "";

  return result.content
    .map((item) => item.text || "")
    .filter(Boolean)
    .join("\n")
    .trim();
}

function App() {
  const hostDisplayMode = useOpenAiGlobal("displayMode", "inline" as DisplayMode);
  const toolProps = useWidgetProps<SearchStructuredContent>(DEFAULT_SEARCH_RESULTS);
  const [searchResults, setSearchResults] = useState(() => normalizeSearchResults(toolProps));
  const [currentActiveLotId, setCurrentActiveLotId] = useState("");
  const [isInspectorOpen, setInspectorOpen] = useState(true);
  const [isBooking, setIsBooking] = useState(false);
  const [bannerMessage, setBannerMessage] = useState(null as string | null);
  const [bannerTone, setBannerTone] = useState("success" as "success" | "error");
  const [pendingBookingSync, setPendingBookingSync] = useState(null as null | {
    bookingContextId: string;
    date: string;
    confirmationId: string;
  });
  const lastSignatureRef = useRef("");
  const lastConfirmationIdRef = useRef("");

  useEffect(() => {
    const nextResults = normalizeSearchResults(toolProps);
    const hasHostResults = nextResults.results.length > 0 || Boolean(nextResults.bookingContextId);

    if (!hasHostResults) return;

    if (pendingBookingSync) {
      const isSamePendingBookingDay =
        nextResults.bookingContextId === pendingBookingSync.bookingContextId &&
        nextResults.date === pendingBookingSync.date;

      if (isSamePendingBookingDay) {
        const hostConfirmationId = nextResults.currentDateBooking?.confirmationId;
        if (hostConfirmationId !== pendingBookingSync.confirmationId) {
          return;
        }
      }

      setPendingBookingSync(null);
    }

    setSearchResults(nextResults);
  }, [toolProps, pendingBookingSync]);

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

    const currentWidgetState = window.openai?.widgetState;
    const nextWidgetState = {
      selectedLotId: nextLotId,
      selectedDate: searchResults.date,
      bookingContextId: searchResults.bookingContextId,
      currentDateBooking: searchResults.currentDateBooking,
      selectedLot: {
        id: lot.id,
        name: lot.name,
        covered: lot.attributes.covered,
        accessible: lot.attributes.accessible,
        distanceToHQMeters: lot.distanceToHQMeters,
        availableSpots: lot.availableSpots
      }
    };

    const isUnchanged =
      currentWidgetState?.selectedLotId === nextWidgetState.selectedLotId &&
      currentWidgetState?.selectedDate === nextWidgetState.selectedDate &&
      currentWidgetState?.bookingContextId === nextWidgetState.bookingContextId &&
      currentWidgetState?.currentDateBooking?.confirmationId === nextWidgetState.currentDateBooking?.confirmationId &&
      currentWidgetState?.selectedLot?.id === nextWidgetState.selectedLot.id &&
      currentWidgetState?.selectedLot?.availableSpots === nextWidgetState.selectedLot.availableSpots;

    if (isUnchanged) {
      return;
    }

    window.openai?.setWidgetState?.(nextWidgetState);
  }

  useEffect(() => {
    const confirmationId = searchResults.currentDateBooking?.confirmationId || "";

    if (confirmationId && confirmationId !== lastConfirmationIdRef.current) {
      lastConfirmationIdRef.current = confirmationId;
      setBannerTone("success");
      setBannerMessage(
        `Booked ${searchResults.currentDateBooking?.lotName} for ${searchResults.date}. Confirmation ID: ${confirmationId}.`
      );
      return;
    }

    if (!confirmationId) {
      lastConfirmationIdRef.current = "";
      setBannerMessage((current) => (bannerTone === "success" ? null : current));
    }
  }, [searchResults.currentDateBooking, searchResults.date, bannerTone]);

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

  async function handleBookLot(lotId: string) {
    if (!searchResults.bookingContextId) {
      setBannerTone("error");
      setBannerMessage("Missing booking context. Run a new search and try again.");
      return;
    }

    setIsBooking(true);
    setBannerMessage(null);

    try {
      const result = await window.openai?.callTool?.("book_lot", {
        bookingContextId: searchResults.bookingContextId,
        lotId,
        date: searchResults.date,
        query: searchResults.query
      });

      if (!result) {
        throw new Error("No response received from the booking tool.");
      }

      if (result.isError) {
        throw new Error(extractResultText(result) || "Failed to book the selected lot.");
      }

      const nextResults = normalizeSearchResults(result.structuredContent);
      setSearchResults(nextResults);
      if (nextResults.currentDateBooking) {
        setPendingBookingSync({
          bookingContextId: nextResults.bookingContextId,
          date: nextResults.date,
          confirmationId: nextResults.currentDateBooking.confirmationId
        });
      }
      setBannerTone("success");
      setBannerMessage(
        nextResults.currentDateBooking
          ? `Booked ${nextResults.currentDateBooking.lotName} for ${nextResults.date}. Confirmation ID: ${nextResults.currentDateBooking.confirmationId}.`
          : "Parking spot booked."
      );
    } catch (error) {
      setBannerTone("error");
      setBannerMessage(error instanceof Error ? error.message : "Failed to book the selected lot.");
    } finally {
      setIsBooking(false);
    }
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
            currentDateBooking={searchResults.currentDateBooking}
            isBooking={isBooking}
            bannerMessage={bannerMessage}
            bannerTone={bannerTone}
            onBookLot={handleBookLot}
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
