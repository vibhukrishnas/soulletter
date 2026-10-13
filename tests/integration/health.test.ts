/**
 * Integration test for GET /api/v1/health, calling the exported route handler directly.
 */
import { describe, expect, it } from "vitest";
import * as route from "@/app/api/v1/health/route";

describe("GET /api/v1/health", () => {
  it("only exports GET", () => {
    const methods = Object.keys(route).filter((name) => /^[A-Z]+$/.test(name));
    expect(methods).toEqual(["GET"]);
  });

  it("reports ok without exposing configuration", async () => {
    const response = await route.GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/json; charset=utf-8");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(await response.json()).toEqual({ ok: true, data: { status: "ok" } });
  });
});
