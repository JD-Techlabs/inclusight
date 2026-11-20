import { base } from "@app/config/eslint";

/** Custom rule scripts run inside the scanned page (plain browser JavaScript). */
const browserScripts = {
  files: ["src/rules/browser/**/*.js"],
  languageOptions: {
    sourceType: "script",
    globals: {
      document: "readonly",
      window: "readonly",
      getComputedStyle: "readonly",
      NodeFilter: "readonly",
      URL: "readonly",
      // Shared helpers from helpers.js, prepended to every rule script at runtime.
      a11yPath: "readonly",
      a11ySnippet: "readonly",
      a11yFinding: "readonly",
      a11yRendered: "readonly",
      a11yFirstFocusable: "readonly",
    },
  },
  // Each file declares the function the runner calls by name.
  rules: { "no-unused-vars": "off", "@typescript-eslint/no-unused-vars": "off" },
};

/** helpers.js defines the shared helpers; the other scripts only use them. */
const helpersFile = {
  files: ["src/rules/browser/helpers.js"],
  rules: { "no-redeclare": "off" },
};

export default [...base, browserScripts, helpersFile];
