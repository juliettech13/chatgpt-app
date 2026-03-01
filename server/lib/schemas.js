import { z } from "zod";

export const searchInputSchema = z.object({
  query: z.string().describe("Natural language parking request from the employee.")
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

export function textContent(text) {
  return [{ type: "text", text }];
}
