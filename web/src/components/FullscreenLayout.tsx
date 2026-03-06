import React from "react";

import type { CurrentDateBooking, ParkingLot } from "../types";
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
  currentDateBooking: CurrentDateBooking | null;
  isBooking: boolean;
  bannerMessage: string | null;
  bannerTone: "success" | "error";
  onBookLot: (lotId: string) => Promise<void>;
};

export function FullscreenLayout({
  lots,
  activeLotId,
  onSelectLot,
  campusAddress,
  isInspectorOpen,
  onCloseInspector,
  currentDateBooking,
  isBooking,
  bannerMessage,
  bannerTone,
  onBookLot
}: FullscreenLayoutProps) {
  const selectedLot = lots.find((lot) => lot.id === activeLotId) || lots[0];

  return (
    <section className="fullscreen-overlay">
      <LotOptionsPanel lots={lots} activeLotId={selectedLot.id} onSelectLot={onSelectLot} />
      {isInspectorOpen ? (
        <LotInspectorPanel
          lot={selectedLot}
          address={campusAddress}
          onClose={onCloseInspector}
          currentDateBooking={currentDateBooking}
          isBooking={isBooking}
          bannerMessage={bannerMessage}
          bannerTone={bannerTone}
          onBookLot={onBookLot}
        />
      ) : null}
    </section>
  );
}
