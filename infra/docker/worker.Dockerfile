# Worker image (also used to run DB migrations). Includes Chromium for the scanner.
# Reports are rendered to tagged PDFs with this Chromium. Java + veraPDF arrive in Phase 6
# (PDF validation); Phase 2 validates generated PDFs with veraPDF in tests only.
FROM node:24-slim
RUN npm install -g pnpm@10.34.9
WORKDIR /repo

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/config/package.json packages/config/
COPY packages/db/package.json packages/db/
COPY packages/ui/package.json packages/ui/
COPY packages/scanner-core/package.json packages/scanner-core/
COPY packages/queue/package.json packages/queue/
COPY packages/storage/package.json packages/storage/
COPY packages/compliance-data/package.json packages/compliance-data/
COPY packages/reports/package.json packages/reports/
COPY apps/web/package.json apps/web/
COPY apps/worker/package.json apps/worker/
RUN pnpm install --frozen-lockfile --filter @app/worker... --filter @app/db...

# Chromium + its system libraries, at the exact revision the pinned Playwright expects.
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
RUN pnpm --filter @app/worker exec playwright install --with-deps chromium

COPY packages packages
COPY apps/worker apps/worker

ENV NODE_ENV=production
USER node
CMD ["pnpm", "--filter", "@app/worker", "start"]
