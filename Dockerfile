# ==============================================================================
# HOROLOGIUM // ENTERPRISE MULTI-STAGE PRODUCTION DOCKERFILE
# ==============================================================================
# Architecture:
# - Stage 1 (builder): Installs full dependencies & compiles Vite multi-page assets
# - Stage 2 (runner):  Hardened minimal Node.js Alpine image, unprivileged user,
#                      production dependencies only, built-in health check probe.
# ==============================================================================

# ------------------------------------------------------------------------------
# STAGE 1: Client & Asset Compilation
# ------------------------------------------------------------------------------
FROM node:22-alpine AS builder

WORKDIR /app

# Cache package dependencies layer
COPY package.json package-lock.json ./
RUN npm ci

# Copy full application tree
COPY . .

# Compile multi-page client application and minified chunks
RUN npm run build

# ------------------------------------------------------------------------------
# STAGE 2: Hardened Production Runtime
# ------------------------------------------------------------------------------
FROM node:22-alpine AS runner

WORKDIR /app

# Install curl for container orchestration health checks
RUN apk add --no-cache curl

ENV NODE_ENV=production \
    PORT=3001 \
    HOST=0.0.0.0

# Install production dependencies only
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy pre-compiled Vite distribution from builder
COPY --from=builder /app/dist ./dist

# Copy backend server modules and geodesic datasets
COPY --from=builder /app/server ./server
COPY --from=builder /app/public ./public
COPY --from=builder /app/src/data ./src/data
COPY --from=builder /app/server.js ./server.js

# Ensure local data directory exists with unprivileged permissions
RUN mkdir -p /app/server/data && chown -R node:node /app

# Run as non-root unprivileged system user
USER node

# Expose HTTP API & WebSocket SNTP gateway port
EXPOSE 3001

# Kubernetes & Docker Healthcheck Probe
HEALTHCHECK --interval=20s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3001/healthz || exit 1

# Launch Horologium Production Gateway
CMD ["node", "server.js"]
