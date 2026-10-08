FROM node:22-bookworm-slim AS build
WORKDIR /work
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY apps ./apps
COPY packages ./packages
COPY services ./services
COPY runtime ./runtime
COPY scripts ./scripts
RUN npm run build

FROM node:22-bookworm-slim
WORKDIR /work
ENV NODE_ENV=production
COPY --from=build /work/node_modules ./node_modules
COPY --from=build /work/dist ./dist
COPY package.json package-lock.json tsconfig.json ./
COPY apps ./apps
COPY packages ./packages
COPY services ./services
COPY runtime ./runtime
COPY scripts ./scripts
COPY tests ./tests
EXPOSE 8787 8790
CMD ["npx", "tsx", "services/api/server.ts"]
