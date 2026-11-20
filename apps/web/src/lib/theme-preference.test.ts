import { describe, expect, it } from "vitest";
import { parseThemePreference, themeCookie } from "./theme-preference";

describe("theme preference", () => {
  it("accepts only light and dark; anything else means system", () => {
    expect(parseThemePreference("light")).toBe("light");
    expect(parseThemePreference("dark")).toBe("dark");
    expect(parseThemePreference("system")).toBe("system");
    expect(parseThemePreference(undefined)).toBe("system");
    expect(parseThemePreference('dark"><script>')).toBe("system");
  });

  it("stores a choice for a year and clears it for system", () => {
    expect(themeCookie("dark")).toBe("theme=dark; path=/; max-age=31536000; samesite=lax");
    expect(themeCookie("system")).toBe("theme=; path=/; max-age=0; samesite=lax");
  });
});
