/**
 * Derives the rate-limit key for a request.
 *
 * Forwarding headers are trivially spoofable, so they are only consulted when the
 * operator sets `TRUST_PROXY_HEADERS=true`, which must only be done when the app runs
 * behind a reverse proxy that sets (overwrites) `X-Forwarded-For` / `X-Real-IP`. Without
 * it every client shares the single key {@link GLOBAL_CLIENT_KEY}, i.e. the limits act as
 * a global throttle for the instance.
 *
 * IP addresses are personal data: the derived key is used only as an in-memory map key
 * and must never be logged or returned to clients.
 */
import { isIPv4, isIPv6 } from "node:net";
import { getConfig } from "@/server/config/env";

export const GLOBAL_CLIENT_KEY = "global";

/** Upper bounds that keep header parsing cheap for hostile input. */
const MAX_HEADER_LENGTH = 2048;
const MAX_FORWARDED_ENTRIES = 32;

export type ParsedIp = { version: 4; address: string } | { version: 6; hextets: number[] };

/** Expands a syntactically valid IPv6 address (no zone) into its eight 16-bit groups. */
function expandIPv6(address: string): number[] | null {
  let text = address;
  const tail: number[] = [];
  const lastColon = text.lastIndexOf(":");
  if (lastColon === -1) return null;
  // Embedded dotted-quad suffix, e.g. ::ffff:192.0.2.1 or 64:ff9b::192.0.2.1
  const suffix = text.slice(lastColon + 1);
  if (suffix.includes(".")) {
    if (!isIPv4(suffix)) return null;
    const [a, b, c, d] = suffix.split(".").map(Number);
    tail.push((a << 8) | b, (c << 8) | d);
    text = text.slice(0, lastColon + 1);
    // Keep a "::" compression marker; drop a plain trailing separator.
    if (!text.endsWith("::")) text = text.slice(0, -1);
  }
  const groupsNeeded = 8 - tail.length;
  const parts = text.split("::");
  if (parts.length > 2) return null;
  const parseGroups = (s: string): number[] =>
    s === "" ? [] : s.split(":").filter((g) => g !== "").map((g) => Number.parseInt(g, 16));
  const head = parseGroups(parts[0]);
  const rest = parts.length === 2 ? parseGroups(parts[1]) : [];
  let groups: number[];
  if (parts.length === 2) {
    const zeros = groupsNeeded - head.length - rest.length;
    if (zeros < 0) return null;
    groups = [...head, ...new Array<number>(zeros).fill(0), ...rest];
  } else {
    groups = head;
  }
  groups = [...groups, ...tail];
  if (groups.length !== 8 || groups.some((g) => !Number.isInteger(g) || g < 0 || g > 0xffff)) return null;
  return groups;
}

/**
 * Parses one address token as found in forwarding headers. Accepts plain IPv4/IPv6,
 * `IPv4:port`, `[IPv6]` and `[IPv6]:port`; strips IPv6 zone identifiers. IPv4-mapped
 * IPv6 addresses are reported as IPv4. Returns null for anything else.
 */
export function parseIpAddress(raw: string): ParsedIp | null {
  let token = raw.trim();
  if (token.length === 0 || token.length > 64) return null;

  const bracketed = /^\[([^\]]+)\](?::\d{1,5})?$/.exec(token);
  if (bracketed) {
    token = bracketed[1];
  } else {
    const v4WithPort = /^(\d{1,3}(?:\.\d{1,3}){3}):\d{1,5}$/.exec(token);
    if (v4WithPort) token = v4WithPort[1];
  }

  if (isIPv4(token)) return { version: 4, address: token };

  const withoutZone = token.split("%", 1)[0];
  if (!isIPv6(withoutZone)) return null;
  const hextets = expandIPv6(withoutZone.toLowerCase());
  if (!hextets) return null;
  const isV4Mapped = hextets.slice(0, 5).every((h) => h === 0) && hextets[5] === 0xffff;
  if (isV4Mapped) {
    const address = [hextets[6] >> 8, hextets[6] & 0xff, hextets[7] >> 8, hextets[7] & 0xff].join(".");
    return { version: 4, address };
  }
  return { version: 6, hextets };
}

/**
 * Rate-limit key for an address. IPv6 clients are grouped by their /64 prefix, the
 * smallest block normally assigned to a single subscriber, so one host cannot evade the
 * limit by rotating through its own addresses.
 */
export function rateLimitKeyForIp(ip: ParsedIp): string {
  if (ip.version === 4) return `ip4:${ip.address}`;
  return `ip6:${ip.hextets.slice(0, 4).map((h) => h.toString(16)).join(":")}::/64`;
}

function firstValidForwardedIp(header: string | null): ParsedIp | null {
  if (header === null || header.length > MAX_HEADER_LENGTH) return null;
  const entries = header.split(",", MAX_FORWARDED_ENTRIES);
  for (const entry of entries) {
    const parsed = parseIpAddress(entry);
    if (parsed) return parsed;
  }
  return null;
}

/**
 * Returns the rate-limit key for a request: the client IP (from the left-most valid
 * `X-Forwarded-For` entry, else `X-Real-IP`) when proxy headers are trusted, otherwise
 * {@link GLOBAL_CLIENT_KEY}. Falls back to the global key when no valid address exists.
 */
export function getClientKey(request: Request, options?: { trustProxyHeaders?: boolean }): string {
  const trust = options?.trustProxyHeaders ?? getConfig().trustProxyHeaders;
  if (!trust) return GLOBAL_CLIENT_KEY;

  const ip =
    firstValidForwardedIp(request.headers.get("x-forwarded-for")) ??
    firstValidForwardedIp(request.headers.get("x-real-ip"));
  return ip ? rateLimitKeyForIp(ip) : GLOBAL_CLIENT_KEY;
}
