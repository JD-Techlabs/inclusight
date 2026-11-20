import { listReportTypes } from "@app/compliance-data";
import { z } from "zod";
import { REPORT_DATA_SCHEMAS } from "./schemas";

/** JSON Schema of each template's data, written next to the template as schema.json. */
export function reportJsonSchemas() {
  return listReportTypes().map((info) => ({
    folder: info.folder,
    schema: {
      title: `${info.title}: template data`,
      description:
        "Generated from packages/reports/src/schemas.ts by `pnpm --filter @app/reports schemas:write`. Do not edit by hand.",
      ...z.toJSONSchema(REPORT_DATA_SCHEMAS[info.type]),
    },
  }));
}
