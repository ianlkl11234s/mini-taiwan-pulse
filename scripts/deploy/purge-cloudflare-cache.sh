#!/bin/bash
# 部署後清 Cloudflare 邊緣快取（item 4 進階版用）。
#
# 何時需要：只有當你在 Cloudflare Cache Rule 把「Edge Cache TTL」設成比 nginx header
# 更長（例如 7d）時，才需要在每次 redeploy 後手動清快取，避免使用者拿到舊的 PMTiles/GeoJSON。
# 若 Cache Rule 用「Respect existing headers」(edge TTL = nginx 的 1d)，就**不需要**本腳本。
#
# 需要 env（建議放 .env，勿進 bundle）：
#   CF_ZONE_ID    — Cloudflare 該網域的 Zone ID（dashboard 右下角）
#   CF_API_TOKEN  — 有 "Cache Purge" 權限的 API Token
#
# 用法：deploy 完（新容器已 live）後執行：bash scripts/deploy/purge-cloudflare-cache.sh
set -euo pipefail

if [ -f .env ]; then
  CF_ZONE_ID=${CF_ZONE_ID:-$(grep '^CF_ZONE_ID=' .env | cut -d'=' -f2- || true)}
  CF_API_TOKEN=${CF_API_TOKEN:-$(grep '^CF_API_TOKEN=' .env | cut -d'=' -f2- || true)}
fi

if [ -z "${CF_ZONE_ID:-}" ] || [ -z "${CF_API_TOKEN:-}" ]; then
  echo "✗ 缺 CF_ZONE_ID / CF_API_TOKEN，略過 Cloudflare 清快取"
  exit 0
fi

echo "清 Cloudflare 邊緣快取（purge_everything）…"
resp=$(curl -s -X POST \
  "https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/purge_cache" \
  -H "Authorization: Bearer ${CF_API_TOKEN}" \
  -H "Content-Type: application/json" \
  --data '{"purge_everything":true}')

if echo "$resp" | grep -q '"success":true'; then
  echo "✓ Cloudflare 快取已清"
else
  echo "✗ 清快取失敗：$resp"
  exit 1
fi
