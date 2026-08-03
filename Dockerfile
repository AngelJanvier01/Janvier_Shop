FROM node:22-alpine AS base

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN apk add --no-cache libc6-compat

FROM base AS dependencies
COPY package.json package-lock.json ./
RUN npm ci

FROM dependencies AS build
COPY . .
# Prisma only needs a syntactically valid URL while generating its client. The
# real database URL is injected at runtime by compose, never baked into image.
ENV DATABASE_URL="postgresql://build:build@127.0.0.1:5432/janvier_build?schema=public"
RUN npm run build

# Used only by the migration job. It contains the source, Prisma CLI and tsx,
# but is never exposed as the web service image.
FROM build AS operations
RUN apk add --no-cache su-exec \
  && addgroup --system --gid 1001 janvier \
  && adduser --system --uid 1001 janvier \
  && chown -R janvier:janvier /app/app/generated/prisma
COPY --chmod=755 scripts/docker/run-operations.sh /usr/local/bin/run-operations
RUN sed -i 's/\r$//' /usr/local/bin/run-operations
ENTRYPOINT ["/usr/local/bin/run-operations"]

FROM base AS production
ENV NODE_ENV=production
ENV PORT=3001
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 janvier && adduser --system --uid 1001 janvier
COPY --from=build --chown=janvier:janvier /app/public ./public
COPY --from=build --chown=janvier:janvier /app/.next/standalone ./
COPY --from=build --chown=janvier:janvier /app/.next/static ./.next/static

USER janvier
EXPOSE 3001
CMD ["node", "server.js"]
