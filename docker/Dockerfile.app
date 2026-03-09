# Multi-stage build for NuniCord

# Stage 1: Build React frontend
FROM node:20-alpine AS client-builder

WORKDIR /app/client
COPY client/package.json ./
RUN npm install --legacy-peer-deps --silent

COPY client/ ./
RUN npm run build

# Stage 2: Build server
FROM node:20-alpine AS server-builder

WORKDIR /app/server
COPY server/package.json ./
RUN npm install --production --silent

# Stage 3: Final image
FROM node:20-alpine

# Install system deps
RUN apk add --no-cache \
    ca-certificates \
    curl \
    vips-dev \
    python3 \
    make \
    g++

WORKDIR /app

# Copy server
COPY server/ ./server/
COPY --from=server-builder /app/server/node_modules ./server/node_modules

# Copy built frontend
COPY --from=client-builder /app/client/build ./client/build

# Create uploads directory
RUN mkdir -p /uploads

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3001/health || exit 1

# Expose port
EXPOSE 3001

# Start server
WORKDIR /app/server
USER node

CMD ["node", "src/index.js"]
