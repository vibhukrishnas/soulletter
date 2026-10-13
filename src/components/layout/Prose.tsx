import type { HTMLAttributes } from "react";
import { cn } from "@/components/ui/cn";

export type ProseProps = HTMLAttributes<HTMLDivElement>;

/**
 * Long-form text styles (policy pages, methodology). Styles descendant headings, paragraphs,
 * lists, links and emphasis so content can be written as plain semantic HTML.
 */
export function Prose({ className, ...rest }: ProseProps) {
  return (
    <div
      {...rest}
      className={cn(
        "text-[1.0625rem] leading-relaxed text-ivory-100",
        "[&_h2]:mt-14 [&_h2]:scroll-mt-24 [&_h2]:text-3xl [&_h2]:leading-tight sm:[&_h2]:text-4xl",
        "[&_h3]:mt-9 [&_h3]:scroll-mt-24 [&_h3]:font-sans [&_h3]:text-lg [&_h3]:font-semibold",
        "[&_p]:mt-4 [&_p]:text-ivory-100/95",
        "[&_ul]:mt-4 [&_ul]:flex [&_ul]:list-disc [&_ul]:flex-col [&_ul]:gap-2.5 [&_ul]:pl-5",
        "[&_ol]:mt-4 [&_ol]:flex [&_ol]:list-decimal [&_ol]:flex-col [&_ol]:gap-2.5 [&_ol]:pl-5",
        "[&_li]:pl-1 [&_li]:marker:text-gold-300",
        "[&_a]:text-ivory-50 [&_a]:underline [&_a]:decoration-gold-300/60 [&_a]:underline-offset-4",
        "[&_a:hover]:decoration-gold-200 [&_a:hover]:decoration-2",
        "[&_strong]:font-semibold [&_strong]:text-ivory-50",
        "[&>*:first-child]:mt-0",
        className,
      )}
    />
  );
}
