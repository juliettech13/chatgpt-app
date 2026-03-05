import fs from "node:fs";
import path from "node:path";

import distance from "@turf/distance";
import { point } from "@turf/helpers";

import { metersToMiles } from "./distance.js";
import type { LotFilters } from "./schemas.js";

type Coordinate = {
  lat: number;
  lng: number;
};

type ParkingLotAttributes = {
  covered: boolean;
  accessible: boolean;
  ev_charging?: boolean;
  security_patrol?: boolean;
};

type ParkingLot = {
  id: string;
  name: string;
  type: string;
  image_url?: string;
  location: Coordinate;
  attributes: ParkingLotAttributes;
};

type DailyInventoryEntry = {
  date: string;
  lot_id: string;
  capacity: number;
  reserved: number;
  note?: string;
};

type Campus = {
  id: string;
  name: string;
  address: string;
  location: Coordinate;
};

type ParkingPolicy = {
  hold_ttl_minutes: number;
  max_booking_days_ahead: number;
};

export type ParkingSeedData = {
  timezone: string;
  campus: Campus;
  lots: ParkingLot[];
  daily_inventory: DailyInventoryEntry[];
  policy: ParkingPolicy;
};

export type EnrichedParkingLot = {
  id: string;
  name: string;
  type: string;
  imageUrl?: string;
  date: string;
  location: Coordinate;
  attributes: ParkingLotAttributes;
  note?: string;
  capacity: number;
  reserved: number;
  availableSpots: number;
  distanceToHQMeters: number;
  distanceToHQMiles: number;
};

export type ParkingSearchResult = EnrichedParkingLot & {
  title: string;
};

function distanceBetweenCoordinates(from: Coordinate, to: Coordinate): number {
  const fromPoint = point([from.lng, from.lat]);
  const toPoint = point([to.lng, to.lat]);
  const kilometers = distance(fromPoint, toPoint, { units: "kilometers" });
  return Math.round(kilometers * 1000);
}

export function loadSeedData(projectRoot: string): ParkingSeedData {
  const filePath = path.join(projectRoot, "server", "data", "parking-seed.json");
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw) as ParkingSeedData;
}

function getInventoryForDate(seedData: ParkingSeedData, date: string): DailyInventoryEntry[] {
  return seedData.daily_inventory.filter((entry) => entry.date === date);
}

function resolveDateOrToday(inputDate?: string): string {
  if (inputDate) return inputDate;

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

function enrichLotDetails(
  seedData: ParkingSeedData,
  lot: ParkingLot,
  inventoryEntry: DailyInventoryEntry | undefined,
  date: string
): EnrichedParkingLot {
  const { capacity = 0, reserved = 0, note } = inventoryEntry ?? {};
  const availableSpots = Math.max(0, capacity - reserved);
  const distanceToHQMeters = distanceBetweenCoordinates(seedData.campus.location, lot.location);
  const optionalNote = note ? { note } : {};
  const optionalImageUrl = lot.image_url ? { imageUrl: lot.image_url } : {};

  return {
    id: lot.id,
    name: lot.name,
    type: lot.type,
    ...optionalImageUrl,
    location: lot.location,
    attributes: lot.attributes,
    date,
    ...optionalNote,
    capacity,
    reserved,
    availableSpots,
    distanceToHQMeters,
    distanceToHQMiles: metersToMiles(distanceToHQMeters)
  };
}

function getLotsForDate(
  seedData: ParkingSeedData,
  dateInput?: string
): { date: string; lots: EnrichedParkingLot[] } {
  const date = resolveDateOrToday(dateInput);

  const inventoryByLotId = new Map(
    getInventoryForDate(seedData, date).map((item) => [item.lot_id, item])
  );

  const lots = seedData.lots
    .map((lot) => enrichLotDetails(seedData, lot, inventoryByLotId.get(lot.id), date))
    .sort((a, b) => a.distanceToHQMeters - b.distanceToHQMeters);

  return { date, lots };
}

function applyFilters(lots: EnrichedParkingLot[], filters: LotFilters = {}): EnrichedParkingLot[] {
  const {
    minSpots,
    maxSpots,
    requireCovered,
    excludeCovered,
    requireAccessible,
    excludeAccessible,
    requireEv,
    excludeEv,
    typeIn,
    maxDistanceMiles
  } = filters;

  const filtered = lots.filter((lot) => {
    if (typeof minSpots === "number" && lot.availableSpots < minSpots) return false;
    if (typeof maxSpots === "number" && lot.availableSpots > maxSpots) return false;
    if (requireCovered && !lot.attributes.covered) return false;
    if (excludeCovered && lot.attributes.covered) return false;
    if (requireAccessible && !lot.attributes.accessible) return false;
    if (excludeAccessible && lot.attributes.accessible) return false;
    if (requireEv && !lot.attributes.ev_charging) return false;
    if (excludeEv && lot.attributes.ev_charging) return false;
    if (Array.isArray(typeIn) && typeIn.length > 0 && !typeIn.includes(lot.type as "surface_lot" | "garage")) return false;
    if (typeof maxDistanceMiles === "number" && lot.distanceToHQMiles > maxDistanceMiles) return false;
    return true;
  });

  filtered.sort((a, b) => a.distanceToHQMeters - b.distanceToHQMeters);
  return filtered;
}

function searchLotsForSeed(
  seedData: ParkingSeedData,
  filters?: LotFilters
): { date: string; lots: EnrichedParkingLot[] } {
  const dateInput = filters?.date;
  const { date, lots } = getLotsForDate(seedData, dateInput);
  const filteredLots = applyFilters(lots, filters || {});
  return { date, lots: filteredLots };
}

function toSearchResults(lots: EnrichedParkingLot[]): ParkingSearchResult[] {
  return lots.map((lot) => ({
    ...lot,
    title: `${lot.name} (${lot.availableSpots} spots available)`
  }));
}

export function createParkingService(seedData: ParkingSeedData) {
  const searchLots = (filters?: LotFilters) => searchLotsForSeed(seedData, filters);

  return {
    searchLots,
    toSearchResults
  };
}
