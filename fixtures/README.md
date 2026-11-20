# Fixture site

A small local website with **known** accessibility issues, used to develop and test the scanner
without crawling anyone else's site.

```bash
pnpm fixtures          # http://localhost:4100
```

The worker must be allowed to reach localhost: set `SCANNER_ALLOW_PRIVATE_HOSTS=true` in `.env`
(local development only — it turns off the scanner's SSRF protection).

## Pages

| Path                            | Known issues                                                                                                     |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `/`                             | `image-alt` on the hero image (v1 only), `color-contrast` on the risk disclaimer, `image-alt` on the header logo |
| `/about`                        | `heading-order` (best practice, reported separately)                                                             |
| `/contact`                      | `label` on the name and email inputs                                                                             |
| `/articles`                     | index of 200 article links                                                                                       |
| `/articles/1` … `/articles/200` | one template: `image-alt` (chart) and `link-name` (icon link) on every article                                   |
| `/private/hidden`               | disallowed by `robots.txt`; must never be crawled                                                                |

Every page also has the header logo without alt text. The 200 articles share one template, so
their issues de-duplicate into one issue each with ~200 occurrences.

Every page also triggers these Inclusight custom rules (Phase 2):

- `cr-skip-link`: the navigation is not preceded by a skip link (WCAG 2.4.1).
- `cr-lang-regional`: the footer's "हिन्दी संस्करण" (Hindi version) text has no `lang="hi"` (WCAG 3.1.2).
- `cr-accessibility-statement` (needs review): no link to an accessibility statement.
- `cr-pdf-links` (needs review): the footer links to an annual report PDF.

## Simulating changes

State files in `fixtures/.state/` (git-ignored) are read on every request:

- `version.txt`: write `v2` to fix the home-page hero image and add a new `button-name` issue.
  Re-scan to see one issue fixed and one new. Delete the file (or write `v1`) to go back.
- `well-known.txt`: put a property's verification token here, then choose "File at
  /.well-known/inclusight.txt" as the verification method.
