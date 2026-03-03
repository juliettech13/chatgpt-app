import React from "react";

import type { ParkingLot } from "../types";
import { LotInspectorPanel } from "./LotInspectorPanel";
import { LotOptionsPanel } from "./LotOptionsPanel";

import "../css/fullscreen-layout.css";

type Props = {
  lots: ParkingLot[];
  selectedLotId: string;
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
  selectedLotId,
  onSelectLot,
  onBook,
  bookingMessage,
  campusAddress,
  isSubmittingBooking,
  isInspectorOpen,
  onCloseInspector
}: Props) {
  const selectedLot = lots.find((lot) => lot.id === selectedLotId) || lots[0];

  return (
    <section className="fullscreen-overlay">
      <LotOptionsPanel lots={lots} selectedLotId={selectedLot.id} onSelectLot={onSelectLot} />
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
