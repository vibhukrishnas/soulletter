import { numerologyRequestSchema } from "@/lib/contracts/input";
import { computeNumerology } from "@/lib/numerology/numerology";
import { enforceRateLimit } from "@/server/http/rate-limit";
import { jsonOk, withErrorBoundary } from "@/server/http/respond";
import { parseJsonRequest } from "@/server/http/validate";

/** POST /api/v1/numerology — deterministic numerology only (never produces syllables). */
export const POST = withErrorBoundary("numerology", async (request: Request) => {
  const limited = enforceRateLimit(request, "readings");
  if (limited) return limited;
  const parsed = await parseJsonRequest(request, numerologyRequestSchema);
  if (!parsed.ok) return parsed.response;
  return jsonOk(
    computeNumerology({
      birthDate: parsed.value.birthDate,
      settings: parsed.value.numerology,
      enabledRuleIds: parsed.value.enabledRuleIds,
      name: parsed.value.name,
    }),
  );
});
