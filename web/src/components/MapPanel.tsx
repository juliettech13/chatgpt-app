import React, { useEffect, useRef, useState } from "react";

import mapboxgl, { LngLatBounds } from "mapbox-gl";
import type { FeatureCollection, Point } from "geojson";

import "mapbox-gl/dist/mapbox-gl.css";
import "../css/map-panel-placeholder.css";

import type { ParkingLot } from "../types";

type Props = {
  lots: ParkingLot[];
  selectedLotId: string;
  onSelectLot?: (lotId: string) => void;
  onMarkerActivate?: (lotId: string) => void;
  className?: string;
};

declare global {
  interface Window {
    __MAPBOX_PUBLIC_TOKEN__?: string;
  }
}

type LotFeatureProperties = { lotId: string; spotsLabel: string; selected: boolean };

function getCssVariable(name: string, fallback: string) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

function toLotsFeatureCollection(lots: ParkingLot[], selectedLotId: string): FeatureCollection<Point, LotFeatureProperties> {
  return {
    type: "FeatureCollection",
    features: lots.map((lot) => ({
      type: "Feature" as const,
      geometry: {
        type: "Point" as const,
        coordinates: [lot.location.lng, lot.location.lat]
      },
      properties: {
        lotId: lot.id,
        spotsLabel: String(lot.availableSpots),
        selected: lot.id === selectedLotId
      }
    }))
  };
}

export function MapPanel({
  lots,
  selectedLotId,
  onSelectLot,
  onMarkerActivate,
  className
}: Props) {
  const containerRef = useRef(null as HTMLDivElement | null);
  const mapRef = useRef(null as mapboxgl.Map | null);
  const hasInitialViewportRef = useRef(false);
  const [isStyleLoaded, setIsStyleLoaded] = useState(false);
  const callbacksRef = useRef({ onSelectLot, onMarkerActivate });
  const token = window.__MAPBOX_PUBLIC_TOKEN__ || "";
  const hasToken = Boolean(token);

  useEffect(() => {
    callbacksRef.current = { onSelectLot, onMarkerActivate };
  }, [onSelectLot, onMarkerActivate]);

  useEffect(() => {
    if (!hasToken || !containerRef.current || mapRef.current) return;

    const markerDefaultColor = getCssVariable("--lot-marker-default", "#be89b1");
    const markerSelectedColor = getCssVariable("--lot-marker-selected", "#f7c742");

    mapboxgl.accessToken = token;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/standard",
      config: {
        basemap: {
          lightPreset: "night"
        }
      },
      center: [-122.401075, 37.789887],
      zoom: 11.5,
      bearing: 0,
      pitch: 0
    });

    mapRef.current = map;

    map.on("load", () => {
      setIsStyleLoaded(true);

      map.addSource("parking-lots", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] }
      });

      map.addLayer({
        id: "parking-lots-circle",
        type: "circle",
        source: "parking-lots",
        paint: {
          "circle-color": ["case", ["to-boolean", ["get", "selected"]], markerSelectedColor, markerDefaultColor],
          "circle-emissive-strength": 1,
          "circle-radius": 14,
          "circle-stroke-color": "rgba(255,255,255,0.45)",
          "circle-stroke-width": 1
        }
      });

      map.addLayer({
        id: "parking-lots-label",
        type: "symbol",
        source: "parking-lots",
        layout: {
          "text-field": ["get", "spotsLabel"],
          "text-font": ["DIN Offc Pro Bold", "Arial Unicode MS Bold"],
          "text-size": 14,
          "text-allow-overlap": true
        },
        paint: {
          "text-color": "#121f1c",
          "text-emissive-strength": 1
        }
      });

      const onLotClick = (event: mapboxgl.MapMouseEvent) => {
        const features = map.queryRenderedFeatures(event.point, {
          layers: ["parking-lots-circle", "parking-lots-label"]
        });

        const lotId: string | undefined = features[0]?.properties?.lotId;
        if (!lotId) return;

        callbacksRef.current.onSelectLot?.(lotId);
        callbacksRef.current.onMarkerActivate?.(lotId);
      };

      map.on("click", "parking-lots-circle", onLotClick);
      map.on("click", "parking-lots-label", onLotClick);
      map.on("mouseenter", "parking-lots-circle", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "parking-lots-circle", () => {
        map.getCanvas().style.cursor = "";
      });
    });

    return () => {
      map.remove();
      mapRef.current = null;
      setIsStyleLoaded(false);
      hasInitialViewportRef.current = false;
    };
  }, [hasToken, token]);

  useEffect(() => {
    const map = mapRef.current;
    if (!hasToken || !map || !isStyleLoaded) return;

    const lotsSource = map.getSource("parking-lots") as mapboxgl.GeoJSONSource | undefined;
    if (!lotsSource) return;

    lotsSource.setData(toLotsFeatureCollection(lots, selectedLotId));

    if (!hasInitialViewportRef.current && lots.length) {
      if (lots.length === 1) {
        map.jumpTo({ center: [lots[0].location.lng, lots[0].location.lat], zoom: 14 });
      } else {
        const bounds = new LngLatBounds();
        lots.forEach((lot) => bounds.extend([lot.location.lng, lot.location.lat]));
        map.fitBounds(bounds, { padding: 80, duration: 0 });
      }
      hasInitialViewportRef.current = true;
    }
  }, [hasToken, isStyleLoaded, lots, selectedLotId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!hasToken || !map || !selectedLotId) return;

    const selectedLot = lots.find((lot) => lot.id === selectedLotId);
    if (!selectedLot) return;

    map.easeTo({
      center: [selectedLot.location.lng, selectedLot.location.lat],
      duration: 500
    });
  }, [hasToken, lots, selectedLotId]);

  if (!hasToken) {
    return (
      <section className={`map-panel-placeholder ${className || ""}`.trim()} aria-label="Map panel fallback">
        <img
          className="map-panel-placeholder__image"
          src="https://images.unsplash.com/photo-1569336415962-a4bd9f69c07a?auto=format&fit=crop&w=1200&q=80"
          alt="Placeholder downtown map"
        />
      </section>
    );
  }

  return <section className={`map-panel-placeholder ${className || ""}`.trim()} ref={containerRef} aria-label="Map panel" />;
}
