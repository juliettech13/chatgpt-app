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
  imageUrl?: string;
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

export type SearchResult = ParkingLot & {
  title: string;
};

export type Booking = {
  confirmationId: string;
  lotId: string;
  lotName: string;
  date: string;
};

export type SearchStructuredContent = {
  date: string;
  query: string;
  bookingContextId: string;
  booking: Booking | null;
  appliedFilters?: Record<string, unknown>;
  totalMatches?: number;
  totalAvailableSpots?: number;
  results: SearchResult[];
};

export type ToolOutputSnapshot = {
  structuredContent?: Partial<SearchStructuredContent>;
};

export type WidgetState = {
  selectedLotId?: string;
  selectedDate?: string;
  bookingContextId?: string;
  selectedLotView?: {
    id: string;
    name: string;
    date: string;
    covered: boolean;
    accessible: boolean;
    evCharging: boolean;
    distanceToHQMeters: number;
    availableSpots: number;
    isBookedForSelectedDate: boolean;
    bookingConfirmationId?: string;
  };
};

export type DisplayMode = "inline" | "fullscreen";

export type OpenAiGlobals = {
  displayMode?: DisplayMode;
  toolOutput?: ToolOutputSnapshot | Partial<SearchStructuredContent>;
  widgetState?: WidgetState;
};

export type ToolCallResult = {
  isError?: boolean;
  structuredContent?: Partial<SearchStructuredContent>;
  content?: Array<{ type?: string; text?: string }>;
};

export type OpenAIApi = {
  requestDisplayMode?: (params: { mode: DisplayMode }) => Promise<{ mode: DisplayMode }>;
  setWidgetState?: (state: WidgetState & Record<string, unknown>) => void;
  callTool?: (toolName: string, args: Record<string, unknown>) => Promise<ToolCallResult>;
};

export type OpenAiSetGlobalsEvent = CustomEvent<{
  globals?: OpenAiGlobals;
}>;

declare global {
  interface Window {
    openai?: OpenAiGlobals & OpenAIApi;
  }
}
