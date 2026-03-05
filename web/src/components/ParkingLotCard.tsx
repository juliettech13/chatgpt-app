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
      <div className="parking-lot-card__thumb">
        {lot.imageUrl ? (
          <img
            className="parking-lot-card__thumb-image"
            src={lot.imageUrl}
            alt={lot.name}
            loading="lazy"
          />
        ) : null}
      </div>
      <div className="parking-lot-card__copy">
        <div className="parking-lot-card__name">{lot.name}</div>
        <div className="parking-lot-card__meta">
          {lot.availableSpots} spots • {lot.distanceToHQMiles} mi
        </div>
        <div className="parking-lot-card__attributes">
          <span className={lot.attributes.covered ? "parking-lot-card__attr parking-lot-card__attr--covered" : "parking-lot-card__attr parking-lot-card__attr--uncovered"}>
            {lot.attributes.covered ? "Covered" : "Uncovered"}
          </span>
          <span className={lot.attributes.accessible ? "parking-lot-card__attr parking-lot-card__attr--accessible" : "parking-lot-card__attr parking-lot-card__attr--standard"}>
            {lot.attributes.accessible ? "Accessible" : "Standard"}
          </span>
          {lot.attributes.ev_charging ? (
            <span className="parking-lot-card__attr parking-lot-card__attr--ev">
              EV
            </span>
          ) : null}
        </div>
      </div>
    </button>
  );
}
