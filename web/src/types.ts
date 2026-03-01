export type ParkingAttributes = {
  covered: boolean;
  accessible: boolean;
  ev_charging?: boolean;
  security_patrol?: boolean;
};

export type ParkingLot = {
  id: string;
  name: string;
  type: string;
  date: string;
  location: { lat: number; lng: number };
  attributes: ParkingAttributes;
  note?: string;
  capacity: number;
  reserved: number;
  availableSpots: number;
  distanceToHQMeters: number;
  distanceToHQMiles: number;
};

export type Campus = {
  id: string;
  name: string;
  address: string;
  location: { lat: number; lng: number };
};

export type ToolOutput = {
  date: string;
  query: string;
  campus: Campus;
  lots: ParkingLot[];
  policy?: {
    hold_ttl_minutes: number;
    max_booking_days_ahead: number;
  };
};

export type WidgetState = {
  selectedLotId?: string;
  selectedDate?: string;
  displayMode?: "inline" | "fullscreen";
};

