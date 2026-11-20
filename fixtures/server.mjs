// Local test site with KNOWN accessibility issues, for scanner development and e2e tests.
// Run: pnpm fixtures   (http://localhost:4100)
//
// State files (git-ignored) in fixtures/.state/ change behaviour at runtime, so tests can
// simulate a customer fixing their site and verifying their domain:
//   version.txt    "v1" (default) or "v2" — v2 fixes the home-page hero image and adds a new issue
//   well-known.txt served at /.well-known/inclusight.txt (domain verification)
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PORT = Number(process.env.FIXTURES_PORT ?? 4100);
const ARTICLE_COUNT = 200;
const stateDir = join(dirname(fileURLToPath(import.meta.url)), ".state");

function readState(name, fallback) {
  try {
    return readFileSync(join(stateDir, name), "utf8").trim() || fallback;
  } catch {
    return fallback;
  }
}

const layout = (title, main) => `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} · Fixture Broking</title>
<style>body{font-family:sans-serif;margin:0} header,main,footer{padding:1rem} .faint{color:#b0b0b0}
.icon{display:inline-block;width:16px;height:16px;background:#333}</style></head>
<body>
<header>
  <a href="/"><img src="/logo.svg" width="120" height="40"></a>
  <nav aria-label="Main"><a href="/">Home</a> <a href="/about">About</a> <a href="/contact">Contact</a> <a href="/articles">Articles</a></nav>
</header>
<main>${main}</main>
<footer><p>© Fixture Broking Ltd. SEBI Reg. No. INZ000000000 (fictional)</p>
<p><a href="/docs/annual-report-2025.pdf">Annual report 2025 (PDF)</a> · <span>हिन्दी संस्करण</span></p></footer>
</body></html>`;

function homePage(version) {
  const hero =
    version === "v2"
      ? `<img src="/hero.svg" width="600" height="200" alt="Investors reviewing a portfolio">`
      : `<img src="/hero.svg" width="600" height="200">`; // KNOWN: image-alt (fixed in v2)
  const newIssue =
    version === "v2"
      ? `<button type="button"><span class="icon"></span></button>` // KNOWN (v2 only): button-name
      : "";
  return layout(
    "Home",
    `<h1>Invest with confidence</h1>
     ${hero}
     <p class="faint">Investments in securities market are subject to market risks.</p>
     ${newIssue}
     <p><a href="/articles">Market insights</a></p>`,
  );
}

const aboutPage = () =>
  layout(
    "About",
    `<h1>About us</h1>
     <h3>Our history</h3>
     <p>We have served investors since 1999.</p>
     <img src="/team.svg" width="300" height="150" alt="Our team">`,
  ); // KNOWN: heading-order (best practice)

const contactPage = () =>
  layout(
    "Contact",
    `<h1>Contact us</h1>
     <form action="/contact" method="get">
       <input type="text" name="name" placeholder="Name">
       <input type="email" name="email" placeholder="Email">
       <button type="submit">Send</button>
     </form>`,
  ); // KNOWN: label (x2)

const articlesIndex = () =>
  layout(
    "Articles",
    `<h1>Market insights</h1><ul>${Array.from(
      { length: ARTICLE_COUNT },
      (_, i) => `<li><a href="/articles/${i + 1}">Article ${i + 1}</a></li>`,
    ).join("")}</ul>`,
  );

function articlePage(n) {
  const paragraphs = Array.from(
    { length: (n % 5) + 2 },
    (_, i) => `<p>Paragraph ${i + 1} of article ${n}.</p>`,
  ).join("");
  return layout(
    `Article ${n}`,
    `<article><h1>Article ${n}</h1>${paragraphs}
       <img src="/chart.svg" width="400" height="200">
       <a href="/articles"><span class="icon"></span></a></article>`,
  ); // KNOWN on every article (one template): image-alt, link-name
}

const svg = (label) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200"><rect width="100%" height="100%" fill="#dde"/><text x="10" y="30">${label}</text></svg>`;

function route(path, host) {
  const version = readState("version.txt", "v1");
  if (path === "/") return ["text/html", homePage(version)];
  if (path === "/about") return ["text/html", aboutPage()];
  if (path === "/contact") return ["text/html", contactPage()];
  if (path === "/articles") return ["text/html", articlesIndex()];
  const article = /^\/articles\/(\d+)$/.exec(path);
  if (article && Number(article[1]) >= 1 && Number(article[1]) <= ARTICLE_COUNT) {
    return ["text/html", articlePage(Number(article[1]))];
  }
  if (path === "/private/hidden")
    return ["text/html", layout("Hidden", "<h1>Must not be crawled</h1>")];
  if (/^\/(logo|hero|team|chart)\.svg$/.test(path)) return ["image/svg+xml", svg(path)];
  if (path === "/robots.txt") {
    return [
      "text/plain",
      `User-agent: *\nDisallow: /private/\nSitemap: http://${host}/sitemap.xml\n`,
    ];
  }
  if (path === "/sitemap.xml") {
    const urls = ["/", "/about", "/contact", "/articles"]
      .map((p) => `<url><loc>http://${host}${p}</loc></url>`)
      .join("");
    return [
      "application/xml",
      `<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`,
    ];
  }
  if (path === "/.well-known/inclusight.txt") {
    const token = readState("well-known.txt", "");
    return token ? ["text/plain", token] : null;
  }
  if (path === "/health") return ["application/json", '{"status":"ok"}'];
  return null;
}

createServer((request, response) => {
  const url = new URL(request.url ?? "/", "http://fixture");
  const result = route(url.pathname, request.headers.host ?? `localhost:${PORT}`);
  if (!result) {
    response.writeHead(404, { "content-type": "text/html" });
    response.end(layout("Not found", "<h1>Not found</h1>"));
    return;
  }
  response.writeHead(200, { "content-type": `${result[0]}; charset=utf-8` });
  response.end(result[1]);
}).listen(PORT, () => console.log(`Fixture site on http://localhost:${PORT}`));
