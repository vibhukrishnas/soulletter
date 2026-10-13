import { Badge, Card, Callout, NumbersIcon, StatusBadge } from "@/components/ui";
import type { NumerologyResult } from "@/lib/contracts/numerology";
import { getRule } from "@/lib/rules/registry";

/** Numerology numbers with every calculation step, shown as symbolic context only. */
export function NumerologySection({ numerology }: { numerology: NumerologyResult }) {
  return (
    <section aria-labelledby="numerology-heading" className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <NumbersIcon aria-hidden="true" className="size-6 text-gold-300" />
          <h2 id="numerology-heading" className="font-display text-3xl text-ivory-50">
            Numerology
          </h2>
        </div>
        <p className="max-w-prose text-[0.9375rem] text-mist-300">{numerology.disclaimer}</p>
      </div>

      {numerology.status === "not_requested" ? (
        <Card as="div" variant="outline">
          <p className="text-ivory-100">No numerology methods were selected for this reading.</p>
        </Card>
      ) : null}

      {numerology.results.length > 0 ? (
        <ul className="grid gap-4 md:grid-cols-2">
          {numerology.results.map((n, i) => {
            const rule = getRule(n.ruleId);
            const headingId = `numerology-${i}`;
            return (
              <li key={`${n.ruleId}-${i}`} className="flex">
                <Card as="article" aria-labelledby={headingId} className="flex w-full flex-col gap-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex min-w-0 flex-col gap-1.5">
                      <h3 id={headingId} className="font-display text-2xl text-ivory-50">
                        {n.name}
                      </h3>
                      {rule ? <StatusBadge status={rule.verificationStatus} /> : null}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="font-display text-5xl leading-none text-gold-200">{n.value}</span>
                      {n.isMasterNumber ? <Badge tone="gold">Master number</Badge> : null}
                    </div>
                  </div>
                  {n.compound !== null ? (
                    <p className="text-sm text-mist-300">
                      Compound (unreduced) total: <span className="font-mono text-ivory-100">{n.compound}</span>
                    </p>
                  ) : null}
                  <div className="flex flex-col gap-1.5">
                    <p className="text-sm font-medium text-mist-200">Steps</p>
                    <ol className="flex flex-col gap-1 rounded-[0.9rem] border border-line bg-night-900/50 p-3">
                      {n.steps.map((s, j) => (
                        <li key={j} className="grid gap-0.5 text-sm sm:grid-cols-[minmax(6rem,auto)_1fr] sm:gap-3">
                          <span className="text-mist-300">{s.label}</span>
                          <span className="font-mono break-words text-ivory-100">{s.expression}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                  <dl className="flex flex-col gap-2 text-sm">
                    <div>
                      <dt className="font-medium text-mist-200">Formula</dt>
                      <dd className="text-mist-300">{n.formula}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-mist-200">Convention</dt>
                      <dd className="text-mist-300">{n.convention}</dd>
                    </div>
                    {n.themes.length > 0 ? (
                      <div>
                        <dt className="font-medium text-mist-200">Commonly associated themes (symbolic)</dt>
                        <dd className="text-mist-300">{n.themes.join(", ")}</dd>
                      </div>
                    ) : null}
                  </dl>
                </Card>
              </li>
            );
          })}
        </ul>
      ) : null}

      {numerology.unavailable.length > 0 ? (
        <Callout tone="caution" title="Not calculated">
          <ul className="list-disc space-y-1 pl-5">
            {numerology.unavailable.map((u) => (
              <li key={u.ruleId}>
                <span className="font-medium">{getRule(u.ruleId)?.name ?? u.ruleId}:</span> {u.reason}
              </li>
            ))}
          </ul>
        </Callout>
      ) : null}

    </section>
  );
}
