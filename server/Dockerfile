# ── Single-stage build: pre-built on host ─────────────────────
FROM node:20-bullseye-slim

# Install Chromium + Xvfb (virtual display) + noVNC (visual remote access) + system libs
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    xvfb \
    xauth \
    x11vnc \
    novnc \
    websockify \
    socat \
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

# Tell Puppeteer to use the system Chromium (for exchange-rate.service.ts)
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Tell Playwright to use the system Chromium (skip bundled browser download)
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV PLAYWRIGHT_CHROMIUM_PATH=/usr/bin/chromium

WORKDIR /app

# Copy pre-built artifacts from host
COPY dist ./dist
COPY node_modules ./node_modules
COPY prisma ./prisma
COPY package*.json ./

# Prisma Client is pre-generated on host (includes linux-arm64-openssl-1.1.x binary target)

# Create chrome-data directory (will be mounted as a volume)
RUN mkdir -p .chrome-data

# Copy entrypoint script
COPY entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

EXPOSE 3001

# Use entrypoint script that properly manages Xvfb lifecycle
CMD ["./entrypoint.sh"]
