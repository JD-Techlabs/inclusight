// cr-session-timeout: scripts that look like they manage a session timeout need a manual check
// that users are warned and can extend the session (WCAG 2.2.1).
function crSessionTimeout() {
  const PATTERN =
    /(session|idle|inactiv\w*)[\s\S]{0,40}?(time-?out|expir\w*|log-?out|sign-?out)|auto-?logout|idle-?timer|session-?timeout|keep-?alive/i;
  const ANALYTICS =
    /googletagmanager|google-analytics|clarity\.ms|hotjar|facebook\.net|doubleclick/i;
  for (const script of document.querySelectorAll("script")) {
    const src = script.getAttribute("src") || "";
    if (src && ANALYTICS.test(src)) continue;
    const source = src || (script.textContent || "").slice(0, 200000);
    if (!PATTERN.test(source)) continue;
    return [
      a11yFinding(
        script,
        src
          ? `The script ${src.slice(0, 200)} looks like it manages a session timeout. Check users are warned before the session ends and can extend it.`
          : "An inline script looks like it manages a session timeout. Check users are warned before the session ends and can extend it.",
      ),
    ];
  }
  return [];
}
