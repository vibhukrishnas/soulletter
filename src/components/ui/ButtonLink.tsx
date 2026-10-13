import Link from "next/link";
import type { ComponentPropsWithRef, ReactNode } from "react";
import { buttonStyles, type ButtonSize, type ButtonVariant } from "./button-styles";
import { cn } from "./cn";

export interface ButtonLinkProps extends ComponentPropsWithRef<typeof Link> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
}

/**
 * A next/link styled as a button. Use for navigation ("Discover My Initial" → /discover);
 * use <Button> for actions. Usable from Server Components.
 */
export function ButtonLink({
  variant = "primary",
  size = "md",
  fullWidth = false,
  leadingIcon,
  trailingIcon,
  className,
  children,
  ...rest
}: ButtonLinkProps) {
  return (
    <Link {...rest} className={cn(buttonStyles({ variant, size, fullWidth }), className)}>
      {leadingIcon}
      {children}
      {trailingIcon}
    </Link>
  );
}
