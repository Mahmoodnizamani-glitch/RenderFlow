# -----------------------------------------------
# Render worker Dockerfile
#
# Multi-stage build: compile TypeScript, then run
# in a slim image with Chromium + FFmpeg.
# -----------------------------------------------

# ---- Stage 1: Builder ----
FROM node:20-slim AS builder

WORKDIR /build

# Install build dependencies
COPY package.json package-lock.json* ./
RUN npm ci --ignore-scripts

# Copy source and compile
COPY tsconfig.json ./
COPY src/ ./src/
RUN npx tsc

# Prune dev dependencies for the runtime image
RUN npm prune --production

# ---- Stage 2: Runtime ----
FROM node:20-slim AS runtime

# Install Chromium, FFmpeg, and fonts for intl text
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        chromium \
        ffmpeg \
        fonts-noto \
        fonts-noto-cjk \
        fonts-noto-color-emoji \
        dumb-init \
    && rm -rf /var/lib/apt/lists/*

# Set Chromium path for Remotion
ENV CHROME_BIN=/usr/bin/chromium
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV REMOTION_CHROME_EXECUTABLE=/usr/bin/chromium

# Create non-root user
RUN groupadd --gid 1001 renderflow && \
    useradd --uid 1001 --gid renderflow --shell /bin/false --create-home renderflow

WORKDIR /app

# Copy production node_modules and compiled output
COPY --from=builder --chown=renderflow:renderflow /build/node_modules ./node_modules
COPY --from=builder --chown=renderflow:renderflow /build/dist ./dist
COPY --from=builder --chown=renderflow:renderflow /build/package.json ./package.json

# Create tmp directory for render workspaces
RUN mkdir -p /tmp/renderflow && chown renderflow:renderflow /tmp/renderflow

# Switch to non-root user
USER renderflow

# Environment defaults
ENV NODE_ENV=production
ENV HEALTH_PORT=3001
ENV WORKER_CONCURRENCY=1
ENV JOB_TIMEOUT_MS=1800000

EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD node -e "const http = require('http'); const req = http.get('http://localhost:3001/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); }); req.on('error', () => process.exit(1)); req.end();"

# Use dumb-init to properly handle signals
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/worker.js"]
