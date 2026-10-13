import { Disclosure, StatusBadge } from "@/components/ui";
import type { ReadingResult, RuleOutcomeStatus } from "@/lib/contracts/reading";
import { DataRows } from "./CalculationBreakdown";
import { KARAKA_SCHEME_LABEL, LIFE_PATH_LABEL, MASTER_LABEL, NODE_LABEL } from "./format";

const OUTCOME_LABEL: Record<RuleOutcomeStatus, string> = {
  produced: "Produced a result",
  time_dependent: "Depends on birth time",
  unavailable: "Unavailable",
  not_enabled: "Not selected",
};

function SubHeading({ children }: { children: string }) {
  return <h3 className="mt-6 mb-2 font-sans text-base font-semibold text-ivory-50 first:mt-0">{children}</h3>;
}

/** Collapsible technical detail: settings, versions, ordering policy, rules, limitations and sources. */
export function TechnicalExplanation({ result }: { result: ReadingResult }) {
  const s = result.chart.settings;
  const n = result.numerology.settings;
  const v = result.versions;

  return (
    <Disclosure title="Technical explanation" headingLevel={2}>
      <div className="flex flex-col">
        <SubHeading>Settings used</SubHeading>
        <DataRows
          rows={[
            ["Zodiac", s.zodiac === "sidereal" ? "Sidereal" : s.zodiac],
            ["Ayanamsha", s.ayanamsha === "lahiri" ? "Lahiri (Chitrapaksha)" : s.ayanamsha],
            ["Chart", s.chart === "D1" ? "D1 (Rashi)" : s.chart],
            ["Houses", s.houseSystem === "whole_sign" ? "Whole-sign" : s.houseSystem],
            ["Lunar node", NODE_LABEL[s.nodeType]],
            ["Chara Karaka scheme", KARAKA_SCHEME_LABEL[s.charaKarakaScheme]],
            ["Life Path method", LIFE_PATH_LABEL[n.lifePathMethod]],
            ["Master numbers", MASTER_LABEL[n.masterNumbers]],
            ["Letter Y", n.yHandling === "consonant" ? "Treated as a consonant" : n.yHandling],
          ]}
        />

        <SubHeading>Versions</SubHeading>
        <DataRows
          rows={[
            ["App", v.app],
            ["Reading schema", v.readingSchema],
            ["Chart schema", v.chartSchema],
            ["Rule set", v.ruleSet],
            ["Avakahada table", v.avakahadaTable],
            ["Engine", v.engine],
          ]}
        />

        <SubHeading>Ordering policy</SubHeading>
        <p className="text-[0.9375rem] text-ivory-100">{result.partner.orderingPolicy}</p>

        <SubHeading>Tolerance source</SubHeading>
        <p className="text-[0.9375rem] text-ivory-100">{result.chart.engine.toleranceSource}</p>

        <SubHeading>Rules evaluated</SubHeading>
        <ul className="flex flex-col gap-3">
          {result.evaluations.map((e) => (
            <li key={e.ruleId} className="rounded-[0.9rem] border border-line bg-night-900/50 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-ivory-50">{e.name}</span>
                <StatusBadge status={e.verificationStatus} />
              </div>
              <p className="mt-1 text-sm text-mist-300">
                {OUTCOME_LABEL[e.status]}
                {e.reason ? ` — ${e.reason}` : ""} · {e.ruleId} v{e.ruleVersion}
              </p>
            </li>
          ))}
        </ul>

        <SubHeading>Limitations</SubHeading>
        <ul className="list-disc space-y-1.5 pl-5 text-[0.9375rem] text-ivory-100">
          {result.limitations.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>

        <SubHeading>Sources</SubHeading>
        <ul className="flex flex-col gap-3">
          {result.sources.map((src) => (
            <li key={src.id} className="text-[0.9375rem]">
              {src.url ? (
                <a
                  href={src.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-ivory-50 underline decoration-gold-300/60 underline-offset-4 hover:decoration-gold-200"
                >
                  {src.label}
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              ) : (
                <span className="text-ivory-50">{src.label}</span>
              )}
              <span className="block text-sm text-mist-300">{src.note}</span>
            </li>
          ))}
        </ul>
      </div>
    </Disclosure>
  );
}
