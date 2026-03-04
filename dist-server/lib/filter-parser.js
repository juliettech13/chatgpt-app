import { CreateMessageResultSchema } from "@modelcontextprotocol/sdk/types.js";
import { lotFiltersSchema } from "./schemas.js";
const FILTER_SCHEMA_HELP_TEXT = `{
  "date": "YYYY-MM-DD"?,
  "minSpots": number?,
  "maxSpots": number?,
  "requireCovered": boolean?,
  "excludeCovered": boolean?,
  "requireAccessible": boolean?,
  "excludeAccessible": boolean?,
  "requireEv": boolean?,
  "excludeEv": boolean?,
  "typeIn": ["surface_lot" | "garage"]?,
  "maxDistanceMiles": number?,
  "sortBy": "most_spots" | "closest"?
}`;
function extractJsonObject(text) {
    if (!text)
        return "{}";
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    return start >= 0 && end > start ? text.slice(start, end + 1) : "{}";
}
async function getSamplingResponseText(context, request) {
    const raw = await context.sendRequest(request, CreateMessageResultSchema);
    const response = raw;
    return response?.content?.type === "text" ? response.content.text ?? "{}" : "{}";
}
export async function parseLotFiltersWithSampling(query, context) {
    if (!context?.sendRequest)
        return {};
    const prompt = `Convert this parking request into JSON filters.
    Schema: ${FILTER_SCHEMA_HELP_TEXT}
    Rules:
    - Return only a JSON object, no prose.
    - Include only fields implied by the request.
    - Use booleans only when explicitly implied.
    Request: ${query}`;
    try {
        const params = {
            messages: [{ role: "user", content: { type: "text", text: prompt } }],
            systemPrompt: "You are a strict parser. Return only JSON matching the provided schema. Never add unknown keys.",
            includeContext: "none",
            temperature: 0,
            maxTokens: 220
        };
        const samplingRequest = {
            method: "sampling/createMessage",
            params
        };
        const responseText = await getSamplingResponseText(context, samplingRequest);
        const parsedJson = JSON.parse(extractJsonObject(responseText));
        const validationResult = lotFiltersSchema.safeParse(parsedJson);
        return validationResult.success ? validationResult.data : {};
    }
    catch {
        return {};
    }
}
