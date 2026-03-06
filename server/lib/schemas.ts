import { z } from "zod";

export const lotFiltersSchema = z.object({
  date: z.string().optional().describe("Target date in YYYY-MM-DD format. Defaults to today."),
  minSpots: z.number().int().min(0).optional().describe("Minimum available spots required."),
  maxSpots: z.number().int().min(0).optional().describe("Maximum available spots allowed."),
  requireCovered: z.boolean().optional().describe("Only include covered lots when true."),
  excludeCovered: z.boolean().optional().describe("Exclude covered lots when true."),
  requireAccessible: z.boolean().optional().describe("Only include accessible lots when true."),
  excludeAccessible: z.boolean().optional().describe("Exclude accessible lots when true."),
  requireEv: z.boolean().optional().describe("Only include lots with EV charging when true."),
  excludeEv: z.boolean().optional().describe("Exclude lots with EV charging when true."),
  typeIn: z
    .array(z.enum(["surface_lot", "garage"]))
    .optional()
    .describe("Allowed lot types."),
  maxDistanceMiles: z.number().nonnegative().optional().describe("Maximum distance from campus in miles.")
});

export const searchInputSchema = z.object({
  query: z.string().describe("Natural language parking request from the employee."),
  bookingContextId: z
    .string()
    .optional()
    .describe("Anonymous booking context identifier reused across searches and bookings in the same ChatGPT session."),
  filters: lotFiltersSchema
    .optional()
    .describe("Optional canonical filters generated from the natural-language query. Include only fields the user clearly implies.")
});

export const bookLotInputSchema = z.object({
  bookingContextId: z
    .string()
    .describe("Anonymous booking context identifier returned by the search tool for this ChatGPT session."),
  lotId: z.string().describe("Canonical lot identifier to book."),
  date: z.string().describe("Target booking date in YYYY-MM-DD format."),
  source: z
    .enum(["widget"])
    .optional()
    .describe("Optional booking origin. Present only for widget-initiated bookings so the server can preserve fullscreen widget behavior."),
  query: z
    .string()
    .optional()
    .describe("The most recent user request or search query, if available, so the widget can keep displaying consistent context.")
});

export type LotFilters = z.infer<typeof lotFiltersSchema>;
export type SearchInput = z.infer<typeof searchInputSchema>;
export type BookLotInput = z.infer<typeof bookLotInputSchema>;

export function textContent(text: string): Array<{ type: "text"; text: string }> {
  return [{ type: "text", text }];
}
