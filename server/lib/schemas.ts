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

export type LotFilters = z.infer<typeof lotFiltersSchema>;
export type SearchInput = z.infer<typeof searchInputSchema>;

export function textContent(text: string): Array<{ type: "text"; text: string }> {
  return [{ type: "text", text }];
}
