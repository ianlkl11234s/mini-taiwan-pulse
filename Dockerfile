# ── Stage 1: Build ──
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Mapbox token 必須在 build time 注入（Vite 會嵌入靜態檔）
ARG VITE_MAPBOX_TOKEN
ENV VITE_MAPBOX_TOKEN=$VITE_MAPBOX_TOKEN

RUN npm run build

# ── Stage 2: Serve ──
FROM nginx:alpine
RUN apk add --no-cache wget
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
COPY scripts/pull-deploy-assets.sh /usr/local/bin/pull-deploy-assets.sh

EXPOSE 8080
