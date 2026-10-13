import { StarField } from "./StarField";

/**
 * Fixed, full-viewport midnight backdrop (gradient + star field) rendered once by the root
 * layout behind all content. Decorative and non-interactive.
 */
export function SiteBackdrop() {
  return (
    <div aria-hidden="true" className="bg-celestial pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <StarField className="absolute inset-0 size-full opacity-80" />
      <div className="absolute -top-40 left-1/2 h-[28rem] w-[min(60rem,140vw)] -translate-x-1/2 rounded-full bg-indigo-600/15 blur-3xl" />
    </div>
  );
}
