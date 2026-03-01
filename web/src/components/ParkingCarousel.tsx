import React from "react";

import type { ParkingLot } from "../types";
import { MapPanel } from "./MapPanel";
import { ParkingLotCard } from "./ParkingLotCard";

import "../css/parking-carousel.css";

type Props = {
  lots: ParkingLot[];
  selectedLotId: string;
  onSelectLot: (lotId: string) => void;
  onOpenFullscreen: (lotId: string) => void;
};

export function ParkingCarousel({
  lots,
  selectedLotId,
  onSelectLot,
  onOpenFullscreen
}: Props) {
  function handleMarkerActivate(lotId: string) {
    onOpenFullscreen(lotId);
  }

  return (
    <section className="parking-carousel-map-shell">
      <button
        type="button"
        className="parking-carousel__fullscreen-btn"
        onClick={() => onOpenFullscreen(selectedLotId)}
        aria-label="Open fullscreen"
        title="Open fullscreen"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      <MapPanel
        lots={lots}
        selectedLotId={selectedLotId}
        onMarkerActivate={handleMarkerActivate}
        className="parking-carousel__map"
      />

      <div className="parking-carousel__rail" role="list">
        {lots.map((lot) => {
          const selected = selectedLotId === lot.id;
          return (
            <ParkingLotCard
              key={lot.id}
              lot={lot}
              selected={selected}
              variant="carousel"
              onClick={() => {
                onSelectLot(lot.id);
                onOpenFullscreen(lot.id);
              }}
            />
          );
        })}
      </div>
    </section>
  );
}
