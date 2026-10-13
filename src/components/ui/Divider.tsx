import { cn } from "./cn";
import { SparkleIcon } from "./icons";

export interface DividerProps {
  /** Show a small star ornament in the middle of a horizontal divider. */
  ornament?: boolean;
  /**
   * Decorative dividers are hidden from assistive technology (default). Set to false when the
   * divider marks a real thematic break; it is then exposed as a separator.
   */
  decorative?: boolean;
  orientation?: "horizontal" | "vertical";
  className?: string;
}

/** Fine champagne hairline. */
export function Divider({ ornament = false, decorative = true, orientation = "horizontal", className }: DividerProps) {
  const a11y = decorative
    ? ({ "aria-hidden": true } as const)
    : ({ role: "separator", "aria-orientation": orientation } as const);

  if (orientation === "vertical") {
    return (
      <div
        {...a11y}
        className={cn("w-px self-stretch bg-linear-to-b from-transparent via-gold-300/35 to-transparent", className)}
      />
    );
  }

  if (!ornament) {
    return <div {...a11y} className={cn("hairline-gold h-px w-full", className)} />;
  }

  return (
    <div {...a11y} className={cn("flex w-full items-center gap-4", className)}>
      <span className="hairline-gold h-px flex-1" />
      <SparkleIcon className="size-3 text-gold-300/80" />
      <span className="hairline-gold h-px flex-1" />
    </div>
  );
}
