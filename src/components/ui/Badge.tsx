import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

export type BadgeTone = "neutral" | "gold" | "indigo" | "info" | "caution" | "important" | "success";
export type BadgeSize = "sm" | "md";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  size?: BadgeSize;
  /** Decorative leading icon. Meaning must also be carried by the text. */
  icon?: ReactNode;
}

export const BADGE_TONES: Record<BadgeTone, string> = {
  neutral: "border-white/12 bg-white/[0.05] text-mist-200",
  gold: "border-gold-300/35 bg-gold-300/10 text-gold-200",
  indigo: "border-indigo-300/35 bg-indigo-400/12 text-indigo-200",
  info: "border-info-300/35 bg-info-500/12 text-info-200",
  caution: "border-caution-300/35 bg-caution-500/12 text-caution-200",
  important: "border-important-300/35 bg-important-500/12 text-important-200",
  success: "border-status-verified/35 bg-status-verified/10 text-status-verified",
};

export const BADGE_SIZES: Record<BadgeSize, string> = {
  sm: "gap-1 px-2 py-0.5 text-xs [&_svg]:size-3.5",
  md: "gap-1.5 px-2.5 py-1 text-[0.8125rem] [&_svg]:size-4",
};

/** Compact label for categories and states. Not interactive. */
export function Badge({ tone = "neutral", size = "sm", icon, className, children, ...rest }: BadgeProps) {
  return (
    <span
      {...rest}
      className={cn(
        "inline-flex max-w-full items-center rounded-full border leading-snug font-medium [&_svg]:shrink-0",
        BADGE_TONES[tone],
        BADGE_SIZES[size],
        className,
      )}
    >
      {icon}
      <span className="min-w-0">{children}</span>
    </span>
  );
}
