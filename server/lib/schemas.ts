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
  maxDistanceMiles: z.number().nonnegative().optional().describe("Maximum distance from campus in miles."),
  sortBy: z
    .enum(["most_spots", "closest"])
    .optional()
    .describe("Sort order: most_spots or closest.")
});

export const searchInputSchema = z.object({
  query: z.string().describe("Natural language parking request from the employee."),
  filters: lotFiltersSchema
    .optional()
    .describe("Optional canonical filters generated from the natural-language query. Include only fields the user clearly implies.")
});

export const fetchInputSchema = z.object({
  id: z.string().describe("Unique parking lot identifier to fetch details for.")
});

export const alternativesInputSchema = z.object({
  lotId: z.string().describe("Selected parking lot ID used as the baseline."),
  date: z.string().optional().describe("YYYY-MM-DD date to evaluate alternatives for."),
  maxResults: z.number().int().min(1).max(10).optional().describe("Maximum alternative lots to return.")
});

export const bookInputSchema = z.object({
  lotId: z.string().describe("Parking lot ID to mock-book."),
  date: z.string().optional().describe("YYYY-MM-DD date to mock-book.")
});

export type LotFilters = z.infer<typeof lotFiltersSchema>;
export type SearchInput = z.infer<typeof searchInputSchema>;
export type FetchInput = z.infer<typeof fetchInputSchema>;
export type AlternativesInput = z.infer<typeof alternativesInputSchema>;
export type BookInput = z.infer<typeof bookInputSchema>;

export function textContent(text: string): Array<{ type: "text"; text: string }> {
  return [{ type: "text", text }];
}
