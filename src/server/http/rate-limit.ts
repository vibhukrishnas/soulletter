/**
 * Request rate limiting.
 *
 * The bundled implementation is an in-memory sliding-window log: each client key keeps
 * the timestamps of its accepted requests within the last window (never more than
 * `limit` of them), so decisions are exact and `Retry-After` is precise.
 *
 * DEPLOYMENT NOTE: state lives in the memory of one server process. With several
 * instances (horizontal scaling, serverless concurrency) each instance enforces the limit
 * separately, so the effective limit is multiplied by the instance count. Multi-instance
 * deployments must provide a {@link RateLimiter} backed by a shared store (e.g. Redis)
 * or enforce limits at the edge/reverse proxy.
 *
 * Memory is bounded: keys idle for a full window are swept, and at most `maxKeys` keys are
 * kept (least recently used keys are evicted first).
 */
import { getConfig } from "@/server/config/env";
import { getClientKey } from "./client-key";
import { jsonError } from "./respond";

export type RateLimitBucket = "readings" | "geocode" | "share" | "chart" | "preview";

export interface RateLimitDecision {
  allowed: boolean;
  /** Requests still allowed in the current window after this one. */
  remaining: number;
  /** Whole seconds until a request would be allowed again; 0 when allowed. */
  retryAfterSeconds: number;
  limit: number;
}

export interface RateLimiter {
  /** Records an attempt for `key` and decides whether it is allowed. */
  check(key: string): RateLimitDecision;
  /** Forgets all state. */
  reset(): void;
}

export interface SlidingWindowOptions {
  /** Maximum accepted requests per key per window (integer >= 1). */
  limit: number;
  /** Window length in milliseconds (default 60 000). */
  windowMs?: number;
  /** Maximum number of tracked keys (default 10 000). */
  maxKeys?: number;
  /** Clock in milliseconds; injectable for tests (default `Date.now`). */
  now?: () => number;
}

export const DEFAULT_WINDOW_MS = 60_000;
export const DEFAULT_MAX_KEYS = 10_000;

interface KeyState {
  /** Ascending timestamps of accepted requests inside the window. */
  hits: number[];
  lastSeen: number;
}

/** In-memory sliding-window-log limiter. See the module comment for its limitations. */
export class SlidingWindowRateLimiter implements RateLimiter {
  readonly limit: number;
  readonly windowMs: number;
  readonly maxKeys: number;
  private readonly now: () => number;
  /** Insertion order == least-recently-seen first (entries are re-inserted on access). */
  private readonly entries = new Map<string, KeyState>();
  private lastSweep = Number.NEGATIVE_INFINITY;

  constructor(options: SlidingWindowOptions) {
    const { limit, windowMs = DEFAULT_WINDOW_MS, maxKeys = DEFAULT_MAX_KEYS, now = Date.now } = options;
    if (!Number.isInteger(limit) || limit < 1) throw new RangeError("limit must be a positive integer");
    if (!Number.isFinite(windowMs) || windowMs <= 0) throw new RangeError("windowMs must be positive");
    if (!Number.isInteger(maxKeys) || maxKeys < 1) throw new RangeError("maxKeys must be a positive integer");
    this.limit = limit;
    this.windowMs = windowMs;
    this.maxKeys = maxKeys;
    this.now = now;
  }

  /** Number of keys currently tracked (for tests and diagnostics). */
  get size(): number {
    return this.entries.size;
  }

  check(key: string): RateLimitDecision {
    const now = this.now();
    const windowStart = now - this.windowMs;
    if (now - this.lastSweep >= this.windowMs) this.sweep(windowStart, now);

    let state = this.entries.get(key);
    if (state) {
      this.entries.delete(key);
      let expired = 0;
      while (expired < state.hits.length && state.hits[expired] <= windowStart) expired++;
      if (expired > 0) state.hits.splice(0, expired);
    } else {
      state = { hits: [], lastSeen: now };
    }
    state.lastSeen = now;
    this.entries.set(key, state);
    this.enforceCapacity();

    if (state.hits.length < this.limit) {
      state.hits.push(now);
      return { allowed: true, remaining: this.limit - state.hits.length, retryAfterSeconds: 0, limit: this.limit };
    }
    const retryAfterMs = state.hits[0] + this.windowMs - now;
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)),
      limit: this.limit,
    };
  }

  reset(): void {
    this.entries.clear();
    this.lastSweep = Number.NEGATIVE_INFINITY;
  }

  /** Drops keys that have not been seen for a whole window (oldest-seen first). */
  private sweep(windowStart: number, now: number): void {
    this.lastSweep = now;
    for (const [key, state] of this.entries) {
      if (state.lastSeen > windowStart) break;
      this.entries.delete(key);
    }
  }

  private enforceCapacity(): void {
    while (this.entries.size > this.maxKeys) {
      const oldest = this.entries.keys().next();
      if (oldest.done) break;
      this.entries.delete(oldest.value);
    }
  }
}

/** Per-minute limit configured for a bucket. "chart" shares the readings limit. */
export function limitForBucket(bucket: RateLimitBucket): number {
  const limits = getConfig().rateLimits;
  switch (bucket) {
    case "readings":
    case "chart":
      return limits.readingsPerMinute;
    case "preview":
      // Live previews fire while people type; allow more of these cheap requests.
      return Math.min(limits.readingsPerMinute * 3, 1000);
    case "geocode":
      return limits.geocodePerMinute;
    case "share":
      return limits.sharePerMinute;
  }
}

const limiters = new Map<RateLimitBucket, RateLimiter>();

/**
 * Process-wide limiter for a bucket, created on first use with the configured per-minute
 * limit. Each bucket counts independently.
 */
export function getRateLimiter(bucket: RateLimitBucket): RateLimiter {
  let limiter = limiters.get(bucket);
  if (!limiter) {
    limiter = new SlidingWindowRateLimiter({ limit: limitForBucket(bucket), windowMs: DEFAULT_WINDOW_MS });
    limiters.set(bucket, limiter);
  }
  return limiter;
}

/** Test helper: replaces the limiter for a bucket (or restores the default with null). */
export function setRateLimiterForTests(bucket: RateLimitBucket, limiter: RateLimiter | null): void {
  if (limiter) limiters.set(bucket, limiter);
  else limiters.delete(bucket);
}

/** Test helper: discards every bucket's limiter so limits are re-read from config. */
export function resetRateLimitersForTests(): void {
  limiters.clear();
}

export const RATE_LIMITED_MESSAGE = "Too many requests. Please wait a moment and try again.";

/**
 * Applies the bucket's rate limit to a request.
 *
 * @returns null when the request may proceed, otherwise a ready-to-return 429
 *   RATE_LIMITED response with `Retry-After`.
 */
export function enforceRateLimit(request: Request, bucket: RateLimitBucket): Response | null {
  const decision = getRateLimiter(bucket).check(getClientKey(request));
  if (decision.allowed) return null;
  return jsonError("RATE_LIMITED", RATE_LIMITED_MESSAGE, { retryAfterSeconds: decision.retryAfterSeconds });
}
