import React from "react";

import type { Booking, ParkingLot } from "../types";
import { LotInspectorPanel } from "./LotInspectorPanel";
import { LotOptionsPanel } from "./LotOptionsPanel";

import "../css/fullscreen-layout.css";

type FullscreenLayoutProps = {
  lots: ParkingLot[];
  activeLotId: string;
  onSelectLot: (lotId: string) => void;
  campusAddress: string;
  isInspectorOpen: boolean;
  onCloseInspector: () => void;
  booking: Booking | null;
  bookingNotice: null | {
    lotId: string;
    date: string;
    message: string;
  };
  isBooking: boolean;
  bannerMessage: string | null;
  bannerTone: "success" | "error";
  onBookLot: (lotId: string) => Promise<void>;
  onDismissNotice: () => void;
};

export function FullscreenLayout({
  lots,
  activeLotId,
  onSelectLot,
  campusAddress,
  isInspectorOpen,
  onCloseInspector,
  booking,
  bookingNotice,
  isBooking,
  bannerMessage,
  bannerTone,
  onBookLot,
  onDismissNotice
}: FullscreenLayoutProps) {
  const selectedLot = lots.find((lot) => lot.id === activeLotId) || lots[0];
  const showSuccessNotice = Boolean(bookingNotice?.message);
  const showErrorNotice = bannerTone === "error" && Boolean(bannerMessage);

  return (
    <section className="fullscreen-overlay">
      {showSuccessNotice ? (
        <div className="fullscreen-overlay__notice fullscreen-overlay__notice--success" role="status">
          <p className="fullscreen-overlay__notice-text">{bookingNotice?.message}</p>
          <button
            type="button"
            className="fullscreen-overlay__notice-close"
            aria-label="Dismiss booking notice"
            onClick={onDismissNotice}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M6 6l12 12M18 6L6 18"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      ) : null}
      {showErrorNotice ? (
        <div className="fullscreen-overlay__notice fullscreen-overlay__notice--error" role="alert">
          <p className="fullscreen-overlay__notice-text">{bannerMessage}</p>
          <button
            type="button"
            className="fullscreen-overlay__notice-close"
            aria-label="Dismiss booking notice"
            onClick={onDismissNotice}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M6 6l12 12M18 6L6 18"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      ) : null}
      <LotOptionsPanel lots={lots} activeLotId={selectedLot.id} onSelectLot={onSelectLot} />
      {isInspectorOpen ? (
        <LotInspectorPanel
          lot={selectedLot}
          address={campusAddress}
          onClose={onCloseInspector}
          booking={booking}
          isBooking={isBooking}
          onBookLot={onBookLot}
        />
      ) : null}
    </section>
  );
}
