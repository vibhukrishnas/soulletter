/**
 * Finds every change of a discrete quantity (e.g. a Moon Pada) inside a time window.
 *
 * The window is sampled on a regular grid; whenever two consecutive samples differ,
 * the change instant is located by bisection to `resolutionMs`. Several changes between
 * two samples are all found (the scan continues from each located change).
 *
 * Correctness requires the grid step to be shorter than the shortest possible run of
 * any single value; callers choose steps accordingly (see compute-chart.ts).
 */

export interface TimelineSegment<K> {
  from: number;
  to: number;
  key: K;
}

export function scanTimeline<K extends string | number>(
  start: number,
  end: number,
  stepMs: number,
  keyAt: (t: number) => K,
  resolutionMs = 1000,
): TimelineSegment<K>[] {
  if (!(end >= start)) throw new RangeError("end must be >= start");
  if (!(stepMs > 0)) throw new RangeError("stepMs must be positive");

  const samples: number[] = [];
  for (let t = start; t < end; t += stepMs) samples.push(t);
  samples.push(end);

  const segments: TimelineSegment<K>[] = [];
  let segStart = start;
  let segKey = keyAt(start);

  for (let i = 1; i < samples.length; i++) {
    const t = samples[i];
    const k = keyAt(t);
    let a = samples[i - 1];
    let ka = segKey;
    let guard = 0;
    while (k !== ka) {
      let lo = a;
      let hi = t;
      while (hi - lo > resolutionMs) {
        const mid = Math.floor((lo + hi) / 2);
        if (keyAt(mid) === ka) lo = mid;
        else hi = mid;
      }
      segments.push({ from: segStart, to: hi, key: segKey });
      segStart = hi;
      segKey = keyAt(hi);
      a = hi;
      ka = segKey;
      if (++guard > 10_000) throw new Error("timeline scan did not converge");
    }
  }
  segments.push({ from: segStart, to: end, key: segKey });
  return segments;
}

/** Memoizes an expensive function of time (keyed by integer milliseconds). */
export function memoizeByTime<T>(fn: (t: number) => T, maxEntries = 20_000): (t: number) => T {
  const cache = new Map<number, T>();
  return (t: number) => {
    const key = Math.round(t);
    const hit = cache.get(key);
    if (hit !== undefined) return hit;
    const value = fn(key);
    if (cache.size >= maxEntries) cache.clear();
    cache.set(key, value);
    return value;
  };
}
