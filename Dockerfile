# ======================================================================================
# Stage 1: Builder - Build the application and prepare production node_modules
# ======================================================================================
# Use your pre-built image instead of the generic node:22-alpine
FROM kiet03/artshare-base:1.0.0 AS builder
WORKDIR /app

# Install ALL dependencies (including devDependencies).
#    This layer is cached as long as package.json and yarn.lock don't change.
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --network-timeout 600000


# Copy the rest of the source code.
# This is the most frequently invalidated layer.
COPY . .

# Build the application.
RUN yarn build

RUN yarn install --production --frozen-lockfile --network-timeout 600000

# ======================================================================================
# Stage 2: Production - Create the final, small, and secure runtime image
# ======================================================================================
FROM node:22-slim

# Install only RUNTIME OS dependencies.
#    - `vips` is the runtime library for `sharp`.
#    - `dumb-init` is a lightweight init system.
#    - `openssl` is often needed for HTTPS/TLS connections.
RUN apt-get update && apt-get install -y --no-install-recommends \
    dumb-init \
    libvips \
    curl \
    && rm -rf /var/lib/apt/lists/* 

# Create a non-root user for security.
RUN adduser --system --uid 1001 --group --shell /bin/bash nodejs

WORKDIR /app

# Copy necessary artifacts from the builder stage.
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/prisma ./prisma

# Copy the entrypoint script and make it executable.
COPY --chmod=755 entrypoint.sh /usr/local/bin/entrypoint.sh

# Create the cache directory that the entrypoint script defaults to.
RUN mkdir -p /app/.cache && chown nodejs:nodejs /app/.cache

# Switch to the non-root user.
USER nodejs

# Use dumb-init to properly handle process signals (like SIGTERM/SIGINT).
ENTRYPOINT ["dumb-init", "--", "entrypoint.sh"]

# Set environment for production.
ENV NODE_ENV=production

# A lightweight healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=30s --retries=3 \
    CMD curl --fail http://localhost:3000/health || exit 1

# Start the application.
CMD ["node", "dist/main.js"]