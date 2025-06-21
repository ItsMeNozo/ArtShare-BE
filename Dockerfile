# Stage 1: Builder
FROM node:22-slim AS builder

# Install security updates and required packages
RUN apt-get update && \
    apt-get install -y \
    python3 \
    build-essential \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package.json yarn.lock ./

# Copy prisma schema before installing dependencies 
COPY prisma ./prisma

# Install dependencies 
RUN yarn install --frozen-lockfile

# Generate Prisma client with correct binary target and verify
RUN yarn prisma generate && \
    echo "Verifying Prisma client generation..." && \
    ls -la node_modules/.prisma/client/ && \
    echo "Prisma client generated successfully"

# Copy source code
COPY . .

# Build application
RUN yarn build

# Stage 2: Production dependencies  
FROM node:22-slim AS deps
# Install security updates, openssl, and sharp dependencies
RUN apt-get update && \
    apt-get install -y \
    libssl3 \
    libvips-dev \
    python3 \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Set Sharp configuration to use local binaries
ENV SHARP_IGNORE_GLOBAL_LIBVIPS=1

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --production --network-timeout 600000
COPY prisma ./prisma
RUN yarn prisma generate

# Stage 3: Production runtime
FROM node:22-slim

# Install security updates, dumb-init, curl, openssl, and sharp runtime dependencies
RUN apt-get update && \
    apt-get install -y \
    dumb-init \
    curl \
    libssl3 \
    libvips42 \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd -g 1001 nodejs && \
    useradd -u 1001 -g nodejs -m -s /bin/bash nodejs

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