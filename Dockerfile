# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app
# Sync URL is baked into the bundle at build time (Vite VITE_* convention).
# Leave empty to ship a standalone build with no NAS sync.
ARG VITE_SYNC_URL=""
ENV VITE_SYNC_URL=$VITE_SYNC_URL
COPY package*.json .npmrc ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Serve
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
