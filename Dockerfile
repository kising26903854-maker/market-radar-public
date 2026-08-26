# ─── Stage 1: Build Frontend (Vite React) ───
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm install

COPY frontend/ ./
RUN npm run build

# ─── Stage 2: Production Server ───
FROM node:20-alpine AS runner
WORKDIR /app

# Install backend dependencies
COPY backend/package*.json ./backend/
RUN cd backend && npm install --omit=dev

# Copy backend source
COPY backend/ ./backend/

# Copy built frontend assets to serve statically
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

EXPOSE 6002
ENV PORT=6002
ENV NODE_ENV=production

CMD ["node", "backend/server.js"]
