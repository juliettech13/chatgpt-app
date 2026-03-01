import React, { useState } from "react";

import type { ParkingLot } from "../types";

import { LotInspectorPanel } from "./LotInspectorPanel";
import { LotOptionsPanel } from "./LotOptionsPanel";
import { MapPanel } from "./MapPanel";

import "../css/fullscreen-layout.css";

type Props = {
  lots: ParkingLot[];
  selectedLotId: string;
  onSelectLot: (lotId: string) => void;
  onBook: (lot: ParkingLot) => void;
  bookingMessage: string | null;
  campusAddress: string;
  isSubmittingBooking: boolean;
};

export function FullscreenLayout({
  lots,
  selectedLotId,
  onSelectLot,
  onBook,
  bookingMessage,
  campusAddress,
  isSubmittingBooking
}: Props) {
  const [isInspectorOpen, setInspectorOpen] = useState(true);
  const selectedLot = lots.find((lot) => lot.id === selectedLotId) || lots[0];

  function handleSelectLot(nextLotId: string) {
    onSelectLot(nextLotId);
    setInspectorOpen(true);
  }

  return (
    <section className="fullscreen-layout">
      <MapPanel
        lots={lots}
        selectedLotId={selectedLot.id}
        onSelectLot={handleSelectLot}
        onMarkerActivate={() => setInspectorOpen(true)}
      />
      <LotOptionsPanel lots={lots} selectedLotId={selectedLot.id} onSelectLot={handleSelectLot} />
      {isInspectorOpen ? (
        <LotInspectorPanel
          lot={selectedLot}
          onBook={onBook}
          bookingMessage={bookingMessage}
          address={campusAddress}
          onClose={() => setInspectorOpen(false)}
          isSubmittingBooking={isSubmittingBooking}
        />
      ) : null}
    </section>
  );
}
