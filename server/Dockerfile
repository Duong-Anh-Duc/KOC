# ── Stage 1: Build ──────────────────────────────────────────
FROM node:20-bullseye-slim AS builder

WORKDIR /app

# Install deps first (layer cache)
COPY package*.json ./
ENV PUPPETEER_SKIP_DOWNLOAD=true
RUN npm ci

COPY . .

# Generate Prisma client BEFORE compiling TypeScript (types must exist for tsc)
RUN npx prisma generate

# Compile TypeScript
RUN npm run build

# ── Stage 2: Production runtime ───────────────────────────────
FROM node:20-bullseye-slim AS runner

# Install Chromium + Xvfb (virtual display) + required system libs for Puppeteer
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    xvfb \
    xauth \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgdk-pixbuf2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libxss1 \
    libxtst6 \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

# Set up virtual display
ENV DISPLAY=:99

# Tell Puppeteer to use the system Chromium
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

# Copy built artifacts from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY package*.json ./

# Create chrome-data directory (will be mounted as a volume)
RUN mkdir -p .chrome-data

EXPOSE 3001

# Run migrations → seed default users → start the server with Xvfb for virtual display
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/prisma/seed.js && xvfb-run -a node dist/index.js"]
