import type { ReadingResult, SymbolicCandidate, SyllableEntry } from "@/lib/contracts/reading";

export type RevealSubject =
  | { kind: "partner"; candidate: SymbolicCandidate }
  | { kind: "native"; syllable: SyllableEntry; label: string }
  | { kind: "none"; title: string; detail: string };

/** What the reveal shows. It never picks among time-conditional possibilities. */
export function revealSubject(r: ReadingResult): RevealSubject {
  if (r.partner.primary) return { kind: "partner", candidate: r.partner.primary };
  if (r.partner.status === "not_enabled" && r.native.atStatedTime) {
    return { kind: "native", syllable: r.native.atStatedTime.syllable, label: r.native.label };
  }
  const timeDependent =
    r.partner.status === "limited" ||
    r.native.status === "time_dependent" ||
    r.partner.alternatives.some((a) => a.qualifiers.includes("time_conditional"));
  return {
    kind: "none",
    title: timeDependent ? "Your reading depends on your birth time" : "No single syllable could be determined",
    detail: timeDependent
      ? "The positions used by the selected methods change during the possible birth times, so no single syllable can be shown first."
      : (r.partner.unavailableReasons[0] ??
        r.native.reason ??
        "The details below explain what could and could not be calculated."),
  };
}
