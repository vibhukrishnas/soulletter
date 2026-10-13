import { chartRequestSchema } from "@/lib/contracts/input";
import { loadProvider } from "@/server/http/engine";
import { enforceRateLimit } from "@/server/http/rate-limit";
import { jsonError, jsonOk, withErrorBoundary } from "@/server/http/respond";
import { parseJsonRequest } from "@/server/http/validate";
import { runChart } from "@/server/reading/pipeline";

/** POST /api/v1/chart — validated birth data → calculated chart (no interpretation). */
export const POST = withErrorBoundary("chart", async (request: Request) => {
  const limited = enforceRateLimit(request, "chart");
  if (limited) return limited;
  const parsed = await parseJsonRequest(request, chartRequestSchema);
  if (!parsed.ok) return parsed.response;
  const engine = await loadProvider();
  if (!engine.ok) return engine.response;
  const outcome = await runChart(parsed.value, engine.provider);
  if (!outcome.ok) return jsonError(outcome.code, outcome.message, { details: outcome.details });
  return jsonOk(outcome.chart);
});
