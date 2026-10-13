import { z } from "zod";
import { birthInputSchema } from "@/lib/contracts/input";
import { computePreview } from "@/server/chart/preview";
import { buildTimeContext, normalizeBirth } from "@/server/chart/time-context";
import { loadProvider } from "@/server/http/engine";
import { enforceRateLimit } from "@/server/http/rate-limit";
import { jsonError, jsonOk, withErrorBoundary } from "@/server/http/respond";
import { parseJsonRequest } from "@/server/http/validate";

const previewRequestSchema = z.object({ birth: birthInputSchema }).strict();

/**
 * POST /api/v1/chart/preview — the user's calculated placements (Rashi, Nakshatra, Lagna,
 * houses) and the result of every selectable convention, for live display while the
 * form is being filled in. Uses the same validation and engine as /chart.
 */
export const POST = withErrorBoundary("chart-preview", async (request: Request) => {
  const limited = enforceRateLimit(request, "preview");
  if (limited) return limited;
  const parsed = await parseJsonRequest(request, previewRequestSchema);
  if (!parsed.ok) return parsed.response;
  const engine = await loadProvider();
  if (!engine.ok) return engine.response;
  const birth = normalizeBirth(parsed.value.birth);
  const time = buildTimeContext(birth);
  if (!time.ok) return jsonError(time.code, time.message, { details: time.details });
  try {
    return jsonOk(computePreview({ birth, ctx: time.ctx, provider: engine.provider }));
  } catch {
    return jsonError("CALCULATION_FAILED", "The chart could not be calculated for these details. Please check them and try again.");
  }
});
