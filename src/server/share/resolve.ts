import type { ShareCardModel } from "@/lib/contracts/share";
import { buildShareCard, fromTokenPayload } from "@/lib/share/card";
import { openShareToken } from "./token";

export type ResolvedShare =
  | { ok: true; card: ShareCardModel; expiresAt: string }
  | { ok: false; reason: "invalid" | "expired" | "disabled" };

/** Opens a share token and rebuilds the public card from the table and registry. */
export function resolveShareToken(token: string): ResolvedShare {
  const opened = openShareToken(token);
  if (!opened.ok) return { ok: false, reason: opened.reason };
  const request = fromTokenPayload(opened.payload);
  if (!request) return { ok: false, reason: "invalid" };
  const card = buildShareCard(request);
  if (!card.ok) return { ok: false, reason: "invalid" };
  return { ok: true, card: card.card, expiresAt: new Date(opened.expiresAtUnix * 1000).toISOString() };
}
