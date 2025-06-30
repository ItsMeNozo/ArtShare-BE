# ======================================================================================
# Stage 1: Builder - Build the application and prepare production node_modules
# ======================================================================================
# Use your pre-built image instead of the generic node:22-alpine
FROM kiet03/artshare-base:1.0.0 AS builder
WORKDIR /app

COPY package.json yarn.lock ./
RUN --mount=type=cache,target=/root/.cache/yarn \
    yarn install --frozen-lockfile --network-timeout 600000


COPY . .
RUN yarn build \
    && npm prune --production \
    && yarn cache clean

# ======================================================================================
# Stage 2: Production - Create the final, small, and secure runtime image
# ======================================================================================
FROM node:22-slim AS runner

# Install only RUNTIME OS dependencies.
#    - `vips` is the runtime library for `sharp`.
#    - `dumb-init` is a lightweight init system.
#    - `openssl` is often needed for HTTPS/TLS connections.
RUN apt-get update && apt-get install -y --no-install-recommends \
    dumb-init libvips curl \
    && rm -rf /var/lib/apt/lists/* 

# Create a non-root user for security.
RUN adduser --system --uid 1001 --group --shell /bin/bash nodejs

WORKDIR /app
ENV NODE_ENV=production

# Copy files from builder
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/prisma ./prisma
# Copy the entrypoint script and make it executable.
COPY --chmod=755 entrypoint.sh /usr/local/bin/entrypoint.sh

# Create cache directories for transformers and set proper ownership
RUN mkdir -p /app/.cache /app/.transformers-cache && \
    chown -R nodejs:nodejs /app/.cache /app/.transformers-cache

# Set transformers cache environment variables
ENV TRANSFORMERS_CACHE=/app/.transformers-cache
ENV HF_HOME=/app/.transformers-cache

# Switch to non-root user
USER nodejs

# Use dumb-init to properly handle process signals (like SIGTERM/SIGINT).
ENTRYPOINT ["dumb-init", "--", "entrypoint.sh"]
HEALTHCHECK --interval=30s --timeout=3s --start-period=30s --retries=3 \
    CMD curl --fail http://localhost:3000/health || exit 1

# Start the application.
CMD ["node", "dist/main.js"]