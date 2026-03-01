import React from "react";
import type { ParkingLot } from "../types";
import "../css/map-panel-placeholder.css";

type Props = {
  lots: ParkingLot[];
  selectedLotId: string;
};

function normalizePins(lots: ParkingLot[]) {
  const lats = lots.map((lot) => lot.location.lat);
  const lngs = lots.map((lot) => lot.location.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  return lots.map((lot) => {
    const y = ((maxLat - lot.location.lat) / Math.max(0.0001, maxLat - minLat)) * 100;
    const x = ((lot.location.lng - minLng) / Math.max(0.0001, maxLng - minLng)) * 100;
    return {
      lotId: lot.id,
      x: Math.min(94, Math.max(6, x)),
      y: Math.min(92, Math.max(8, y))
    };
  });
}

export function MapPanelPlaceholder({ lots, selectedLotId }: Props) {
  const pins = normalizePins(lots);
  return (
    <section className="map-panel-placeholder" aria-label="Map panel">
      <img
        className="map-panel-placeholder__image"
        src="https://images.unsplash.com/photo-1569336415962-a4bd9f69c07a?auto=format&fit=crop&w=1200&q=80"
        alt="Placeholder downtown map"
      />
      {pins.map((pin) => (
        <div
          key={pin.lotId}
          className={`map-panel-placeholder__pin ${selectedLotId === pin.lotId ? "is-selected" : ""}`}
          style={{ left: `${pin.x}%`, top: `${pin.y}%` }}
          title={pin.lotId}
        />
      ))}
    </section>
  );
}
