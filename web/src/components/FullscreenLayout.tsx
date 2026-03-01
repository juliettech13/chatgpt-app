import React, { useState } from "react";
import type { ParkingLot } from "../types";
import { LotInspectorPanel } from "./LotInspectorPanel";
import { LotOptionsPanel } from "./LotOptionsPanel";
import { MapPanelPlaceholder } from "./MapPanelPlaceholder";
import "../css/fullscreen-layout.css";

type Props = {
  lots: ParkingLot[];
  selectedLotId: string;
  onSelectLot: (lotId: string) => void;
  onBook: (lot: ParkingLot) => void;
  bookingMessage: string | null;
  campusAddress: string;
};

export function FullscreenLayout({
  lots,
  selectedLotId,
  onSelectLot,
  onBook,
  bookingMessage,
  campusAddress
}: Props) {
  const [isInspectorOpen, setInspectorOpen] = useState(true);
  const selectedLot = lots.find((lot) => lot.id === selectedLotId) || lots[0];

  function handleSelectLot(nextLotId: string) {
    onSelectLot(nextLotId);
    setInspectorOpen(true);
  }

  return (
    <section className="fullscreen-layout">
      <MapPanelPlaceholder lots={lots} selectedLotId={selectedLot.id} />
      <LotOptionsPanel lots={lots} selectedLotId={selectedLot.id} onSelectLot={handleSelectLot} />
      {isInspectorOpen ? (
        <LotInspectorPanel
          lot={selectedLot}
          onBook={onBook}
          bookingMessage={bookingMessage}
          address={campusAddress}
          onClose={() => setInspectorOpen(false)}
        />
      ) : null}
    </section>
  );
}
