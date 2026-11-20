// Writes compliance-data/report-templates/<folder>/schema.json from the report data schemas.
//   pnpm --filter @app/reports schemas:write
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { REPORT_TEMPLATES_DIR } from "@app/compliance-data/templates";
import { reportJsonSchemas } from "../src/json-schemas";

for (const { folder, schema } of reportJsonSchemas()) {
  const path = join(REPORT_TEMPLATES_DIR, folder, "schema.json");
  writeFileSync(path, `${JSON.stringify(schema, null, 2)}\n`);
  console.log(`Wrote ${path}`);
}
