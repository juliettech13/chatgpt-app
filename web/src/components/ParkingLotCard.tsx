import React from "react";

import type { ParkingLot } from "../types";

import "../css/parking-lot-card.css";

type ParkingLotCardProps = {
  key: string;
  lot: ParkingLot;
  selected: boolean;
  onClick: () => void;
  disabled?: boolean;
  variant?: "carousel" | "panel";
};

export function ParkingLotCard({
  lot,
  selected,
  onClick,
  disabled = false,
  variant = "panel"
}: ParkingLotCardProps) {
  return (
    <button
      type="button"
      className={`parking-lot-card parking-lot-card--${variant} ${selected ? "is-selected" : ""}`}
      onClick={onClick}
      disabled={disabled}
    >
      <div className={`parking-lot-card__thumb parking-lot-card__thumb--${lot.type}`} />
      <div className="parking-lot-card__copy">
        <div className="parking-lot-card__name">{lot.name}</div>
        <div className="parking-lot-card__meta">
          {lot.availableSpots} spots • {lot.distanceToHQMiles} mi
        </div>
        <div className="parking-lot-card__attributes">
          <span>{lot.attributes.covered ? "Covered" : "Uncovered"}</span>
          <span>{lot.attributes.accessible ? "Accessible" : "Standard"}</span>
          {lot.attributes.ev_charging ? <span>EV</span> : null}
        </div>
      </div>
    </button>
  );
}
