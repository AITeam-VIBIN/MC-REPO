# ==========================================
# Stage 1: Build & Prisma Client Compiler
# ==========================================
FROM node:22-alpine AS builder

WORKDIR /usr/src/app

# Install build dependencies for compiling any native addons
RUN apk add --no-cache libc6-compat

# Copy dependency manifests and prisma schema
COPY package*.json ./
COPY prisma ./prisma/

# Install all dependencies (including devDependencies for Prisma generate)
RUN npm ci

# Generate Prisma Client
RUN npx prisma generate

# ==========================================
# Stage 2: Prune Development Dependencies
# ==========================================
FROM node:22-alpine AS pruner

WORKDIR /usr/src/app

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

# Install curl for container health checks
RUN apk add --no-cache curl

# Create non-privileged system user for running app safely (Security Best Practice)
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nodejs

# Copy package manifests and runtime source code
COPY package*.json ./
COPY prisma ./prisma/
COPY src ./src/
COPY scripts ./scripts/
COPY docker-entrypoint.sh ./

# Copy pruned production-only node_modules from pruner stage
COPY --from=pruner /usr/src/app/node_modules ./node_modules

# Ensure scripts and entrypoint have execution rights and folder belongs to nodejs user
RUN chmod +x scripts/*.sh docker-entrypoint.sh && \
    chown -R nodejs:nodejs /usr/src/app

# Run the container under the non-root nodejs user
USER nodejs

EXPOSE 5000

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["npm", "start"]
