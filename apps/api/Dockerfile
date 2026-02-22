# -----------------------------------------------
# RenderFlow API Dockerfile
#
# Multi-stage build: compile TypeScript, then run
# in a slim image. Target runtime < 200MB.
# -----------------------------------------------

# ---- Stage 1: Builder ----
FROM node:20.11-slim AS builder

WORKDIR /build

# Copy workspace root files needed for monorepo install
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/

# Install all dependencies (needed for workspace resolution)
RUN npm ci --workspace=@renderflow/api --include-workspace-root --ignore-scripts

# Copy shared package and compile it first
COPY packages/shared/ ./packages/shared/
COPY tsconfig.base.json ./
RUN npm run build --workspace=@renderflow/shared 2>/dev/null || true

# Copy API source and compile
COPY apps/api/tsconfig.json ./apps/api/
COPY apps/api/src/ ./apps/api/src/
RUN npm run build --workspace=@renderflow/api

# Prune dev dependencies for the runtime image
RUN npm prune --production --workspace=@renderflow/api --include-workspace-root

# ---- Stage 2: Runtime ----
FROM node:20.11-slim AS runtime

# Install dumb-init for proper signal handling
RUN apt-get update && \
    apt-get install -y --no-install-recommends dumb-init && \
    rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd --gid 1001 renderflow && \
    useradd --uid 1001 --gid renderflow --shell /bin/false --create-home renderflow

WORKDIR /app

# Copy production node_modules, compiled output, and package files
COPY --from=builder --chown=renderflow:renderflow /build/node_modules ./node_modules
COPY --from=builder --chown=renderflow:renderflow /build/apps/api/dist ./apps/api/dist
COPY --from=builder --chown=renderflow:renderflow /build/apps/api/package.json ./apps/api/package.json
COPY --from=builder --chown=renderflow:renderflow /build/packages/shared ./packages/shared
COPY --from=builder --chown=renderflow:renderflow /build/package.json ./package.json

# Switch to non-root user
USER renderflow

# Environment defaults
ENV NODE_ENV=production
ENV PORT=3001
ENV HOST=0.0.0.0

EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD node -e "const http = require('http'); const req = http.get('http://localhost:3001/api/v1/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); }); req.on('error', () => process.exit(1)); req.end();"

# Use dumb-init to properly handle signals
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "apps/api/dist/index.js"]
