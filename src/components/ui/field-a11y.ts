/**
 * Helpers for wiring form controls to their hint and error text.
 * Pure functions (no hooks) — safe to import from Server and Client Components.
 */

/** Joins element ids for aria-describedby / aria-labelledby, skipping empty values. */
export function joinIds(...ids: Array<string | false | null | undefined>): string | undefined {
  const joined = ids.filter((id): id is string => typeof id === "string" && id.length > 0).join(" ");
  return joined.length > 0 ? joined : undefined;
}

export interface FieldA11yOptions {
  /** Id of the hint element, if one is rendered. */
  hintId?: string | false | null;
  /** Id of the error element, if one is rendered. Only referenced while `invalid` is true. */
  errorId?: string | false | null;
  invalid?: boolean;
  required?: boolean;
  /** Extra ids to append (e.g. a description elsewhere on the page). */
  describedBy?: string;
}

export interface FieldA11yProps {
  "aria-describedby"?: string;
  "aria-invalid"?: true;
  "aria-required"?: true;
}

/**
 * Returns the aria-* props a control needs. The error is listed before the hint so screen
 * readers announce the problem first.
 */
export function fieldA11yProps({ hintId, errorId, invalid = false, required = false, describedBy }: FieldA11yOptions): FieldA11yProps {
  const props: FieldA11yProps = {};
  const describedByIds = joinIds(invalid ? errorId : null, hintId, describedBy);
  if (describedByIds) props["aria-describedby"] = describedByIds;
  if (invalid) props["aria-invalid"] = true;
  if (required) props["aria-required"] = true;
  return props;
}
