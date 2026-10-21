# ==============================================================================
# CodeSkill Backend — Production Multi-Stage Dockerfile (AMD64 & ARM64)
# Immutable, minimal, rootless container with liveness health check
# ==============================================================================

# --- Stage 1: Build & Dependencies ---
FROM node:22-alpine AS builder

WORKDIR /app

# Install native compilation toolchain (required for bcrypt / argon2 if needed)
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm ci --legacy-peer-deps

COPY tsconfig*.json nest-cli.json ./
COPY scripts/build.js ./scripts/build.js
COPY src/ ./src/

# Compile TypeScript
RUN npm run build

# Remove development dependencies to keep production footprint minimal
RUN npm prune --omit=dev --legacy-peer-deps

# --- Stage 2: Production Runtime ---
FROM node:22-alpine AS runner

WORKDIR /app

# Install curl for container health check
RUN apk add --no-cache curl tzdata

ENV NODE_ENV=production
ENV PORT=5001

# Copy compiled artifacts and production dependencies from builder
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

# Create uploads directory and assign ownership to standard non-root node user
RUN mkdir -p /app/uploads && chown -R node:node /app

USER node

EXPOSE 5001

# Container-level Liveness Healthcheck
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:5001/api/health/live || exit 1

# Apply the idempotent assessment schema additions on every new image rollout.
# Do not start an API with a schema it cannot query if migration fails.
CMD ["sh", "-c", "node dist/database/run-assessment-schema-migrations.js && exec node dist/main.js"]
