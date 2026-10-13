import { describe, expect, it } from "vitest";
import { MAX_REQUEST_BYTES } from "@/lib/contracts/input";
import type { ApiFailure } from "@/lib/contracts/api";
import { isJsonContentType, readJsonBody, readStreamWithLimit } from "./body";

const URL_ = "http://localhost/api/v1/test";

function jsonRequest(body: BodyInit | null, headers: Record<string, string> = {}): Request {
  return new Request(URL_, {
    method: "POST",
    body,
    headers: { "content-type": "application/json", ...headers },
    ...(body instanceof ReadableStream ? { duplex: "half" } : {}),
  } as RequestInit);
}

function streamOf(chunks: Uint8Array[]): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
}

async function expectFailure(result: Awaited<ReturnType<typeof readJsonBody>>, status: number, code: string) {
  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(result.response.status).toBe(status);
  expect(result.response.headers.get("cache-control")).toBe("no-store");
  const body = (await result.response.json()) as ApiFailure;
  expect(body.error.code).toBe(code);
  return body;
}

describe("isJsonContentType", () => {
  it.each([
    ["application/json", true],
    ["application/json; charset=utf-8", true],
    ["Application/JSON", true],
    [" application/json ;charset=UTF-8", true],
    ["text/plain", false],
    ["application/jsonp", false],
    ["application/x-www-form-urlencoded", false],
    ["application/problem+json", false],
  ])("%j → %s", (value, expected) => {
    expect(isJsonContentType(value)).toBe(expected);
  });

  it("rejects a missing header", () => {
    expect(isJsonContentType(null)).toBe(false);
  });
});

describe("readJsonBody", () => {
  it("parses a valid JSON body", async () => {
    const result = await readJsonBody(jsonRequest(JSON.stringify({ a: [1, 2], b: "ü" })));
    expect(result).toEqual({ ok: true, value: { a: [1, 2], b: "ü" } });
  });

  it("parses JSON with a charset parameter and a UTF-8 BOM", async () => {
    const bytes = new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode('{"x":1}')]);
    const result = await readJsonBody(jsonRequest(bytes, { "content-type": "application/json; charset=utf-8" }));
    expect(result).toEqual({ ok: true, value: { x: 1 } });
  });

  it("returns 415 without a JSON content type", async () => {
    const missing = new Request(URL_, { method: "POST", body: "{}" });
    missing.headers.delete("content-type");
    await expectFailure(await readJsonBody(missing), 415, "UNSUPPORTED_MEDIA_TYPE");
    await expectFailure(await readJsonBody(jsonRequest("{}", { "content-type": "text/plain" })), 415, "UNSUPPORTED_MEDIA_TYPE");
  });

  it("returns 413 when Content-Length declares too many bytes, without reading the body", async () => {
    const request = jsonRequest("{}", { "content-length": String(MAX_REQUEST_BYTES + 1) });
    await expectFailure(await readJsonBody(request), 413, "PAYLOAD_TOO_LARGE");
    expect(request.bodyUsed).toBe(false);
  });

  it("returns 413 when the streamed body exceeds the limit even without Content-Length", async () => {
    const chunk = new Uint8Array(4096).fill(0x20);
    const request = jsonRequest(streamOf([chunk, chunk, chunk, chunk, chunk]));
    expect(request.headers.get("content-length")).toBeNull();
    await expectFailure(await readJsonBody(request), 413, "PAYLOAD_TOO_LARGE");
  });

  it("does not trust an understated Content-Length", async () => {
    const big = JSON.stringify({ padding: "x".repeat(200) });
    const request = jsonRequest(big, { "content-length": "10" });
    await expectFailure(await readJsonBody(request, 100), 413, "PAYLOAD_TOO_LARGE");
  });

  it("accepts a body exactly at the limit", async () => {
    const body = `"${"a".repeat(98)}"`;
    expect(body).toHaveLength(100);
    expect(await readJsonBody(jsonRequest(body), 100)).toEqual({ ok: true, value: "a".repeat(98) });
  });

  it.each([
    ["malformed JSON", "{not json"],
    ["an empty body", ""],
    ["trailing garbage", '{"a":1} x'],
  ])("returns 400 for %s", async (_label, body) => {
    await expectFailure(await readJsonBody(jsonRequest(body)), 400, "INVALID_JSON");
  });

  it("returns 400 for invalid UTF-8", async () => {
    await expectFailure(await readJsonBody(jsonRequest(new Uint8Array([0x22, 0xc3, 0x28, 0x22]))), 400, "INVALID_JSON");
  });

  it("returns 400 for a request without a body", async () => {
    const request = new Request(URL_, { method: "POST", headers: { "content-type": "application/json" } });
    await expectFailure(await readJsonBody(request), 400, "INVALID_JSON");
  });

  it("returns 400 when the body was already consumed", async () => {
    const request = jsonRequest("{}");
    await request.text();
    await expectFailure(await readJsonBody(request), 400, "INVALID_JSON");
  });

  it("never echoes the body in error responses", async () => {
    const secret = '{"birthDate":"1990-01-01", oops';
    const failure = await expectFailure(await readJsonBody(jsonRequest(secret)), 400, "INVALID_JSON");
    expect(JSON.stringify(failure)).not.toContain("1990");
  });
});

describe("readStreamWithLimit", () => {
  it("concatenates chunks", async () => {
    const result = await readStreamWithLimit(streamOf([new Uint8Array([1, 2]), new Uint8Array([3])]), 3);
    expect(result).toEqual({ ok: true, bytes: new Uint8Array([1, 2, 3]) });
  });

  it("treats a null stream as empty", async () => {
    expect(await readStreamWithLimit(null, 10)).toEqual({ ok: true, bytes: new Uint8Array(0) });
  });

  it("stops and cancels the stream once the limit is exceeded", async () => {
    let cancelled = false;
    let pulls = 0;
    const endless = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulls++;
        controller.enqueue(new Uint8Array(10));
      },
      cancel() {
        cancelled = true;
      },
    });
    expect(await readStreamWithLimit(endless, 25)).toEqual({ ok: false, reason: "too_large" });
    expect(cancelled).toBe(true);
    expect(pulls).toBeLessThan(10);
  });

  it("reports stream errors", async () => {
    const failing = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.error(new Error("socket reset"));
      },
    });
    expect(await readStreamWithLimit(failing, 100)).toEqual({ ok: false, reason: "read_error" });
  });
});
