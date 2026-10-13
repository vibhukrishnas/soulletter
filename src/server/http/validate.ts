import type { ZodType } from "zod";
import { readJsonBody } from "./body";
import { jsonError, zodErrorToFieldErrors } from "./respond";

export type ParsedBody<T> = { ok: true; value: T } | { ok: false; response: Response };

/** Reads, size-limits and schema-validates a JSON request body. */
export async function parseJsonRequest<T>(request: Request, schema: ZodType<T>): Promise<ParsedBody<T>> {
  const body = await readJsonBody(request);
  if (!body.ok) return body;
  const parsed = schema.safeParse(body.value);
  if (!parsed.success) {
    return {
      ok: false,
      response: jsonError("VALIDATION_ERROR", "Some details need attention.", {
        fieldErrors: zodErrorToFieldErrors(parsed.error),
      }),
    };
  }
  return { ok: true, value: parsed.data };
}
