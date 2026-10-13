/**
 * GET /api/v1/health — liveness probe.
 *
 * Always `{ ok: true, data: { status: "ok" } }`. Deliberately exposes no configuration,
 * versions or secrets, and performs no dependency checks.
 */
import { jsonOk } from "@/server/http/respond";

interface HealthData {
  status: "ok";
}

export async function GET(): Promise<Response> {
  const data: HealthData = { status: "ok" };
  return jsonOk(data);
}
