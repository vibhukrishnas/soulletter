import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";
import { CautionIcon, ImportantIcon, InfoIcon } from "./icons";

export type CalloutTone = "info" | "caution" | "important";

export interface CalloutProps extends Omit<HTMLAttributes<HTMLDivElement>, "title" | "role"> {
  tone?: CalloutTone;
  /** Short heading shown in bold above the body. */
  title?: ReactNode;
  /** Element used for the title. Defaults to a paragraph so it does not alter the page outline. */
  titleAs?: "p" | "h2" | "h3" | "h4";
  /** Replace the tone icon, or pass `null` to hide it. */
  icon?: ReactNode | null;
  /**
   * Use role="alert" (assertive announcement). Only for urgent, newly-inserted messages such as
   * a failed submission. Otherwise the callout uses role="status".
   */
  alert?: boolean;
}

const TONES: Record<CalloutTone, { container: string; icon: string; title: string }> = {
  info: {
    container: "border-info-300/25 bg-info-950/70",
    icon: "text-info-300",
    title: "text-info-200",
  },
  caution: {
    container: "border-caution-300/30 bg-caution-950/70",
    icon: "text-caution-300",
    title: "text-caution-200",
  },
  important: {
    container: "border-important-300/30 bg-important-950/70",
    icon: "text-important-300",
    title: "text-important-200",
  },
};

const DEFAULT_ICONS: Record<CalloutTone, ReactNode> = {
  info: <InfoIcon />,
  caution: <CautionIcon />,
  important: <ImportantIcon />,
};

/** Contextual note. Tone is conveyed by icon and title text as well as colour. */
export function Callout({
  tone = "info",
  title,
  titleAs: TitleTag = "p",
  icon,
  alert = false,
  className,
  children,
  ...rest
}: CalloutProps) {
  const styles = TONES[tone];
  const resolvedIcon = icon === undefined ? DEFAULT_ICONS[tone] : icon;
  return (
    <div
      {...rest}
      role={alert ? "alert" : "status"}
      className={cn("flex gap-3 rounded-card border p-4 sm:p-5", styles.container, className)}
    >
      {resolvedIcon === null ? null : (
        <span aria-hidden="true" className={cn("mt-0.5 shrink-0 [&_svg]:size-5", styles.icon)}>
          {resolvedIcon}
        </span>
      )}
      <div className="min-w-0 flex-1 text-[0.9375rem] leading-relaxed text-ivory-200">
        {title ? <TitleTag className={cn("mb-1 font-sans text-[0.9375rem] font-semibold", styles.title)}>{title}</TitleTag> : null}
        {children}
      </div>
    </div>
  );
}
