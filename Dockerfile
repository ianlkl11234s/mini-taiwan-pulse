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

FROM node:22-alpine AS coral-server
WORKDIR /coral-server
COPY server/coral-private/package*.json ./
RUN npm ci --omit=dev
COPY server/coral-private/ ./

# ── Stage 2: Serve ──
FROM nginx:alpine
RUN apk add --no-cache aws-cli nodejs python3
COPY --from=coral-server /coral-server /opt/coral-server
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
COPY scripts/deploy/pull-deploy-assets.sh /usr/local/bin/pull-deploy-assets.sh
COPY scripts/deploy/install-jp-medical-assets.py /usr/local/bin/install-jp-medical-assets.py
COPY scripts/deploy/refresh-climate.sh /usr/local/bin/refresh-climate.sh
COPY scripts/deploy/refresh-gfw-hourly.sh /usr/local/bin/refresh-gfw-hourly.sh
COPY scripts/deploy/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/pull-deploy-assets.sh /usr/local/bin/refresh-climate.sh /usr/local/bin/refresh-gfw-hourly.sh /usr/local/bin/entrypoint.sh

EXPOSE 8080

# 啟動時先 pull S3 → /data，再起 nginx（pull 失敗不會 crash，見 entrypoint.sh）
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
