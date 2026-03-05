import fs from "node:fs";
import path from "node:path";

import distance from "@turf/distance";
import { point } from "@turf/helpers";

import { metersToMiles } from "./distance.js";
import { lotCanonicalUrl } from "./urls.js";
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

type ParkingLotSeed = {
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

type CampusSeed = {
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
  campus: CampusSeed;
  lots: ParkingLotSeed[];
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
  url: string;
};

type FetchDocument = {
  id: string;
  title: string;
  text: string;
  url: string;
  metadata: {
    type: string;
    attributes: ParkingLotAttributes;
    availableSpots: number;
    capacity: number;
    reserved: number;
    distanceToHQMeters: number;
    note?: string;
  };
};

function distanceBetweenCoordinates(from: Coordinate, to: Coordinate): number {
  const fromPoint = point([from.lng, from.lat]);
  const toPoint = point([to.lng, to.lat]);
  const kilometers = distance(fromPoint, toPoint, { units: "kilometers" });
  return Math.round(kilometers * 1000);
}

function capitalize(word: string): string {
  return word
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
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

function enrichLotForSeed(
  seedData: ParkingSeedData,
  lot: ParkingLotSeed,
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

function getLotsForDateForSeed(
  seedData: ParkingSeedData,
  dateInput?: string
): { date: string; lots: EnrichedParkingLot[] } {
  const date = resolveDateOrToday(dateInput);
  const daily = getInventoryForDate(seedData, date);
  const inventoryByLotId = new Map<string, DailyInventoryEntry>(daily.map((item) => [item.lot_id, item]));
  const lots = seedData.lots
    .map((lot) => enrichLotForSeed(seedData, lot, inventoryByLotId.get(lot.id), date))
    .sort((a, b) => a.distanceToHQMeters - b.distanceToHQMeters);

  return { date, lots };
}

function applyFilters(lots: EnrichedParkingLot[], filters: LotFilters = {}): EnrichedParkingLot[] {
  let filtered = [...lots];

  const minimumSpots = filters.minSpots;
  if (typeof minimumSpots === "number") {
    filtered = filtered.filter((lot) => lot.availableSpots >= minimumSpots);
  }
  const maximumSpots = filters.maxSpots;
  if (typeof maximumSpots === "number") {
    filtered = filtered.filter((lot) => lot.availableSpots <= maximumSpots);
  }
  if (filters.requireCovered) {
    filtered = filtered.filter((lot) => lot.attributes.covered);
  }
  if (filters.excludeCovered) {
    filtered = filtered.filter((lot) => !lot.attributes.covered);
  }
  if (filters.requireAccessible) {
    filtered = filtered.filter((lot) => lot.attributes.accessible);
  }
  if (filters.excludeAccessible) {
    filtered = filtered.filter((lot) => !lot.attributes.accessible);
  }
  if (filters.requireEv) {
    filtered = filtered.filter((lot) => lot.attributes.ev_charging);
  }
  if (filters.excludeEv) {
    filtered = filtered.filter((lot) => !lot.attributes.ev_charging);
  }
  if (Array.isArray(filters.typeIn) && filters.typeIn.length) {
    filtered = filtered.filter((lot) => filters.typeIn?.includes(lot.type as "surface_lot" | "garage"));
  }
  const maximumDistanceMiles = filters.maxDistanceMiles;
  if (typeof maximumDistanceMiles === "number") {
    filtered = filtered.filter((lot) => lot.distanceToHQMiles <= maximumDistanceMiles);
  }

  if (filters.sortBy === "most_spots") {
    filtered.sort((a, b) => b.availableSpots - a.availableSpots || a.distanceToHQMeters - b.distanceToHQMeters);
  } else {
    filtered.sort((a, b) => a.distanceToHQMeters - b.distanceToHQMeters);
  }

  return filtered;
}

function searchLotsForSeed(
  seedData: ParkingSeedData,
  filters?: LotFilters
): { date: string; lots: EnrichedParkingLot[] } {
  const dateInput = filters?.date;
  const { date, lots } = getLotsForDateForSeed(seedData, dateInput);
  const filteredLots = applyFilters(lots, filters || {});
  return { date, lots: filteredLots };
}

function getLotByIdForSeed(
  seedData: ParkingSeedData,
  lotsById: Map<string, ParkingLotSeed>,
  id: string,
  dateInput?: string
): EnrichedParkingLot | null {
  const date = resolveDateOrToday(dateInput);
  const lot = lotsById.get(id);
  if (!lot) {
    return null;
  }
  const daily = getInventoryForDate(seedData, date);
  const inventory = daily.find((item) => item.lot_id === id);
  return enrichLotForSeed(seedData, lot, inventory, date);
}

function getNearestAlternativesForSeed(
  seedData: ParkingSeedData,
  lotsById: Map<string, ParkingLotSeed>,
  lotId: string,
  dateInput?: string,
  maxResults = 3
): EnrichedParkingLot[] {
  const selected = getLotByIdForSeed(seedData, lotsById, lotId, dateInput);
  if (!selected) {
    return [];
  }
  const { lots } = getLotsForDateForSeed(seedData, selected.date);
  return lots
    .filter((lot) => lot.id !== lotId)
    .sort((a, b) => {
      if (b.availableSpots !== a.availableSpots) {
        return b.availableSpots - a.availableSpots;
      }
      return a.distanceToHQMeters - b.distanceToHQMeters;
    })
    .slice(0, maxResults);
}

function toSearchResults(lots: EnrichedParkingLot[]): ParkingSearchResult[] {
  return lots.map((lot) => ({
    ...lot,
    title: `${lot.name} (${lot.availableSpots} spots available)`,
    url: lotCanonicalUrl(lot.id, lot.date)
  }));
}

function toFetchDocument(lot: EnrichedParkingLot): FetchDocument {
  const lotType = capitalize(lot.type);
  return {
    id: lot.id,
    title: lot.name,
    text: `${lot.name} is a ${lotType} ${lot.distanceToHQMiles} miles from HQ. ${lot.availableSpots}/${lot.capacity} spots are available.`,
    url: lotCanonicalUrl(lot.id, lot.date),
    metadata: {
      type: lot.type,
      attributes: lot.attributes,
      availableSpots: lot.availableSpots,
      capacity: lot.capacity,
      reserved: lot.reserved,
      distanceToHQMeters: lot.distanceToHQMeters,
      ...(lot.note ? { note: lot.note } : {})
    }
  };
}

export function createParkingService(seedData: ParkingSeedData) {
  const lotsById = new Map<string, ParkingLotSeed>(seedData.lots.map((lot) => [lot.id, lot]));

  const getLotsForDate = (dateInput?: string) => getLotsForDateForSeed(seedData, dateInput);
  const searchLots = (filters?: LotFilters) => searchLotsForSeed(seedData, filters);
  const getLotById = (id: string, dateInput?: string) => getLotByIdForSeed(seedData, lotsById, id, dateInput);
  const getNearestAlternatives = (lotId: string, dateInput?: string, maxResults = 3) =>
    getNearestAlternativesForSeed(seedData, lotsById, lotId, dateInput, maxResults);

  return {
    campus: seedData.campus,
    timezone: seedData.timezone,
    policy: seedData.policy,
    resolveDateOrToday,
    getLotsForDate,
    applyFilters,
    searchLots,
    getLotById,
    getNearestAlternatives,
    toSearchResults,
    toFetchDocument
  };
}
