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
  booking: null,
  results: []
};

function normalizeSearchResults(structuredContent?: Partial<SearchStructuredContent>) {
  const results = Array.isArray(structuredContent?.results) ? structuredContent.results : [];

  return {
    date: structuredContent?.date ?? new Date().toISOString().slice(0, 10),
    query: structuredContent?.query ?? "Parking discovery",
    bookingContextId: structuredContent?.bookingContextId ?? "",
    booking: structuredContent?.booking ?? null,
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

function getResultsSnapshot(searchResults: SearchStructuredContent): string {
  const lotSnapshot = searchResults.results
    .map((lot) => `${lot.id}:${lot.availableSpots}:${lot.reserved}`)
    .join("|");

  return [
    searchResults.date,
    searchResults.query,
    searchResults.bookingContextId,
    searchResults.booking?.confirmationId || "",
    lotSnapshot
  ].join("::");
}

function resolveActiveLotId(
  searchResults: SearchStructuredContent,
  currentActiveLotId: string
) {
  if (searchResults.results.some((lot) => lot.id === currentActiveLotId)) {
    return currentActiveLotId;
  }
  const { selectedLotId, selectedDate, bookingContextId } = window.openai?.widgetState ?? {};

  const useWidget =
    selectedLotId != null &&
    selectedDate === searchResults.date &&
    bookingContextId === searchResults.bookingContextId &&
    searchResults.results.some((lot) => lot.id === selectedLotId);

  return useWidget ? selectedLotId : (searchResults.results[0]?.id ?? "");
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

  const lastConfirmationIdRef = useRef("");

  useEffect(() => {
    const updatedSearchResults = normalizeSearchResults(toolProps);
    const hasHostResults = updatedSearchResults.results.length > 0 || Boolean(updatedSearchResults.bookingContextId);

    if (!hasHostResults) return;

    const currentSnapshot = getResultsSnapshot(searchResults);
    const nextSnapshot = getResultsSnapshot(updatedSearchResults);
    const hasMeaningfulHostChange = currentSnapshot !== nextSnapshot;
    if (pendingBookingSync) {
      const isSamePendingBookingDay =
        updatedSearchResults.bookingContextId === pendingBookingSync.bookingContextId &&
        updatedSearchResults.date === pendingBookingSync.date;

      if (isSamePendingBookingDay) {
        const hostConfirmationId = updatedSearchResults.booking?.confirmationId;
        if (hostConfirmationId !== pendingBookingSync.confirmationId) {
          return;
        }
      }

      setPendingBookingSync(null);
    }

    if (!hasMeaningfulHostChange) {
      return;
    }

    setSearchResults(updatedSearchResults);
    setCurrentActiveLotId((currentLotId) => resolveActiveLotId(updatedSearchResults, currentLotId));
  }, [toolProps, pendingBookingSync, searchResults]);

  const selectedLot = searchResults.results.find((lot) => lot.id === currentActiveLotId) || searchResults.results[0];

  const isFullscreen = hostDisplayMode === "fullscreen" && Boolean(selectedLot);

  function syncContext(nextLotId: string) {
    const lot = searchResults.results.find((item) => item.id === nextLotId);
    if (!lot) return;

    const updatedWidgetState = {
      selectedLotId: nextLotId,
      selectedDate: searchResults.date,
      bookingContextId: searchResults.bookingContextId,
      selectedLot: {
        id: lot.id,
        name: lot.name,
        covered: lot.attributes.covered,
        accessible: lot.attributes.accessible,
        distanceToHQMeters: lot.distanceToHQMeters,
        availableSpots: lot.availableSpots
      }
    };

    window.openai?.setWidgetState?.(updatedWidgetState);
  }

  useEffect(() => {
    const confirmationId = searchResults.booking?.confirmationId || "";

    if (confirmationId && confirmationId !== lastConfirmationIdRef.current) {
      lastConfirmationIdRef.current = confirmationId;

      setBannerTone("success");
      setBannerMessage(
        `Booked ${searchResults.booking?.lotName} for ${searchResults.date}. Confirmation ID: ${confirmationId}.`
      );

      return;
    }

    if (!confirmationId) {
      lastConfirmationIdRef.current = "";

      setBannerMessage((current) => (bannerTone === "success" ? null : current));
    }
  }, [searchResults.booking, searchResults.date, bannerTone]);

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

  async function closeFullscreen() {
    setInspectorOpen(false);
    await window.openai?.requestDisplayMode?.({ mode: "inline" });
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
        setBannerTone("error");
        setBannerMessage(extractResultText(result) || "Failed to book the selected lot.");
        return;
      }

      const updatedSearchResults = normalizeSearchResults(result.structuredContent);
      setSearchResults(updatedSearchResults);
      if (updatedSearchResults.booking) {
        setPendingBookingSync({
          bookingContextId: updatedSearchResults.bookingContextId,
          date: updatedSearchResults.date,
          confirmationId: updatedSearchResults.booking.confirmationId
        });
      }
      setBannerTone("success");
      setBannerMessage(
        updatedSearchResults.booking
          ? `Booked ${updatedSearchResults.booking.lotName} for ${updatedSearchResults.date}. Confirmation ID: ${updatedSearchResults.booking.confirmationId}.`
          : "Parking spot booked."
      );
    } catch {
      setBannerTone("error");
      setBannerMessage("Failed to book the selected lot.");
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
            onCloseInspector={closeFullscreen}
            booking={searchResults.booking}
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
