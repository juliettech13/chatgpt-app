import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import type { ParkingSeedData } from "./parking-service.js";

function ensureDirectoryExists(filePath: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

export function createDatabase(projectRoot: string, seedData: ParkingSeedData) {
  const dbPath = process.env.SQLITE_PATH || path.join(projectRoot, "server", "data", "parking.sqlite");

  ensureDirectoryExists(dbPath);

  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");

  db.exec(`
    CREATE TABLE IF NOT EXISTS campus (
      id TEXT PRIMARY KEY,
      timezone TEXT NOT NULL,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      name TEXT NOT NULL,
      address TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS lots (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      image_url TEXT,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      covered INTEGER NOT NULL,
      accessible INTEGER NOT NULL,
      ev_charging INTEGER NOT NULL,
      security_patrol INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS daily_inventory (
      date TEXT NOT NULL,
      lot_id TEXT NOT NULL,
      capacity INTEGER NOT NULL,
      reserved INTEGER NOT NULL,
      note TEXT,
      PRIMARY KEY (date, lot_id)
    );

    CREATE TABLE IF NOT EXISTS bookings (
      confirmation_id TEXT PRIMARY KEY,
      booking_context_id TEXT NOT NULL,
      date TEXT NOT NULL,
      lot_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE (booking_context_id, date)
    );
  `);

  const campusCountRow = db.prepare("SELECT COUNT(*) AS count FROM campus").get() as { count: number };
  if (campusCountRow.count === 0) {
    const insertCampus = db.prepare(`
      INSERT INTO campus (id, timezone, lat, lng, name, address)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const { campus, timezone } = seedData;
    insertCampus.run(campus.id, timezone, campus.location.lat, campus.location.lng, campus.name, campus.address);
  }

  const lotsCountRow = db.prepare("SELECT COUNT(*) AS count FROM lots").get() as { count: number };

  if (lotsCountRow.count === 0) {
    const insertLot = db.prepare(`
      INSERT INTO lots (id, name, type, image_url, lat, lng, covered, accessible, ev_charging, security_patrol)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const lot of seedData.lots) {
      insertLot.run(
        lot.id,
        lot.name,
        lot.type,
        lot.image_url ?? null,
        lot.location.lat,
        lot.location.lng,
        lot.attributes.covered ? 1 : 0,
        lot.attributes.accessible ? 1 : 0,
        lot.attributes.ev_charging ? 1 : 0,
        lot.attributes.security_patrol ? 1 : 0
      );
    }
  }

  const inventoryCountRow = db.prepare("SELECT COUNT(*) AS count FROM daily_inventory").get() as { count: number };

  if (inventoryCountRow.count === 0) {
    const insertInventory = db.prepare(`
      INSERT INTO daily_inventory (date, lot_id, capacity, reserved, note)
      VALUES (?, ?, ?, ?, ?)
    `);

    for (const entry of seedData.daily_inventory) {
      insertInventory.run(
        entry.date,
        entry.lot_id,
        entry.capacity,
        entry.reserved,
        entry.note ?? null
      );
    }
  }

  return db;
}
