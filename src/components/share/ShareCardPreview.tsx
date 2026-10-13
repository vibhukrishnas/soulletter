import { Badge, cn } from "@/components/ui";
import type { ShareCardModel, ShareSyllable } from "@/lib/contracts/share";

/**
 * HTML rendering of a privacy-safe share card. Renders ONLY fields of ShareCardModel, so it
 * is safe for the public /s/[token] page. Usable from Server and Client Components.
 */
export interface ShareCardPreviewProps {
  card: ShareCardModel;
  /** Heading level for the card headline within the surrounding outline. */
  headingLevel?: "h2" | "h3";
  /** Optional id for the headline (for aria-labelledby). */
  headingId?: string;
  className?: string;
}

function SmallSyllable({ s }: { s: ShareSyllable }) {
  return (
    <li className="flex flex-col items-center gap-0.5 rounded-[0.9rem] border border-white/10 bg-white/[0.03] px-3 py-2">
      <span lang="sa" className="font-devanagari text-3xl leading-[1.3] text-ivory-50">
        {s.devanagari}
      </span>
      <span className="font-display text-xl text-gold-200">{s.roman}</span>
      <span lang="sa-Latn" className="font-display text-sm text-mist-300 italic">
        {s.iast}
      </span>
    </li>
  );
}

export function ShareCardPreview({ card, headingLevel = "h3", headingId, className }: ShareCardPreviewProps) {
  const Heading = headingLevel;
  return (
    <article
      aria-labelledby={headingId}
      className={cn(
        "relative isolate overflow-hidden rounded-panel border border-gold-300/30 bg-linear-to-br from-[#0b1026] to-[#1c1747] px-5 py-8 text-center shadow-glow-gold-soft sm:px-8",
        className,
      )}
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-3 -z-10 rounded-[1.4rem] border border-gold-300/20" />
      <p className="font-display text-2xl font-medium text-gold-200">SoulLetter</p>
      <Heading id={headingId} className="mt-2 font-sans text-xs font-semibold tracking-[0.2em] text-mist-300 uppercase">
        {card.headline}
      </Heading>

      {card.primary ? (
        <div className="mt-6 flex flex-col items-center gap-1">
          <span lang="sa" className="font-devanagari text-8xl leading-[1.25] text-ivory-50">
            {card.primary.devanagari}
          </span>
          <span className="font-display text-4xl font-medium text-gold-200">{card.primary.roman}</span>
          <span lang="sa-Latn" className="font-display text-lg text-mist-300 italic">
            {card.primary.iast}
          </span>
        </div>
      ) : (
        <p className="mt-6 font-display text-2xl text-ivory-50">No single syllable determined</p>
      )}

      {card.alternatives.length > 0 ? (
        <div className="mt-6">
          <p className="text-sm text-mist-300">Also shown</p>
          <ul className="mt-2 flex flex-wrap justify-center gap-2">
            {card.alternatives.map((a) => (
              <SmallSyllable key={a.cellId} s={a} />
            ))}
          </ul>
        </div>
      ) : null}

      {card.methods.length > 0 ? (
        <ul className="mt-6 flex flex-col items-center gap-2">
          {card.methods.map((m) => (
            <li key={m.ruleId} className="flex flex-wrap items-center justify-center gap-2 text-sm text-ivory-100">
              <span>{m.name}</span>
              <Badge tone="indigo">{m.statusLabel}</Badge>
            </li>
          ))}
        </ul>
      ) : null}

      {card.interpretation ? (
        <p className="mx-auto mt-6 max-w-md text-[0.9375rem] leading-relaxed text-ivory-100">{card.interpretation}</p>
      ) : null}
      <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-mist-300">{card.disclaimer}</p>
      <p className="mt-6 text-xs text-mist-400">
        Rule set {card.ruleSetVersion} · Table {card.avakahadaTableVersion}
      </p>
    </article>
  );
}
