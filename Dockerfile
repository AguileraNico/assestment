# ── Build stage ──────────────────────────────────────────────────
FROM node:20-slim AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ── Production stage ─────────────────────────────────────────────
FROM node:20-slim AS runner
WORKDIR /app

# Solo dependencias de produccion
COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

# Carpeta de datos persistentes (se monta como volumen en Cloud Run)
RUN mkdir -p /app/data/sentencias

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

CMD ["node", "dist/index.js"]
