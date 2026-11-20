/**
 * Colour theme preference (D-050). Stored in a plain cookie so the server renders the chosen
 * theme on <html> straight away (no flash, no inline script). No cookie means "System".
 */
export const THEME_COOKIE = "theme";
export const THEME_PREFERENCES = ["light", "dark", "system"] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export function parseThemePreference(value: string | null | undefined): ThemePreference {
  return value === "light" || value === "dark" ? value : "system";
}

/** The Set-Cookie string for a choice; "system" deletes the cookie. */
export function themeCookie(preference: ThemePreference): string {
  return preference === "system"
    ? `${THEME_COOKIE}=; path=/; max-age=0; samesite=lax`
    : `${THEME_COOKIE}=${preference}; path=/; max-age=${ONE_YEAR_SECONDS}; samesite=lax`;
}
