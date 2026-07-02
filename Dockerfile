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
RUN apk add --no-cache aws-cli
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
COPY scripts/deploy/pull-deploy-assets.sh /usr/local/bin/pull-deploy-assets.sh
COPY scripts/deploy/refresh-climate.sh /usr/local/bin/refresh-climate.sh
COPY scripts/deploy/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/pull-deploy-assets.sh /usr/local/bin/refresh-climate.sh /usr/local/bin/entrypoint.sh

EXPOSE 8080

# 啟動時先 pull S3 → /data，再起 nginx（pull 失敗不會 crash，見 entrypoint.sh）
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
