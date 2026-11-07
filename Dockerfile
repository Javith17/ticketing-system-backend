# ---- Builder ----
FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# ---- Runtime ----
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist
COPY db ./db
COPY scripts ./scripts
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN sed -i 's/\r$//' docker-entrypoint.sh && chmod +x docker-entrypoint.sh

RUN mkdir -p uploads \
    && addgroup -S -g 1001 appgroup && adduser -S -u 1001 -G appgroup appuser \
    && chown -R appuser:appgroup /app
USER appuser

EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh"]
