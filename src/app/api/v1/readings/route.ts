import { NDJSON_CONTENT_TYPE, type ReadingStreamEvent } from "@/lib/contracts/api";
import { readingRequestSchema } from "@/lib/contracts/input";
import { loadProvider } from "@/server/http/engine";
import { enforceRateLimit } from "@/server/http/rate-limit";
import { jsonError, jsonOk, withErrorBoundary } from "@/server/http/respond";
import { parseJsonRequest } from "@/server/http/validate";
import { runReading } from "@/server/reading/pipeline";

/**
 * POST /api/v1/readings — full reading (chart + rule evaluation + numerology).
 *
 * With `Accept: application/x-ndjson` the response streams one JSON event per line:
 * a `stage` event after each pipeline stage actually completes, then exactly one
 * `result` or `error` event. Request validation and rate limiting happen before the
 * stream opens and return ordinary JSON errors with HTTP status codes.
 */
export const POST = withErrorBoundary("readings", async (request: Request) => {
  const limited = enforceRateLimit(request, "readings");
  if (limited) return limited;
  const parsed = await parseJsonRequest(request, readingRequestSchema);
  if (!parsed.ok) return parsed.response;
  const engine = await loadProvider();
  if (!engine.ok) return engine.response;

  const wantsStream = (request.headers.get("accept") ?? "").includes(NDJSON_CONTENT_TYPE);
  if (!wantsStream) {
    const outcome = await runReading(parsed.value, engine.provider);
    if (!outcome.ok) return jsonError(outcome.code, outcome.message, { details: outcome.details });
    return jsonOk(outcome.result);
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: ReadingStreamEvent) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      try {
        const outcome = await runReading(parsed.value, engine.provider, (stage, status) => send({ type: "stage", stage, status }));
        if (outcome.ok) send({ type: "result", data: outcome.result });
        else send({ type: "error", error: { code: outcome.code, message: outcome.message, details: outcome.details } });
      } catch (error) {
        console.error(`[api] readings stream failed: ${error instanceof Error ? error.name : "unknown"}`);
        send({ type: "error", error: { code: "INTERNAL_ERROR", message: "Something went wrong. Please try again." } });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": `${NDJSON_CONTENT_TYPE}; charset=utf-8`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
});
