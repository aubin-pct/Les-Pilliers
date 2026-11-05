# Les Piliers : l'appli construite + le serveur de synchronisation, dans une seule image.
FROM node:22-alpine AS build
WORKDIR /src
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=8787 DATA_DIR=/data STATIC_DIR=/app/dist
COPY server/server.mjs ./server.mjs
COPY --from=build /src/dist ./dist
RUN mkdir -p /data && chown -R node:node /data
USER node
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s CMD wget -qO- http://127.0.0.1:8787/api/health >/dev/null || exit 1
CMD ["node", "server.mjs"]
