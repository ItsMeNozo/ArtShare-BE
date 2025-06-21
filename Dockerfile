# Stage 1: Builder
FROM node:22-slim AS builder

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    openssl \
    && apt-get upgrade -y \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install all dependencies
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

# Generate Prisma client and build
COPY prisma ./prisma
RUN yarn prisma generate
COPY . .
RUN yarn build

# Remove dev dependencies
RUN yarn install --frozen-lockfile --production && yarn cache clean

# Stage 2: Production
FROM node:22-slim

RUN apt-get update && \
    apt-get install -y --no-install-recommends dumb-init curl openssl && \
    apt-get upgrade -y && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN groupadd --gid 1001 --system nodejs && \
    useradd --uid 1001 --system --gid nodejs --shell /bin/bash nodejs

WORKDIR /app

# Copy everything from builder
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nodejs:nodejs /app/package.json ./
# ✅ ADD THIS LINE - Copy the custom generated Prisma client
COPY --from=builder --chown=nodejs:nodejs /app/src/generated ./src/generated

RUN mkdir -p /app/.cache && chown -R nodejs:nodejs /app/.cache

USER nodejs

ENTRYPOINT ["dumb-init", "--"]
ENV NODE_ENV=production
ENV TRANSFORMERS_CACHE=/app/.cache

HEALTHCHECK --interval=30s --timeout=3s --start-period=30s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })" || exit 1

CMD ["node", "dist/src/main.js"]