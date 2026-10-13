import type { ReactNode } from "react";
import { cn } from "@/components/ui/cn";
import { SparkleIcon } from "@/components/ui/icons";

export interface SectionHeadingProps {
  /** Id for the heading, so a <section aria-labelledby> can reference it. */
  id?: string;
  /** Small overline above the title. */
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  as?: "h1" | "h2" | "h3";
  align?: "left" | "center";
  className?: string;
}

/** Eyebrow + display-serif heading + supporting paragraph. */
export function SectionHeading({
  id,
  eyebrow,
  title,
  description,
  as: Tag = "h2",
  align = "left",
  className,
}: SectionHeadingProps) {
  const centered = align === "center";
  return (
    <div className={cn("flex flex-col gap-3", centered && "items-center text-center", className)}>
      {eyebrow ? (
        <p className="inline-flex items-center gap-2 text-xs font-semibold tracking-[0.18em] text-gold-300 uppercase">
          <SparkleIcon className="size-3" />
          {eyebrow}
        </p>
      ) : null}
      <Tag
        id={id}
        className={cn(
          Tag === "h1" ? "text-4xl sm:text-5xl" : "text-3xl sm:text-4xl",
          "leading-[1.1] font-medium text-ivory-50",
        )}
      >
        {title}
      </Tag>
      {description ? (
        <p className={cn("max-w-2xl text-base leading-relaxed text-mist-200 sm:text-lg", centered && "mx-auto")}>
          {description}
        </p>
      ) : null}
    </div>
  );
}
