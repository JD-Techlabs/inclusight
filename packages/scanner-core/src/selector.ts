const MAX_SELECTOR_LENGTH = 1000;
const COMBINATORS = new Set([">>>", ">", "+", "~"]);

/** Ids/classes that are build- or runtime-generated (hashes, counters) say nothing about structure. */
function looksGenerated(token: string): boolean {
  if (/\d{3,}/.test(token)) return true; // counters: item-1234, ember567
  if (/^(css|sc|jsx|emotion|svelte|chakra|mui|tw)-[a-z0-9]+$/i.test(token)) return true;
  if (/^[0-9a-f]{8,}$/i.test(token)) return true; // hex hashes
  // Short hash-like mixes of letters and digits with no separators: _3fG2k, a1b2c3
  return /^_?[a-z0-9]{5,}$/i.test(token) && /\d/.test(token) && /[a-z]/i.test(token);
}

/** Joins an axe target (which nests through iframes and shadow roots) into one selector string. */
export function targetToSelector(target: unknown): string {
  const flatten = (value: unknown): string =>
    Array.isArray(value) ? value.map(flatten).join(" >>> ") : String(value ?? "");
  return flatten(target).slice(0, MAX_SELECTOR_LENGTH);
}

function stripCompound(compound: string): string {
  return compound
    .replace(/:(nth-child|nth-of-type|nth-last-child|nth-last-of-type)\([^)]*\)/gi, "")
    .replace(/:(first|last|only)-(child|of-type)/gi, "")
    .replace(/\[[^\]]*\]/g, "")
    .replace(/#((?:\\.|[\w-])+)/g, (match, id: string) =>
      looksGenerated(id.replace(/\\/g, "")) ? "" : match,
    )
    .replace(/\.((?:\\.|[\w-])+)/g, (match, cls: string) =>
      looksGenerated(cls.replace(/\\/g, "")) ? "" : match,
    )
    .replace(/^[a-z][a-z0-9-]*/i, (tag) => tag.toLowerCase());
}

/**
 * Normalises a CSS selector for issue de-duplication (spec §6 fingerprint input): positional
 * pseudo-classes, attribute selectors and generated ids/classes are removed so that the same
 * element in repeated content or across pages of one template produces the same selector.
 */
export function normaliseSelector(selector: string): string {
  // Attribute values may contain spaces or combinator characters; drop them before tokenising.
  const tokens = selector
    .replace(/\[[^\]]*\]/g, "")
    .replace(/\s*(>>>|>|\+|~)\s*/g, " $1 ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  const out: string[] = [];
  for (const token of tokens) {
    if (COMBINATORS.has(token)) {
      if (out.length === 0 || COMBINATORS.has(out[out.length - 1]!)) out.push("*");
      out.push(token);
    } else {
      out.push(stripCompound(token) || "*");
    }
  }
  if (out.length > 0 && COMBINATORS.has(out[out.length - 1]!)) out.push("*");

  return out.join(" ").slice(0, MAX_SELECTOR_LENGTH) || "*";
}
