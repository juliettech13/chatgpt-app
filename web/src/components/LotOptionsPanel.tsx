import React from "react";

import type { ParkingLot } from "../types";
import { ParkingLotCard } from "./ParkingLotCard";

import "../css/lot-options-panel.css";

type Props = {
  lots: ParkingLot[];
  selectedLotId: string;
  onSelectLot: (lotId: string) => void;
};

export function LotOptionsPanel({ lots, selectedLotId, onSelectLot }: Props) {
  return (
    <aside className="lot-options-panel" aria-label="Parking options panel">
      <div className="lot-options-panel__rail">
        {lots.map((lot) => {
          const selected = lot.id === selectedLotId;
          return (
            <ParkingLotCard
              key={lot.id}
              lot={lot}
              selected={selected}
              variant="panel"
              onClick={() => onSelectLot(lot.id)}
            />
          );
        })}
      </div>
    </aside>
  );
}
