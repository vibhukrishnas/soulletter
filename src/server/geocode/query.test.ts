import { describe, expect, it } from "vitest";
import { normalizeGeocodeQuery } from "./query";

describe("normalizeGeocodeQuery", () => {
  it("trims and collapses whitespace", () => {
    expect(normalizeGeocodeQuery("  New    Delhi \n")).toEqual({ ok: true, query: "New Delhi" });
  });

  it("replaces control characters (C0, DEL, C1, line separators) with spaces", () => {
    const nasty = ["Mum", String.fromCharCode(0), "bai", String.fromCharCode(0x7f), "x", String.fromCharCode(0x85), "y"];
    const separators = `Pune${String.fromCharCode(0x2028)}City${String.fromCharCode(0x2029)}`;
    expect(normalizeGeocodeQuery(nasty.join(""))).toEqual({ ok: true, query: "Mum bai x y" });
    expect(normalizeGeocodeQuery(separators)).toEqual({ ok: true, query: "Pune City" });
    expect(normalizeGeocodeQuery("\tBerlin\r\n")).toEqual({ ok: true, query: "Berlin" });
  });

  it("applies Unicode NFC normalization", () => {
    const decomposed = `Zu${String.fromCharCode(0x0308)}rich`; // "u" + combining diaeresis
    const result = normalizeGeocodeQuery(decomposed);
    expect(result).toEqual({ ok: true, query: "Zürich" });
  });

  it("accepts 2 to 80 characters", () => {
    expect(normalizeGeocodeQuery("Ya").ok).toBe(true);
    expect(normalizeGeocodeQuery("a".repeat(80)).ok).toBe(true);
  });

  it("rejects text shorter than 2 characters after normalization", () => {
    for (const value of ["", " ", "a", " a ", String.fromCharCode(1).repeat(5), "\n\nb\n"]) {
      const result = normalizeGeocodeQuery(value);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.message).toMatch(/at least 2/);
    }
  });

  it("rejects text longer than 80 characters", () => {
    const result = normalizeGeocodeQuery("a".repeat(81));
    expect(result).toEqual({ ok: false, message: expect.stringMatching(/at most 80/) });
    expect(normalizeGeocodeQuery("a".repeat(5000)).ok).toBe(false);
  });

  it("counts code points, not UTF-16 code units", () => {
    const emoji = "\u{1F30D}"; // 2 UTF-16 code units
    expect(normalizeGeocodeQuery(emoji.repeat(80)).ok).toBe(true);
    expect(normalizeGeocodeQuery(emoji.repeat(81)).ok).toBe(false);
    expect(normalizeGeocodeQuery(emoji).ok).toBe(false);
  });

  it("rejects non-string input", () => {
    expect(normalizeGeocodeQuery(undefined).ok).toBe(false);
    expect(normalizeGeocodeQuery(42).ok).toBe(false);
  });
});
