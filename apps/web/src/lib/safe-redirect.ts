const DEFAULT_REDIRECT = "/dashboard";

/**
 * Only same-site relative paths are allowed as post-login redirect targets (prevents open
 * redirects through the `redirect` query parameter).
 */
export function safeRedirect(target: unknown, fallback: string = DEFAULT_REDIRECT): string {
  if (typeof target !== "string") return fallback;
  if (!target.startsWith("/") || target.startsWith("//") || target.includes("\\")) return fallback;
  for (const char of target) {
    if (char.charCodeAt(0) < 32) return fallback; // control characters
  }
  return target;
}

export function withRedirect(path: string, redirectTo: string | undefined): string {
  if (!redirectTo) return path;
  return `${path}?redirect=${encodeURIComponent(redirectTo)}`;
}
