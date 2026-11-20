// cr-captcha-alternative: a home-grown CAPTCHA without an audio or other alternative needs a
// manual check (WCAG 1.1.1, 3.3.8). reCAPTCHA, hCaptcha and Turnstile ship their own
// alternatives and are not flagged.
function crCaptchaAlternative() {
  const marker = (el) =>
    /captcha/i.test(
      [
        el.getAttribute("src"),
        el.getAttribute("alt"),
        el.getAttribute("id"),
        el.getAttribute("name"),
        el.getAttribute("class"),
        el.getAttribute("aria-label"),
        el.getAttribute("placeholder"),
      ].join(" "),
    );
  const ALTERNATIVE = /audio|listen|speak|play|सुन/i;
  const candidates = Array.from(document.querySelectorAll("img, canvas, svg, input")).filter(
    (el) => marker(el) && !el.closest(".g-recaptcha, .h-captcha, .cf-turnstile"),
  );
  const seen = new Set();
  const findings = [];
  for (const el of candidates) {
    const container =
      el.closest("form") || (el.parentElement && el.parentElement.parentElement) || document.body;
    if (seen.has(container)) continue;
    seen.add(container);
    const controls = container.querySelectorAll(
      "a, button, [role='button'], input[type='button'], input[type='image']",
    );
    const hasAlternative =
      container.querySelector("audio") !== null ||
      Array.from(controls).some((c) =>
        ALTERNATIVE.test(
          [
            c.textContent,
            c.getAttribute("aria-label"),
            c.getAttribute("title"),
            c.getAttribute("value"),
            c.getAttribute("alt"),
          ].join(" "),
        ),
      );
    if (hasAlternative) continue;
    const image = Array.from(container.querySelectorAll("img, canvas, svg")).find(marker);
    const target = image || el;
    findings.push(
      a11yFinding(
        target,
        "A CAPTCHA was found with no audio or other alternative nearby. Check manually that people who cannot see or solve it (screen reader users, people with cognitive disabilities) have another way to continue.",
      ),
    );
  }
  return findings;
}
