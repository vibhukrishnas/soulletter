/**
 * Privacy-safe sharing contract. A share card can ONLY contain the fields below; it never
 * contains birth date, birth time, coordinates, place, time zone, name, Nakshatra
 * placements of the person, or numerology derived from the birth date.
 */
import { z } from "zod";

export const SHARE_CARD_VERSION = 1;

export interface ShareSyllable {
  cellId: string;
  roman: string;
  devanagari: string;
  iast: string;
}

export interface ShareMethod {
  ruleId: string;
  name: string;
  /** e.g. "Experimental symbolic interpretation" */
  statusLabel: string;
}

export interface ShareCardModel {
  version: typeof SHARE_CARD_VERSION;
  kind: "partner" | "native";
  headline: string;
  primary: ShareSyllable | null;
  alternatives: ShareSyllable[];
  methods: ShareMethod[];
  interpretation: string;
  disclaimer: string;
  ruleSetVersion: string;
  avakahadaTableVersion: string;
}

/** What the client sends to create a share link: table cells and rule ids only. */
export const createShareRequestSchema = z
  .object({
    kind: z.enum(["partner", "native"]),
    items: z
      .array(
        z
          .object({
            cellId: z.string().regex(/^(?:[1-9]|1\d|2[0-7])-[1-4]$/),
            ruleIds: z.array(z.string().max(64)).min(1).max(4),
          })
          .strict(),
      )
      .min(1)
      .max(4),
  })
  .strict();

export type CreateShareRequest = z.infer<typeof createShareRequestSchema>;

export interface CreateShareResponse {
  token: string;
  /** Relative URL of the public share page, e.g. "/s/<token>". */
  path: string;
  expiresAt: string;
}
