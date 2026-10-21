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
# ops and api import the pure Lab AI modules (CircuitSpec, layout maths) and read the precomputed examples (ADR 011).
COPY apps/web/src/lab/contract.ts apps/web/src/lab/circuit-spec.ts apps/web/src/lab/circuit-examples.ts ./apps/web/src/lab/
COPY apps/web/src/lab/scene/layout.ts ./apps/web/src/lab/scene/
COPY apps/web/src/lab/ai/examples ./apps/web/src/lab/ai/examples
COPY runtime ./runtime
COPY deploy/jev ./jev
RUN chmod +x /work/jev/jev-codex
CMD ["node", "--import", "tsx", "services/api/server.ts"]
