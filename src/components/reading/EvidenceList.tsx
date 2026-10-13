import { Badge, StatusBadge } from "@/components/ui";
import { formatDms } from "@/lib/astro/angles";
import type { TimeContext } from "@/lib/contracts/chart";
import type { CandidateEvidence, PointRole } from "@/lib/contracts/reading";
import { grahaText } from "./VedicNames";
import { conditionLabel } from "./format";

const POINT_ROLE_LABEL: Record<PointRole, string> = {
  native_moon: "Your Moon",
  seventh_lord: "Seventh-house lord",
  darakaraka: "Darakaraka",
};

/** Every evidence item behind a syllable: rule, status label, condition, explanation and notes. */
export function EvidenceList({ evidence, time }: { evidence: readonly CandidateEvidence[]; time: TimeContext }) {
  return (
    <ul className="flex flex-col gap-3">
      {evidence.map((e, i) => (
        <li
          key={`${e.ruleId}-${e.padaIndex}-${i}`}
          className="rounded-[0.9rem] border border-line bg-night-900/50 p-3.5 sm:p-4"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[0.9375rem] font-medium text-ivory-50">{e.ruleName}</span>
            <StatusBadge status={e.verificationStatus} />
          </div>
          <p className="mt-2 text-sm text-mist-300">
            <span className="font-medium text-mist-200">When: </span>
            {conditionLabel(e.condition, time)}
          </p>
          <p className="mt-1 text-sm text-mist-300">
            <span className="font-medium text-mist-200">Point: </span>
            {POINT_ROLE_LABEL[e.pointRole]} — {grahaText(e.point)} in {e.nakshatraName} Pada {e.pada}
            {e.longitudeDeg !== null ? `, sidereal longitude ${formatDms(e.longitudeDeg)}` : ""}
          </p>
          <p className="mt-2 text-[0.9375rem] leading-relaxed text-ivory-100">{e.explanation}</p>
          {e.boundarySensitive || e.timeSensitive || e.tieSensitive ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {e.boundarySensitive ? <Badge tone="caution">Boundary-sensitive</Badge> : null}
              {e.timeSensitive ? <Badge tone="caution">Birth-time sensitive</Badge> : null}
              {e.tieSensitive ? <Badge tone="caution">Tie-sensitive</Badge> : null}
            </div>
          ) : null}
          {e.notes.length > 0 ? (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-mist-300">
              {e.notes.map((n, j) => (
                <li key={j}>{n}</li>
              ))}
            </ul>
          ) : null}
          <p className="mt-2 text-xs text-mist-400">
            Rule {e.ruleId} v{e.ruleVersion}
          </p>
        </li>
      ))}
    </ul>
  );
}
