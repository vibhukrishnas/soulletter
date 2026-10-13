import { describe, expect, it } from "vitest";
import { formatTime12h, formatTypedTime, from24h, to24h } from "@/lib/client/time12";

/** Simulates typing characters one by one. */
function typeKeys(keys: string): string {
  let text = "";
  for (const k of keys) text = formatTypedTime(text + k, text).text;
  return text;
}

describe("typing a 12-hour time inserts the colon automatically", () => {
  it.each([
    ["0230", "02:30"],
    ["230", "02:30"],
    ["2", "02:"],
    ["1", "1"],
    ["12", "12:"],
    ["1230", "12:30"],
    ["130", "01:30"],
    ["945", "09:45"],
    ["1159", "11:59"],
    ["2:30", "02:30"],
    ["027", "02:"], // minutes cannot start with 7
    ["00", "0"], // 00 is not a 12-hour hour
    ["123045", "12:30"], // extra digits ignored
  ])("%s → %s", (keys, expected) => {
    expect(typeKeys(keys)).toBe(expected);
  });

  it("deleting the auto-inserted colon removes the digit before it", () => {
    expect(formatTypedTime("02", "02:").text).toBe("0");
    expect(formatTypedTime("12", "12:").text).toBe("1");
    expect(formatTypedTime("02:3", "02:30").text).toBe("02:3");
  });

  it("accepts a pasted 24-hour time and sets the meridiem", () => {
    expect(formatTypedTime("14:30", "")).toEqual({ text: "02:30", meridiem: "PM" });
    expect(formatTypedTime("00:15", "")).toEqual({ text: "12:15", meridiem: "AM" });
    expect(formatTypedTime("09:05", "")).toEqual({ text: "09:05" });
  });
});

describe("12-hour ⇄ 24-hour conversion", () => {
  it.each([
    ["02:30", "PM", "14:30"],
    ["02:30", "AM", "02:30"],
    ["12:00", "AM", "00:00"],
    ["12:00", "PM", "12:00"],
    ["11:59", "PM", "23:59"],
  ] as const)("%s %s → %s", (text, meridiem, expected) => {
    expect(to24h(text, meridiem)).toBe(expected);
    expect(from24h(expected)).toEqual({ text, meridiem });
  });

  it("requires a complete time and an explicit AM/PM", () => {
    expect(to24h("02:3", "PM")).toBeNull();
    expect(to24h("02:30", null)).toBeNull();
    expect(to24h("13:00", "PM")).toBeNull();
  });

  it("formats for display", () => {
    expect(formatTime12h("14:30")).toBe("2:30 PM");
    expect(formatTime12h("00:05")).toBe("12:05 AM");
    expect(formatTime12h("12:00")).toBe("12:00 PM");
  });
});
