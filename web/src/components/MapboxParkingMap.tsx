import React from "react";
import type { ParkingLot } from "../types";
import "../css/mapbox-parking-map.css";

type Props = {
  lots: ParkingLot[];
  selectedLotId: string;
};

export function MapboxParkingMap({ lots, selectedLotId }: Props) {
  return (
    <section className="mapbox-parking-map">
      <p>
        Mapbox integration placeholder. {lots.length} lots loaded. Selected lot: <strong>{selectedLotId}</strong>
      </p>
    </section>
  );
}

