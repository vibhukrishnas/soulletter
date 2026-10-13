/**
 * Stable identifiers for every interpretation method the registry knows about.
 * Only ENABLEABLE_RULE_IDS can be requested; the others are registered so the
 * methodology page can explain why they are excluded.
 */

export const ENABLEABLE_RULE_IDS = [
  "naming.moon-pada-avakahada",
  "partner.seventh-lord-pada-avakahada",
  "partner.darakaraka-pada-avakahada",
  "numerology.life-path",
  "numerology.psychic-number",
  "numerology.destiny-number",
  "numerology.name-pythagorean",
  "numerology.name-chaldean",
] as const;

export const EXCLUDED_RULE_IDS = [
  "partner.upapada-lagna",
  "partner.nadi-name-examples",
  "partner.rare-syllable-substitution",
  "partner.name-frequency-filter",
  "partner.katapayadi-reverse",
  "partner.prasna-query-time",
  "partner.palm-feature-fusion",
  "numerology.number-to-initial",
] as const;

export type EnableableRuleId = (typeof ENABLEABLE_RULE_IDS)[number];
export type ExcludedRuleId = (typeof EXCLUDED_RULE_IDS)[number];
export type RuleId = EnableableRuleId | ExcludedRuleId;

export const PARTNER_RULE_IDS = [
  "partner.seventh-lord-pada-avakahada",
  "partner.darakaraka-pada-avakahada",
] as const satisfies readonly EnableableRuleId[];

export const NAME_NUMEROLOGY_RULE_IDS = [
  "numerology.name-pythagorean",
  "numerology.name-chaldean",
] as const satisfies readonly EnableableRuleId[];

export const DEFAULT_ENABLED_RULE_IDS: readonly EnableableRuleId[] = [
  "naming.moon-pada-avakahada",
  "partner.seventh-lord-pada-avakahada",
  "partner.darakaraka-pada-avakahada",
  "numerology.life-path",
  "numerology.psychic-number",
  "numerology.destiny-number",
];

export function isEnableableRuleId(id: string): id is EnableableRuleId {
  return (ENABLEABLE_RULE_IDS as readonly string[]).includes(id);
}

export function isExcludedRuleId(id: string): id is ExcludedRuleId {
  return (EXCLUDED_RULE_IDS as readonly string[]).includes(id);
}
