/**
 * Stateless, opaque, authenticated share tokens.
 *
 * Wire format (base64url, no padding):
 *
 *   0x01 (version) | 12-byte random IV | AES-256-GCM ciphertext | 16-byte GCM tag
 *
 * The plaintext is the JSON document `{"exp": <unix seconds>, "p": <payload>}` (at most
 * {@link MAX_SHARE_PLAINTEXT_BYTES} bytes). The version byte is bound to the ciphertext as
 * GCM additional authenticated data. The AES key is derived from the configured secret
 * with HKDF-SHA256 (salt "soulletter-share-v1", info "share-token").
 *
 * Tokens are encrypted, not just signed, so the payload is opaque to anyone holding the
 * link. Expiry is checked only after authentication so forged tokens learn nothing.
 * This module is payload-agnostic: callers decide (and validate) what goes inside.
 */
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";
import { getConfig, MIN_SHARE_SECRET_LENGTH } from "@/server/config/env";

export const SHARE_TOKEN_VERSION = 0x01;
export const MAX_SHARE_TOKEN_LENGTH = 2048;
export const MAX_SHARE_PLAINTEXT_BYTES = 1024;

const IV_BYTES = 12;
const TAG_BYTES = 16;
const KEY_BYTES = 32;
const HKDF_SALT = "soulletter-share-v1";
const HKDF_INFO = "share-token";
const SECONDS_PER_DAY = 86_400;
const MIN_TOKEN_BYTES = 1 + IV_BYTES + 1 + TAG_BYTES;
const BASE64URL_RE = /^[A-Za-z0-9_-]+$/;

export type SharePayload = Record<string, unknown>;

export interface ShareTokenOptions {
  /** Current time in milliseconds since the epoch (default `Date.now()`). */
  now?: number;
  /** Secret override (tests). Must be at least 32 characters. Defaults to configuration. */
  secret?: string;
}

export interface SealShareTokenOptions extends ShareTokenOptions {
  /** Lifetime in whole days, 1..365 (default: configured SHARE_TOKEN_TTL_DAYS). */
  ttlDays?: number;
}

export interface CreatedShareToken {
  token: string;
  /** Expiry as unix seconds (embedded in the token). */
  expiresAtUnix: number;
  /** Expiry as an ISO-8601 UTC timestamp. */
  expiresAt: string;
}

export type ShareTokenFailureReason = "invalid" | "expired" | "disabled";

export type OpenShareTokenResult =
  | { ok: true; payload: SharePayload; expiresAtUnix: number }
  | { ok: false; reason: ShareTokenFailureReason };

export type ShareAvailability = { enabled: true; ephemeral: boolean } | { enabled: false; reason: string };

/** Thrown by {@link sealShareToken} when sharing is not configured. */
export class ShareDisabledError extends Error {
  constructor() {
    super("Sharing is disabled");
    this.name = "ShareDisabledError";
  }
}

/** Thrown by {@link sealShareToken} when the serialized payload exceeds the size limit. */
export class SharePayloadTooLargeError extends Error {
  constructor() {
    super(`Share payload exceeds ${MAX_SHARE_PLAINTEXT_BYTES} bytes`);
    this.name = "SharePayloadTooLargeError";
  }
}

/** Whether share links can be created/opened, and why not. Never exposes the secret. */
export function isShareEnabled(): ShareAvailability {
  const share = getConfig().share;
  return share.enabled ? { enabled: true, ephemeral: share.ephemeral } : { enabled: false, reason: share.reason };
}

let keyCache: { secret: string; key: Buffer } | null = null;

function deriveKey(secret: string): Buffer {
  if (keyCache?.secret === secret) return keyCache.key;
  const key = Buffer.from(hkdfSync("sha256", Buffer.from(secret, "utf8"), HKDF_SALT, HKDF_INFO, KEY_BYTES));
  keyCache = { secret, key };
  return key;
}

/** Resolves the secret to use, or null when sharing is disabled. */
function resolveSecret(override: string | undefined): string | null {
  if (override !== undefined) {
    if (override.length < MIN_SHARE_SECRET_LENGTH) {
      throw new RangeError(`share secret must be at least ${MIN_SHARE_SECRET_LENGTH} characters`);
    }
    return override;
  }
  const share = getConfig().share;
  return share.enabled ? share.secret : null;
}

function isPlainObject(value: unknown): value is SharePayload {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value) as unknown;
  return proto === Object.prototype || proto === null;
}

/**
 * Encrypts a payload into a share token and reports its expiry.
 *
 * @throws {ShareDisabledError} when no usable secret is configured.
 * @throws {SharePayloadTooLargeError} when the serialized payload is too large.
 * @throws {TypeError} when the payload is not a plain JSON object.
 * @throws {RangeError} for an invalid `ttlDays` or secret override.
 */
export function createShareToken(payload: SharePayload, options: SealShareTokenOptions = {}): CreatedShareToken {
  if (!isPlainObject(payload)) throw new TypeError("share payload must be a plain object");
  const secret = resolveSecret(options.secret);
  if (secret === null) throw new ShareDisabledError();

  const ttlDays = options.ttlDays ?? getConfig().share.ttlDays;
  if (!Number.isInteger(ttlDays) || ttlDays < 1 || ttlDays > 365) {
    throw new RangeError("ttlDays must be an integer between 1 and 365");
  }
  const nowSeconds = Math.floor((options.now ?? Date.now()) / 1000);
  const exp = nowSeconds + ttlDays * SECONDS_PER_DAY;

  const plaintext = Buffer.from(JSON.stringify({ exp, p: payload }), "utf8");
  if (plaintext.byteLength > MAX_SHARE_PLAINTEXT_BYTES) throw new SharePayloadTooLargeError();

  const version = Buffer.from([SHARE_TOKEN_VERSION]);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", deriveKey(secret), iv, { authTagLength: TAG_BYTES });
  cipher.setAAD(version);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    token: Buffer.concat([version, iv, ciphertext, tag]).toString("base64url"),
    expiresAtUnix: exp,
    expiresAt: new Date(exp * 1000).toISOString(),
  };
}

/**
 * Encrypts a payload into an opaque share token (see {@link createShareToken} for the
 * thrown errors). Use {@link createShareToken} when the expiry is also needed.
 */
export function sealShareToken(payload: SharePayload, options?: SealShareTokenOptions): string {
  return createShareToken(payload, options).token;
}

/**
 * Authenticates, decrypts and checks the expiry of a share token. Never throws for
 * untrusted input; every malformed, truncated, tampered or foreign token is "invalid".
 */
export function openShareToken(token: unknown, options: ShareTokenOptions = {}): OpenShareTokenResult {
  const secret = resolveSecret(options.secret);
  if (secret === null) return { ok: false, reason: "disabled" };

  if (typeof token !== "string" || token.length === 0 || token.length > MAX_SHARE_TOKEN_LENGTH) {
    return { ok: false, reason: "invalid" };
  }
  if (!BASE64URL_RE.test(token)) return { ok: false, reason: "invalid" };

  const raw = Buffer.from(token, "base64url");
  // Reject non-canonical encodings so each token has exactly one textual form.
  if (raw.byteLength < MIN_TOKEN_BYTES || raw.toString("base64url") !== token) return { ok: false, reason: "invalid" };
  if (raw[0] !== SHARE_TOKEN_VERSION) return { ok: false, reason: "invalid" };

  const iv = raw.subarray(1, 1 + IV_BYTES);
  const ciphertext = raw.subarray(1 + IV_BYTES, raw.byteLength - TAG_BYTES);
  const tag = raw.subarray(raw.byteLength - TAG_BYTES);
  if (ciphertext.byteLength > MAX_SHARE_PLAINTEXT_BYTES) return { ok: false, reason: "invalid" };

  let plaintext: Buffer;
  try {
    const decipher = createDecipheriv("aes-256-gcm", deriveKey(secret), iv, { authTagLength: TAG_BYTES });
    decipher.setAAD(raw.subarray(0, 1));
    decipher.setAuthTag(tag);
    plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch {
    return { ok: false, reason: "invalid" };
  }

  let document: unknown;
  try {
    document = JSON.parse(plaintext.toString("utf8"));
  } catch {
    return { ok: false, reason: "invalid" };
  }
  if (!isPlainObject(document)) return { ok: false, reason: "invalid" };
  const { exp, p } = document;
  if (typeof exp !== "number" || !Number.isSafeInteger(exp) || !isPlainObject(p)) {
    return { ok: false, reason: "invalid" };
  }

  const nowSeconds = Math.floor((options.now ?? Date.now()) / 1000);
  if (exp <= nowSeconds) return { ok: false, reason: "expired" };
  return { ok: true, payload: p, expiresAtUnix: exp };
}
