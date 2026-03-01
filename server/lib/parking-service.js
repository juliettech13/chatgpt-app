import fs from "node:fs";
import path from "node:path";
import { lotCanonicalUrl } from "./urls.js";

function toRadians(value) {
  return (value * Math.PI) / 180;
}

function haversineMeters(from, to) {
  const earthRadiusMeters = 6371000;
  const deltaLat = toRadians(to.lat - from.lat);
  const deltaLng = toRadians(to.lng - from.lng);
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(toRadians(from.lat)) * Math.cos(toRadians(to.lat)) * Math.sin(deltaLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(earthRadiusMeters * c);
}

function formatTodayInTimezone(timezone) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  return formatter.format(new Date());
}

export function loadSeedData(projectRoot) {
  const filePath = path.join(projectRoot, "server", "data", "parking-seed.json");
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw);
}

export function createParkingService(seedData) {
  const lotById = new Map(seedData.lots.map((lot) => [lot.id, lot]));
  const inventoryByDate = new Map();

  for (const entry of seedData.daily_inventory) {
    if (!inventoryByDate.has(entry.date)) {
      inventoryByDate.set(entry.date, []);
    }
    inventoryByDate.get(entry.date).push(entry);
  }

  function resolveDateOrToday(inputDate) {
    return inputDate || formatTodayInTimezone(seedData.timezone);
  }

  function enrichLot(lot, inventoryEntry, date) {
    const capacity = inventoryEntry?.capacity ?? 0;
    const reserved = inventoryEntry?.reserved ?? 0;
    const availableSpots = Math.max(0, capacity - reserved);
    const distanceToHQMeters = haversineMeters(seedData.campus.location, lot.location);
    return {
      id: lot.id,
      name: lot.name,
      type: lot.type,
      date,
      location: lot.location,
      attributes: lot.attributes,
      note: inventoryEntry?.note,
      capacity,
      reserved,
      availableSpots,
      distanceToHQMeters,
      distanceToHQMiles: Number((distanceToHQMeters / 1609.34).toFixed(2))
    };
  }

  function getLotsForDate(dateInput) {
    const date = resolveDateOrToday(dateInput);
    const daily = inventoryByDate.get(date) || [];
    const inventoryByLotId = new Map(daily.map((item) => [item.lot_id, item]));
    const lots = seedData.lots
      .map((lot) => enrichLot(lot, inventoryByLotId.get(lot.id), date))
      .sort((a, b) => a.distanceToHQMeters - b.distanceToHQMeters);
    return { date, lots };
  }

  function getLotById(id, dateInput) {
    const date = resolveDateOrToday(dateInput);
    const lot = lotById.get(id);
    if (!lot) {
      return null;
    }
    const daily = inventoryByDate.get(date) || [];
    const inventory = daily.find((item) => item.lot_id === id);
    return enrichLot(lot, inventory, date);
  }

  function getNearestAlternatives(lotId, dateInput, maxResults = 3) {
    const selected = getLotById(lotId, dateInput);
    if (!selected) {
      return [];
    }
    const { lots } = getLotsForDate(selected.date);
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

  function toSearchResults(lots) {
    return lots.map((lot) => ({
      id: lot.id,
      title: `${lot.name} (${lot.availableSpots} spots available)`,
      url: lotCanonicalUrl(lot.id, lot.date)
    }));
  }

  function toFetchDocument(lot) {
    return {
      id: lot.id,
      title: lot.name,
      text: `${lot.name} is a ${lot.type} ${lot.distanceToHQMiles} miles from HQ. ${lot.availableSpots}/${lot.capacity} spots are available.`,
      url: lotCanonicalUrl(lot.id, lot.date),
      metadata: {
        type: lot.type,
        attributes: lot.attributes,
        availableSpots: lot.availableSpots,
        capacity: lot.capacity,
        reserved: lot.reserved,
        distanceToHQMeters: lot.distanceToHQMeters,
        note: lot.note
      }
    };
  }

  return {
    campus: seedData.campus,
    timezone: seedData.timezone,
    policy: seedData.policy,
    resolveDateOrToday,
    getLotsForDate,
    getLotById,
    getNearestAlternatives,
    toSearchResults,
    toFetchDocument
  };
}

