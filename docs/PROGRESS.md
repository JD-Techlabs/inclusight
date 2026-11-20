# Progress

## Product renamed to Inclusight ✅ (awaiting review)

- "A11yComply" is now **Inclusight** everywhere: screens, emails, reports, crawler user-agent,
  domain-verification names, package names and local/CI infrastructure (D-051).
- How to see it: `pnpm dev`, then look at the brand in the sidebar and the browser tab title. A
  property's "Verify your domain" panel now offers `/.well-known/inclusight.txt`.
- Local data was carried over: the database was dumped and restored into the new Postgres, and all
  stored files were copied to the new bucket. The old `a11ycomply_*` Docker volumes are kept as a
  backup and can be removed with `docker volume rm a11ycomply_postgres-data a11ycomply_minio-data`.
- Checks: format, lint, typecheck, 198 unit tests, the build and all 15 e2e tests pass. The axe
  helper now waits for the page title before checking: after an in-app navigation Next.js adds
  the new `<title>` just after the page content, which made the Audits check fail at random.
- Known issues:
  - Any `pnpm dev` started before the rename must be restarted to pick up the new `.env` values.
  - In one e2e run the dev server started by Playwright recompiled every ~0.6 s with no source
    file changing, and each recompile reloaded the open page (14 tests failed). It did not happen
    again with fresh servers and the cause is not known. If it comes back, stop every dev
    server, then re-run.

## UI refresh (requested between Phase 2 and Phase 3) ✅ (awaiting review)

### Done

- New design system (D-050): indigo brand colours on tinted surfaces, Geist fonts (self-hosted),
  lucide icons, soft status badges, cards, stat tiles, empty states and segmented tabs.
- **Light, dark and System themes**, chosen at the bottom of the sidebar (or at the top of the
  sign-in pages), remembered in a cookie and rendered by the server without a flash.
- Motion: page and card entrances, score ring and trend line animations, hover lifts. All of it
  stops with the operating system's "reduce motion" setting.
- App shell: sidebar navigation with groups and icons on large screens; a Menu button on phones.
  Sign-in pages: a brand panel with the product summary on large screens.
- Every screen restyled with the shared components; markup, landmarks, labels and test ids kept.

### How to see it

1. `pnpm dev`, sign in, and use **Theme: Light / Dark / System** at the bottom of the sidebar.
2. Turn on "reduce motion" in the OS (Windows: Settings → Accessibility → Visual effects →
   Animation effects off) and reload: pages appear without animation.
3. Make the window narrower than 1024 px: the sidebar becomes a **Menu** button; Escape closes it.

### Checks

- `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm build`: pass.
- `pnpm test`: 198 unit tests pass (new: theme contrast and token-sync tests, theme cookie tests).
- `pnpm test:e2e`: all 15 tests pass. axe now runs on every screen in both the light and the dark
  theme, and new tests cover the theme choice and the phone menu. Fixes found on the way: no
  loading skeleton (it turned cross-organisation 404s into 200s, D-050), and table frames are
  `position: relative` so screen-reader-only cell text cannot widen the page on phones.

### Known issues

- In `next dev`, the first visit to a route just after the server starts can trigger a Fast
  Refresh reload while Turbopack compiles; the e2e animation wait retries once for this.

---

## Phase 2 — Compliance workspace & reports ✅ (complete, awaiting review)

### Done

- **Compliance data** (`packages/compliance-data`, all data files, D-034):
  - criteria catalogue: WCAG 2.1 A/AA (50) and the WCAG 2.2 additions (55 in WCAG 2.2 AA), each
    with a plain-language summary, who it affects, how far it can be automated and a W3C link;
  - GIGW 3.0 and IS 17802 placeholder requirements, marked **pending expert review** everywhere
    (D-035);
  - `mappings/rules.yaml`: every axe-core 4.14 rule (105) and every custom rule mapped to
    criteria, checked against the installed axe-core by a test;
  - manual test checklists (tools + steps) for every criterion that is not fully automatable;
  - report templates (LiquidJS) with a `schema.json` per report (D-042).
- **Custom rules** (spec §7.4, `packages/scanner-core/src/rules`, D-037): skip link, Indian-
  language `lang`, focus visible (screenshot comparison), accessibility statement, CAPTCHA
  alternative, session timeout, PDF links, video captions. Target size is covered by axe's own
  `target-size` rule. Findings a person must check go to a new **Needs review** tab (D-036).
- **Manual tests**: per property and standard, one page per criterion with its meaning, the
  automated result, the test steps, a result (pass / fail / not applicable) with notes, and
  **evidence uploads** (images, PDFs, recordings, text; checked by content, D-040).
- **Conformance matrix** (Conformance in the navigation): criteria × properties for WCAG 2.1 AA,
  WCAG 2.2 AA, GIGW 3.0 and IS 17802, combining scan and manual results (rules in D-038, legend on
  screen), with CSV / Excel export.
- **Audits**: auditor, IAAP certification, organisation, dates, standard, scope and methodology;
  closing locks a snapshot of findings, conformance and manual results (D-044).
- **Reports** (worker job, D-043): platform inventory, audit summary, remediation tracker,
  annual accessibility compliance report (draft) and accessibility statement, as **tagged PDFs
  that pass veraPDF PDF/UA-1** (D-041), plus Excel (or HTML and Markdown for the statement).
  Approvals ("sign-off") are recorded with designation and audit-logged (D-046).
- **Also**: property owner (inventory), issue target dates in triage (tracker), criterion names,
  W3C links and "who it affects" on issue pages, new audit-log entries for every new action.

### How to run locally

Same as Phase 1, plus:

```bash
pnpm install
docker compose -f infra/docker-compose.yml up -d
pnpm --filter @app/db db:migrate     # adds manual_tests, evidence, audits, reports
pnpm dev                             # web + worker (the worker now also generates reports)
pnpm fixtures                        # optional: fixture site on http://localhost:4100
```

To run the PDF/UA test, keep Docker running (it uses the `verapdf/cli:v1.30.3` image) or set
`VERAPDF_BIN` to a local veraPDF CLI. After editing compliance YAML run
`pnpm --filter @app/compliance-data data:build`; after changing report data schemas run
`pnpm --filter @app/reports schemas:write`.

### How to test manually

1. As an owner, add and scan the fixture site (Phase 1 steps). On the issues page, the new
   **Needs review** tab lists the missing accessibility statement and the linked PDF; the WCAG
   tab now also shows the missing skip link and the Hindi link without `lang`.
2. Property page → **Manual tests** → open **1.4.3 Contrast (Minimum)** → read the steps →
   record **Fail** with a note → attach a screenshot. Record **Pass** for **2.1.1 Keyboard**.
3. **Conformance**: 1.4.3 shows "Does not support", 1.1.1 "Partially supports" (scan found
   issues), 2.1.1 "Supports". Switch to GIGW 3.0 to see the pending-review placeholders.
   Export CSV.
4. Property **Settings** → choose an owner.
5. **Audits** → create an audit (IAAP number is required) → **Close audit and lock findings**.
6. **Reports** → generate each of the five reports → download the PDF, Excel, HTML and
   Markdown files. On the annual report, **Record my approval** as CEO.
7. **Audit log** shows every step above.

### Acceptance results (spec §19 "Done when")

| Criterion                                   | Result                                                                                                                                                                                                                                                                                                         |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A full audit can be recorded                | e2e `compliance.spec.ts`: scan → custom-rule findings → manual results with notes and evidence (a disguised file is rejected) → conformance matrix (1.4.3 Does not support, 1.1.1 Partially supports, 2.1.1 Supports) and CSV export → property owner → audit created and closed (snapshot locked) → audit log |
| All 5 reports generated                     | Same test: every report type generated by the worker; every file downloaded (5 PDFs, 4 Excel, HTML, Markdown); approval recorded on the annual report                                                                                                                                                          |
| Generated PDFs pass veraPDF PDF/UA in tests | `packages/reports/src/pdfua.test.ts`: all five report types pass veraPDF 1.30.3 PDF/UA-1; the e2e test also validates the five PDFs downloaded from the running app. Also checked by hand: the same reports rendered by Chromium on Linux pass                                                                 |

### Checks

| Command             | Result on 2026-11-19                                                                                                                                                                                            |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm format:check` | pass                                                                                                                                                                                                            |
| `pnpm lint`         | pass                                                                                                                                                                                                            |
| `pnpm typecheck`    | pass                                                                                                                                                                                                            |
| `pnpm test`         | pass — 192 unit tests (scanner-core 61, web 44, compliance-data 31, db 25, reports 20 incl. veraPDF, worker 8, queue 3)                                                                                         |
| `pnpm build`        | pass                                                                                                                                                                                                            |
| `pnpm test:e2e`     | pass — 14 tests (8.2 min) incl. the full audit-and-reports flow with veraPDF on downloaded PDFs and a cross-organisation 404 test; axe finds no violations on any new screen; no horizontal scrolling at 390 px |

Unit tests now need Chromium (`pnpm --filter @app/scanner-core exec playwright install chromium`)
and Docker (or `VERAPDF_BIN`) for the PDF/UA test; without either, that one test is skipped
locally with a warning.

### Known issues / not verified

- **CI not run on GitHub** (no remote). CI now installs Chromium for unit tests and requires
  veraPDF (Docker) in both jobs; untested there.
- **Docker images** were not rebuilt for Phase 2 (they copy the two new packages). Report PDFs
  were verified to pass PDF/UA-1 when rendered by Chromium on Linux (Playwright image).
- **GIGW 3.0, IS 17802 and the annual report layout are placeholders** until an
  IAAP-certified reviewer checks them and the official SEBI annexure format is obtained.
- Per-rule "how to fix" guidance is still a Deque link for axe rules (criterion links and "who it
  affects" now come from compliance data); AI suggestions are Phase 5.
- Custom-rule heuristics can miss things (D-037): the focus check only covers the first 20 Tab
  stops; CAPTCHA, session-timeout and statement detection are pattern-based, which is why most
  are "needs review".
- Evidence files are not scanned for malware, and storage objects are not deleted with their
  property or organisation (D-040). No report or evidence retention limit yet.
- The audit snapshot keeps up to 2,000 issues and the remediation tracker 5,000 (D-044, D-045).
- Grievance figures in the annual report are "to be completed" until the grievance desk
  (Phase 4).

### Next

Phase 3 — Authenticated scans, monitoring, CI.

---

## Phase 1 — Web scanner MVP ✅

### Done

- **Properties**: add, list, settings (crawl limits, include/exclude globs, query strings,
  viewports, wait selector, robots.txt), delete. Owner/admin only; all audit-logged.
- **Domain verification**: DNS TXT, meta tag, or `/.well-known/inclusight.txt`. Unverified
  properties can only run single-page scans of the exact URL (10 per hour per organisation).
- **Crawler** (`packages/scanner-core`): robots.txt → sitemaps (incl. indexes) → breadth-first
  link discovery; same-host only; page cap, depth cap, include/exclude, query-string handling;
  identifiable user-agent; 500 ms between requests; SSRF guard on every request and redirect.
- **Worker jobs**: `crawl` → `scan-page` (one per page, concurrency 3) → `finalize-scan`.
  Playwright + axe-core (`wcag2a/aa`, `wcag21a/aa`, `wcag22aa`, `best-practice`) on desktop
  (1366×768) and mobile (390×844), full-page screenshots in MinIO/S3, element bounding boxes.
  Every job is idempotent and retry-safe; a page that keeps failing is marked failed so scans
  never hang.
- **De-duplication**: template hash (landmark structure) + normalised selector (from axe's
  ancestry path) → spec §6 fingerprint. Issues upserted per property, occurrences per scan.
- **Re-scans**: new / fixed / reopened detection with the safeguards in DECISIONS D-019.
- **Screens** (all axe-tested): Properties, property overview (score, trend chart + table,
  verification, recent scans), settings, scan detail with live progress, issues list (filters
  by status, impact, criterion, template, page, assignee; sort by severity or occurrences;
  WCAG / best-practice tabs; bulk status and assignment), issue detail (occurrences, HTML,
  selectors, screenshot with the element outlined, status/assignee form). False positive and
  accepted risk require a reason; every change is audit-logged.
- **Export**: CSV and Excel of the filtered issue list.
- **Score + trend**: per scan, weighted by impact and occurrences (D-020), always shown with
  the automated-testing note.
- **Fixture site** in `/fixtures` with known issues, 204 pages, and a switch to simulate fixes.
- **Keyboard focus after navigation** (found in review): the next Tab after moving to another
  screen now always lands on "Skip to main content" (D-032). Tested for mouse and keyboard.

### How to run locally

Same as Phase 0, plus:

```bash
pnpm install
docker compose -f infra/docker-compose.yml up -d
pnpm --filter @app/db db:migrate     # adds the scanning tables
pnpm --filter @app/web exec playwright install chromium   # once; the worker uses it too
pnpm dev                             # web (http://localhost:3000) + worker
pnpm fixtures                        # optional: fixture site on http://localhost:4100
```

`.env` needs the S3 settings from `.env.example` (MinIO defaults). To scan the fixture site,
set `SCANNER_ALLOW_PRIVATE_HOSTS=true` in `.env` — local development only.

### How to test manually

1. Sign in as an owner → **Properties** → add `http://localhost:4100` ("Fixture site").
2. Under "Verify your domain" choose **File at /.well-known/inclusight.txt**, copy the value
   into `fixtures/.state/well-known.txt` (create the folder), select **Verify domain**.
3. Optional: **Settings** → lower "Maximum pages" for a quicker run (default 200).
4. **Start full scan** → watch progress → open **View issues**. The article chart image is one
   issue with ~200 pages; the header logo is one issue across all pages sharing the main
   template.
5. Open an issue → **Show screenshot** to see the element outlined. Mark one as False
   positive (a reason is required) and check **Audit log**.
6. Write `v2` into `fixtures/.state/version.txt` and scan again: 1 issue fixed (home hero
   image), 1 new (`button-name`). Write `v1` and scan again: the button is fixed and the hero
   issue is reopened.
7. **Export CSV / Excel** from the issues page.

### Which public sites are safe to test against?

Only sites you own or have written permission to scan. Full crawls require domain
verification, so on sites you do not control the product only allows single-page scans of
the exact URL. Pages built specifically for testing accessibility tools are a reasonable
target for those, e.g. the W3C "Before and After Demonstration" (BAD) inaccessible pages
(`https://www.w3.org/WAI/demos/bad/before/home.html`) and Deque's "Mars Commuter" demo
(`https://dequeuniversity.com/demo/mars/`) — check their current terms first. For full crawls,
use the local fixture site or a staging domain you control.

### Acceptance results (spec §19 "Done when")

| Criterion                                                    | Result                                                                                                                                                                                                                              |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scanning a 200-page site completes                           | Fixture site, 204 pages × 2 viewports: completed, 0 failed pages. ~5 min on an idle laptop (crawl ~1.7 min, scan ~3.3 min); 9 min 38 s while a Docker build ran in parallel. Extrapolates to ~25 min per 1,000 pages (target < 30). |
| Issues de-duplicated by template                             | 1,622 occurrences → 9 issues (8 WCAG + 1 best practice), e.g. header logo `image-alt`: 1 issue, 406 occurrences on 203 pages                                                                                                        |
| Re-scans mark fixed / new                                    | v1 → v2: exactly 1 fixed + 1 new; v2 → v1: 1 fixed + 1 reopened (manual run and e2e test)                                                                                                                                           |
| Unit tests for crawler limits, fingerprinting, normalisation | `packages/scanner-core` (45 tests), plus scan-lifecycle tests in `packages/db`                                                                                                                                                      |

### Checks

| Command             | Result on 2026-11-17                                                                                                                                                                                             |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm format:check` | pass                                                                                                                                                                                                             |
| `pnpm lint`         | pass                                                                                                                                                                                                             |
| `pnpm typecheck`    | pass                                                                                                                                                                                                             |
| `pnpm test`         | pass — 108 unit tests (scanner-core 45, db 17, web 35, worker 8, queue 3)                                                                                                                                        |
| `pnpm build`        | pass                                                                                                                                                                                                             |
| `pnpm test:e2e`     | pass — 12 tests incl. the full scanner flow, a cross-organisation 404 test, focus after navigation, dark-mode colours and no horizontal scrolling at 320/390 px; axe reports zero violations on every new screen |

`pnpm test:e2e` now also starts the worker and the fixture site (or reuses running ones).

### Known issues / not verified

- **CI not run on GitHub** (no remote). The e2e job now starts MinIO with `docker run` and
  sets `SCANNER_ALLOW_PRIVATE_HOSTS=true`; untested there.
- **Docker images** build. Verified inside the worker image, as the non-root user, that Chromium
  launches and scans a page (axe results + screenshot). The full containerised stack was not
  run end to end. The image installs full Chromium (~700 MB); `--only-shell` could slim it.
- Links that only appear after JavaScript runs are not crawled (D-025). Use a sitemap.
- Per-domain concurrency is only guaranteed with a single worker process (D-025).
- DNS rebinding is not prevented by the SSRF guard (D-024).
- Screenshot retention (90 days) and PII redaction are not implemented; redaction is Phase 3.
- Issue guidance links to Deque; static guidance, "who it affects" and criterion links need
  Phase 2's compliance data (D-029). axe "needs review" results are not stored.
- Changing viewports between scans can mark mobile-only issues fixed (D-019).
- Scan history keeps every occurrence; no clean-up yet.
- If a dev server reloads endlessly, stop all `next dev` processes and delete
  `apps/web/.next` (D-031).

### Next

Phase 2 — Compliance workspace & reports. Spec §21 recommends 15–20 customer interviews
before Phase 2.

---

## Phase 0 — Foundation ✅

### Done

- **Monorepo:** pnpm workspaces + Turborepo, TypeScript strict, ESLint (incl. `jsx-a11y`) +
  Prettier, Vitest, Playwright.
  - `apps/web` — Next.js App Router, Tailwind v4, shadcn-style components.
  - `apps/worker` — BullMQ worker with pino logging, graceful shutdown and a `system` queue
    (boot self-check job). Real queues arrive in Phase 1.
  - `packages/db` — Drizzle schema + migration, `orgScope` tenant data-access layer.
  - `packages/ui` — accessible primitives (Button, TextField, SelectField, Alert, Card,
    SkipLink) and light/dark design tokens.
  - `packages/config` — shared ESLint and tsconfig.
- **Infra:** `infra/docker-compose.yml` — Postgres 17, Redis 7, MinIO, Mailpit (dev inbox);
  `web`, `worker` and `migrate` behind `--profile app`. Dockerfiles in `infra/docker/`.
- **Database:** `organizations`, `users`, `memberships`, `audit_log` (+ the auth tables
  `sessions`, `accounts`, `verifications`, `invitations`, `two_factors`).
- **Auth (Better Auth):** email + password (min 12 chars), magic-link sign-in, organisation
  creation, member invitations by email, the 7 spec roles, TOTP 2FA with backup codes.
  2FA is **enforced** for owner/admin. Magic links are refused for 2FA accounts.
- **App shell:** skip link, banner, labelled primary nav with `aria-current`, main landmark,
  footer carrying the "assists, does not certify / manual testing required" disclaimer.
  Screens: sign-in, sign-up, two-factor, two-factor setup, onboarding, accept invitation,
  dashboard, members (invite / change role / remove / cancel invitation), audit log.
- **Audit log:** organisation created, invitation created / cancelled / accepted / declined,
  member role changed, member removed — viewable by owner, admin, nodal officer, auditor.
- **CI:** `.github/workflows/ci.yml` — format check, lint, typecheck, unit tests, production
  build; separate job for e2e + axe with Postgres/Redis/Mailpit services.

### How to run locally

Prerequisites: Node ≥ 22 (24 recommended), pnpm 10 (`npm i -g pnpm@10`), Docker Desktop running.

```bash
pnpm install
cp .env.example .env          # then set BETTER_AUTH_SECRET (command is in the file)
docker compose -f infra/docker-compose.yml up -d
pnpm --filter @app/db db:migrate
pnpm dev                      # web on http://localhost:3000, plus the worker
```

Emails (invitations, magic links) land in Mailpit: http://localhost:8025

### How to test manually

1. http://localhost:3000 → **Create an account** → you land on onboarding.
2. Create an organisation → you are forced to **set up two-step verification** (scan the QR or
   type the setup key into an authenticator app, enter a code).
3. Dashboard → **Members** → invite another email address with a role.
4. Open Mailpit, copy the invitation link into a private window, create that account, accept.
5. Back as the owner: the member is listed; change their role; open **Audit log**.
6. Sign out and back in: password, then authenticator code. As the invited (non-2FA) user,
   try "Email me a sign-in link".
7. Keyboard check: press Tab on any page — the first stop is "Skip to main content".

### Checks

| Command          | Result on 2026-11-16                                                                                           |
| ---------------- | -------------------------------------------------------------------------------------------------------------- |
| `pnpm lint`      | pass                                                                                                           |
| `pnpm typecheck` | pass                                                                                                           |
| `pnpm test`      | pass — 36 unit tests (db 8 incl. cross-org isolation, web 22, worker 6)                                        |
| `pnpm build`     | pass                                                                                                           |
| `pnpm test:e2e`  | pass — 8 Playwright tests; axe (WCAG 2.0/2.1/2.2 A+AA) reports zero violations on every screen, light and dark |

`pnpm test:e2e` needs the compose infra running and migrations applied. It starts `next dev`
itself (or reuses one already on port 3000).

### Known issues / not verified

- **CI has not run on GitHub** — there is no remote yet. The workflow is written but untested
  there. Nothing has been committed; `git init` was run so you can review and commit.
- **Docker images** (`--profile app`): build and start; smoke-tested only (`/api/health` and
  `/sign-in` respond, worker processes its boot job). The e2e suite has not been run against
  the containers. They are simple single-stage images, not yet optimised for production.
- No email verification on sign-up and no password-reset flow (not in Phase 0 scope). A user
  with 2FA who forgets their password currently has no self-service recovery.
- Audit-log `ip` is null in local dev (only populated from `X-Forwarded-For` behind a proxy).
  The production reverse proxy must set/overwrite that header.
- 2FA enable/disable and sign-ins are not audit-logged (audit log is org-scoped) — D-008.
- Better Auth's rate limiter uses in-memory storage: fine for one VPS, not for multiple web
  instances. Revisit in Phase 10.
- Auth forms require JavaScript (D-007).
- A user who belongs to several organisations can only switch from `/onboarding`; there is no
  switcher in the shell header yet.
- MinIO is running but unused; no bucket is created until Phase 1 needs one.
- Prettier's first run added blank lines after the headings in `CLAUDE.md` (whitespace only);
  the file is now in `.prettierignore`.
- Local toolchain note: pnpm was installed with `npm i -g pnpm@10` because `corepack enable`
  needs admin rights on this machine.
