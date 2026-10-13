import type { HTMLAttributes } from "react";
import { cn } from "./cn";

export type CardElement = "div" | "section" | "article" | "aside" | "li";
export type CardVariant = "default" | "elevated" | "outline" | "glow";
export type CardPadding = "none" | "sm" | "md" | "lg";

export interface CardProps extends HTMLAttributes<HTMLElement> {
  /** Rendered element. Use "article"/"section" when the card is a self-contained region, "li" inside lists. */
  as?: CardElement;
  variant?: CardVariant;
  padding?: CardPadding;
}

const VARIANTS: Record<CardVariant, string> = {
  default: "border-line bg-night-800/55 shadow-card",
  elevated: "border-line-strong bg-night-700/60 shadow-raised",
  outline: "border-line bg-transparent",
  glow: "border-gold-300/25 bg-night-800/60 shadow-glow-gold-soft",
};

const PADDING: Record<CardPadding, string> = {
  none: "",
  sm: "p-4",
  md: "p-5 sm:p-6",
  lg: "p-6 sm:p-8",
};

/** Surface container with a soft champagne hairline along the top edge. */
export function Card({ as: Tag = "div", variant = "default", padding = "md", className, ...rest }: CardProps) {
  return (
    <Tag
      {...rest}
      className={cn(
        "relative rounded-card border text-ivory-100",
        variant !== "outline" &&
          "before:pointer-events-none before:absolute before:inset-x-8 before:top-0 before:h-px before:hairline-gold",
        VARIANTS[variant],
        PADDING[padding],
        className,
      )}
    />
  );
}

export type CardHeaderProps = HTMLAttributes<HTMLDivElement>;

export function CardHeader({ className, ...rest }: CardHeaderProps) {
  return <div {...rest} className={cn("mb-4 flex flex-col gap-2", className)} />;
}

export interface CardTitleProps extends HTMLAttributes<HTMLHeadingElement> {
  /** Heading level that fits the surrounding document outline. Defaults to h3. */
  as?: "h2" | "h3" | "h4" | "p";
}

export function CardTitle({ as: Tag = "h3", className, ...rest }: CardTitleProps) {
  return (
    <Tag
      {...rest}
      className={cn("font-display text-2xl leading-tight font-medium text-ivory-50", className)}
    />
  );
}

export type CardDescriptionProps = HTMLAttributes<HTMLParagraphElement>;

export function CardDescription({ className, ...rest }: CardDescriptionProps) {
  return <p {...rest} className={cn("text-sm leading-relaxed text-mist-300", className)} />;
}

export type CardBodyProps = HTMLAttributes<HTMLDivElement>;

export function CardBody({ className, ...rest }: CardBodyProps) {
  return <div {...rest} className={cn("text-[0.9375rem] leading-relaxed text-ivory-100", className)} />;
}

export type CardFooterProps = HTMLAttributes<HTMLDivElement>;

export function CardFooter({ className, ...rest }: CardFooterProps) {
  return (
    <div {...rest} className={cn("mt-5 flex flex-wrap items-center gap-3 border-t border-line pt-4", className)} />
  );
}
