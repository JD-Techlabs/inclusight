# Decisions

Short record of choices made where the spec was ambiguous or reality forced a deviation.
Newest phase at the bottom. Each entry: what, why, and how to revisit.

## Phase 0 — Foundation

### D-001 Auth library: Better Auth

Spec §4 allows "Better Auth (or Auth.js)". Better Auth is used because its first-party plugins
cover everything Phase 0 needs (email + password, magic link, organisations with invitations and
roles, TOTP 2FA with backup codes) with a Drizzle adapter. Google sign-in is listed in §4 but
not in the Phase 0 scope (§19), so it is not enabled yet.

### D-002 Version pins that differ from "latest"

- **TypeScript 6.0** (not 7.x): `typescript-eslint` supports `<6.1` only.
- **ESLint 9** (not 10): `eslint-plugin-jsx-a11y` — which we want for dogfooding — supports ≤ 9.
- **BullMQ 5**, **Vitest 4**, **postgres.js 3**, **pnpm 10**: previous majors, chosen for
  stability. Revisit when upgrading deliberately.

### D-003 Table/column naming vs. Better Auth field names

SQL names follow spec §6 (`users`, `organizations`, `memberships`, `org_id`, `totp_enabled`).
The Drizzle _property_ names follow Better Auth's field names (`organizationId`,
`twoFactorEnabled`, …) because its adapter addresses columns by property name. Extra tables
Better Auth needs (`sessions`, `accounts`, `verifications`, `invitations`, `two_factors`) were
added. `entity_type`, `reporting_authority` and roles are `text` columns validated against the
lists in `packages/db/src/domain.ts`, not Postgres enums, so the lists can change without
migrations.

### D-004 Tenant data-access layer

`orgScope(db, orgId)` in `packages/db` is the only way application code reads or writes tenant
tables; it pins `org_id` on every query. Isolation is proven by unit tests running the real
migrations on in-memory Postgres (PGlite, dev-dependency only). Exception: Better Auth itself
reads/writes `memberships` and `invitations` through its adapter; those endpoints check the
caller's membership and role.

### D-005 2FA enforcement

Spec §16: 2FA mandatory for owner/admin. Enforced server-side in `requireAppContext()`: an
owner/admin without TOTP is redirected to `/two-factor-setup` from every app page. Other roles
may enable it voluntarily. TOTP seeds and backup codes are encrypted by Better Auth with
`BETTER_AUTH_SECRET` before storage (rotating that secret invalidates enrolled seeds).
Disabling 2FA has no UI.

### D-006 Magic links never bypass 2FA

Better Auth's TOTP challenge only guards password sign-in, so a magic link would skip it.
Accounts with 2FA enabled therefore never receive a sign-in link; they get an email telling
them to use password + authenticator code. Magic links are sign-in only (`disableSignUp`), and
the UI never reveals whether an address has an account.

### D-007 Auth flows call Better Auth's HTTP API from the browser

Forms use the Better Auth client against `/api/auth/*` rather than custom server actions, so
its built-in input validation (Zod), CSRF/origin checks, 2FA attempt limits and production rate
limiter all apply. There are no custom mutating API routes in Phase 0. Trade-off: these forms
need JavaScript.

### D-008 Audit log coverage and content

A global Better Auth `after` hook records every successful organisation-management call:
organisation created, invitation created / cancelled / accepted / declined, member role
changed, member removed — with actor, target id and client IP (first `X-Forwarded-For` hop;
null when not behind a proxy). Metadata holds roles only, never emails or tokens. User-level
events (2FA enabled, sign-ins) are not logged yet because `audit_log` is organisation-scoped.

### D-009 Email via SMTP (nodemailer) + Mailpit locally

SES and Resend (spec §4) both speak SMTP, so one SMTP transport covers local and production.
Mailpit was added to `docker-compose.yml` as a dev-only inbox so magic-link and invitation
emails can be read (and used by e2e tests) without ever logging token-bearing URLs.

### D-010 MinIO image

`minio/minio` is no longer published on Docker Hub, so compose uses
`cgr.dev/chainguard/minio`. Not used by application code until Phase 1.

### D-011 Compose layout

`docker compose up -d` starts infra only (Postgres, Redis, MinIO, Mailpit), matching the
day-to-day `pnpm dev` workflow. `web`, `worker` and a one-shot `migrate` service are behind
`--profile app`.

### D-012 "Theme"

Read as design tokens with automatic light/dark support via `prefers-color-scheme` (both
schemes are axe-tested). No manual theme toggle yet.

### D-013 Internal packages are consumed as TypeScript source

`@app/db` and `@app/ui` export `.ts` directly (Next `transpilePackages`; `tsx` in the worker).
No per-package build step. `@app/db/domain` is a client-safe entry point (no Postgres driver).

### D-014 E2E runs against `next dev`

Keeps Better Auth's production rate limiter from throttling the test suite. CI separately runs
`pnpm build` to verify the production build.

### D-015 Not included in Phase 0 (deliberately)

Email verification on sign-up, password reset, Google sign-in, org deletion (disabled),
session/device list, manual theme toggle. None are in the Phase 0 list in §19.

### D-016 Spec location

`PRODUCT_SPEC.md` was moved from the repo root to `docs/PRODUCT_SPEC.md`, as spec §0 and
`CLAUDE.md` expect.

## Phase 1 — Web scanner MVP

### D-017 Template hash = landmark structure only

Spec §6: "hash of the page's DOM skeleton (tag names + landmark structure)". A first version
hashed every element (depth-limited, repeats collapsed). On the fixture site, adding one button
to the home page changed its hash, so all 4 home-page issues were reported as "fixed" and
re-created as "new" — exactly the noise the fingerprint is meant to remove. The hash now covers
only landmarks (`header`, `nav`, `main`, `footer`, `aside`, `form`, `search`, and elements with
landmark roles) and how they nest. Content changes inside a landmark keep the page in its
template. Consequence: sites with one layout have one template, so e.g. a header logo issue is
one issue across all pages. Re-validated: v1 → v2 re-scan reports exactly 1 fixed + 1 new.

### D-018 Fingerprint selector comes from axe's ancestry path

`fingerprint = sha256(rule_id + normalised_selector + template_hash)` as spec §6, with a
newline separator between parts. axe's shortest selector often relies on attribute values
(`img[src$="logo.svg"]`); normalisation removes attribute selectors, which merged the header
logo and the article chart into one "img" issue. The normalised selector is therefore built from
axe's full ancestry path (`ancestry: true`), with positional pseudo-classes, attribute selectors
and generated-looking ids/classes (counters, hashes, CSS-in-JS) removed. The raw axe selector is
still stored per occurrence for display and highlighting.

### D-019 New / fixed / reopened rules

Computed once per scan in a single transaction (`finalizeScan`), idempotently:

- **New**: first seen in this scan.
- **Fixed**: open or in-progress, not seen in this scan, and _every_ page it occurred on in its
  last-seen scan was scanned successfully this time. A page that failed to load proves nothing.
- **Reopened**: status was fixed (by a scan or manually) and it was seen again.
- False positive and accepted risk are never changed automatically, and are excluded from the
  score.

Known gap: if the viewport settings change between scans (e.g. mobile removed), an issue seen
only on mobile is marked fixed when its page is re-scanned on desktop only.

### D-020 Accessibility score

`score = round(100 × e^(−P/100))`, `P = Σ weight(impact) × (1 + log10(occurrences))` over WCAG
violations seen in the scan (best practice and false positives excluded). Weights: critical 10,
serious 6, moderate 3, minor 1 (`scanner-core/src/score.ts`). The log keeps one template-wide
issue from outweighing many distinct problems; the exponential keeps it in 0–100 without
depending on site size. Always shown with the "automated checks find only part…" note.
Revisit with real customer data.

### D-021 Screenshots

One full-page JPEG (quality 70) per page per viewport, height capped at 8,000 px, stored in
object storage under `orgs/{org}/scans/{scan}/pages/{page}/{viewport}.jpg`. Highlight boxes
are drawn in the UI from each occurrence's stored bounding box rather than burned into the
image, so one screenshot serves every occurrence. Screenshots are served only through an
authenticated, organisation-scoped route. Retention (spec §16: 90 days) is not implemented yet.

### D-022 Domain verification runs in the web request

Checking is one bounded DNS lookup or HTTP request (10 s timeout) through the same SSRF-safe
fetcher as the crawler, so it gives immediate feedback without a job. The token is stored in
plain text because it is published by design. The base URL cannot be edited (it would void
verification); delete and re-add the property instead.

### D-023 Unverified properties and scan limits

Unverified properties get single-page scans of the exact base URL, always obeying robots.txt,
limited to 10 per hour per organisation. One active scan per property. Limits live in
`packages/config/scan-limits.json` (data, not code) until per-plan limits arrive in Phase 9.

### D-024 SSRF protection

The scanner never reaches loopback, private, link-local (cloud metadata), CGNAT or multicast
addresses: the crawler's fetcher re-checks every redirect hop, and the browser routes every
request (sub-resources included) through the same host guard. `SCANNER_ALLOW_PRIVATE_HOSTS=true`
disables this for local development and CI only (the fixture site runs on localhost); it also
lets the web app accept localhost properties. Known gap: DNS rebinding between the check and the
connection is not prevented.

### D-025 Crawler and politeness

Link discovery uses plain HTTP fetches (robots.txt → sitemaps → breadth-first links), not a
browser, so links that only exist after JavaScript runs are not discovered; customers with
single-page apps should provide a sitemap. Requests are sequential with a 500 ms delay. Page
scans run with concurrency 3 per worker process, which is the per-domain limit while there is
one worker process; multiple worker processes would need a per-domain limiter (e.g. a Redis
semaphore) — revisit when scaling.

### D-026 Job idempotency

Deterministic BullMQ job ids, upserts (`ON CONFLICT`), and a `scan_pages` row per page per scan.
A page that fails on its final attempt is marked failed instead of throwing, so a scan never
hangs on one broken page; the scan finalises when no pages are pending. Re-running any job is
safe.

### D-027 New shared packages

`@app/queue` (queue names, Zod job payloads, enqueue helpers) and `@app/storage` (S3 client)
are used by both web and worker. Not in the CLAUDE.md package list, but small and avoid
duplicating queue contracts and storage code in two apps.

### D-028 Issue export runs in the web request

CSV/XLSX export of the issue list is a single bounded query (capped at 10,000 issues) — not a
report. Formal reports remain worker jobs (Phase 2). Cells starting with `= + - @` are
neutralised against spreadsheet formula injection. The automated-testing note is the last CSV
line and an "About" sheet in XLSX.

### D-029 Guidance until compliance-data exists

"How to fix" links to axe's rule help (Deque University). Static guidance and "who it affects"
need the criteria/mapping data that Phase 2 adds to `packages/compliance-data`. axe
"incomplete" (needs review) results are not stored yet. Best-practice findings are stored as
issues with `is_best_practice`, listed on their own tab, and excluded from score and counts.

### D-030 Forms do not auto-reset after submitting

React 19 resets a form after an `action` submission. That wiped user input after validation
errors (forcing re-entry — WCAG 3.3.7) and desynchronised the verification-method radio from
what was submitted (a real bug found by the e2e test). New forms submit via `onSubmit` +
`startTransition` (`components/use-form-action.ts`). Like the auth forms (D-007), they need
JavaScript.

### D-031 Dev reload loop

`next dev` reloaded pages endlessly ("HMR hash mismatch") after a stale dev server shared
`apps/web/.next` with a new one. Fix: stop all dev servers and delete `apps/web/.next`. Tailwind
now scans explicit folders only (`src/app`, `src/components`, `src/lib`, `packages/ui/src`).

### D-032 Focus after client-side navigation

Found during manual review: after clicking a link inside the app, focus stayed on that link,
so the next Tab continued through the menu and never reached "Skip to main content" (it only
worked on full page loads). `RouteFocusReset` (in `packages/ui`, mounted in the root layout)
now moves focus to an invisible page-start marker just before the skip link whenever the path
changes, so after a mouse click or keyboard Enter alike the next Tab lands on the skip link.
Next.js announces the new page title to screen readers. Changes of query string only (filters,
pagination, tabs) keep focus where it is. The skip link now appears on `:focus-visible`. E2E
tests cover mouse and keyboard navigation, dark-mode colours and reflow at 320/390 px.

### D-033 Next.js dev indicator hidden

The dev-only "N" badge covered page content at the bottom left during manual accessibility
checks, so `devIndicators: false`. Build and runtime errors still show in the dev overlay.

## Phase 2 — Compliance workspace & reports

### D-034 Compliance data: YAML sources, one generated JSON

Criteria (`criteria/*.yaml`), the rule mapping (`mappings/rules.yaml`, YAML as spec §8 asks),
manual checklists (`checklists/wcag.yaml`) and the report registry
(`report-templates/reports.yaml`) are authored as YAML in `packages/compliance-data`.
`pnpm --filter @app/compliance-data data:build` compiles them into `generated/catalogue.json`,
which the web app, worker and tests import like any JSON (no runtime file reads, works in the
Next.js bundle). The catalogue is validated with Zod at load. Tests fail if the generated file is
out of date, if an installed axe-core rule is missing from the mapping, or if any mapping points
at a criterion, rule or standard that does not exist.

### D-035 GIGW 3.0 and IS 17802 are placeholders

They are short lists of requirements written from public summaries, each linked to the WCAG
criteria, scanner rules or whole standard that provide evidence. Clause numbers are "To be
confirmed" rather than guessed. Every screen, export and report that shows them says "Pending
expert review" with the review note (spec §2, §23). WCAG 2.1 AA is the default standard (SEBI
circular); WCAG 2.2 AA is available (55 criteria: 4.1.1 is obsolete in 2.2).

### D-036 Rule kinds and "needs review" findings

Each rule in the mapping has a kind: `violation` (scored), `best_practice`, `review` (a person must
check; the scanner cannot decide) or `aaa` (not run). Review findings are stored as issues with
`needs_review = true` and `is_best_practice = true`, so every existing score and count already
excludes them; they get their own "Needs review" tab. Issue criteria now come from the mapping,
falling back to axe's tags for rules the mapping does not know. axe tags some A/AA rules with
AAA criteria too (e.g. 2.1.3); the mapping keeps only the A/AA criteria.

### D-037 Custom rules (spec §7.4)

In `packages/scanner-core/src/rules/`. Each rule's page logic is a plain browser script, read
as text and evaluated in the page (no transpiler helpers, read-only). They run once per page in
the first configured viewport, after axe and the screenshot, because the focus check moves focus
and scrolls. A rule that throws is skipped and logged (rule id only) so it cannot fail the page.
Results go through the same normalisation and fingerprinting as axe results.

- `cr-skip-link` (violation, 2.4.1): pages whose navigation has 3+ links must start with a skip
  link whose target exists.
- `cr-lang-regional` (violation, 3.1.2): text in Indian scripts whose nearest `lang` does not
  match the script.
- `cr-focus-visible` (violation, 2.4.7): Tab through the first 20 stops, screenshot each element
  focused and unfocused at the same scroll position; pixel-identical means no visible change.
  Conservative: any visible change counts as an indicator.
- `cr-accessibility-statement`, `cr-captcha-alternative`, `cr-session-timeout`, `cr-pdf-links`,
  `cr-video-captions`: review findings. CAPTCHA: only home-grown CAPTCHAs without an
  audio/alternative control nearby (reCAPTCHA, hCaptcha and Turnstile ship alternatives). Session
  timeout: script source or URL patterns, analytics scripts excluded. Statement: link text, label
  or URL with "accessib" or the Hindi words सुगम्य / अभिगम्य.
- `cr-target-size` is **not** a separate rule: axe-core's own `target-size` (WCAG 2.5.8, run via
  the `wcag22aa` tag) already applies the spacing and inline exceptions; a duplicate would report
  every small target twice.

### D-038 Conformance status

Per criterion and property: a manual **fail** → Does not support; unresolved automated
**violations** (open, in progress or accepted risk) without a manual fail → Partially supports (a
manual pass does not erase scanner failures); manual **pass** → Supports; **not applicable** →
Not applicable; otherwise Not evaluated, except fully automatable criteria (only obsolete 4.1.1)
on a scanned property → Supports. Combining properties, or a requirement's related criteria:
all "does not support" → Does not support; any failure → Partially supports; any not evaluated →
Not evaluated; else Supports (not applicable is ignored). Shown as a legend next to every matrix
and in the audit summary.

### D-039 Manual tests

One current result per property and criterion (`manual_tests`); every change is audit-logged
with the criterion and result, so the history is in the audit log. Notes are not copied into the
audit log because they may contain personal data. Owners, admins, nodal officers and auditors can
record results and evidence.

### D-040 Evidence files

PNG, JPEG, WebP, PDF, MP4, WebM, TXT and CSV up to 10 MB, checked by content (magic bytes; text
files must not contain binary data), stored under a random key (`orgs/{org}/evidence/{uuid}.{ext}`)
with the original name kept only in the database. Served only to members through an org-scoped
route with `nosniff` and a sandboxing CSP; only images open inline. Uploads use a server action
with an 11 MB body limit. Not yet: malware scanning, and deleting storage objects when a property
or organisation is deleted (the same gap as screenshots).

### D-041 Tagged PDFs that pass PDF/UA-1

Chromium's `page.pdf({ tagged: true, outline: true })` fails three PDF/UA-1 rules on its own.
After rendering, `pdf-lib` adds an XMP metadata stream (`pdfuaid:part=1`, `dc:title`, language),
sets `DisplayDocTitle` and `/Lang`, gives every link annotation a `/Contents` description, and adds
a RoleMap for PDF 2.0 structure types Chromium emits (e.g. `Strong` → `Span`). Two template
limits: no Chromium page headers or footers (they are untagged: rule 7.1-3), and list items stay
plain text (inline elements inside `<li>` break rule 7.2-20). Templates render offline with
JavaScript disabled. Verified with veraPDF 1.30 (PDF/UA-1) on Windows and on Linux (Playwright's
Docker image). Tests use the pinned `verapdf/cli:v1.30.3` image or `VERAPDF_BIN`; CI sets
`VERAPDF_REQUIRED=1` so a missing validator fails instead of skipping.

### D-042 Templates: LiquidJS

Report templates are LiquidJS (`report-templates/<folder>/template.html`), which escapes every
value by default and cannot run code, so templates stay data that can be edited without code
changes. Each folder's `schema.json` is generated from the Zod schemas in `packages/reports` and
checked by a test. Prettier skips the templates folder (it would reformat Liquid tags).

### D-043 Report generation and downloads

Reports are a worker job (`generate-report`, deterministic job id, idempotent; a ready report is
never regenerated). Input problems (for example a deleted audit) fail at once with a safe message
instead of retrying. Files are stored at `orgs/{org}/reports/{id}/report.{ext}`. "Download links
expire" (spec §9) is met with session-bound links: files are streamed only to signed-in members
of the organisation, never through public or pre-signed URLs, so a link stops working when the
session ends. No retention limit yet.

### D-044 Audit snapshots

Closing an audit (irreversible, needs explicit confirmation) stores a JSON snapshot in
`audits.snapshot`: properties and latest scans, aggregated findings, conformance rows, manual
results, evidence count and up to 2,000 issues. It is built in the web request: a few bounded,
aggregated queries and no rendering. An open audit shows a live preview, and its audit summary
report is marked "Draft". The audit summary also shows GIGW 3.0 and IS 17802 tables computed
from the same snapshot.

### D-045 Report content choices

- **Platform inventory**: registered properties (websites only until Phases 6–7 add document
  collections and apps); a note asks for unlisted platforms to be added. Properties gain an
  optional owner (a member).
- **Remediation tracker**: WCAG findings only (review findings are not remediation items), up to
  5,000, most severe first. Issues gain a target date, set in triage; overdue = unresolved past
  its target date (India time). Fixed date and verifying scan come from the re-scan that stopped
  seeing the issue.
- **Annual report (draft)**: findings as on the generation date; audits that overlap the
  financial year; due date 30 days after 31 March; grievance figures "to be completed" until the
  grievance desk (Phase 4); signature blocks blank or with the names given. The layout is a draft
  until the official SEBI annexure format is obtained (spec §23), and the report says so.
- **Accessibility statement**: WCAG-EM wording (fully / partially conformant / assessment in
  progress), known limitations from failing criteria, the latest closed audit if any, and the
  feedback contact given. PDF, HTML and Markdown.

### D-046 Sign-off

"Record my approval" stores who approved, in which designation (CEO, CTO, nodal officer or
compliance officer) and when, once per person and designation, and audit-logs it. Owners, admins,
nodal officers and viewers (the CEO/CTO signatory persona) can approve. Real signatures happen
outside the product (spec §9).

### D-047 Permissions added in Phase 2

| Action                                 | Roles                                |
| -------------------------------------- | ------------------------------------ |
| Record manual results, upload evidence | owner, admin, nodal officer, auditor |
| Create, edit and close audits          | owner, admin, nodal officer, auditor |
| Generate reports                       | owner, admin, nodal officer, auditor |
| Record report approval                 | owner, admin, nodal officer, viewer  |
| Set a property's owner                 | owner, admin                         |
| View conformance, audits and reports   | every member                         |

### D-048 Shared labels

Entity type, reporting authority, issue status and impact labels moved to `@app/db/domain` so
the app and generated reports use the same words.

### D-049 Fixture site

The fixture footer now links to a PDF and shows "हिन्दी संस्करण" without `lang`, so every page also
triggers `cr-pdf-links` and `cr-lang-regional` (as well as `cr-skip-link` and
`cr-accessibility-statement`, which it already did). The Hindi text is deliberately not a link:
a link to a new page took one of the crawl slots in the Phase 1 e2e test (8-page limit) and
changed its expected occurrence counts. The PDF link is not crawled. Phase 1's fixed/new
expectations are unchanged because these findings are the same in v1 and v2.

## UI refresh (between Phase 2 and Phase 3, requested by the product owner)

### D-050 Design system, fonts, icons and themes

- **Scope:** a visual refresh of the existing screens only — no new data, routes or features.
  Requested outside the phase plan; recorded here so it is not mistaken for Phase 3 work.
- **Tokens:** all colours are CSS custom properties in `packages/ui/src/theme.css` (indigo
  primary, tinted neutral surfaces, soft success/warning/danger/info tones for badges). Every
  text/background and control-border pair is checked against WCAG 2.2 AA in
  `packages/ui/src/theme.test.ts`, for both themes.
- **Themes:** light, dark and "System" (the default). The choice is a plain `theme` cookie
  (`light` | `dark`; no cookie = system), read by the root layout, which renders
  `data-theme` on `<html>`. This avoids an inline script and a flash of the wrong theme. The cookie
  holds no personal data. Reading it makes every route dynamic, which they already were (session).
  The switcher is a native radio group (keyboard: arrow keys) in the sidebar and on the sign-in
  pages; a View Transition cross-fades the change unless reduced motion is requested.
- **Fonts:** Geist Sans and Geist Mono from the `geist` npm package (pinned 1.9.0), self-hosted via
  `next/font/local`: no request to Google or any third party, no build-time download.
- **Icons:** `lucide-react` (pinned 1.68.0, ISC). Icons are decorative (`aria-hidden` by
  default); meaning is always in text. Both versions were over two weeks old when added.
- **Motion:** CSS only (no animation library): page enter (`template.tsx`), staggered cards, score
  ring fill, trend line draw, badge/alert entrances, small hover lifts. All run once and briefly;
  `prefers-reduced-motion: reduce` turns all of them off (including delays). The only endless
  animation is the spinner while a scan or report is running.
- **No loading skeleton (`loading.tsx`):** a loading boundary makes Next.js stream the page and
  send HTTP 200 before the page can call `notFound()`, so another organisation's property or audit
  would answer 200 (with the not-found page) instead of 404. Correct 404s matter more.
- **Layout:** app shell with a sidebar on large screens (the `<header>`/banner landmark holds the
  logo, organisation, grouped navigation, theme and user) and a Menu disclosure button on small
  screens (closes on navigation and Escape). Sign-in pages get a brand panel (`<aside>`) on large
  screens.
- **Shared components** in `@app/ui`: `PageHeader`, `CardHeader`, `Badge`, `StatCard`,
  `EmptyState`, `TabNav`, `TableContainer` + table classes, `Textarea`, choice-card and file-input
  classes. Status colours for badges live in `apps/web/src/lib/status-tones.ts`.
- **Tests:** the axe helper now waits for animations to finish and checks every screen in both the
  light and the dark theme. New e2e checks cover the theme choice (applies at once, survives a
  reload, overrides the system setting) and the phone Menu button.

## Product name (between Phase 2 and Phase 3, requested by the product owner)

### D-051 Renamed from "A11yComply" to "Inclusight"

- **Why:** the working name in the spec used developer jargon ("a11y") that compliance buyers do
  not know, and "Comply" suggested the product certifies compliance, which it must never claim.
  The product owner chose **Inclusight**.
- **What changed:** every user-facing string (app title, brand, footer, emails, report templates,
  PDF producer, spreadsheet creator) and every identifier derived from the name:
  - crawler user-agent `InclusightBot/1.0 (+<APP_URL>/bot)`, robots.txt token `inclusightbot`;
  - domain verification: file `/.well-known/inclusight.txt`, meta tag `inclusight-verification`,
    DNS TXT prefix `inclusight-verification=`;
  - custom axe rule tag `inclusight-custom`; root package name `inclusight`; planned npm CLI
    `inclusight` (unclaimed on npm when checked);
  - local and CI infra: Docker Compose project, Postgres user/password/database and the storage
    bucket are all `inclusight`; email sender `Inclusight <no-reply@inclusight.local>`.
- **No migration code:** there are no customers yet, so nothing needed the old verification names
  or bot name to keep working. Properties verified before the rename stay verified (the flag is
  stored); re-checking one now looks for the new names.
- **Local environments:** the old Docker volumes (`a11ycomply_*`) are not used any more. Copy the
  data across once (database dump and restore, stored files bucket to bucket) or start fresh,
  then update `.env` from `.env.example`.
- **Not checked:** trademark, company-name and domain availability for "Inclusight". The product
  owner will check these before launch.
