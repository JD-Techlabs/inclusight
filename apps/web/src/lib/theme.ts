import { cookies } from "next/headers";
import { parseThemePreference, THEME_COOKIE, type ThemePreference } from "./theme-preference";

/** The signed-in or anonymous visitor's theme choice, read from the theme cookie. */
export async function getThemePreference(): Promise<ThemePreference> {
  return parseThemePreference((await cookies()).get(THEME_COOKIE)?.value);
}
