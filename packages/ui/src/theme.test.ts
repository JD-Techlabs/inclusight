/// <reference types="node" />
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("./theme.css", import.meta.url), "utf8");

/** The custom properties declared directly inside the first block that follows `selector`. */
function tokens(selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`No block for ${selector}`);
  const body = css.slice(start, css.indexOf("\n}", start));
  return Object.fromEntries(
    [...body.matchAll(/--([\w-]+):\s*([^;]+);/g)].map((m) => [m[1]!, m[2]!.trim()]),
  );
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

const SURFACES = ["background", "card", "sidebar", "muted"];
const TEXT = 4.5;
const NON_TEXT = 3;

/** [foreground token, background tokens, minimum ratio] */
const PAIRS: Array<[string, string[], number]> = [
  ["foreground", SURFACES, TEXT],
  ["muted-foreground", SURFACES, TEXT],
  ["primary", SURFACES, TEXT],
  ["destructive", ["background", "card"], TEXT],
  ["success", ["card"], TEXT],
  ["warning", ["card"], TEXT],
  ["info", ["card"], TEXT],
  ["primary-foreground", ["primary", "primary-hover"], TEXT],
  ["destructive-foreground", ["destructive", "destructive-hover"], TEXT],
  ["primary-soft-foreground", ["primary-soft"], TEXT],
  ["primary", ["primary-soft"], TEXT],
  ["success-soft-foreground", ["success-soft"], TEXT],
  ["warning-soft-foreground", ["warning-soft"], TEXT],
  ["destructive-soft-foreground", ["destructive-soft"], TEXT],
  ["info-soft-foreground", ["info-soft"], TEXT],
  [
    "foreground",
    ["primary-soft", "success-soft", "warning-soft", "destructive-soft", "info-soft"],
    TEXT,
  ],
  ["border", SURFACES, NON_TEXT],
  ["ring", ["background", "card", "sidebar"], NON_TEXT],
];

const light = tokens(":root");
const darkSystem = tokens(':root:not([data-theme="light"])');
const darkChosen = tokens(':root[data-theme="dark"]');

describe("theme tokens", () => {
  it("defines the same dark tokens for the system preference and the explicit choice", () => {
    expect(darkSystem).toEqual(darkChosen);
  });

  it("defines every light token in dark mode too", () => {
    expect(Object.keys(darkChosen).sort()).toEqual(Object.keys(light).sort());
  });

  for (const [name, theme] of [
    ["light", light],
    ["dark", darkChosen],
  ] as const) {
    it(`meets WCAG 2.2 AA contrast in the ${name} theme`, () => {
      const failures: string[] = [];
      for (const [fg, backgrounds, min] of PAIRS) {
        for (const bg of backgrounds) {
          const ratio = contrast(theme[fg]!, theme[bg]!);
          if (ratio < min) failures.push(`${fg} on ${bg}: ${ratio.toFixed(2)} < ${min}`);
        }
      }
      expect(failures).toEqual([]);
    });
  }
});
