/**
 * 12-hour time entry helpers. The UI collects "hh:mm" + AM/PM and stores the 24-hour
 * "HH:mm" value the API expects. The colon is inserted automatically while typing.
 */

export type Meridiem = "AM" | "PM";

export interface TypedTime {
  /** Display text, e.g. "02:3" while typing or "02:30" when complete. */
  text: string;
  /** Set only when the input implies it (e.g. a pasted 24-hour "14:30"). */
  meridiem?: Meridiem;
}

function buildFromDigits(d: string): string {
  if (!d) return "";
  let hour: string;
  let rest: string;
  const a = d[0];
  if (a >= "2" && a <= "9") {
    hour = `0${a}`; // 2–9 can only be a single-digit hour
    rest = d.slice(1);
  } else if (a === "1") {
    if (d.length === 1) return "1";
    if (d[1] <= "2") {
      hour = `1${d[1]}`; // 10, 11, 12
      rest = d.slice(2);
    } else {
      hour = "01"; // "13…" → 1:3…
      rest = d.slice(1);
    }
  } else {
    // leading 0
    if (d.length === 1) return "0";
    if (d[1] === "0") return "0"; // "00" is not a 12-hour hour
    hour = `0${d[1]}`;
    rest = d.slice(2);
  }
  let minutes = rest.slice(0, 2);
  if (minutes.length > 0 && minutes[0] > "5") minutes = ""; // minutes start with 0–5
  return `${hour}:${minutes}`;
}

/**
 * Formats what the user typed into "hh:mm", inserting the colon automatically.
 * `previous` is the text before this keystroke, so deleting the auto-inserted colon
 * also removes the digit before it (otherwise the colon would reappear immediately).
 */
export function formatTypedTime(raw: string, previous = ""): TypedTime {
  const pasted = /^\s*(\d{1,2}):(\d{2})\s*$/.exec(raw);
  if (pasted && raw.length > previous.length + 1) {
    const h = Number(pasted[1]);
    const m = pasted[2];
    if (h <= 23 && Number(m) <= 59) {
      if (h === 0) return { text: `12:${m}`, meridiem: "AM" };
      if (h > 12) return { text: `${String(h - 12).padStart(2, "0")}:${m}`, meridiem: "PM" };
      return { text: `${String(h).padStart(2, "0")}:${m}` };
    }
  }
  let digits = raw.replace(/\D/g, "");
  if (raw.length < previous.length && previous.endsWith(":") && raw === previous.slice(0, -1)) {
    digits = digits.slice(0, -1);
  }
  return { text: buildFromDigits(digits.slice(0, 4)) };
}

/** "02:30" + PM → "14:30"; null when incomplete or the meridiem is missing. */
export function to24h(text: string, meridiem: Meridiem | null): string | null {
  const m = /^(0[1-9]|1[0-2]):([0-5]\d)$/.exec(text);
  if (!m || !meridiem) return null;
  const h12 = Number(m[1]);
  const h24 = (h12 % 12) + (meridiem === "PM" ? 12 : 0);
  return `${String(h24).padStart(2, "0")}:${m[2]}`;
}

/** "14:30" → { text: "02:30", meridiem: "PM" } */
export function from24h(value: string): { text: string; meridiem: Meridiem } | null {
  const m = /^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/.exec(value);
  if (!m) return null;
  const h = Number(m[1]);
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return { text: `${String(h12).padStart(2, "0")}:${m[2]}`, meridiem: h < 12 ? "AM" : "PM" };
}

/** "14:30" → "2:30 PM" (display only). */
export function formatTime12h(value: string): string {
  const t = from24h(value);
  if (!t) return value;
  return `${Number(t.text.slice(0, 2))}:${t.text.slice(3)} ${t.meridiem}`;
}
