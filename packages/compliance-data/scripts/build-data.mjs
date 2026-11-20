// Compiles the YAML data files into generated/catalogue.json, which the apps import.
// Run after editing any YAML file in criteria/, mappings/, checklists/ or report-templates/:
//   pnpm --filter @app/compliance-data data:build
// A unit test fails when the generated file is out of date.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

const root = new URL("../", import.meta.url);
const read = (path) => parse(readFileSync(new URL(path, root), "utf8"));

/** Raw catalogue data; validated with Zod when the package loads it. */
export function buildCatalogue() {
  return {
    standards: read("criteria/standards.yaml").standards,
    sources: {
      wcag: read("criteria/wcag.yaml"),
      gigw3: read("criteria/gigw-3.0.yaml"),
      is17802: read("criteria/is-17802.yaml"),
    },
    rules: read("mappings/rules.yaml"),
    checklists: read("checklists/wcag.yaml"),
    reportTypes: read("report-templates/reports.yaml").reports,
  };
}

export const GENERATED_PATH = fileURLToPath(new URL("generated/catalogue.json", root));

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  writeFileSync(GENERATED_PATH, `${JSON.stringify(buildCatalogue(), null, 2)}\n`);
  console.log(`Wrote ${GENERATED_PATH}`);
}
