import { readFileSync } from "node:fs";

/**
 * Loads the custom rule scripts (plain browser JavaScript in ./browser) as text. They are
 * evaluated in the scanned page as strings so no transpiler helper can leak into it, and
 * they only read the DOM.
 */
function read(name: string): string {
  return readFileSync(new URL(`./browser/${name}.js`, import.meta.url), "utf8");
}

const helpers = read("helpers");

/** An expression that runs `functionName` from `file` (with the shared helpers) in the page. */
export function browserCall(file: string, functionName: string): string {
  const source = read(file);
  return `(() => {\n${helpers}\n${source}\nreturn ${functionName}();\n})()`;
}
