FROM node:20-slim

# Install system dependencies
# - ffmpeg: video compilation engine
# - fontconfig + fonts-noto-color-emoji: emoji rendering support for video overlays
# - fonts-liberation: fallback Latin fonts for subtitle rendering
# - ca-certificates: HTTPS support for GCS/Firestore connections
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    fontconfig \
    fonts-noto-color-emoji \
    fonts-liberation \
    ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && fc-cache -fv

WORKDIR /app

# --- Dependency caching layer ---
# Copy package files first so Docker caches npm install separately from code changes
COPY package*.json ./
COPY backend/package*.json ./backend/

RUN npm install --production=false
RUN cd backend && npm install --production

# --- Application code layer ---
COPY . .

# Build React production bundle (Vite)
RUN npm run build

# The Express server will serve the built React app from /app/dist
EXPOSE 8000
ENV PORT=8000
ENV NODE_ENV=production

# Healthcheck for Cloud Run (optional but recommended)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:8000/api/health').then(r => { if (!r.ok) process.exit(1) }).catch(() => process.exit(1))"

CMD ["npm", "start", "--prefix", "backend"]
