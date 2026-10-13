import { afterEach, describe, expect, it, vi } from "vitest";
import { resetConfigForTests } from "@/server/config/env";
import { getClientKey, GLOBAL_CLIENT_KEY, parseIpAddress, rateLimitKeyForIp } from "./client-key";

function requestWith(headers: Record<string, string>): Request {
  return new Request("http://localhost/api/v1/geocode", { headers });
}

const trusted = { trustProxyHeaders: true };

describe("parseIpAddress", () => {
  it.each([
    ["192.0.2.1", "ip4:192.0.2.1"],
    [" 198.51.100.23 ", "ip4:198.51.100.23"],
    ["203.0.113.9:51234", "ip4:203.0.113.9"],
    ["::ffff:192.0.2.128", "ip4:192.0.2.128"],
    ["[::ffff:c000:280]:443", "ip4:192.0.2.128"],
    ["2001:db8:85a3:8d3:1319:8a2e:370:7348", "ip6:2001:db8:85a3:8d3::/64"],
    ["2001:DB8::1", "ip6:2001:db8:0:0::/64"],
    ["[2001:db8:1:2::abcd]:8443", "ip6:2001:db8:1:2::/64"],
    ["fe80::1%eth0", "ip6:fe80:0:0:0::/64"],
    ["::1", "ip6:0:0:0:0::/64"],
    ["::", "ip6:0:0:0:0::/64"],
    ["64:ff9b::192.0.2.33", "ip6:64:ff9b:0:0::/64"],
    ["1:2:3:4:5:6:7:8", "ip6:1:2:3:4::/64"],
    ["1:2:3:4:5:6:192.0.2.1", "ip6:1:2:3:4::/64"],
  ])("parses %j", (raw, key) => {
    const parsed = parseIpAddress(raw);
    expect(parsed).not.toBeNull();
    expect(rateLimitKeyForIp(parsed!)).toBe(key);
  });

  it("groups addresses from the same IPv6 /64 together", () => {
    const a = parseIpAddress("2001:db8:aaaa:bbbb::1")!;
    const b = parseIpAddress("2001:db8:aaaa:bbbb:ffff:ffff:ffff:ffff")!;
    const c = parseIpAddress("2001:db8:aaaa:bbbc::1")!;
    expect(rateLimitKeyForIp(a)).toBe(rateLimitKeyForIp(b));
    expect(rateLimitKeyForIp(a)).not.toBe(rateLimitKeyForIp(c));
  });

  it.each([
    "",
    "unknown",
    "999.1.1.1",
    "1.2.3",
    "01.2.3.4",
    "1.2.3.4.5",
    "2001:db8:::1",
    "1:2:3:4:5:6:7:8:9",
    "gggg::1",
    "[192.0.2.1",
    "example.com",
    "192.0.2.1/24",
    "x".repeat(100),
  ])("rejects %j", (raw) => {
    expect(parseIpAddress(raw)).toBeNull();
  });
});

describe("getClientKey", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    resetConfigForTests();
  });

  it("ignores forwarding headers unless proxy headers are trusted", () => {
    const request = requestWith({ "x-forwarded-for": "203.0.113.5", "x-real-ip": "203.0.113.6" });
    expect(getClientKey(request, { trustProxyHeaders: false })).toBe(GLOBAL_CLIENT_KEY);
  });

  it("uses the left-most valid X-Forwarded-For entry when trusted", () => {
    expect(getClientKey(requestWith({ "x-forwarded-for": "203.0.113.5, 10.0.0.1, 10.0.0.2" }), trusted)).toBe(
      "ip4:203.0.113.5",
    );
    expect(getClientKey(requestWith({ "x-forwarded-for": "unknown, garbage, 198.51.100.7" }), trusted)).toBe(
      "ip4:198.51.100.7",
    );
  });

  it("falls back to X-Real-IP, then to the global key", () => {
    expect(getClientKey(requestWith({ "x-forwarded-for": "nonsense", "x-real-ip": "2001:db8::5" }), trusted)).toBe(
      "ip6:2001:db8:0:0::/64",
    );
    expect(getClientKey(requestWith({}), trusted)).toBe(GLOBAL_CLIENT_KEY);
    expect(getClientKey(requestWith({ "x-real-ip": "localhost" }), trusted)).toBe(GLOBAL_CLIENT_KEY);
  });

  it("ignores oversized forwarding headers", () => {
    const huge = Array.from({ length: 400 }, () => "203.0.113.5").join(", ");
    expect(getClientKey(requestWith({ "x-forwarded-for": huge }), trusted)).toBe(GLOBAL_CLIENT_KEY);
  });

  it("reads TRUST_PROXY_HEADERS from configuration by default", () => {
    const request = requestWith({ "x-forwarded-for": "192.0.2.44" });
    vi.stubEnv("TRUST_PROXY_HEADERS", "false");
    resetConfigForTests();
    expect(getClientKey(request)).toBe(GLOBAL_CLIENT_KEY);

    vi.stubEnv("TRUST_PROXY_HEADERS", "true");
    resetConfigForTests();
    expect(getClientKey(request)).toBe("ip4:192.0.2.44");
  });
});
