#!/bin/sh
# Container 啟動進入點：先把 S3 deploy-assets 拉進 /data volume，再啟動 nginx。
#
# 設計原則（上線安全）：
# - pull 是「盡力而為」：即使 S3 key 未設或拉取失敗，也不要讓容器崩潰，
#   nginx 仍會啟動並 serve dist/ + volume 內既有資料（persistent volume 會保留上次內容）。
# - 需要的 runtime 環境變數：S3_ACCESS_KEY, S3_SECRET_KEY, S3_REGION, S3_BUCKET
#   （在 Zeabur service 環境變數設定；未設時自動跳過 pull）。

set -u

echo "[entrypoint] $(date -u) container start"

if [ -n "${S3_ACCESS_KEY:-}" ] && [ -n "${S3_SECRET_KEY:-}" ]; then
  echo "[entrypoint] S3 credentials present → pulling deploy-assets to /data ..."
  if /usr/local/bin/pull-deploy-assets.sh; then
    echo "[entrypoint] pull-deploy-assets.sh completed OK"
  else
    echo "[entrypoint] WARNING: pull-deploy-assets.sh failed (exit $?). Serving existing /data + dist only."
  fi
else
  echo "[entrypoint] WARNING: S3_ACCESS_KEY/S3_SECRET_KEY not set → skip pull. Serving existing /data + dist only."
fi

echo "[entrypoint] starting nginx (foreground)"
exec nginx -g 'daemon off;'
