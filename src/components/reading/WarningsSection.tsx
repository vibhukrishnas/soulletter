import { Callout } from "@/components/ui";
import type { CalculationWarning, WarningSeverity } from "@/lib/contracts/chart";
import { SEVERITY_LABEL } from "./format";

const ORDER: readonly WarningSeverity[] = ["important", "caution", "info"];

const GROUP_TITLE: Record<WarningSeverity, string> = {
  important: "Important",
  caution: "Please note",
  info: "For your information",
};

/** Service warnings grouped by severity (important first). */
export function WarningsSection({ warnings }: { warnings: readonly CalculationWarning[] }) {
  if (warnings.length === 0) return null;
  return (
    <section aria-labelledby="warnings-heading" className="flex flex-col gap-5">
      <h2 id="warnings-heading" className="font-display text-3xl text-ivory-50">
        Warnings and qualifications
      </h2>
      {ORDER.map((severity) => {
        const group = warnings.filter((w) => w.severity === severity);
        if (group.length === 0) return null;
        return (
          <div key={severity} className="flex flex-col gap-3">
            <h3 className="font-sans text-base font-semibold text-ivory-50">
              {GROUP_TITLE[severity]} ({group.length})
            </h3>
            {group.map((w, i) => (
              <Callout
                key={`${w.code}-${w.subject ?? ""}-${i}`}
                tone={severity}
                title={`${SEVERITY_LABEL[severity]}${w.subject ? ` — ${w.subject}` : ""}`}
              >
                <p>{w.message}</p>
              </Callout>
            ))}
          </div>
        );
      })}
    </section>
  );
}
