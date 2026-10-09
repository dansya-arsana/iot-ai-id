FROM node:24.13.1-bookworm-slim AS build
WORKDIR /work
ENV ELECTRON_SKIP_BINARY_DOWNLOAD=1
COPY package.json package-lock.json ./
RUN npm ci
COPY apps ./apps
COPY packages ./packages
COPY services ./services
COPY runtime ./runtime
COPY scripts ./scripts
COPY tsconfig.json ./
RUN npm run build
FROM node:24.13.1-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends python3 ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /work
ENV NODE_ENV=production
COPY --from=build /work/node_modules ./node_modules
COPY --from=build /work/dist ./dist
COPY package.json ./
COPY packages ./packages
COPY services ./services
COPY runtime ./runtime
COPY deploy/jev ./jev
RUN chmod +x /work/jev/jev-codex
CMD ["node", "--import", "tsx", "services/api/server.ts"]
