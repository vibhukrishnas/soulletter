/**
 * Minimal class-name joiner. Falsy values are skipped and nested arrays are flattened.
 *
 * Note: this does not de-duplicate conflicting Tailwind utilities. Classes passed through a
 * component's `className` prop are appended last; prefer adding layout/spacing utilities
 * rather than overriding a component's colours or sizing.
 */
export type ClassValue = string | number | false | null | undefined | readonly ClassValue[];

export function cn(...values: ClassValue[]): string {
  const out: string[] = [];
  const visit = (value: ClassValue): void => {
    if (value === false || value === null || value === undefined || value === "") return;
    if (Array.isArray(value)) {
      for (const item of value as readonly ClassValue[]) visit(item);
      return;
    }
    out.push(String(value));
  };
  for (const value of values) visit(value);
  return out.join(" ");
}
