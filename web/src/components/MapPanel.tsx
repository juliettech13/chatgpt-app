import React, { useEffect, useRef, useState } from "react";

import mapboxgl, { LngLatBounds } from "mapbox-gl";
import type { FeatureCollection, Point } from "geojson";

import "mapbox-gl/dist/mapbox-gl.css";
import "../css/map-panel-placeholder.css";

import type { DisplayMode, ParkingLot } from "../types";

type MapPanelProps = {
  lots: ParkingLot[];
  selectedLotId: string;
  mode: DisplayMode;
  onMarkerActivate?: (lotId: string) => void;
  className?: string;
};

declare global {
  interface Window {
    __MAPBOX_PUBLIC_TOKEN__?: string;
  }
}

type LotFeatureProperties = { lotId: string; spotsLabel: string; selected: boolean };

function readCssCustomProperty(name: string, fallback: string) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

function buildLotsGeoJsonFeatureCollection(
  lots: ParkingLot[],
  selectedLotId: string
): FeatureCollection<Point, LotFeatureProperties> {
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
  mode,
  onMarkerActivate,
  className
}: MapPanelProps) {
  const containerRef = useRef(null as HTMLDivElement | null);
  const mapRef = useRef(null as mapboxgl.Map | null);
  const hasInitialViewportRef = useRef(false);
  const hasSelectionCameraInitRef = useRef(false);
  const previousSelectedLotIdRef = useRef(null);
  const [isStyleLoaded, setIsStyleLoaded] = useState(false);
  const markerCallbacksRef = useRef({ onMarkerActivate });
  const mapboxPublicToken = window.__MAPBOX_PUBLIC_TOKEN__ || "";
  const hasMapboxPublicToken = Boolean(mapboxPublicToken);

  useEffect(() => {
    markerCallbacksRef.current = { onMarkerActivate };
  }, [onMarkerActivate]);

  useEffect(() => {
    if (!hasMapboxPublicToken || !containerRef.current || mapRef.current) return;

    const markerDefaultColor = readCssCustomProperty("--lot-marker-default", "#be89b1");
    const markerSelectedColor = readCssCustomProperty("--lot-marker-selected", "#f7ccd7");

    mapboxgl.accessToken = mapboxPublicToken;
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

      const handleMapLotClick = (event: mapboxgl.MapMouseEvent) => {
        const features = map.queryRenderedFeatures(event.point, {
          layers: ["parking-lots-circle", "parking-lots-label"]
        });

        const lotId: string | undefined = features[0]?.properties?.lotId;
        if (!lotId) return;

        markerCallbacksRef.current.onMarkerActivate?.(lotId);
      };

      map.on("click", "parking-lots-circle", handleMapLotClick);
      map.on("click", "parking-lots-label", handleMapLotClick);
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
      hasSelectionCameraInitRef.current = false;
      previousSelectedLotIdRef.current = null;
    };
  }, [hasMapboxPublicToken, mapboxPublicToken]);

  useEffect(() => {
    const map = mapRef.current;
    if (!hasMapboxPublicToken || !map || !isStyleLoaded) return;
    map.resize();
  }, [hasMapboxPublicToken, isStyleLoaded, mode]);

  useEffect(() => {
    const map = mapRef.current;
    if (!hasMapboxPublicToken || !map || !isStyleLoaded) return;

    const lotsSource = map.getSource("parking-lots") as mapboxgl.GeoJSONSource | undefined;
    if (!lotsSource) return;

    lotsSource.setData(buildLotsGeoJsonFeatureCollection(lots, selectedLotId));

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
  }, [hasMapboxPublicToken, isStyleLoaded, lots, selectedLotId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!hasMapboxPublicToken || !map || !selectedLotId) return;

    const selectedLot = lots.find((lot) => lot.id === selectedLotId);
    if (!selectedLot) return;

    if (!hasInitialViewportRef.current) return;

    if (!hasSelectionCameraInitRef.current) {
      hasSelectionCameraInitRef.current = true;
      previousSelectedLotIdRef.current = selectedLotId;
      return;
    }

    if (previousSelectedLotIdRef.current === selectedLotId) {
      return;
    }
    previousSelectedLotIdRef.current = selectedLotId;

    map.easeTo({
      center: [selectedLot.location.lng, selectedLot.location.lat],
      duration: 500
    });
  }, [hasMapboxPublicToken, lots, selectedLotId]);

  if (!hasMapboxPublicToken) {
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
