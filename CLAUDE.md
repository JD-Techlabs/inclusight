# CLAUDE.md — A11yComply India

Accessibility compliance SaaS for SEBI-regulated financial firms. Full spec: `docs/PRODUCT_SPEC.md` (source of truth). Progress: `docs/PROGRESS.md`. Decisions: `docs/DECISIONS.md`.

## Working rules

- Work **one phase at a time** (spec §19). Stop at the end of each phase and wait.
- Do not add features, modules, or dependencies outside the current phase. If something is ambiguous, pick the simplest option and record it in `docs/DECISIONS.md`.
- End of every phase: update `docs/PROGRESS.md` (done, how to test, known issues), run all checks, and stop.

## Stack

- TypeScript strict, pnpm workspaces + Turborepo.
- `apps/web` Next.js (App Router) + Tailwind + shadcn/ui; `apps/worker` BullMQ workers; `apps/cli` npm CLI.
- `packages/*`: db (Drizzle + Postgres), scanner-core, compliance-data, pdf-core, ai-core, reports, ui, config.
- Local infra: `docker compose -f infra/docker-compose.yml up -d` (Postgres, Redis, MinIO).

## Commands

- Install: `pnpm install`
- Dev: `pnpm dev`
- Lint / typecheck: `pnpm lint && pnpm typecheck`
- Unit tests: `pnpm test`
- E2E + accessibility of our own UI: `pnpm test:e2e`
- DB migrations: `pnpm --filter @app/db db:generate && pnpm --filter @app/db db:migrate`

## Architecture rules

- Heavy work (crawl, scan, PDF, mobile, AI, reports) runs **only in workers**, never in web requests. Jobs must be idempotent and retry-safe.
- **Multi-tenancy:** every tenant table has `org_id`; every query goes through the data-access layer that enforces it. Add tests that prove cross-org access is impossible.
- Validate all inputs with Zod at API boundaries.
- Compliance criteria, rule mappings, checklists, report templates and plan limits are **data files** in `packages/compliance-data` / config — never hard-coded.
- Issue deduplication uses the fingerprint in spec §6. Don't change it without recording a decision.

## Security & privacy (hard rules)

- Never log secrets, cookies, tokens, form values or personal data.
- Encrypt secrets (login scripts, TOTP seeds, reporter contacts) at the application level before storing.
- Strip PII (PAN, Aadhaar, phone, email, account-number patterns, input values) before any AI call.
- Full crawls only for **verified** domains. Polite crawling: identifiable user-agent, per-domain concurrency limits.
- Never commit `.env` files, keys or credentials. Keep `.env.example` updated.
- Audit-log every sensitive action (see spec §16).

## Our own accessibility (dogfooding)

- The product must meet **WCAG 2.2 AA**. Use semantic HTML and Radix/shadcn primitives; visible focus; labels on all inputs; no colour-only meaning; charts have table alternatives.
- E2E tests run axe on every main screen; CI fails on serious/critical violations.
- Generated PDFs must be tagged (Playwright `tagged: true`) and pass veraPDF PDF/UA checks.

## Product rules

- **Never build overlays or scripts that modify customer pages at runtime.** The grievance embed only adds a feedback trigger + dialog.
- Always label scores and reports with: automated checks find only part of all issues; manual testing is required.
- AI output is labelled "AI suggestion — review before applying". GitHub App only opens **draft PRs**, never pushes to default branches.
- The product assists compliance; it never claims to certify it.

## Code style

- Small, single-purpose modules; prefer < 300 lines per file.
- Pure logic (crawler limits, fingerprinting, scoring, mapping, report data) in packages with Vitest tests.
- Name things by domain (property, scan, issue, occurrence, criterion, audit, grievance).
