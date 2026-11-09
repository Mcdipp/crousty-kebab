# syntax=docker/dockerfile:1

# ---------- Étape 1 : dépendances + build TypeScript ----------
FROM node:22-alpine AS build
RUN apk add --no-cache openssl
WORKDIR /app
# DATABASE_URL factice : `prisma generate` n'a pas besoin d'une vraie base.
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
RUN npm ci --no-audit --no-fund
COPY tsconfig.json ./
COPY src ./src
RUN npx prisma generate && npm run build

# ---------- Étape 2 : dépendances de production uniquement ----------
FROM node:22-alpine AS prod-deps
RUN apk add --no-cache openssl
WORKDIR /app
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
# Le postinstall exécute `prisma generate` et télécharge le moteur de migration (schema-engine).
RUN npm ci --omit=dev --no-audit --no-fund

# ---------- Étape 3 : image finale ----------
FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN apk add --no-cache tini openssl
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node package.json prisma.config.ts docker-entrypoint.sh ./
COPY --chown=node:node prisma ./prisma
RUN chmod +x docker-entrypoint.sh
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1
ENTRYPOINT ["/sbin/tini", "--", "./docker-entrypoint.sh"]
CMD ["node", "dist/server.js"]
