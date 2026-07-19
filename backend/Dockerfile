# ==========================================
# Stage 1: Build & Prisma Client Compiler
# ==========================================
FROM node:22-alpine AS builder

WORKDIR /usr/src/app

# Install build dependencies
# openssl: required by Prisma engine (linux-musl-openssl-3.0.x target)
# libc6-compat: required for native addons on Alpine musl libc
RUN apk add --no-cache libc6-compat openssl

# Copy dependency manifests and prisma schema
COPY package*.json ./
COPY prisma ./prisma/

# Install all dependencies (including devDependencies for Prisma generate)
RUN npm ci

# Generate Prisma Client with linux-musl-openssl-3.0.x engine binary
RUN npx prisma generate

# ==========================================
# Stage 2: Prune Development Dependencies
# ==========================================
FROM node:22-alpine AS pruner

WORKDIR /usr/src/app

# openssl needed by Prisma binaries during prune validation
RUN apk add --no-cache libc6-compat openssl

COPY package*.json ./
COPY prisma ./prisma/

# Copy dependencies and generated prisma client binaries from builder
COPY --from=builder /usr/src/app/node_modules ./node_modules

# Prune devDependencies to keep the production image lightweight
RUN npm prune --omit=dev

# ==========================================
# Stage 3: Production Execution Environment
# ==========================================
FROM node:22-alpine AS runner

WORKDIR /usr/src/app

ENV NODE_ENV=production
ENV PORT=5000

# openssl: REQUIRED at runtime — Prisma engine links against libssl.so (OpenSSL 3.x)
# curl: for Railway/Docker health check probes
# libc6-compat: musl compatibility shim for native addons
RUN apk add --no-cache curl openssl libc6-compat

# Create non-privileged system user for running app safely
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nodejs

# Copy package manifests and runtime source code
COPY package*.json ./
COPY prisma ./prisma/
COPY src ./src/
COPY scripts ./scripts/
COPY docker-entrypoint.sh ./

# Copy pruned production-only node_modules (includes Prisma engine binaries)
COPY --from=pruner /usr/src/app/node_modules ./node_modules

# Ensure scripts and entrypoint have execution rights
RUN chmod +x scripts/*.sh docker-entrypoint.sh && \
    chown -R nodejs:nodejs /usr/src/app

# Run as non-root
USER nodejs

EXPOSE 5000

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["npm", "start"]
