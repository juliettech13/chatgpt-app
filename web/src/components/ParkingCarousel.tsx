import React from "react";
import type { ParkingLot } from "../types";
import "../css/parking-carousel.css";

type Props = {
  lots: ParkingLot[];
  selectedLotId: string;
  onSelectLot: (lotId: string) => void;
  onOpenFullscreen: (lotId: string) => void;
};

export function ParkingCarousel({ lots, selectedLotId, onSelectLot, onOpenFullscreen }: Props) {
  function lotDescription(lot: ParkingLot) {
    const typeLabel = lot.type === "garage" ? "Structured garage" : "Open-air surface lot";
    const coverage = lot.attributes.covered ? "covered parking" : "uncovered parking";
    const ev = lot.attributes.ev_charging ? "EV charging available" : "no EV charging";
    return `${typeLabel} with ${coverage}; ${ev}.`;
  }

  function lotMediaLabel(lot: ParkingLot) {
    return lot.type === "garage" ? "GARAGE" : "SURFACE LOT";
  }

  const pinAnchors = lots.map((lot, index) => ({
    id: lot.id,
    label: `${lot.availableSpots} spots`,
    left: 10 + ((index * 17) % 72),
    top: 18 + ((index * 13) % 40)
  }));

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

      <div className="parking-carousel__map">
        <img
          src="https://images.unsplash.com/photo-1499092346589-b9b6be3e94b2?auto=format&fit=crop&w=1600&q=80"
          alt="Parking discovery map placeholder"
        />
        <div className="parking-carousel__map-shade" />
        {pinAnchors.map((pin) => (
          <div key={pin.id} className="parking-carousel__pin" style={{ left: `${pin.left}%`, top: `${pin.top}%` }}>
            {pin.label}
          </div>
        ))}
      </div>

      <div className="parking-carousel__rail" role="list">
        {lots.map((lot) => {
          const selected = selectedLotId === lot.id;
          return (
            <button
              key={lot.id}
              type="button"
              role="listitem"
              className={`parking-carousel__card ${selected ? "is-selected" : ""}`}
              onClick={() => {
                onSelectLot(lot.id);
                onOpenFullscreen(lot.id);
              }}
            >
              <div className={`parking-carousel__media parking-carousel__media--${lot.type}`}>
                <div className="parking-carousel__media-chip">{lotMediaLabel(lot)}</div>
              </div>
              <div className="parking-carousel__content">
                <div className="parking-carousel__card-title">{lot.name}</div>
                <div className="parking-carousel__meta">
                  <span>{lot.type.replaceAll("_", " ")}</span>
                  <span>•</span>
                  <span>{lot.distanceToHQMiles} mi</span>
                </div>
                <p className="parking-carousel__description">{lotDescription(lot)}</p>
                <div className="parking-carousel__footer">
                  <span className="parking-carousel__availability">{lot.availableSpots} spots available</span>
                  <span className="parking-carousel__cta">View details</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
