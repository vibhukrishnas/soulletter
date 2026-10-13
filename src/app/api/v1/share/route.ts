import { createShareRequestSchema, type CreateShareResponse } from "@/lib/contracts/share";
import { buildShareCard, toTokenPayload } from "@/lib/share/card";
import { enforceRateLimit } from "@/server/http/rate-limit";
import { jsonError, jsonOk, withErrorBoundary } from "@/server/http/respond";
import { parseJsonRequest } from "@/server/http/validate";
import { createShareToken, isShareEnabled } from "@/server/share/token";

/**
 * POST /api/v1/share — creates an opaque, encrypted, expiring share token. The request
 * may only contain Avakahada cell ids and rule ids; no birth data is accepted.
 */
export const POST = withErrorBoundary("share", async (request: Request) => {
  const limited = enforceRateLimit(request, "share");
  if (limited) return limited;
  const availability = isShareEnabled();
  if (!availability.enabled) return jsonError("SHARE_DISABLED", "Share links are not enabled on this server.");
  const parsed = await parseJsonRequest(request, createShareRequestSchema);
  if (!parsed.ok) return parsed.response;
  const card = buildShareCard(parsed.value);
  if (!card.ok) return jsonError("VALIDATION_ERROR", card.message);
  const created = createShareToken(toTokenPayload(parsed.value));
  const body: CreateShareResponse = { token: created.token, path: `/s/${created.token}`, expiresAt: created.expiresAt };
  return jsonOk(body, { status: 201 });
});
