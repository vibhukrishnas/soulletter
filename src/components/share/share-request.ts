import type { ReadingResult } from "@/lib/contracts/reading";
import type { CreateShareRequest } from "@/lib/contracts/share";
import { shareRequestFromNative, shareRequestFromPartner } from "@/lib/share/card";

export type CardKind = "partner" | "native";

/**
 * Share request (cell ids + rule ids only) for a reading. A partner card is only offered
 * when the service put a syllable first: time-conditional possibilities are never
 * promoted to the card's main syllable.
 */
export function shareRequestFor(result: ReadingResult, kind: CardKind): CreateShareRequest | null {
  if (kind === "partner") return result.partner.primary ? shareRequestFromPartner(result.partner) : null;
  return shareRequestFromNative(result.native);
}
