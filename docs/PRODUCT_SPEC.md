# A11yComply India — Product & Build Specification

> **Working title.** Check trademark and domain availability before launch.
> Accessibility compliance platform for SEBI-regulated entities (brokers, AMCs, depositories, investment advisers, research analysts, exchanges), expanding later to RBI/IRDAI-regulated firms and EU (EAA) exporters.
> Version 1.0 · Solo founder + Claude Code

---

## 0. How to use this document

1. Create an empty folder. Put `CLAUDE.md` in the root and this file at `docs/PRODUCT_SPEC.md`.
2. Open Claude Code in that folder.
3. Run **one phase at a time** using the prompts in §20. Never ask for the whole product in one go.
4. After each phase: test manually, review the code, commit, then move on.

**Regulatory disclaimer (keep visible in the product too):** The regulatory summary in §2 is a working summary from public sources as of November 2026. Before launch, read the original SEBI circulars (31 July 2025 and later amendments, including the 30 October 2026 extension) and have the compliance mapping reviewed by an IAAP-certified accessibility professional. The product **assists** audits and compliance; it does not certify compliance.

---

## 1. Product summary

**One line:** Find, fix, and prove digital accessibility compliance for SEBI-regulated firms, across websites, mobile apps and investor PDFs, with SEBI-ready reports.

**Problem:** SEBI now requires all regulated entities to make websites, mobile apps, investor portals, documents and KYC flows accessible to persons with disabilities, conduct audits by IAAP-certified professionals, remediate findings, run a grievance mechanism, and submit annual compliance reports signed by the CEO and CTO. Most firms (especially small/mid brokers and advisers) have no tooling, no in-house expertise, and cannot afford global enterprise tools.

**Solution modules:**
| # | Module | What it does |
|---|---|---|
| M1 | Web Scanner | Crawls sites (public + logged-in), runs automated WCAG checks, deduplicates issues, tracks them over time |
| M2 | Compliance Workspace | Maps findings to WCAG 2.1/2.2 AA, GIGW 3.0, IS 17802; guided manual test checklists; evidence; conformance matrix |
| M3 | SEBI Reports | Platform inventory, audit summary, remediation tracker, annual compliance report draft, accessibility statement generator |
| M4 | Monitoring & CI | Scheduled scans, regression alerts, CLI + GitHub Action that fails builds on new violations |
| M5 | AI Remediation | Fix suggestions per issue, GitHub App that opens pull requests with code fixes |
| M6 | PDF Accessibility | PDF/UA validation (bulk), plus an API that turns HTML statement templates into tagged, accessible PDFs |
| M7 | Mobile (Android) | Scan Android apps for accessibility issues (labels, touch targets, contrast, focus order) |
| M8 | Grievance Desk | Accessibility feedback form (embeddable), ticket workflow with SLA, grievance stats for reports |

**Positioning:** Developer-first and code-fixing. **No accessibility overlays or widgets that modify the customer's site at runtime.** Overlays are widely criticised and cited in lawsuits; we fix the source.

---

## 2. Regulatory basis (working summary — verify against originals)

- **SEBI circular dated 31 July 2025** (SEBI/HO/ITD-1/ITD_VIAP/P/CIR/2025/111) mandates digital accessibility for all SEBI-regulated entities under the Rights of Persons with Disabilities Act, 2016.
- **Standards referenced:** WCAG 2.1 Level AA (or latest version), GIGW (latest, currently 3.0), IS 17802:2021.
- **Scope:** websites, mobile apps, investor portals, trading platforms, disclosures, documents (tagged PDFs), multimedia, KYC/e-KYC/video-KYC flows.
- **Operational requirements:** inventory of digital platforms; appoint an IAAP-certified accessibility auditor; conduct audits; remediate; senior nodal officer; grievance redressal mechanism; **annual accessibility compliance report signed by CEO and CTO within 30 days of financial-year end**.
- **Timelines:** extended several times. Circular dated **30 October 2026** extended auditor appointment, audits and remediation to **31 January 2027**. Annual audits/reports recur every year after that, which makes this a recurring need.
- **Reporting route:** brokers and depository participants report to their stock exchange or depository; market infrastructure institutions and others report directly to SEBI.

**Product implication:** keep the regulatory mapping **data-driven** (`/packages/compliance-data`) so it can be updated without code changes when SEBI revises formats or deadlines.

---

## 3. Target customers & personas

**Initial segment (beachhead):** small and mid-size stockbrokers, depository participants, investment advisers, research analysts, portfolio managers, small AMCs. They are legally on the hook but cannot afford enterprise tools.

**Later:** large brokers/AMCs, NBFCs and banks (RBI), insurers (IRDAI), Indian IT/BPO firms serving EU clients (European Accessibility Act), audit firms (white-label).

| Persona | Role in product | Needs |
|---|---|---|
| Nodal Officer / Compliance Head | Owner/Admin | Status at a glance, deadlines, reports to sign off, grievance stats |
| Engineering Lead / Developer | Developer | Issue list with code-level detail, fix suggestions, CI integration, PRs |
| IAAP Auditor (internal or external) | Auditor | Manual test checklists, evidence capture, conformance matrix, audit report export |
| CEO / CTO | Viewer/Signatory | One-page summary, signed annual report |
| Support staff | Grievance Agent | Grievance tickets, SLA, responses |

---

## 4. Tech stack

| Layer | Choice | Notes |
|---|---|---|
| Language | TypeScript everywhere (strict) | Java only for veraPDF CLI |
| Monorepo | pnpm workspaces + Turborepo | |
| Web app | Next.js (App Router) + React + Tailwind + shadcn/ui (Radix) | The app itself must meet WCAG 2.2 AA (dogfooding) |
| API | Next.js route handlers (tRPC optional) + Zod validation | Public REST API under `/api/v1` with API keys |
| Workers | Node service consuming BullMQ queues | Scanning, PDF, mobile, AI jobs |
| Queue / cache | Redis + BullMQ | |
| Database | PostgreSQL + Drizzle ORM | Migrations via drizzle-kit |
| Object storage | S3-compatible (AWS S3 Mumbai / Cloudflare R2 / MinIO locally) | Screenshots, evidence, reports, PDFs |
| Web scanning | Playwright (Chromium) + axe-core (`@axe-core/playwright`) + custom rules | axe-core is MPL-2.0 |
| PDF validation | veraPDF CLI (PDF/UA-1) in worker container | Open source |
| PDF generation | Playwright `page.pdf({ tagged: true, outline: true })` from HTML templates, validated by veraPDF | |
| Android scanning | Appium + UiAutomator2 on an Android emulator; rules from Google Accessibility Test Framework concepts | Phase 7 |
| AI | Anthropic Claude API (model configurable via env; default a cost-efficient Sonnet-class model) | Cache results by fingerprint |
| Auth | Better Auth (or Auth.js) with email + password, magic link, Google; org/team support | 2FA (TOTP) required for Owner/Admin |
| Billing | Razorpay Subscriptions (INR, GST invoices) | Phase 9 |
| Email | Amazon SES or Resend | |
| Charts | Recharts | Accessible: provide data tables alongside charts |
| Testing | Vitest (unit), Playwright (e2e), axe checks on our own UI | |
| Infra (MVP) | Docker Compose on a single VPS in an **Indian region** | Data residency matters to Indian financial firms |
| Observability | Sentry (errors), pino logs, simple uptime monitor | |

---

## 5. Architecture

```
apps/
  web/                 # Next.js app: dashboard, API routes, public scanner, marketing pages
  worker/              # BullMQ workers: crawl, scan, pdf, mobile, ai, reports
  cli/                 # npm package "a11ycomply" for CI pipelines
packages/
  db/                  # Drizzle schema, migrations, typed queries
  scanner-core/        # Crawler, axe runner, custom rules, fingerprinting, normalisation
  compliance-data/     # WCAG/GIGW/IS 17802 criteria, rule→criteria mapping, manual test checklists, SEBI report templates (JSON/YAML)
  pdf-core/            # veraPDF wrapper, tagged PDF generation
  ai-core/             # Prompt templates, Claude client, fix-suggestion cache
  reports/             # Report builders (tagged PDF via HTML templates, XLSX via exceljs)
  ui/                  # Shared accessible components (built on shadcn/Radix)
  config/              # eslint, tsconfig, tailwind presets
infra/
  docker-compose.yml   # postgres, redis, minio, web, worker
  docker/              # Dockerfiles (worker includes Chromium + Java for veraPDF)
docs/
  PRODUCT_SPEC.md
  PROGRESS.md
  DECISIONS.md
```

**Job flow (web scan):**
`POST /scans` → create `scan` row → enqueue `crawl` job → crawler discovers URLs (sitemap + link discovery, limits) → enqueue `scan-page` jobs (concurrency-limited per domain) → each runs axe + custom rules, takes a screenshot with highlight boxes → results normalised + fingerprinted → `issues` upserted → when all pages finish, mark scan complete → compute diff vs previous scan → notify.

**Key principles:**
- All heavy work happens in workers, never in web requests.
- Every job is idempotent and retry-safe.
- Per-domain politeness: max concurrency (default 3), delay between requests, obey robots.txt for unauthenticated crawls unless the customer explicitly overrides for their own verified domain.
- Multi-tenant: every row has `org_id`; every query filters by it (enforce in the data-access layer and test it).

---

## 6. Data model (core tables)

| Table | Key columns |
|---|---|
| `organizations` | id, name, legal_name, sebi_registration_no, entity_type (broker, dp, amc, ia, ra, pms, mii, other), reporting_authority (nse, bse, cdsl, nsdl, sebi, other), plan, created_at |
| `users` | id, email, name, totp_enabled |
| `memberships` | user_id, org_id, role (owner, admin, nodal_officer, developer, auditor, grievance_agent, viewer) |
| `properties` | id, org_id, type (web, android, pdf_collection), name, base_url / package_name, verified (bool), verification_method, scan_config (json), auth_config_encrypted, is_investor_facing (bool) |
| `scans` | id, property_id, trigger (manual, schedule, ci, api), status, started_at, finished_at, pages_found, pages_scanned, summary (json) |
| `pages` | id, property_id, url, title, template_hash, last_scanned_at |
| `issues` | id, property_id, fingerprint (unique per property), rule_id, source (axe, custom, mobile, pdf, manual), impact (critical, serious, moderate, minor), criteria (text[]), help_text, status (open, in_progress, fixed, false_positive, accepted_risk), assignee_id, first_seen_scan_id, last_seen_scan_id, fixed_in_scan_id |
| `issue_occurrences` | id, issue_id, page_id, scan_id, selector, html_snippet, screenshot_key, bbox (json) |
| `manual_tests` | id, property_id, criterion_id, result (pass, fail, not_applicable, not_tested), notes, tester_id, tested_at |
| `evidence` | id, org_id, linked_type, linked_id, file_key, description, uploaded_by |
| `audits` | id, org_id, auditor_name, iaap_cert_id, auditor_org, start_date, end_date, scope (property ids), status |
| `reports` | id, org_id, type (audit_summary, sebi_annual, conformance_matrix, accessibility_statement, remediation_tracker), period, file_key_pdf, file_key_xlsx, generated_by, signed_by (json) |
| `grievances` | id, org_id, property_id, channel (widget, email, phone, manual), reporter_contact_encrypted, description, page_url, status, sla_due_at, resolved_at, resolution |
| `ai_suggestions` | id, cache_key, rule_id, snippet_hash, suggestion (json), model, created_at |
| `api_keys` | id, org_id, name, hashed_key, scopes, last_used_at |
| `usage_events` | id, org_id, type (page_scanned, pdf_validated, pdf_generated, ai_suggestion), quantity, created_at |
| `audit_log` | id, org_id, actor_id, action, target_type, target_id, metadata (json), ip, created_at |
| `subscriptions` | id, org_id, razorpay_sub_id, plan, status, current_period_end |

**Fingerprint:** `sha256(rule_id + normalised_selector + template_hash)`. The same issue on 500 pages that share a template = **one issue with 500 occurrences**. This cuts noise, which is the #1 complaint with scanners.

`template_hash`: hash of the page's DOM skeleton (tag names + landmark structure, ignoring text and attributes), so pages built from the same template group together.

---

## 7. Module M1 — Web Scanner

### 7.1 Property setup
- Add property: name, base URL, investor-facing yes/no.
- **Domain verification** before full crawls (prevents scanning sites the customer doesn't own): DNS TXT record **or** meta tag **or** file at `/.well-known/a11ycomply.txt`.
- Unverified properties: only single-page scans of the exact URL, rate-limited.

### 7.2 Crawl config
- Sources: sitemap.xml, start URLs, link discovery.
- Limits: max pages (plan-based), max depth, include/exclude URL patterns (glob), query-string handling.
- Viewports: desktop (1366×768) and mobile (390×844); both by default.
- Wait strategy: network idle + optional custom wait selector.
- Respect robots.txt (configurable for verified domains only).

### 7.3 Authenticated scans (Phase 3)
- Customer records a login with a **step script** (URL, fill selector, value from secret, click, wait). Store secrets encrypted (libsodium sealed boxes, key from env/KMS).
- Use Playwright `storageState` after login; re-login on expiry.
- **Guidance shown in UI:** use test accounts only, never real investor accounts.
- Support OTP-based logins via a static test OTP or a customer-provided TOTP secret.

### 7.4 Checks
- axe-core with tags: `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`, `best-practice` (best-practice issues shown separately, not counted as violations).
- **Custom rules** (in `scanner-core/rules/`), each with id, description, criteria mapping, test function:
  - `cr-accessibility-statement`: site has a discoverable accessibility statement link (footer).
  - `cr-skip-link`: first focusable element is a working skip link (when the page has repeated navigation).
  - `cr-lang-regional`: content blocks in Hindi/regional scripts have the correct `lang` attribute.
  - `cr-captcha-alternative`: CAPTCHA detected without an audio/alternative mechanism → flag for manual review.
  - `cr-session-timeout`: detect session timeout scripts → manual check for warning + extend option (WCAG 2.2.1).
  - `cr-pdf-links`: links to PDFs are listed for PDF validation (feeds M6).
  - `cr-video-captions`: `<video>`/embedded players detected → manual caption check.
  - `cr-focus-visible`: tab through the first N focusable elements and detect missing visible focus indicators (screenshot diff).
  - `cr-target-size`: interactive targets smaller than 24×24 CSS px (WCAG 2.5.8).
- Screenshots: full-page screenshot per viewport, with bounding boxes for each occurrence. **PII redaction option:** blur all text inputs and configurable selectors; option to disable screenshots entirely for authenticated scans.

### 7.5 Issue experience
- Issue list: filters (impact, criterion, status, page, template, assignee), sort by "most occurrences" and "most severe".
- Issue detail: description in plain language, who it affects (e.g., screen reader users), WCAG criterion links, occurrences with selector + HTML snippet + highlighted screenshot, "How to fix" (static guidance from compliance-data), AI suggestion (Phase 5).
- Bulk actions: assign, change status, mark false positive (with a mandatory reason, audit-logged).
- Export: CSV, XLSX.

### 7.6 Scores
- **Accessibility score** per property: weighted by impact and occurrence count. Show the trend over time.
- Always show "Automated checks find only part of all accessibility issues; manual testing is required for compliance" next to scores.

---

## 8. Module M2 — Compliance Workspace

- **Criteria catalogue** (`compliance-data/criteria/`): WCAG 2.1 AA (50 criteria at A+AA), WCAG 2.2 AA additions, GIGW 3.0 requirements, IS 17802 clauses. Each criterion: id, title, level, description, automatable (full, partial, none), test procedure, related rules.
- **Rule → criteria mapping:** YAML file; every axe rule and custom rule maps to one or more criteria.
- **Manual test checklists:** for each criterion that is not fully automatable, a step-by-step procedure (keyboard-only navigation, NVDA/TalkBack checks, zoom to 200%/400% reflow, captions, error identification, etc.). Testers record pass/fail/N/A + notes + evidence upload.
- **Conformance matrix:** criteria × properties grid showing automated status + manual status → overall status (Supports, Partially Supports, Does Not Support, Not Applicable, Not Evaluated). Exportable.
- **Audits:** create an audit (auditor name, IAAP certification ID, organisation, dates, scope). Lock a snapshot of findings at audit close for reports.

---

## 9. Module M3 — SEBI Reports

All report templates live in `compliance-data/report-templates/` (HTML + JSON schema) so formats can be changed without code changes. **All generated PDFs must themselves be tagged and accessible** (validate with veraPDF in tests).

| Report | Contents |
|---|---|
| Platform inventory | All investor-facing digital platforms (websites, apps, portals, document types), owner, status |
| Audit summary | Scope, auditor + IAAP ID, methodology, findings by severity and criterion, conformance matrix |
| Remediation tracker | Each finding, status, owner, target date, fixed date, verification scan |
| **Annual compliance report (draft)** | Entity details, reporting authority, platforms covered, audits done, findings + remediation status, grievances received/resolved/average resolution time, nodal officer details, **signature blocks for CEO and CTO** with name, designation, date |
| Accessibility statement | Public page text: commitment, standards, conformance status, known limitations, feedback/grievance contact, date — exportable as HTML and Markdown |

- Report generation is a worker job; output stored in object storage; download links expire.
- "Sign-off" in the product = record who approved and when (audit-logged). Real signatures happen outside the product (PDF signing is out of scope for MVP).

---

## 10. Module M4 — Monitoring & CI

- **Schedules:** daily/weekly/monthly per property (plan-based).
- **Regression detection:** new issues since the last scan, reopened issues (previously fixed), fixed issues. Email + in-app notifications; optional Slack/MS Teams webhook.
- **CLI (`apps/cli`, published as an npm package):**
  - `a11ycomply scan <url> [--fail-on serious] [--baseline issues.json] [--format json|sarif|junit]`
  - Runs locally with Playwright (no account needed for basic use) or uploads results with `--api-key`.
  - Baseline support: only fail on **new** issues.
- **GitHub Action** wrapping the CLI, posting a summary comment on PRs.

---

## 11. Module M5 — AI Remediation

- **Fix suggestion:** for an issue occurrence, send rule id, criterion, HTML snippet (trimmed, PII-stripped), surrounding DOM context, and framework hint (React, Angular, plain HTML) to Claude. Return JSON: `{ explanation, fixed_snippet, code_diff_hint, confidence, manual_verification_steps }`.
- Validate the JSON with Zod; on failure, retry once and then show static guidance only.
- **Cache** by `rule_id + snippet_hash + framework` to control cost.
- **GitHub App** (Phase 5b): customer installs the app on a repo; maps a property to a repo + path patterns; for selected issues, Claude locates the source file (search by class names, ids, text) and proposes a patch; the app opens a **draft PR** with explanation and links to the issues. Never push to default branches.
- **Never send:** credentials, cookies, form values, investor data. Strip text content of inputs and anything matching PAN/Aadhaar/phone/email patterns before sending.
- Show AI output labelled as "AI suggestion — review before applying".

---

## 12. Module M6 — PDF Accessibility

### 12.1 Validation
- Upload PDFs (single or bulk ZIP) or auto-collect PDF links found by the web crawler.
- Run veraPDF with the PDF/UA-1 profile + extra checks: tagged (yes/no), document title set, language set, bookmarks for long docs, reading order presence, alt text on figures, table header tags.
- Results map to criteria; issues appear in the same issue system (`source = pdf`).

### 12.2 Accessible PDF generation API (revenue line for statements and contract notes)
- `POST /api/v1/pdf/render` with `{ template_id | html, data, options }` → returns a **tagged PDF** (Playwright `tagged: true`, `outline: true`), language and title metadata set, validated by veraPDF before returning.
- Template authoring guide: semantic HTML (headings, `<table>` with `<th scope>`, `alt` on images, `lang`), with linting before render.
- Usage metered per page (`usage_events`). Rate limits per API key.
- Synchronous for ≤ 20 pages; async job + webhook for bigger batches.

---

## 13. Module M7 — Mobile (Android) scanning (Phase 7)

- Customer uploads an APK/AAB (or a Play Store package name for public apps; download handled manually by the customer for MVP).
- Worker boots an Android emulator, installs the app, uses Appium (UiAutomator2) to explore the screens the customer defines (simple step script like web auth, plus an automatic "tap each visible element" explorer with depth limits).
- Per screen: dump the accessibility hierarchy + screenshot; checks:
  - Missing content descriptions/labels on interactive elements and images.
  - Touch targets < 48×48 dp.
  - Text contrast (from screenshot sampling) below 4.5:1 (3:1 for large text).
  - Duplicate or unhelpful labels ("button", "image").
  - Text that doesn't scale (fixed text sizes detected via font scale change re-run).
- Results map to criteria (`source = mobile`), same issue workflow.
- iOS: out of scope for MVP; provide a manual checklist instead.

---

## 14. Module M8 — Grievance Desk

- **Feedback form:** hosted page + embeddable script that adds an "Accessibility feedback" link/button opening an accessible dialog form. It **only collects feedback**; it never modifies the host page.
- Fields: description, page URL (auto), contact (optional), preferred response channel, assistive technology used (optional).
- Ticket workflow: new → acknowledged → in progress → resolved/closed; SLA timers (configurable, default acknowledge 2 business days, resolve 30 days); email notifications; internal notes; link grievance to an issue.
- Grievance stats feed the annual report.
- Reporter contact details encrypted at rest; retention policy configurable.

---

## 15. Plans & pricing (draft — validate with 15+ customer interviews)

| Plan | Price (INR / month, excl. GST) | Includes |
|---|---|---|
| Free scanner | ₹0 | Public single-URL scan, top 10 issues, email gate for full report |
| Starter | ₹9,999 | 2 web properties, 1,000 pages/scan, monthly scans, compliance workspace, reports, grievance desk |
| Growth | ₹24,999 | 5 web properties, 5,000 pages/scan, weekly scans, authenticated scans, CI/CLI, AI suggestions (500/mo), 1 Android app |
| Enterprise | Custom | Unlimited properties, daily scans, GitHub App PRs, SSO, India-only data residency guarantees, dedicated support |
| PDF API (add-on) | Per page, tiered | Validation and tagged PDF generation |
| Auditor/Partner plan | Custom | IAAP audit firms manage multiple client orgs, white-label reports |

Annual billing discount 15–20%. All limits stored in a `plans` config, not code.

---

## 16. Security, privacy & trust (non-negotiable for financial customers)

- **Data residency:** host the database, storage and workers in an Indian region.
- **DPDP Act 2023 compliance:** privacy notice, consent where applicable, data minimisation, retention + deletion, grievance officer contact.
- Encryption: TLS everywhere; secrets (login scripts, TOTP seeds, reporter contacts) encrypted at the application level; DB volume encryption.
- RBAC enforced on every API route; org isolation tested.
- 2FA mandatory for owner/admin roles; session timeout; device/session list.
- **Audit log** for all sensitive actions (status changes, false positives, report generation, sign-offs, settings, API key creation).
- Screenshots: PII redaction defaults on for authenticated scans; retention limit (default 90 days).
- Scanning ethics: only verified domains get full crawls; identifiable user-agent (`A11yComplyBot/1.0 (+https://<domain>/bot)`); polite rate limits.
- Backups: daily DB backups, tested restore, 30-day retention.
- Prepare for: VAPT by a CERT-In empanelled auditor before first enterprise customer; ISO 27001 roadmap later.
- Never log secrets, cookies, or form values.

---

## 17. The product's own accessibility (dogfooding)

- Our app must meet **WCAG 2.2 AA**: Playwright e2e tests run axe on every main screen; CI fails on any serious/critical violation.
- Keyboard-only navigation for all flows; visible focus; proper landmarks; skip link; accessible charts (data table alternative); no colour-only meaning.
- Publish our own accessibility statement.

---

## 18. Non-functional targets

| Item | Target |
|---|---|
| Scan throughput | 1,000 pages in < 30 minutes on a single worker (concurrency 3–5) |
| Dashboard load | < 2 s for orgs with 50k occurrences (paginate, index, pre-aggregate summaries) |
| Uptime | 99.5% (MVP) |
| Report generation | < 60 s for 5,000-page properties |
| API latency | p95 < 500 ms for non-job endpoints |

---

## 19. Build phases & acceptance criteria

### Phase 0 — Foundation
- Monorepo (pnpm + Turborepo), TypeScript strict, ESLint + Prettier, Vitest, Playwright.
- `infra/docker-compose.yml`: Postgres, Redis, MinIO, web, worker.
- Drizzle schema for orgs, users, memberships, audit_log; migrations.
- Auth (email+password, magic link), org creation, invite members, roles, TOTP 2FA.
- App shell: accessible layout, nav, skip link, theme; axe e2e test on shell.
- GitHub Actions CI: lint, typecheck, unit, e2e, axe.
- `docs/PROGRESS.md`, `docs/DECISIONS.md`.
- **Done when:** `docker compose up` + `pnpm dev` gives a working sign-up → org → invite flow; CI green.

### Phase 1 — Web scanner MVP
- Properties CRUD + domain verification (DNS TXT, meta tag, well-known file).
- Crawler (sitemap + links, limits, include/exclude, robots) in `scanner-core`.
- Worker: crawl + scan-page jobs, axe-core run, desktop + mobile viewports, screenshots with bounding boxes.
- Normalisation, template hash, fingerprinting, issue upsert, occurrences.
- Scans list, scan detail with progress, issues list with filters, issue detail, CSV/XLSX export.
- Accessibility score + trend.
- **Done when:** scanning a 200-page public site completes, issues are deduplicated by template, and re-scans correctly mark fixed/new issues. Unit tests for crawler limits, fingerprinting and normalisation.

### Phase 2 — Compliance workspace & reports
- `compliance-data`: criteria catalogue (WCAG 2.1/2.2 AA, GIGW 3.0, IS 17802 placeholders clearly marked "to be reviewed"), rule mapping, manual checklists.
- Custom rules from §7.4.
- Manual tests UI, evidence upload, conformance matrix.
- Audits entity + snapshot.
- Report generator (tagged PDF + XLSX): platform inventory, audit summary, remediation tracker, annual compliance report draft, accessibility statement.
- **Done when:** a full audit can be recorded and all 5 reports generated; generated PDFs pass veraPDF PDF/UA checks in tests.

### Phase 3 — Authenticated scans, monitoring, CI
- Login step scripts, encrypted secrets, storageState handling, TOTP support, PII redaction.
- Schedules, regression diff, notifications (email, Slack/Teams webhook).
- CLI with baseline + SARIF/JUnit output; GitHub Action.
- **Done when:** a scheduled authenticated scan runs unattended, a regression triggers an email, and the CLI fails a sample CI job on a new serious issue.

### Phase 4 — Grievance desk
- Hosted feedback page, embeddable script (feedback only), ticket workflow, SLA timers, notifications, linking to issues, stats into annual report.
- **Done when:** a test grievance submitted via the embed flows through to resolution and appears in the annual report stats. The embed itself passes axe and keyboard tests.

### Phase 5 — AI remediation
- 5a: fix suggestions with Zod-validated JSON, PII stripping, caching, usage metering, plan limits.
- 5b: GitHub App (repo mapping, source location, draft PR creation).
- **Done when:** suggestions appear for the top 20 axe rules with sensible output; a draft PR is created on a sample repo for a missing-alt-text issue.

### Phase 6 — PDF accessibility
- veraPDF in the worker image; upload/bulk ZIP validation; crawler-found PDF validation; issues integration.
- PDF render API with templates, API keys, metering, rate limits, async batches + webhooks.
- **Done when:** a sample investor statement template renders to a tagged PDF that passes veraPDF; bulk validation of 100 PDFs completes and reports issues.

### Phase 7 — Android scanning
- Emulator + Appium worker image; APK upload; step scripts + auto-explorer; checks from §13; issues integration.
- **Done when:** a sample open-source Android app is scanned, and issues for missing labels and small touch targets are reported with screenshots.

### Phase 8 — Free public scanner & marketing site
- Marketing pages (accessible, fast), SEBI accessibility checklist page (content), free single-URL scanner with rate limits (per IP + captcha **with an accessible alternative**), email-gated full report, lead capture.
- **Done when:** a visitor can scan a URL and receive a report by email; Lighthouse accessibility 100 and performance ≥ 90 on marketing pages.

### Phase 9 — Billing & plans
- Razorpay subscriptions, GST-compliant invoices, plan limits enforcement, usage-based add-ons, upgrade/downgrade, dunning emails.
- **Done when:** a test-mode subscription upgrades limits immediately, and over-limit usage is blocked with a clear message.

### Phase 10 — Hardening & launch
- Security review (OWASP ASVS L2 checklist), rate limiting, audit log coverage, backup/restore drill, Sentry, uptime checks.
- Production deployment in an Indian region, runbooks, privacy policy, terms, DPA template, security overview page.
- **Done when:** production deploy is live, restore drill succeeds, and a security checklist is completed in `docs/SECURITY.md`.

---

## 20. Prompts to paste into Claude Code (one per phase)

**Phase 0**
> Read CLAUDE.md and docs/PRODUCT_SPEC.md fully. Implement Phase 0 exactly as specified in §19. Create docs/PROGRESS.md and docs/DECISIONS.md. Stop when done and tell me how to run it locally.

**Phase 1**
> Implement Phase 1 (web scanner MVP) from §19, following §5–§7. Put crawl/scan logic in packages/scanner-core with unit tests. Update PROGRESS.md and stop. Tell me which public sites are safe to test against (or set up a local test site with known accessibility issues in /fixtures).

**Phase 2**
> Implement Phase 2 (§8–§9). All criteria, mappings, checklists and report templates must live in packages/compliance-data as data files. Mark IS 17802 and GIGW content as "pending expert review". Generated PDFs must be tagged and pass veraPDF in tests. Update PROGRESS.md and stop.

**Phase 3**
> Implement Phase 3 (§7.3, §10). Encrypt all secrets at the application level. PII redaction on by default for authenticated scans. Publish-ready CLI in apps/cli with README. Update PROGRESS.md and stop.

**Phase 4**
> Implement Phase 4 (§14). The embed must never modify the host page beyond adding the feedback trigger and dialog. Update PROGRESS.md and stop.

**Phase 5**
> Implement Phase 5a (§11) first, stop, and wait for my review before 5b. Strip PII before any AI call. Update PROGRESS.md.

**Phase 6**
> Implement Phase 6 (§12). Add veraPDF to the worker Docker image. Include a sample investor account statement template that renders to a valid tagged PDF. Update PROGRESS.md and stop.

**Phase 7**
> Implement Phase 7 (§13). Provide the worker Docker image or setup script for the emulator + Appium. Use an open-source Android app as the test fixture. Update PROGRESS.md and stop.

**Phase 8**
> Implement Phase 8. The free scanner must be rate-limited and abuse-resistant. Update PROGRESS.md and stop.

**Phase 9**
> Implement Phase 9 with Razorpay in test mode. Tell me exactly what I need to set up in the Razorpay dashboard. Update PROGRESS.md and stop.

**Phase 10**
> Implement Phase 10. Produce docs/SECURITY.md, docs/RUNBOOK.md, and deployment scripts for a VPS in an Indian region. Update PROGRESS.md and stop.

---

## 21. Go-to-market (non-code, run in parallel)

1. **Validate first (before Phase 2):** interview 15–20 compliance heads/CTOs at small brokers and advisers. Questions: current status, who audits, budget, pain with reports and PDFs.
2. **Partner with IAAP-certified auditors:** they need tooling; offer the Auditor/Partner plan. Every audit they run brings a client onto the platform.
3. **Content:** a SEBI accessibility compliance checklist, deadline tracker, and free scanner. Compliance heads search for exactly this.
4. **Channels:** broker associations, exchange/depository member events, LinkedIn content aimed at compliance officers.
5. **Pilot pricing:** 3–5 design partners at a discount in exchange for feedback and a case study.
6. **Get IAAP certification yourself** (WAS or CPACC) for credibility.

---

## 22. Out of scope for MVP
iOS scanning, PDF auto-remediation of existing PDFs, SSO/SAML, on-premise deployment, overlay/widget-based fixes (never), legal advice, compliance certification.

## 23. Open decisions (owner: founder)
- Final product name + trademark.
- Hosting provider in India (AWS Mumbai vs. DigitalOcean Bangalore vs. others).
- Exact SEBI report format: obtain the annexure formats from the circulars and update `compliance-data/report-templates`.
- Pricing after interviews.
- Expert reviewer for the compliance mapping (IAAP-certified).
