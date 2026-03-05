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

export type SearchStructuredContent = {
  date: string;
  query: string;
  results: SearchResult[];
};

export type ToolOutputSnapshot = {
  structuredContent?: Partial<SearchStructuredContent>;
};

export type WidgetState = {
  selectedLotId?: string;
};

export type DisplayMode = "inline" | "fullscreen";

export type OpenAiGlobals = {
  displayMode?: DisplayMode;
  toolOutput?: ToolOutputSnapshot | Partial<SearchStructuredContent>;
  widgetState?: WidgetState;
};

export type OpenAIApi = {
  requestDisplayMode?: (params: { mode: DisplayMode }) => Promise<{ mode: DisplayMode }>;
  setWidgetState?: (state: WidgetState & Record<string, unknown>) => void;
  updateModelContext?: (payload: Record<string, unknown>) => Promise<void>;
};

export type OpenAiSetGlobalsEvent = CustomEvent<{
  globals?: OpenAiGlobals;
}>;

declare global {
  interface Window {
    openai?: OpenAiGlobals & OpenAIApi;
  }
}
