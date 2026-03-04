import React from "react";

import type { ParkingLot } from "../types";
import { ParkingLotCard } from "./ParkingLotCard";

import "../css/lot-options-panel.css";

type LotOptionsPanelProps = {
  lots: ParkingLot[];
  activeLotId: string;
  onSelectLot: (lotId: string) => void;
};

export function LotOptionsPanel({ lots, activeLotId, onSelectLot }: LotOptionsPanelProps) {
  return (
    <aside className="lot-options-panel" aria-label="Parking options panel">
      <div className="lot-options-panel__rail">
        {lots.map((lot) => {
          const selected = lot.id === activeLotId;
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
