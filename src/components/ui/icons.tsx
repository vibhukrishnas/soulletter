import type { ReactNode, SVGProps } from "react";

/**
 * Small, stroke-based icon set (24×24 grid, currentColor).
 *
 * Icons are decorative by default (`aria-hidden`). Pass `title` to expose an icon as an
 * image with an accessible name — only do that when no adjacent text conveys the meaning.
 */
export interface IconProps extends Omit<SVGProps<SVGSVGElement>, "children"> {
  /** Accessible name. When omitted the icon is hidden from assistive technology. */
  title?: string;
}

function IconBase({
  title,
  children,
  className,
  strokeWidth = 1.6,
  ...rest
}: IconProps & { children: ReactNode }) {
  const labelled = typeof title === "string" && title.length > 0;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      width="1em"
      height="1em"
      focusable="false"
      className={className}
      {...(labelled ? { role: "img", "aria-label": title } : { "aria-hidden": true })}
      {...rest}
    >
      {labelled ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </IconBase>
  );
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M6 9l6 6 6-6" />
    </IconBase>
  );
}

export function ArrowRightIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </IconBase>
  );
}

export function MenuIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </IconBase>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M6 6l12 12M18 6L6 18" />
    </IconBase>
  );
}

export function InfoIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5.5" />
      <circle cx="12" cy="7.75" r="0.6" fill="currentColor" />
    </IconBase>
  );
}

export function CautionIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 3.5L2.75 19.5h18.5L12 3.5z" />
      <path d="M12 10v4.25" />
      <circle cx="12" cy="16.9" r="0.6" fill="currentColor" />
    </IconBase>
  );
}

export function ImportantIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M8.3 3.5h7.4l5.3 5.3v7.4l-5.3 5.3H8.3L3 16.2V8.8z" />
      <path d="M12 7.75v5.5" />
      <circle cx="12" cy="16.25" r="0.6" fill="currentColor" />
    </IconBase>
  );
}

export function BookIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 6.5C10.5 5 8 4.5 4 4.5v13c4 0 6.5.5 8 2 1.5-1.5 4-2 8-2v-13c-4 0-6.5.5-8 2z" />
      <path d="M12 6.5v13" />
    </IconBase>
  );
}

export function FlaskIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M9.5 3.5h5" />
      <path d="M10.5 3.5v5.2L5.2 18a1.6 1.6 0 0 0 1.4 2.5h10.8a1.6 1.6 0 0 0 1.4-2.5l-5.3-9.3V3.5" />
      <path d="M7.4 14.5h9.2" />
    </IconBase>
  );
}

export function HourglassIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M7 3.5h10M7 20.5h10" />
      <path d="M8 3.5c0 4 4 5 4 8.5 0-3.5 4-4.5 4-8.5M8 20.5c0-4 4-5 4-8.5 0 3.5 4 4.5 4 8.5" />
    </IconBase>
  );
}

export function BanIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M5.6 5.6l12.8 12.8" />
    </IconBase>
  );
}

/** Four-point star used as the brand's accent mark. Filled. */
export function SparkleIcon(props: IconProps) {
  return (
    <IconBase strokeWidth={0} {...props}>
      <path
        fill="currentColor"
        d="M12 2.5C12.7 8.6 15.4 11.3 21.5 12 15.4 12.7 12.7 15.4 12 21.5 11.3 15.4 8.6 12.7 2.5 12 8.6 11.3 11.3 8.6 12 2.5z"
      />
    </IconBase>
  );
}

export function LockIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="5" y="10.5" width="14" height="10" rx="2" />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
    </IconBase>
  );
}

export function UserOffIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5" />
      <path d="M3.5 3.5l17 17" />
    </IconBase>
  );
}

export function ShareIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="18" cy="5.5" r="2.5" />
      <circle cx="6" cy="12" r="2.5" />
      <circle cx="18" cy="18.5" r="2.5" />
      <path d="M8.2 10.8l7.6-4.1M8.2 13.2l7.6 4.1" />
    </IconBase>
  );
}

export function MapPinIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" />
      <circle cx="12" cy="10" r="2.3" />
    </IconBase>
  );
}

export function ShieldIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 3l7.5 3v5.5c0 4.6-3.2 8.3-7.5 9.5-4.3-1.2-7.5-4.9-7.5-9.5V6z" />
      <path d="M9 12l2.2 2.2L15.5 10" />
    </IconBase>
  );
}

export function CalendarIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
      <path d="M3.5 9.5h17M8 3v4M16 3v4" />
    </IconBase>
  );
}

export function OrbitIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="2.5" />
      <ellipse cx="12" cy="12" rx="9.5" ry="4" transform="rotate(-30 12 12)" />
      <circle cx="19.2" cy="7.4" r="1.3" fill="currentColor" />
    </IconBase>
  );
}

export function LetterIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="3" y="5.5" width="18" height="13" rx="2" />
      <path d="M3.5 7l8.5 6 8.5-6" />
    </IconBase>
  );
}

export function MoonIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />
    </IconBase>
  );
}

export function NumbersIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M9 4L7.5 20M16.5 4L15 20M4.5 9h16M3.5 15h16" />
    </IconBase>
  );
}

export function EyeOffIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M3 12s3.3-6 9-6c1.6 0 3 .5 4.2 1.1M21 12s-3.3 6-9 6c-1.6 0-3-.5-4.2-1.1" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
      <path d="M3.5 3.5l17 17" />
    </IconBase>
  );
}
