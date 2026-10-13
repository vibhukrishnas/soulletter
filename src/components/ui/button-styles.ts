import { cn } from "./cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "link";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonStyleOptions {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Stretch to the full width of the container. */
  fullWidth?: boolean;
}

const BASE =
  "relative inline-flex items-center justify-center gap-2 text-center font-medium tracking-[0.01em] " +
  "border transition-[background-color,border-color,color,box-shadow,transform] duration-200 ease-celestial " +
  "select-none disabled:cursor-not-allowed disabled:opacity-55 aria-disabled:cursor-not-allowed " +
  "[&_svg]:shrink-0";

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "rounded-full border-gold-200/70 bg-linear-to-b from-gold-200 to-gold-400 text-night-950 shadow-glow-gold " +
    "hover:from-gold-100 hover:to-gold-300 active:translate-y-px motion-reduce:active:translate-y-0",
  secondary:
    "rounded-full border-gold-300/35 bg-night-800/70 text-ivory-50 " +
    "hover:border-gold-300/70 hover:bg-night-700/80 active:translate-y-px motion-reduce:active:translate-y-0",
  ghost:
    "rounded-full border-transparent bg-transparent text-ivory-100 " +
    "hover:bg-white/[0.07] hover:text-ivory-50",
  link:
    "rounded-sm border-transparent bg-transparent p-0 text-ivory-50 underline decoration-gold-300/60 " +
    "decoration-1 underline-offset-4 hover:decoration-gold-200 hover:decoration-2",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "min-h-9 px-4 py-1.5 text-sm [&_svg]:size-4",
  md: "min-h-11 px-5 py-2 text-[0.9375rem] [&_svg]:size-[1.125rem]",
  lg: "min-h-13 px-7 py-3 text-base [&_svg]:size-5",
};

/** Link-styled buttons keep the type scale but drop the control padding and height. */
const LINK_SIZES: Record<ButtonSize, string> = {
  sm: "text-sm [&_svg]:size-4",
  md: "text-[0.9375rem] [&_svg]:size-[1.125rem]",
  lg: "text-base [&_svg]:size-5",
};

/**
 * Class names for SoulLetter buttons. Shared by <Button>, <ButtonLink>, and any element
 * that must look like a button (e.g. a <label> acting as a file picker).
 */
export function buttonStyles({ variant = "primary", size = "md", fullWidth = false }: ButtonStyleOptions = {}): string {
  return cn(
    BASE,
    VARIANTS[variant],
    variant === "link" ? LINK_SIZES[size] : SIZES[size],
    fullWidth && "w-full",
  );
}
