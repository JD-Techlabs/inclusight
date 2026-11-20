type Rule = { allow: boolean; pattern: string };
type Group = { agents: string[]; rules: Rule[] };

export type RobotsRules = { groups: Group[] };

export const ALLOW_ALL: RobotsRules = { groups: [] };

/** Minimal robots.txt parser (RFC 9309): user-agent groups with allow/disallow rules. */
export function parseRobots(text: string): RobotsRules {
  const groups: Group[] = [];
  let current: Group | null = null;
  let lastWasAgent = false;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    const separator = line.indexOf(":");
    if (separator === -1) continue;
    const field = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();

    if (field === "user-agent") {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
    } else if (field === "allow" || field === "disallow") {
      lastWasAgent = false;
      if (current && value !== "") current.rules.push({ allow: field === "allow", pattern: value });
    } else {
      lastWasAgent = false;
    }
  }
  return { groups };
}

function patternToRegExp(pattern: string): RegExp {
  const anchored = pattern.endsWith("$");
  const body = (anchored ? pattern.slice(0, -1) : pattern)
    .split("*")
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${body}${anchored ? "$" : ""}`);
}

/**
 * Whether `url` may be fetched by the crawler identified by `agentToken`. The most specific
 * matching group applies (falling back to `*`); within it the longest matching rule wins and
 * allow wins ties.
 */
export function isAllowedByRobots(rules: RobotsRules, url: string, agentToken: string): boolean {
  const token = agentToken.toLowerCase();
  const specific = rules.groups.filter((g) => g.agents.some((a) => a !== "*" && token.includes(a)));
  const applicable =
    specific.length > 0 ? specific : rules.groups.filter((g) => g.agents.includes("*"));
  if (applicable.length === 0) return true;

  let path: string;
  try {
    const parsed = new URL(url);
    path = parsed.pathname + parsed.search;
  } catch {
    return false;
  }

  let best: Rule | null = null;
  for (const rule of applicable.flatMap((g) => g.rules)) {
    if (!patternToRegExp(rule.pattern).test(path)) continue;
    if (
      !best ||
      rule.pattern.length > best.pattern.length ||
      (rule.pattern.length === best.pattern.length && rule.allow)
    ) {
      best = rule;
    }
  }
  return best ? best.allow : true;
}
