import { createCipheriv, hkdfSync, randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetConfigForTests } from "@/server/config/env";
import {
  createShareToken,
  isShareEnabled,
  MAX_SHARE_PLAINTEXT_BYTES,
  MAX_SHARE_TOKEN_LENGTH,
  openShareToken,
  sealShareToken,
  ShareDisabledError,
  SharePayloadTooLargeError,
  SHARE_TOKEN_VERSION,
} from "./token";

const SECRET = "test-secret-0123456789-abcdefghijklmnop";
const OTHER_SECRET = "another-secret-0123456789-abcdefghijklm";
const NOW = Date.UTC(2026, 0, 15, 12, 0, 0);
const DAY_MS = 86_400_000;
const payload = { v: 1, kind: "partner", items: [{ cellId: "4-2", ruleIds: ["partner.darakaraka-pada"] }] };

/** Encrypts an arbitrary plaintext exactly like the implementation (for crafted tokens). */
function craftToken(plaintext: string, secret = SECRET, version = SHARE_TOKEN_VERSION): string {
  const key = Buffer.from(hkdfSync("sha256", Buffer.from(secret), "soulletter-share-v1", "share-token", 32));
  const iv = randomBytes(12);
  const versionByte = Buffer.from([version]);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(versionByte);
  const ciphertext = Buffer.concat([cipher.update(Buffer.from(plaintext)), cipher.final()]);
  return Buffer.concat([versionByte, iv, ciphertext, cipher.getAuthTag()]).toString("base64url");
}

function flipBit(token: string, byteIndex: number): string {
  const raw = Buffer.from(token, "base64url");
  raw[byteIndex] ^= 0x01;
  return raw.toString("base64url");
}

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  resetConfigForTests();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  resetConfigForTests();
});

describe("sealShareToken / openShareToken", () => {
  it("round-trips a payload", () => {
    const token = sealShareToken(payload, { secret: SECRET, now: NOW, ttlDays: 30 });
    expect(openShareToken(token, { secret: SECRET, now: NOW })).toEqual({
      ok: true,
      payload,
      expiresAtUnix: NOW / 1000 + 30 * 86_400,
    });
  });

  it("produces opaque, URL-safe tokens with the documented layout", () => {
    const token = sealShareToken(payload, { secret: SECRET, now: NOW, ttlDays: 30 });
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(token.length).toBeLessThanOrEqual(MAX_SHARE_TOKEN_LENGTH);
    const raw = Buffer.from(token, "base64url");
    expect(raw[0]).toBe(0x01);
    // version | 12-byte IV | ciphertext (same length as the plaintext under GCM) | 16-byte tag
    const plaintext = JSON.stringify({ exp: NOW / 1000 + 30 * 86_400, p: payload });
    expect(raw.byteLength).toBe(1 + 12 + Buffer.byteLength(plaintext) + 16);
    expect(raw.toString("latin1")).not.toContain("partner");
  });

  it("uses a fresh IV for every token", () => {
    const a = sealShareToken(payload, { secret: SECRET, now: NOW });
    const b = sealShareToken(payload, { secret: SECRET, now: NOW });
    expect(a).not.toBe(b);
    expect(Buffer.from(a, "base64url").subarray(1, 13).equals(Buffer.from(b, "base64url").subarray(1, 13))).toBe(false);
  });

  it("createShareToken reports the expiry embedded in the token", () => {
    const created = createShareToken(payload, { secret: SECRET, now: NOW + 999, ttlDays: 7 });
    expect(created.expiresAtUnix).toBe(NOW / 1000 + 7 * 86_400);
    expect(created.expiresAt).toBe(new Date(NOW + 7 * DAY_MS).toISOString());
    const opened = openShareToken(created.token, { secret: SECRET, now: NOW });
    expect(opened.ok && opened.expiresAtUnix).toBe(created.expiresAtUnix);
  });

  describe("expiry", () => {
    const token = sealShareToken(payload, { secret: SECRET, now: NOW, ttlDays: 1 });

    it("is valid until just before exp", () => {
      expect(openShareToken(token, { secret: SECRET, now: NOW + DAY_MS - 1000 }).ok).toBe(true);
    });

    it("is expired at and after exp", () => {
      expect(openShareToken(token, { secret: SECRET, now: NOW + DAY_MS })).toEqual({ ok: false, reason: "expired" });
      expect(openShareToken(token, { secret: SECRET, now: NOW + 400 * DAY_MS })).toEqual({
        ok: false,
        reason: "expired",
      });
    });

    it("authenticates before checking expiry (a forged expired token is invalid, not expired)", () => {
      const forged = craftToken(JSON.stringify({ exp: 1, p: {} }), OTHER_SECRET);
      expect(openShareToken(forged, { secret: SECRET, now: NOW })).toEqual({ ok: false, reason: "invalid" });
      expect(openShareToken(forged, { secret: OTHER_SECRET, now: NOW })).toEqual({ ok: false, reason: "expired" });
    });
  });

  describe("rejects tampered and malformed tokens", () => {
    const token = sealShareToken(payload, { secret: SECRET, now: NOW });
    const rawLength = Buffer.from(token, "base64url").byteLength;

    it.each([
      ["version byte", 0],
      ["IV", 5],
      ["ciphertext", 20],
      ["last ciphertext byte", rawLength - 17],
      ["tag", rawLength - 1],
    ])("a flipped bit in the %s", (_part, index) => {
      expect(openShareToken(flipBit(token, index), { secret: SECRET, now: NOW })).toEqual({
        ok: false,
        reason: "invalid",
      });
    });

    it("a token sealed with another secret", () => {
      const foreign = sealShareToken(payload, { secret: OTHER_SECRET, now: NOW });
      expect(openShareToken(foreign, { secret: SECRET, now: NOW })).toEqual({ ok: false, reason: "invalid" });
    });

    it("truncated tokens", () => {
      const raw = Buffer.from(token, "base64url");
      for (const length of [0, 1, 13, 29, 30, raw.byteLength - 16, raw.byteLength - 1]) {
        const truncated = raw.subarray(0, length).toString("base64url");
        expect(openShareToken(truncated, { secret: SECRET, now: NOW }).ok).toBe(false);
      }
      expect(openShareToken(token.slice(0, -1), { secret: SECRET, now: NOW }).ok).toBe(false);
    });

    it("extended tokens", () => {
      const raw = Buffer.concat([Buffer.from(token, "base64url"), Buffer.from([0])]).toString("base64url");
      expect(openShareToken(raw, { secret: SECRET, now: NOW })).toEqual({ ok: false, reason: "invalid" });
    });

    it.each([
      ["padding", `${"A".repeat(40)}==`],
      ["standard base64 characters", `${"A".repeat(40)}+/`],
      ["whitespace", ` ${"A".repeat(40)}`],
      ["dots", "a.b.c"],
      ["an empty string", ""],
      ["an over-long token", "A".repeat(MAX_SHARE_TOKEN_LENGTH + 1)],
    ])("non-canonical input: %s", (_label, value) => {
      expect(openShareToken(value, { secret: SECRET, now: NOW })).toEqual({ ok: false, reason: "invalid" });
    });

    it("non-string input", () => {
      expect(openShareToken(undefined, { secret: SECRET })).toEqual({ ok: false, reason: "invalid" });
      expect(openShareToken(42, { secret: SECRET })).toEqual({ ok: false, reason: "invalid" });
    });

    it("non-canonical base64url encodings of a valid token", () => {
      // When the byte length is not a multiple of 3, the last base64url character has
      // unused low bits; changing them decodes to the same bytes but must be rejected.
      const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
      const candidate = [0, 1, 2]
        .map((pad) => sealShareToken({ ...payload, pad: "x".repeat(pad) }, { secret: SECRET, now: NOW }))
        .find((t) => Buffer.from(t, "base64url").byteLength % 3 !== 0)!;
      expect(openShareToken(candidate, { secret: SECRET, now: NOW }).ok).toBe(true);
      const raw = Buffer.from(candidate, "base64url");
      const variants = Array.from(alphabet, (ch) => candidate.slice(0, -1) + ch).filter(
        (variant) => variant !== candidate && Buffer.from(variant, "base64url").equals(raw),
      );
      expect(variants.length).toBeGreaterThan(0);
      for (const variant of variants) {
        expect(openShareToken(variant, { secret: SECRET, now: NOW })).toEqual({ ok: false, reason: "invalid" });
      }
    });

    it("authentic tokens with an unknown version", () => {
      const v2 = craftToken(JSON.stringify({ exp: NOW / 1000 + 100, p: {} }), SECRET, 0x02);
      expect(openShareToken(v2, { secret: SECRET, now: NOW })).toEqual({ ok: false, reason: "invalid" });
    });

    it.each([
      ["non-JSON plaintext", "not json"],
      ["a non-object document", "[1,2,3]"],
      ["a missing exp", JSON.stringify({ p: {} })],
      ["a non-integer exp", JSON.stringify({ exp: 1.5e12 + 0.5, p: {} })],
      ["a string exp", JSON.stringify({ exp: "9999999999", p: {} })],
      ["a missing payload", JSON.stringify({ exp: 9_999_999_999 })],
      ["an array payload", JSON.stringify({ exp: 9_999_999_999, p: [] })],
    ])("authentic tokens with %s", (_label, plaintext) => {
      expect(openShareToken(craftToken(plaintext), { secret: SECRET, now: NOW })).toEqual({
        ok: false,
        reason: "invalid",
      });
    });
  });

  describe("sealing limits", () => {
    it("rejects payloads whose plaintext exceeds the limit", () => {
      expect(() => sealShareToken({ text: "x".repeat(MAX_SHARE_PLAINTEXT_BYTES) }, { secret: SECRET })).toThrow(
        SharePayloadTooLargeError,
      );
      // Multi-byte characters count by UTF-8 bytes, not code units.
      expect(() => sealShareToken({ text: "é".repeat(500) }, { secret: SECRET })).toThrow(SharePayloadTooLargeError);
    });

    it("accepts the largest payload that fits and keeps the token within the length limit", () => {
      const overhead = JSON.stringify({ exp: NOW / 1000 + 30 * 86_400, p: { t: "" } }).length;
      const token = sealShareToken({ t: "x".repeat(MAX_SHARE_PLAINTEXT_BYTES - overhead) }, { secret: SECRET, now: NOW });
      expect(token.length).toBeLessThanOrEqual(MAX_SHARE_TOKEN_LENGTH);
      expect(openShareToken(token, { secret: SECRET, now: NOW }).ok).toBe(true);
    });

    it("rejects non-object payloads", () => {
      expect(() => sealShareToken([] as unknown as Record<string, unknown>, { secret: SECRET })).toThrow(TypeError);
      expect(() => sealShareToken(null as unknown as Record<string, unknown>, { secret: SECRET })).toThrow(TypeError);
      expect(() => sealShareToken(new Date() as unknown as Record<string, unknown>, { secret: SECRET })).toThrow(
        TypeError,
      );
    });

    it.each([0, 366, 1.5, Number.NaN])("rejects ttlDays %s", (ttlDays) => {
      expect(() => sealShareToken(payload, { secret: SECRET, ttlDays })).toThrow(RangeError);
    });

    it("rejects injected secrets shorter than 32 characters", () => {
      expect(() => sealShareToken(payload, { secret: "short" })).toThrow(RangeError);
      expect(() => openShareToken("abc", { secret: "short" })).toThrow(RangeError);
    });
  });
});

describe("configuration integration", () => {
  it("uses SHARE_TOKEN_SECRET and SHARE_TOKEN_TTL_DAYS from the environment", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SHARE_TOKEN_SECRET", SECRET);
    vi.stubEnv("SHARE_TOKEN_TTL_DAYS", "3");
    resetConfigForTests();
    expect(isShareEnabled()).toEqual({ enabled: true, ephemeral: false });
    const created = createShareToken(payload, { now: NOW });
    expect(created.expiresAtUnix).toBe(NOW / 1000 + 3 * 86_400);
    expect(openShareToken(created.token, { now: NOW }).ok).toBe(true);
    // The configured secret is the one actually used.
    expect(openShareToken(created.token, { secret: SECRET, now: NOW }).ok).toBe(true);
  });

  it("is disabled in production without a secret", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SHARE_TOKEN_SECRET", "");
    resetConfigForTests();
    const availability = isShareEnabled();
    expect(availability.enabled).toBe(false);
    expect(() => sealShareToken(payload)).toThrow(ShareDisabledError);
    const someToken = sealShareToken(payload, { secret: SECRET });
    expect(openShareToken(someToken)).toEqual({ ok: false, reason: "disabled" });
  });

  it("is disabled when the configured secret is too short", () => {
    vi.stubEnv("SHARE_TOKEN_SECRET", "short-secret");
    resetConfigForTests();
    const availability = isShareEnabled();
    expect(availability).toEqual({ enabled: false, reason: expect.stringMatching(/at least 32/) });
    expect(JSON.stringify(availability)).not.toContain("short-secret");
  });

  it("uses an ephemeral secret in development/test when none is configured", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("SHARE_TOKEN_SECRET", "");
    resetConfigForTests();
    expect(isShareEnabled()).toEqual({ enabled: true, ephemeral: true });
    const token = sealShareToken(payload, { now: NOW });
    expect(openShareToken(token, { now: NOW })).toMatchObject({ ok: true, payload });
    expect(openShareToken(token, { secret: SECRET, now: NOW })).toEqual({ ok: false, reason: "invalid" });
  });
});
