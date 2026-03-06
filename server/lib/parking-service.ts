import fs from "node:fs";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";

import distance from "@turf/distance";
import { point } from "@turf/helpers";

import { metersToMiles } from "./distance.js";
import type { LotFilters } from "./schemas.js";
import type { CurrentDateBooking } from "./booking-service.js";

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

type SearchLotsResponse = {
  date: string;
  lots: EnrichedParkingLot[];
  currentDateBooking: CurrentDateBooking | null;
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

type CampusRow = {
  timezone: string;
  lat: number;
  lng: number;
};

function getCampusFromDb(db: DatabaseSync): CampusRow {
  const row = db.prepare("SELECT timezone, lat, lng FROM campus LIMIT 1").get() as CampusRow | undefined;
  if (!row) throw new Error("Campus not found in database. Run with seed data to initialize.");
  return row;
}

type LotRow = {
  id: string;
  name: string;
  type: string;
  image_url: string | null;
  lat: number;
  lng: number;
  covered: number;
  accessible: number;
  ev_charging: number;
  security_patrol: number;
  capacity: number | null;
  reserved: number | null;
  note: string | null;
};

function getLotsWithInventoryForDate(db: DatabaseSync, date: string): LotRow[] {
  const query = db.prepare(`
    SELECT
      l.id,
      l.name,
      l.type,
      l.image_url,
      l.lat,
      l.lng,
      l.covered,
      l.accessible,
      l.ev_charging,
      l.security_patrol,
      i.capacity,
      i.reserved,
      i.note
    FROM lots l
    LEFT JOIN daily_inventory i ON l.id = i.lot_id AND i.date = ?
    ORDER BY l.id
  `);
  return query.all(date) as LotRow[];
}

function resolveDateOrToday(timezone: string, inputDate?: string): string {
  if (inputDate) return inputDate;

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

function rowToEnrichedLot(row: LotRow, campusLocation: Coordinate, date: string): EnrichedParkingLot {
  const capacity = row.capacity ?? 0;
  const reserved = row.reserved ?? 0;
  const availableSpots = Math.max(0, capacity - reserved);
  const lotLocation: Coordinate = { lat: row.lat, lng: row.lng };
  const distanceToHQMeters = distanceBetweenCoordinates(campusLocation, lotLocation);

  return {
    id: row.id,
    name: row.name,
    type: row.type,
    ...(row.image_url ? { imageUrl: row.image_url } : {}),
    location: lotLocation,
    attributes: {
      covered: Boolean(row.covered),
      accessible: Boolean(row.accessible),
      ev_charging: Boolean(row.ev_charging),
      ...(row.security_patrol ? { security_patrol: true } : {})
    },
    date,
    ...(row.note ? { note: row.note } : {}),
    capacity,
    reserved,
    availableSpots,
    distanceToHQMeters,
    distanceToHQMiles: metersToMiles(distanceToHQMeters)
  };
}

function getLotsForDate(
  db: DatabaseSync,
  timezone: string,
  campusLocation: Coordinate,
  dateInput?: string
): { date: string; lots: EnrichedParkingLot[] } {
  const date = resolveDateOrToday(timezone, dateInput);
  const rows = getLotsWithInventoryForDate(db, date);
  const lots = rows
    .map((row) => rowToEnrichedLot(row, campusLocation, date))
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

function resolveLotSearch(
  db: DatabaseSync,
  getBookingForDate: (bookingContextId: string, date: string) => CurrentDateBooking | null,
  bookingContextId: string,
  filters?: LotFilters
): SearchLotsResponse {
  const { timezone, lat, lng } = getCampusFromDb(db);
  const campusLocation: Coordinate = { lat, lng };
  const dateInput = filters?.date;
  const { date, lots } = getLotsForDate(db, timezone, campusLocation, dateInput);
  const filteredLots = applyFilters(lots, filters || {});
  return {
    date,
    lots: filteredLots,
    currentDateBooking: getBookingForDate(bookingContextId, date)
  };
}

function toSearchResults(lots: EnrichedParkingLot[]): ParkingSearchResult[] {
  return lots.map((lot) => ({
    ...lot,
    title: `${lot.name} (${lot.availableSpots} spots available)`
  }));
}

export function createParkingService(
  db: DatabaseSync,
  getBookingForDate: (bookingContextId: string, date: string) => CurrentDateBooking | null
) {
  const searchLots = (bookingContextId: string, filters?: LotFilters) =>
    resolveLotSearch(db, getBookingForDate, bookingContextId, filters);

  return {
    searchLots,
    toSearchResults
  };
}
