/**
 * Bounded JSON request-body reader for route handlers.
 *
 * Enforces, in order: `Content-Type: application/json` (415), the declared
 * `Content-Length` (413), the actual streamed byte count (413, so a missing or false
 * `Content-Length` cannot bypass the limit), UTF-8 validity and JSON syntax (400).
 * The body is never logged or echoed back.
 */
import { MAX_REQUEST_BYTES } from "@/lib/contracts/input";
import { jsonError } from "./respond";

export type ReadJsonBodyResult = { ok: true; value: unknown } | { ok: false; response: Response };

export type ReadBytesResult =
  | { ok: true; bytes: Uint8Array }
  | { ok: false; reason: "too_large" | "read_error" };

/**
 * Reads a byte stream into memory, stopping (and cancelling the stream) as soon as more
 * than `maxBytes` have been received. Never throws.
 */
export async function readStreamWithLimit(
  stream: ReadableStream<Uint8Array> | null,
  maxBytes: number,
): Promise<ReadBytesResult> {
  if (stream === null) return { ok: true, bytes: new Uint8Array(0) };
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => undefined);
        return { ok: false, reason: "too_large" };
      }
      chunks.push(value);
    }
  } catch {
    await reader.cancel().catch(() => undefined);
    return { ok: false, reason: "read_error" };
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { ok: true, bytes };
}

/** True when the Content-Type header's media type is exactly `application/json`. */
export function isJsonContentType(contentType: string | null): boolean {
  if (contentType === null) return false;
  const mediaType = contentType.split(";", 1)[0].trim().toLowerCase();
  return mediaType === "application/json";
}

function tooLarge(maxBytes: number): Response {
  return jsonError("PAYLOAD_TOO_LARGE", `The request body is too large (limit ${maxBytes} bytes).`);
}

function invalidJson(): Response {
  return jsonError("INVALID_JSON", "The request body is not valid JSON.");
}

/**
 * Reads and parses a JSON request body.
 *
 * @param maxBytes Maximum accepted body size in bytes (defaults to MAX_REQUEST_BYTES).
 * @returns `{ ok: true, value }` with the parsed (still unvalidated) JSON value, or
 *   `{ ok: false, response }` with a ready-to-return typed error response.
 */
export async function readJsonBody(request: Request, maxBytes: number = MAX_REQUEST_BYTES): Promise<ReadJsonBodyResult> {
  if (!isJsonContentType(request.headers.get("content-type"))) {
    return {
      ok: false,
      response: jsonError("UNSUPPORTED_MEDIA_TYPE", "Send the request body as application/json."),
    };
  }

  const declaredLength = request.headers.get("content-length");
  if (declaredLength !== null && /^\d+$/.test(declaredLength.trim())) {
    if (Number(declaredLength.trim()) > maxBytes) return { ok: false, response: tooLarge(maxBytes) };
  }

  if (request.bodyUsed) return { ok: false, response: invalidJson() };
  const read = await readStreamWithLimit(request.body, maxBytes);
  if (!read.ok) {
    return { ok: false, response: read.reason === "too_large" ? tooLarge(maxBytes) : invalidJson() };
  }

  let text: string;
  try {
    // `fatal` rejects malformed UTF-8 instead of silently substituting U+FFFD.
    text = new TextDecoder("utf-8", { fatal: true }).decode(read.bytes);
  } catch {
    return { ok: false, response: invalidJson() };
  }

  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch {
    return { ok: false, response: invalidJson() };
  }
}
