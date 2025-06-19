# Stage 1: Builder
FROM node:22-slim AS builder

# Install security updates and required packages
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    openssl \
    && apt-get upgrade -y \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* \
    && rm -rf /tmp/* \
    && rm -rf /var/tmp/*

WORKDIR /app

# Copy package files
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile && yarn cache clean

# Copy prisma schema
COPY prisma ./prisma

# Generate Prisma client with correct binary target
RUN yarn prisma generate

# Copy source code
COPY . .

# Build application
RUN yarn build

# Stage 2: Production dependencies  
FROM node:22-slim AS deps

# Install security updates, openssl, and sharp dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    openssl \
    libvips-dev \
    python3 \
    make \
    g++ \
    && apt-get upgrade -y && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/* \
    && rm -rf /tmp/* \
    && rm -rf /var/tmp/*

WORKDIR /app

# Set Sharp configuration to use local binaries
ENV SHARP_IGNORE_GLOBAL_LIBVIPS=1

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --production --network-timeout 600000 && yarn cache clean
COPY prisma ./prisma
RUN yarn prisma generate

# Stage 3: Production runtime
FROM node:22-slim

# Install security updates, dumb-init, curl, openssl, and sharp runtime dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    dumb-init \
    curl \
    openssl \
    libvips42 \
    && apt-get upgrade -y && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/* \
    && rm -rf /tmp/* \
    && rm -rf /var/tmp/*

# Create non-root user
RUN groupadd --gid 1001 --system nodejs && \
    useradd --uid 1001 --system --gid nodejs --shell /bin/bash nodejs

WORKDIR /app

# Copy built application
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=deps --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/prisma ./prisma
COPY --chown=nodejs:nodejs package.json ./

# Create cache directory for transformers
RUN mkdir -p /app/.cache && chown -R nodejs:nodejs /app/.cache

# Switch to non-root user
USER nodejs

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Set environment
ENV NODE_ENV=production
ENV TRANSFORMERS_CACHE=/app/.cache

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=30s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })" || exit 1

CMD ["node", "dist/src/main.js"]