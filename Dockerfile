FROM node:20-slim

# Install system dependencies (including FFmpeg and fonts support)
RUN apt-get update && apt-get install -y ffmpeg fontconfig && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy dependency definitions
COPY package*.json ./
COPY backend/package*.json ./backend/

# Install dependencies
RUN npm install
RUN cd backend && npm install

# Copy application files
COPY . .

# Build React production bundle
RUN npm run build

EXPOSE 8000
ENV PORT=8000
ENV NODE_ENV=production

CMD ["npm", "start", "--prefix", "backend"]
