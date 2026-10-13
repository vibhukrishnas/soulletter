/**
 * Privacy-safe share card model. Built ONLY from Avakahada table cells and registry
 * rule ids — never from birth data. The same function runs on the client (preview) and
 * the server (share links), so a share link can never carry more than the card shows.
 */
import { AVAKAHADA_TABLE_VERSION, syllableForCellId } from "@/lib/avakahada/table";
import type { SymbolicCandidate, VerificationStatus, NativeNamingResult, PartnerReading } from "@/lib/contracts/reading";
import { SHARE_CARD_VERSION, type CreateShareRequest, type ShareCardModel, type ShareSyllable } from "@/lib/contracts/share";
import { RULE_SET_VERSION, getRule } from "@/lib/rules/registry";

export const SHARE_DISCLAIMER =
  "A symbolic interpretation for reflection and entertainment — not a prediction of a future partner.";

export const STATUS_LABEL: Record<VerificationStatus, string> = {
  verified_calculation: "Verified calculation",
  documented_traditional_interpretation: "Documented traditional interpretation",
  experimental_symbolic: "Experimental symbolic interpretation",
  provisional_source: "Provisional source",
  disabled_insufficient_evidence: "Disabled — insufficient evidence",
};

export type ShareCardResult = { ok: true; card: ShareCardModel } | { ok: false; message: string };

/** Validates a share request against the table and registry and builds the card. */
export function buildShareCard(request: CreateShareRequest): ShareCardResult {
  const syllables: ShareSyllable[] = [];
  const ruleIds: string[] = [];
  for (const item of request.items) {
    const entry = syllableForCellId(item.cellId);
    if (!entry) return { ok: false, message: "Unknown syllable cell." };
    for (const id of item.ruleIds) {
      const rule = getRule(id);
      if (!rule || !rule.enabled || !rule.candidateMapping) return { ok: false, message: "Unknown or ineligible method." };
      const partnerRule = rule.category === "partner_symbolic";
      if (request.kind === "partner" ? !partnerRule : rule.category !== "native_naming_reference") {
        return { ok: false, message: "Method does not match the card type." };
      }
      if (!ruleIds.includes(id)) ruleIds.push(id);
    }
    if (syllables.some((s) => s.cellId === entry.cellId)) return { ok: false, message: "Duplicate syllable." };
    syllables.push({ cellId: entry.cellId, roman: entry.roman, devanagari: entry.devanagari, iast: entry.iast });
  }
  if (request.kind === "native" && syllables.length !== 1) {
    return { ok: false, message: "A naming-syllable card shows exactly one syllable." };
  }
  const methods = ruleIds.map((id) => {
    const rule = getRule(id)!;
    return { ruleId: id, name: rule.name, statusLabel: STATUS_LABEL[rule.verificationStatus] };
  });
  const firstRule = getRule(ruleIds[0])!;
  return {
    ok: true,
    card: {
      version: SHARE_CARD_VERSION,
      kind: request.kind,
      headline: request.kind === "partner" ? "A symbolic partner syllable" : "A traditional naming syllable",
      primary: syllables[0] ?? null,
      alternatives: syllables.slice(1),
      methods,
      interpretation: firstRule.shareInterpretation ?? "",
      disclaimer: SHARE_DISCLAIMER,
      ruleSetVersion: RULE_SET_VERSION,
      avakahadaTableVersion: AVAKAHADA_TABLE_VERSION,
    },
  };
}

/** Share request for a partner reading: primary + up to three alternatives. */
export function shareRequestFromPartner(partner: PartnerReading): CreateShareRequest | null {
  const list: SymbolicCandidate[] = [...(partner.primary ? [partner.primary] : []), ...partner.alternatives].slice(0, 4);
  if (list.length === 0) return null;
  return {
    kind: "partner",
    items: list.map((c) => ({
      cellId: c.syllable.cellId,
      ruleIds: [...new Set(c.evidence.map((e) => e.ruleId))].slice(0, 4),
    })),
  };
}

export function shareRequestFromNative(native: NativeNamingResult): CreateShareRequest | null {
  if (!native.atStatedTime) return null;
  return {
    kind: "native",
    items: [{ cellId: native.atStatedTime.syllable.cellId, ruleIds: [native.atStatedTime.evidence.ruleId] }],
  };
}

/** Plain-text version of a card for "Copy result". Contains no personal data. */
export function shareCardText(card: ShareCardModel, url?: string): string {
  const fmt = (s: ShareSyllable) => `${s.roman} (${s.devanagari}, ${s.iast})`;
  const lines = [
    `SoulLetter — ${card.headline}`,
    card.primary ? `Syllable: ${fmt(card.primary)}` : "No single syllable could be determined.",
  ];
  if (card.alternatives.length > 0) lines.push(`Also shown: ${card.alternatives.map(fmt).join(", ")}`);
  lines.push(`Method: ${card.methods.map((m) => `${m.name} — ${m.statusLabel}`).join("; ")}`);
  if (card.interpretation) lines.push(card.interpretation);
  lines.push(card.disclaimer);
  if (url) lines.push(url);
  return lines.join("\n");
}

/** Compact token payload: only cell ids and rule ids (plus versions). */
export interface ShareTokenPayload extends Record<string, unknown> {
  v: 1;
  k: "p" | "n";
  i: [string, string[]][];
  rs: string;
}

export function toTokenPayload(request: CreateShareRequest): ShareTokenPayload {
  return { v: 1, k: request.kind === "partner" ? "p" : "n", i: request.items.map((x) => [x.cellId, x.ruleIds]), rs: RULE_SET_VERSION };
}

export function fromTokenPayload(payload: Record<string, unknown>): CreateShareRequest | null {
  const p = payload as Partial<ShareTokenPayload>;
  if (p.v !== 1 || (p.k !== "p" && p.k !== "n") || !Array.isArray(p.i)) return null;
  const items = p.i
    .filter((x): x is [string, string[]] => Array.isArray(x) && typeof x[0] === "string" && Array.isArray(x[1]))
    .map(([cellId, ruleIds]) => ({ cellId, ruleIds: ruleIds.filter((r): r is string => typeof r === "string") }));
  if (items.length === 0 || items.length !== p.i.length) return null;
  return { kind: p.k === "p" ? "partner" : "native", items };
}
