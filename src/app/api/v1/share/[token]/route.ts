import { jsonError, jsonOk, withErrorBoundary } from "@/server/http/respond";
import { resolveShareToken } from "@/server/share/resolve";

/** GET /api/v1/share/:token — only the fields approved for public sharing. */
export const GET = withErrorBoundary(
  "share-token",
  async (_request: Request, context: { params: Promise<{ token: string }> }) => {
    const { token } = await context.params;
    const resolved = resolveShareToken(token);
    if (resolved.ok) return jsonOk({ card: resolved.card, expiresAt: resolved.expiresAt });
    if (resolved.reason === "expired") return jsonError("SHARE_TOKEN_EXPIRED", "This share link has expired.");
    if (resolved.reason === "disabled") return jsonError("SHARE_DISABLED", "Share links are not enabled on this server.");
    return jsonError("SHARE_TOKEN_INVALID", "This share link is not valid.");
  },
);
