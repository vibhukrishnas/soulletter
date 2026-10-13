import type { HTMLAttributes } from "react";
import { cn } from "@/components/ui/cn";

export type ContainerSize = "prose" | "md" | "lg" | "xl";

export interface ContainerProps extends HTMLAttributes<HTMLElement> {
  as?: "div" | "section" | "header" | "footer" | "article" | "nav";
  /** prose ≈ 42rem (reading width), md ≈ 56rem, lg ≈ 72rem (default), xl ≈ 80rem. */
  size?: ContainerSize;
}

const SIZES: Record<ContainerSize, string> = {
  prose: "max-w-2xl",
  md: "max-w-4xl",
  lg: "max-w-6xl",
  xl: "max-w-7xl",
};

/** Centered page column with responsive side padding (16px on phones). */
export function Container({ as: Tag = "div", size = "lg", className, ...rest }: ContainerProps) {
  return <Tag {...rest} className={cn("mx-auto w-full px-4 sm:px-6 lg:px-8", SIZES[size], className)} />;
}
