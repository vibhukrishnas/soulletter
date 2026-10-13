/**
 * Request schemas shared by the client form and the server. The server re-validates
 * everything; client validation is only for user feedback.
 *
 * Policy: inputs are never silently corrected. Anything impossible or inconsistent is
 * rejected with a field-level message.
 */
import { z } from "zod";
import {
  isValidIanaTimeZone,
  isSupportedYear,
  MAX_SUPPORTED_YEAR,
  MIN_SUPPORTED_YEAR,
  parseClockTime,
  parseIsoDate,
} from "@/lib/astro/time";
import { ENABLEABLE_RULE_IDS, EXCLUDED_RULE_IDS } from "@/lib/rules/ids";

export const MAX_REQUEST_BYTES = 16 * 1024;
export const MAX_NAME_LENGTH = 80;
export const MAX_PLACE_LABEL_LENGTH = 160;

// Reject control characters and angle brackets in free text.
const SAFE_TEXT_RE = /^[^\u0000-\u001f\u007f<>]*$/;

export const birthTimeAccuracySchema = z.enum(["to_the_minute", "within_15_minutes", "within_1_hour"]);

export const placeSchema = z
  .object({
    label: z
      .string()
      .trim()
      .max(MAX_PLACE_LABEL_LENGTH)
      .regex(SAFE_TEXT_RE, { error: "Place name contains unsupported characters" })
      .nullable(),
    latitude: z.number().min(-90).max(90).nullable(),
    longitude: z.number().min(-180).max(180).nullable(),
    timeZone: z.string().trim().max(64).nullable(),
  })
  .strict();

export const birthInputSchema = z
  .object({
    birthDate: z.string(),
    birthTimeKnown: z.boolean(),
    birthTime: z.string().nullable(),
    birthTimeAccuracy: birthTimeAccuracySchema.nullable(),
    /** Only consulted when the local time occurs twice (end of daylight saving time). */
    dstChoice: z.enum(["earlier", "later"]).nullable(),
    place: placeSchema,
  })
  .strict()
  .superRefine((v, ctx) => {
    const date = parseIsoDate(v.birthDate);
    if (!date) {
      ctx.addIssue({ code: "custom", path: ["birthDate"], message: "Enter a real calendar date as YYYY-MM-DD" });
    } else if (!isSupportedYear(date.year)) {
      ctx.addIssue({
        code: "custom",
        path: ["birthDate"],
        message: `Supported birth years are ${MIN_SUPPORTED_YEAR}–${MAX_SUPPORTED_YEAR}`,
      });
    }

    if (v.birthTimeKnown) {
      if (v.birthTime === null || !parseClockTime(v.birthTime)) {
        ctx.addIssue({ code: "custom", path: ["birthTime"], message: "Enter the birth time as HH:mm (24-hour)" });
      }
      if (v.birthTimeAccuracy === null) {
        ctx.addIssue({ code: "custom", path: ["birthTimeAccuracy"], message: "Choose how accurate the birth time is" });
      }
    } else {
      if (v.birthTime !== null) {
        ctx.addIssue({
          code: "custom",
          path: ["birthTime"],
          message: "Birth time must be empty when it is marked as unknown",
        });
      }
      if (v.birthTimeAccuracy !== null) {
        ctx.addIssue({
          code: "custom",
          path: ["birthTimeAccuracy"],
          message: "Accuracy only applies when the birth time is known",
        });
      }
    }

    const { latitude, longitude, timeZone } = v.place;
    if ((latitude === null) !== (longitude === null)) {
      ctx.addIssue({
        code: "custom",
        path: ["place", latitude === null ? "latitude" : "longitude"],
        message: "Provide both latitude and longitude, or neither",
      });
    }
    if (timeZone !== null && !isValidIanaTimeZone(timeZone)) {
      ctx.addIssue({
        code: "custom",
        path: ["place", "timeZone"],
        message: "Use an IANA time-zone name such as Asia/Kolkata (not a UTC offset)",
      });
    }
    if (latitude !== null && longitude !== null && timeZone === null) {
      ctx.addIssue({
        code: "custom",
        path: ["place", "timeZone"],
        message: "Choose the time zone for this birthplace",
      });
    }
  });

export const chartSettingsSchema = z
  .object({
    zodiac: z.literal("sidereal"),
    ayanamsha: z.literal("lahiri"),
    chart: z.literal("D1"),
    houseSystem: z.literal("whole_sign"),
    nodeType: z.enum(["mean", "true"]),
    charaKarakaScheme: z.enum(["seven_planet", "eight_planet"]),
  })
  .strict();

export const numerologySettingsSchema = z
  .object({
    lifePathMethod: z.enum(["reduce_components", "full_digit_sum"]),
    masterNumbers: z.enum(["keep_11_22_33", "keep_11_22", "none"]),
    /** Declared convention for the letter Y in vowel/consonant splits. */
    yHandling: z.literal("consonant"),
  })
  .strict();

const ruleIdSchema = z.string().max(64);

export const readingRequestSchema = z
  .object({
    birth: birthInputSchema,
    settings: chartSettingsSchema,
    numerology: numerologySettingsSchema,
    enabledRuleIds: z.array(ruleIdSchema).max(32),
    /** Required when any experimental partner rule is enabled. */
    acknowledgeExperimental: z.boolean(),
    /** Only accepted when a name-based numerology method is enabled. */
    name: z
      .string()
      .trim()
      .min(1)
      .max(MAX_NAME_LENGTH)
      .regex(SAFE_TEXT_RE, { error: "Name contains unsupported characters" })
      .nullable(),
  })
  .strict()
  .superRefine((v, ctx) => {
    const seen = new Set<string>();
    v.enabledRuleIds.forEach((id, i) => {
      if (seen.has(id)) {
        ctx.addIssue({ code: "custom", path: ["enabledRuleIds", i], message: `Duplicate method ${id}` });
      }
      seen.add(id);
      if ((EXCLUDED_RULE_IDS as readonly string[]).includes(id)) {
        ctx.addIssue({
          code: "custom",
          path: ["enabledRuleIds", i],
          message: `Method ${id} is disabled because its evidence is insufficient`,
        });
      } else if (!(ENABLEABLE_RULE_IDS as readonly string[]).includes(id)) {
        ctx.addIssue({ code: "custom", path: ["enabledRuleIds", i], message: `Unknown method ${id}` });
      }
    });
    const partnerEnabled = v.enabledRuleIds.some((id) => id.startsWith("partner."));
    if (partnerEnabled && !v.acknowledgeExperimental) {
      ctx.addIssue({
        code: "custom",
        path: ["acknowledgeExperimental"],
        message: "Confirm that partner-syllable readings are experimental symbolic interpretations",
      });
    }
    const nameMethodEnabled = v.enabledRuleIds.some((id) => id.startsWith("numerology.name-"));
    if (nameMethodEnabled && v.name === null) {
      ctx.addIssue({ code: "custom", path: ["name"], message: "Enter a name for name-based numerology" });
    }
    if (!nameMethodEnabled && v.name !== null) {
      ctx.addIssue({
        code: "custom",
        path: ["name"],
        message: "A name is only sent when a name-based numerology method is selected",
      });
    }
  });

export const chartRequestSchema = z
  .object({ birth: birthInputSchema, settings: chartSettingsSchema })
  .strict();

export const numerologyRequestSchema = z
  .object({
    birthDate: z.string(),
    numerology: numerologySettingsSchema,
    enabledRuleIds: z.array(ruleIdSchema).max(16),
    name: z.string().trim().min(1).max(MAX_NAME_LENGTH).regex(SAFE_TEXT_RE).nullable(),
  })
  .strict()
  .superRefine((v, ctx) => {
    const date = parseIsoDate(v.birthDate);
    if (!date || !isSupportedYear(date.year)) {
      ctx.addIssue({ code: "custom", path: ["birthDate"], message: "Enter a supported calendar date as YYYY-MM-DD" });
    }
    v.enabledRuleIds.forEach((id, i) => {
      if (!id.startsWith("numerology.") || !(ENABLEABLE_RULE_IDS as readonly string[]).includes(id)) {
        ctx.addIssue({ code: "custom", path: ["enabledRuleIds", i], message: `Not a numerology method: ${id}` });
      }
    });
    const nameMethodEnabled = v.enabledRuleIds.some((id) => id.startsWith("numerology.name-"));
    if (nameMethodEnabled !== (v.name !== null)) {
      ctx.addIssue({
        code: "custom",
        path: ["name"],
        message: nameMethodEnabled ? "Enter a name for name-based numerology" : "Name provided without a name-based method",
      });
    }
  });

export type BirthInput = z.infer<typeof birthInputSchema>;
export type ChartSettingsInput = z.infer<typeof chartSettingsSchema>;
export type NumerologySettings = z.infer<typeof numerologySettingsSchema>;
export type ReadingRequest = z.infer<typeof readingRequestSchema>;
export type ChartRequest = z.infer<typeof chartRequestSchema>;
export type NumerologyRequest = z.infer<typeof numerologyRequestSchema>;

export const DEFAULT_CHART_SETTINGS: ChartSettingsInput = {
  zodiac: "sidereal",
  ayanamsha: "lahiri",
  chart: "D1",
  houseSystem: "whole_sign",
  nodeType: "mean",
  charaKarakaScheme: "seven_planet",
};

export const DEFAULT_NUMEROLOGY_SETTINGS: NumerologySettings = {
  lifePathMethod: "reduce_components",
  masterNumbers: "keep_11_22_33",
  yHandling: "consonant",
};
