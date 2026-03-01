import React from "react";
import type { ParkingLot } from "../types";
import "../css/lot-options-panel.css";

type Props = {
  lots: ParkingLot[];
  selectedLotId: string;
  onSelectLot: (lotId: string) => void;
};

export function LotOptionsPanel({ lots, selectedLotId, onSelectLot }: Props) {
  function lotMediaClass(lot: ParkingLot) {
    return lot.type === "garage" ? "lot-options-panel__thumb--garage" : "lot-options-panel__thumb--surface";
  }

  return (
    <aside className="lot-options-panel" aria-label="Parking options panel">
      <div className="lot-options-panel__rail">
        {lots.map((lot) => {
          const selected = lot.id === selectedLotId;
          return (
            <button
              key={lot.id}
              type="button"
              className={`lot-options-panel__card ${selected ? "is-selected" : ""}`}
              onClick={() => onSelectLot(lot.id)}
            >
              <div className={`lot-options-panel__thumb ${lotMediaClass(lot)}`} />
              <div className="lot-options-panel__copy">
                <div className="lot-options-panel__name">{lot.name}</div>
                <div className="lot-options-panel__type">
                  {lot.availableSpots} spots • {lot.distanceToHQMiles} mi
                </div>
                <div className="lot-options-panel__attributes">
                  <span>{lot.attributes.covered ? "Covered" : "Uncovered"}</span>
                  <span>{lot.attributes.accessible ? "Accessible" : "Standard"}</span>
                  {lot.attributes.ev_charging ? <span>EV</span> : null}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
