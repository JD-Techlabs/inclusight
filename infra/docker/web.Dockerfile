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
RUN pnpm install --frozen-lockfile --filter @app/web...

COPY packages packages
COPY apps/web apps/web

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @app/web build && chown -R node:node apps/web/.next

USER node
EXPOSE 3000
CMD ["pnpm", "--filter", "@app/web", "start"]
