# syntax=docker/dockerfile:1.7
# One image for the web app, the research worker and migrations.
#   docker compose up --build        (see docker-compose.yml)

FROM node:22-bookworm-slim AS base
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS build
COPY . .
# The build needs no secrets; runtime configuration comes from the environment.
RUN npm run build && npm run build:worker

FROM base AS runtime
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN groupadd --system --gid 1001 personbrief \
 && useradd --system --uid 1001 --gid personbrief --home /app personbrief
COPY --from=build --chown=personbrief:personbrief /app/package.json /app/package-lock.json /app/next.config.ts /app/tsconfig.json ./
COPY --from=build --chown=personbrief:personbrief /app/node_modules ./node_modules
COPY --from=build --chown=personbrief:personbrief /app/.next ./.next
COPY --from=build --chown=personbrief:personbrief /app/public ./public
COPY --from=build --chown=personbrief:personbrief /app/messages ./messages
COPY --from=build --chown=personbrief:personbrief /app/assets ./assets
COPY --from=build --chown=personbrief:personbrief /app/drizzle ./drizzle
COPY --from=build --chown=personbrief:personbrief /app/scripts ./scripts
COPY --from=build --chown=personbrief:personbrief /app/dist ./dist
# Source is kept for the command-line scripts (migrations, owner creation), which run with tsx.
COPY --from=build --chown=personbrief:personbrief /app/src ./src
COPY --from=build --chown=personbrief:personbrief /app/packages ./packages
USER personbrief
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.status<500?0:1)).catch(()=>process.exit(1))"
CMD ["npx", "next", "start"]
