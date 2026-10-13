import type { VerificationStatus } from "@/lib/contracts/reading";
import { BADGE_SIZES, type BadgeSize } from "./Badge";
import { cn } from "./cn";
import { BanIcon, BookIcon, CheckIcon, FlaskIcon, HourglassIcon } from "./icons";

/** User-facing label for each rule verification status. */
export const VERIFICATION_STATUS_LABELS: Record<VerificationStatus, string> = {
  verified_calculation: "Verified calculation",
  documented_traditional_interpretation: "Documented traditional interpretation",
  experimental_symbolic: "Experimental symbolic interpretation",
  provisional_source: "Provisional source",
  disabled_insufficient_evidence: "Disabled — insufficient evidence",
};

/** One-sentence plain-language explanation of each status, for legends and help text. */
export const VERIFICATION_STATUS_DESCRIPTIONS: Record<VerificationStatus, string> = {
  verified_calculation:
    "Deterministic astronomy or arithmetic that can be reproduced and independently checked.",
  documented_traditional_interpretation:
    "A mapping recorded in traditional sources. It is a cultural convention, not an empirically tested claim.",
  experimental_symbolic:
    "An adaptation of traditional ideas without an established source for this use. Offered for reflection only.",
  provisional_source: "Relies on a secondary source that has not yet been checked against a primary source.",
  disabled_insufficient_evidence: "Not used, because the available evidence is insufficient.",
};

const STATUS_STYLES: Record<VerificationStatus, string> = {
  verified_calculation: "border-status-verified/35 bg-status-verified/10 text-status-verified",
  documented_traditional_interpretation: "border-status-documented/35 bg-status-documented/10 text-status-documented",
  experimental_symbolic: "border-status-experimental/40 bg-status-experimental/10 text-status-experimental",
  provisional_source: "border-status-provisional/40 bg-status-provisional/10 text-status-provisional",
  disabled_insufficient_evidence: "border-status-disabled/30 bg-status-disabled/[0.08] text-status-disabled",
};

const STATUS_ICONS: Record<VerificationStatus, typeof CheckIcon> = {
  verified_calculation: CheckIcon,
  documented_traditional_interpretation: BookIcon,
  experimental_symbolic: FlaskIcon,
  provisional_source: HourglassIcon,
  disabled_insufficient_evidence: BanIcon,
};

export function getVerificationStatusLabel(status: VerificationStatus): string {
  return VERIFICATION_STATUS_LABELS[status];
}

export interface StatusBadgeProps {
  status: VerificationStatus;
  size?: BadgeSize;
  /** Hide the status icon (the text label is always shown). */
  hideIcon?: boolean;
  className?: string;
}

/**
 * Labels how well-founded a method is. Status is conveyed by text and icon, never colour alone.
 */
export function StatusBadge({ status, size = "sm", hideIcon = false, className }: StatusBadgeProps) {
  const Icon = STATUS_ICONS[status];
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center rounded-full border leading-snug font-medium [&_svg]:shrink-0",
        STATUS_STYLES[status],
        BADGE_SIZES[size],
        className,
      )}
    >
      {hideIcon ? null : <Icon />}
      <span className="min-w-0">{VERIFICATION_STATUS_LABELS[status]}</span>
    </span>
  );
}
