import { jsonOk, withErrorBoundary } from "@/server/http/respond";
import { buildRulesMetadata } from "@/server/reading/metadata";

/** GET /api/v1/rules — rule registry, conventions, mapping table and versions. */
export const GET = withErrorBoundary("rules", async () => jsonOk(buildRulesMetadata()));
