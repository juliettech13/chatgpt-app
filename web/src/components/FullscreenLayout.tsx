import React from "react";

import type { ParkingLot } from "../types";
import { LotInspectorPanel } from "./LotInspectorPanel";
import { LotOptionsPanel } from "./LotOptionsPanel";

import "../css/fullscreen-layout.css";

type FullscreenLayoutProps = {
  lots: ParkingLot[];
  activeLotId: string;
  onSelectLot: (lotId: string) => void;
  onBook: (lot: ParkingLot) => void;
  bookingMessage: string | null;
  campusAddress: string;
  isSubmittingBooking: boolean;
  isInspectorOpen: boolean;
  onCloseInspector: () => void;
};

export function FullscreenLayout({
  lots,
  activeLotId,
  onSelectLot,
  onBook,
  bookingMessage,
  campusAddress,
  isSubmittingBooking,
  isInspectorOpen,
  onCloseInspector
}: FullscreenLayoutProps) {
  const selectedLot = lots.find((lot) => lot.id === activeLotId) || lots[0];

  return (
    <section className="fullscreen-overlay">
      <LotOptionsPanel lots={lots} activeLotId={selectedLot.id} onSelectLot={onSelectLot} />
      {isInspectorOpen ? (
        <LotInspectorPanel
          lot={selectedLot}
          onBook={onBook}
          bookingMessage={bookingMessage}
          address={campusAddress}
          onClose={onCloseInspector}
          isSubmittingBooking={isSubmittingBooking}
        />
      ) : null}
    </section>
  );
}
