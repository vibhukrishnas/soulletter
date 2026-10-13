import type { ReactNode } from "react";
import { STEP_HEADING_ID } from "./field-ids";

/** Focusable heading of the current form step (focus moves here when the step changes). */
export function StepHeading({ title, description }: { title: ReactNode; description?: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h2
        id={STEP_HEADING_ID}
        tabIndex={-1}
        className="font-display text-3xl leading-tight text-ivory-50 focus:outline-none sm:text-4xl"
      >
        {title}
      </h2>
      {description ? <p className="max-w-prose text-base leading-relaxed text-mist-300">{description}</p> : null}
    </div>
  );
}
