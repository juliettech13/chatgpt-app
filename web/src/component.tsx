import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";

import { FullscreenLayout } from "./components/FullscreenLayout";
import { MapPanel } from "./components/MapPanel";
import { ParkingCarousel } from "./components/ParkingCarousel";
import { SearchRefinementBar, type RefinementState } from "./components/SearchRefinementBar";
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

function extractRefinementState(searchResults: SearchStructuredContent): RefinementState {
  const appliedFilters = searchResults.appliedFilters || {};

  return {
    date: searchResults.date,
    requireCovered: appliedFilters.requireCovered === true,
    requireAccessible: appliedFilters.requireAccessible === true,
    requireEv: appliedFilters.requireEv === true
  };
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

function getSearchRequestKey(searchResults: SearchStructuredContent): string {
  return [
    searchResults.date,
    searchResults.query,
    searchResults.bookingContextId
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
  const [isSearching, setIsSearching] = useState(false);
  const [bannerMessage, setBannerMessage] = useState(null as string | null);
  const [bannerTone, setBannerTone] = useState("success" as "success" | "error");
  const [bookingNotice, setBookingNotice] = useState(null as null | {
    lotId: string;
    date: string;
    message: string;
    confirmationId: string;
  });
  const [pendingBookingSync, setPendingBookingSync] = useState(null as null | {
    bookingContextId: string;
    date: string;
    confirmationId: string;
  });

  const lastWidgetAuthoredSnapshotRef = useRef("");

  useEffect(() => {
    const updatedSearchResults = normalizeSearchResults(toolProps);
    const hasHostResults = updatedSearchResults.results.length > 0 || Boolean(updatedSearchResults.bookingContextId);

    if (!hasHostResults) return;

    const currentSnapshot = getResultsSnapshot(searchResults);
    const nextSnapshot = getResultsSnapshot(updatedSearchResults);
    const currentSearchRequest = getSearchRequestKey(searchResults);
    const updatedSearchRequest = getSearchRequestKey(updatedSearchResults);
    const hasMeaningfulHostChange = currentSnapshot !== nextSnapshot;

    if (
      lastWidgetAuthoredSnapshotRef.current &&
      currentSnapshot === lastWidgetAuthoredSnapshotRef.current
    ) {
      if (nextSnapshot === currentSnapshot) {
        lastWidgetAuthoredSnapshotRef.current = "";
      } else if (hostDisplayMode === "fullscreen" || currentSearchRequest === updatedSearchRequest) {
        return;
      }
    }

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
      if (lastWidgetAuthoredSnapshotRef.current === currentSnapshot) {
        lastWidgetAuthoredSnapshotRef.current = "";
      }
      return;
    }

    setSearchResults(updatedSearchResults);
    setCurrentActiveLotId((currentLotId) => resolveActiveLotId(updatedSearchResults, currentLotId));
  }, [hostDisplayMode, pendingBookingSync, searchResults, toolProps]);

  const selectedLot = searchResults.results.find((lot) => lot.id === currentActiveLotId) || searchResults.results[0];

  const isFullscreen = hostDisplayMode === "fullscreen" && Boolean(selectedLot);

  function syncContext(nextLotId: string) {
    const lot = searchResults.results.find((item) => item.id === nextLotId);
    if (!lot) return;
    const booking = searchResults.booking;
    const isBookedForSelectedDate = booking?.lotId === lot.id;

    const updatedWidgetState = {
      selectedLotId: nextLotId,
      selectedDate: searchResults.date,
      bookingContextId: searchResults.bookingContextId,
      selectedLotView: {
        id: lot.id,
        name: lot.name,
        date: searchResults.date,
        covered: lot.attributes.covered,
        accessible: lot.attributes.accessible,
        evCharging: Boolean(lot.attributes.ev_charging),
        distanceToHQMeters: lot.distanceToHQMeters,
        availableSpots: lot.availableSpots,
        isBookedForSelectedDate,
        ...(isBookedForSelectedDate && booking?.confirmationId
          ? { bookingConfirmationId: booking.confirmationId }
          : {})
      }
    };

    window.openai?.setWidgetState?.(updatedWidgetState);
  }

  useEffect(() => {
    if (!bookingNotice) return;

    if (bookingNotice.date !== searchResults.date) {
      setBookingNotice(null);
    }
  }, [bookingNotice, searchResults.date]);

  useEffect(() => {
    if (!currentActiveLotId) return;

    syncContext(currentActiveLotId);
  }, [currentActiveLotId, searchResults.date, searchResults.results, searchResults.booking]);

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

  function handleDismissNotice() {
    setBookingNotice(null);
    setBannerMessage(null);
  }

  async function handleBookLot(lotId: string) {
    if (!searchResults.bookingContextId) {
      setBookingNotice(null);
      setBannerTone("error");
      setBannerMessage("Missing booking context. Run a new search and try again.");
      return;
    }

    setIsBooking(true);
    setBookingNotice(null);
    setBannerMessage(null);

    try {
      const bookingDate = selectedLot?.date ?? searchResults.date;
      const result = await window.openai?.callTool?.("book_lot", {
        bookingContextId: searchResults.bookingContextId,
        lotId,
        date: bookingDate,
        query: searchResults.query
      });

      if (!result) {
        throw new Error("No response received from the booking tool.");
      }

      if (result.isError) {
        setBookingNotice(null);
        setBannerTone("error");
        setBannerMessage(extractResultText(result) || "Failed to book the selected lot.");
        return;
      }

      const bookingResults = normalizeSearchResults(result.structuredContent);
      const confirmationMessage = bookingResults.booking
        ? `Booked ${bookingResults.booking.lotName} for ${bookingResults.date}. Confirmation ID: ${bookingResults.booking.confirmationId}.`
        : (extractResultText(result) || "Parking spot booked.");
      const appliedRefinementState = extractRefinementState(searchResults);

      const refreshResult = await window.openai?.callTool?.("refine_widget_results", {
        query: searchResults.query,
        bookingContextId: searchResults.bookingContextId,
        date: appliedRefinementState.date,
        ...(appliedRefinementState.requireCovered ? { requireCovered: true } : {}),
        ...(appliedRefinementState.requireAccessible ? { requireAccessible: true } : {}),
        ...(appliedRefinementState.requireEv ? { requireEv: true } : {})
      });

      if (!refreshResult || refreshResult.isError) {
        setSearchResults(bookingResults);
        lastWidgetAuthoredSnapshotRef.current = getResultsSnapshot(bookingResults);
        if (bookingResults.booking) {
          setPendingBookingSync({
            bookingContextId: bookingResults.bookingContextId,
            date: bookingDate,
            confirmationId: bookingResults.booking.confirmationId
          });
        }
      } else {
        const refreshedSearchResults = normalizeSearchResults(refreshResult.structuredContent);
        setSearchResults(refreshedSearchResults);
        lastWidgetAuthoredSnapshotRef.current = getResultsSnapshot(refreshedSearchResults);
        if (refreshedSearchResults.booking) {
          setPendingBookingSync({
            bookingContextId: refreshedSearchResults.bookingContextId,
            date: bookingDate,
            confirmationId: refreshedSearchResults.booking.confirmationId
          });
        }
        setCurrentActiveLotId((currentLotId) => resolveActiveLotId(refreshedSearchResults, currentLotId));
        setInspectorOpen(true);
      }

      if (bookingResults.booking) {
        setBookingNotice({
          lotId: bookingResults.booking.lotId,
          date: bookingResults.date,
          message: confirmationMessage,
          confirmationId: bookingResults.booking.confirmationId
        });
      }
      setBannerMessage(null);
    } catch {
      setBookingNotice(null);
      setBannerTone("error");
      setBannerMessage("Failed to book the selected lot.");
    } finally {
      setIsBooking(false);
    }
  }

  async function handleSearchRefinement(nextRefinement: RefinementState) {
    setIsSearching(true);

    try {
      const result = await window.openai?.callTool?.("refine_widget_results", {
        query: searchResults.query,
        bookingContextId: searchResults.bookingContextId,
        date: nextRefinement.date,
        ...(nextRefinement.requireCovered ? { requireCovered: true } : {}),
        ...(nextRefinement.requireAccessible ? { requireAccessible: true } : {}),
        ...(nextRefinement.requireEv ? { requireEv: true } : {})
      });

      if (!result) {
        throw new Error("No response received from the search tool.");
      }

      if (result.isError) {
        setBannerTone("error");
        setBannerMessage(extractResultText(result) || "Failed to refresh parking options.");
        return;
      }

      const updatedSearchResults = normalizeSearchResults(result.structuredContent);
      setSearchResults(updatedSearchResults);
      lastWidgetAuthoredSnapshotRef.current = getResultsSnapshot(updatedSearchResults);
      setCurrentActiveLotId((currentLotId) => resolveActiveLotId(updatedSearchResults, currentLotId));
      setInspectorOpen(true);
      setBannerMessage(null);
    } catch {
      setBannerTone("error");
      setBannerMessage("Failed to refresh parking options.");
    } finally {
      setIsSearching(false);
    }
  }

  async function handleResetRefinement() {
    const resetState = {
      date: new Date().toISOString().slice(0, 10),
      requireCovered: false,
      requireAccessible: false,
      requireEv: false
    };

    await handleSearchRefinement(resetState);
  }

  const activeLotId = selectedLot?.id || "";
  const showRefinementBar = hostDisplayMode === "fullscreen";
  const appliedRefinementState = extractRefinementState(searchResults);

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

        {showRefinementBar ? (
          <SearchRefinementBar
            value={appliedRefinementState}
            isSearching={isSearching}
            onChange={handleSearchRefinement}
            onReset={handleResetRefinement}
          />
        ) : null}

        {isFullscreen && selectedLot ? (
          <FullscreenLayout
            lots={searchResults.results}
            activeLotId={selectedLot.id}
            onSelectLot={handleFullscreenSelectLot}
            campusAddress={DEFAULT_CAMPUS_ADDRESS}
            isInspectorOpen={isInspectorOpen}
            onCloseInspector={closeFullscreen}
            booking={searchResults.booking}
            bookingNotice={bookingNotice}
            isBooking={isBooking}
            bannerMessage={bannerMessage}
            bannerTone={bannerTone}
            onBookLot={handleBookLot}
            onDismissNotice={handleDismissNotice}
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
