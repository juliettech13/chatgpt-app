import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";

type BookLotArgs = {
  bookingContextId: string;
  lotId: string;
  date: string;
};

export type Booking = {
  confirmationId: string;
  lotId: string;
  lotName: string;
  date: string;
};

type BookingRow = {
  confirmation_id: string;
  booking_context_id: string;
  date: string;
  lot_id: string;
  created_at: string;
};

function formatBookingRowIntoBooking(
  row: BookingRow | undefined,
  lotNameById: Map<string, string>
): Booking | null {
  if (!row) return null;

  return {
    confirmationId: row.confirmation_id,
    lotId: row.lot_id,
    lotName: lotNameById.get(row.lot_id) || row.lot_id,
    date: row.date
  };
}

function getLotNamesFromDb(db: DatabaseSync): Map<string, string> {
  const rows = db.prepare("SELECT id, name FROM lots").all() as { id: string; name: string }[];

  return new Map(rows.map((row) => [row.id, row.name]));
}

export function createBookingService(db: DatabaseSync) {
  const lotNameById = getLotNamesFromDb(db);

  const getBookingStmt = db.prepare(`
    SELECT confirmation_id, booking_context_id, date, lot_id, created_at
    FROM bookings
    WHERE booking_context_id = ? AND date = ?
    LIMIT 1
  `);

  const getInventoryStmt = db.prepare(`
    SELECT capacity, reserved
    FROM daily_inventory
    WHERE date = ? AND lot_id = ?
    LIMIT 1
  `);

  const insertBookingStmt = db.prepare(`
    INSERT INTO bookings (confirmation_id, booking_context_id, date, lot_id, created_at)
    VALUES (?, ?, ?, ?, ?)
  `);

  const updateInventoryStmt = db.prepare(`
    UPDATE daily_inventory
    SET reserved = reserved + 1
    WHERE date = ? AND lot_id = ? AND reserved < capacity
  `);

  function getBookingForDate(bookingContextId: string, date: string): Booking | null {
    const row = getBookingStmt.get(bookingContextId, date) as BookingRow | undefined;

    return formatBookingRowIntoBooking(row, lotNameById);
  }

  function bookLot({ bookingContextId, lotId, date }: BookLotArgs): Booking {
    db.exec("BEGIN IMMEDIATE TRANSACTION");

    try {
      const existingBooking = getBookingStmt.get(bookingContextId, date) as BookingRow | undefined;
      if (existingBooking) {
        throw new Error("You already have a parking booking for this date.");
      }

      const inventoryRow = getInventoryStmt.get(date, lotId) as { capacity: number; reserved: number } | undefined;
      if (!inventoryRow) {
        throw new Error("This lot is not available for the selected date.");
      }

      if (inventoryRow.reserved >= inventoryRow.capacity) {
        throw new Error("This lot is sold out for the selected date.");
      }

      const confirmationId = `ACME-${randomUUID().slice(0, 8).toUpperCase()}`;
      const createdAt = new Date().toISOString();

      insertBookingStmt.run(confirmationId, bookingContextId, date, lotId, createdAt);

      const updatedInventory = updateInventoryStmt.run(date, lotId);
      if (updatedInventory.changes === 0) {
        throw new Error("This lot is no longer available. Please refresh and try again.");
      }

      db.exec("COMMIT");

      return {
        confirmationId,
        lotId,
        lotName: lotNameById.get(lotId) || lotId,
        date
      };
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }

  return {
    getBookingForDate,
    bookLot
  };
}
