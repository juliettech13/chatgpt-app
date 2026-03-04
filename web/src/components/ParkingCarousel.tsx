import React from "react";

import type { ParkingLot } from "../types";
import { ParkingLotCard } from "./ParkingLotCard";

import "../css/parking-carousel.css";

type ParkingCarouselProps = {
  lots: ParkingLot[];
  activeLotId: string;
  onOpenFullscreen: (lotId: string) => void;
};

export function ParkingCarousel({ lots, activeLotId, onOpenFullscreen }: ParkingCarouselProps) {
  return (
    <section className="parking-carousel-overlay">
      <button
        type="button"
        className="parking-carousel__fullscreen-btn"
        onClick={() => onOpenFullscreen(activeLotId)}
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

      <div className="parking-carousel__rail" role="list">
        {lots.map((lot) => {
          const selected = activeLotId === lot.id;
          return (
            <ParkingLotCard
              key={lot.id}
              lot={lot}
              selected={selected}
              variant="carousel"
              onClick={() => {
                onOpenFullscreen(lot.id);
              }}
            />
          );
        })}
      </div>
    </section>
  );
}
