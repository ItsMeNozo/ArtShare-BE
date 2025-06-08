# Use slim variant for smaller attack surface
FROM node:20-slim AS builder

# Install security updates and required packages
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    && apt-get upgrade -y \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

# Copy prisma schema
COPY prisma ./prisma

# Generate Prisma client
RUN yarn prisma generate

# Copy source code
COPY . .

# Build application
RUN yarn build

# Stage 2: Production dependencies
FROM node:20-slim AS deps

# Install security updates
RUN apt-get update && \
    apt-get upgrade -y && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --production
COPY prisma ./prisma
RUN yarn prisma generate

# Stage 3: Production runtime
FROM node:20-slim

# Install security updates and dumb-init
RUN apt-get update && \
    apt-get install -y --no-install-recommends dumb-init && \
    apt-get upgrade -y && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

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