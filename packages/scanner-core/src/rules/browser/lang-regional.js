// cr-lang-regional: text in Indian scripts is inside an element whose lang matches (WCAG 3.1.2).
function crLangRegional() {
  const SCRIPTS = [
    {
      name: "Devanagari",
      re: /[\u0900-\u097F]/g,
      langs: ["hi", "mr", "ne", "sa", "kok", "mai", "bho", "doi", "brx", "sd"],
    },
    { name: "Bengali", re: /[\u0980-\u09FF]/g, langs: ["bn", "as", "mni"] },
    { name: "Gurmukhi", re: /[\u0A00-\u0A7F]/g, langs: ["pa"] },
    { name: "Gujarati", re: /[\u0A80-\u0AFF]/g, langs: ["gu"] },
    { name: "Odia", re: /[\u0B00-\u0B7F]/g, langs: ["or"] },
    { name: "Tamil", re: /[\u0B80-\u0BFF]/g, langs: ["ta"] },
    { name: "Telugu", re: /[\u0C00-\u0C7F]/g, langs: ["te"] },
    { name: "Kannada", re: /[\u0C80-\u0CFF]/g, langs: ["kn"] },
    { name: "Malayalam", re: /[\u0D00-\u0D7F]/g, langs: ["ml"] },
    { name: "Ol Chiki", re: /[\u1C50-\u1C7F]/g, langs: ["sat"] },
    { name: "Perso-Arabic", re: /[\u0600-\u06FF]/g, langs: ["ur", "ks", "sd", "ar", "fa"] },
  ];
  const SKIP = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE", "TEXTAREA"]);
  const root = document.body || document.documentElement;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const flagged = new Set();
  const findings = [];

  for (let node = walker.nextNode(); node && findings.length < 50; node = walker.nextNode()) {
    const text = node.nodeValue || "";
    const el = node.parentElement;
    if (!el || text.trim().length < 2 || SKIP.has(el.tagName) || flagged.has(el)) continue;
    const script = SCRIPTS.find((s) => (text.match(s.re) || []).length >= 2);
    if (!script) continue;
    const langEl = el.closest("[lang]");
    const lang = ((langEl && langEl.getAttribute("lang")) || "")
      .trim()
      .toLowerCase()
      .split(/[-_]/)[0];
    if (script.langs.includes(lang) || !a11yRendered(el)) continue;
    flagged.add(el);
    findings.push(
      a11yFinding(
        el,
        `This text is in ${script.name} script, but its language is ${lang ? `set to "${lang}"` : "not set"}, so screen readers will mispronounce it. Add the correct lang attribute (for example lang="${script.langs[0]}") to this element.`,
      ),
    );
  }
  return findings;
}
