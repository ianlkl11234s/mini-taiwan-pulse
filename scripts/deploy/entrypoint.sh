#!/bin/sh
# Container 啟動進入點：背景 pull S3 deploy-assets → /data，nginx 立即前景啟動。
#
# 設計原則（上線安全）：
# - nginx **立刻**啟動綁 port → Zeabur 健康檢查馬上通過；不會因第一次大量 pull（~600MB）
#   而卡住數分鐘導致部署逾時。
# - pull 在**背景**跑且「盡力而為」：失敗 / 無 key 都不影響 nginx。
#   persistent volume 會保留上次內容；sync 機制下重啟幾乎零下載（見 pull-deploy-assets.sh）。
# - 第一次部署（空 volume）：小檔（dist）立即可用，大檔在背景陸續補齊（~分鐘級）。
#   之後重啟：volume 已有資料、sync 秒跳過，全部立即可用。
# - 需要的 runtime 環境變數：S3_ACCESS_KEY, S3_SECRET_KEY, S3_REGION, S3_BUCKET。

set -u

echo "[entrypoint] $(date -u) container start"

if [ -n "${S3_ACCESS_KEY:-}" ] && [ -n "${S3_SECRET_KEY:-}" ]; then
  echo "[entrypoint] launching background pull (nginx starts immediately) ..."
  (
    if /usr/local/bin/pull-deploy-assets.sh; then
      echo "[entrypoint] background pull completed OK"
    else
      echo "[entrypoint] WARNING: background pull failed (exit $?). Serving dist + existing /data."
    fi
  ) &
else
  echo "[entrypoint] WARNING: S3_ACCESS_KEY/S3_SECRET_KEY not set → skip pull. Serving dist + existing /data."
fi

# GFW hourly 每日會切新 release/root manifest；預設每 6h 小範圍 re-sync，
# 不用重啟 frontend container 也能在當日追上新資料。
if [ -n "${S3_ACCESS_KEY:-}" ] && [ -n "${S3_SECRET_KEY:-}" ]; then
  (
    while true; do
      sleep "${GFW_HOURLY_REFRESH_SEC:-21600}"
      if /usr/local/bin/refresh-gfw-hourly.sh; then
        echo "[entrypoint] GFW hourly refresh OK $(date -u)"
      else
        echo "[entrypoint] WARNING: GFW hourly refresh failed (exit $?)"
      fi
    done
  ) &
fi

# 氣候 texture 週期性 re-pull：烤圖 collector 每日更新 S3，前端每 CLIMATE_REFRESH_SEC（預設 6h）
# re-sync deploy-assets/climate/ → /data/climate/，免重啟就追上最新。只同步 ~1.3MB，盡力而為不影響 nginx。
if [ -n "${S3_ACCESS_KEY:-}" ] && [ -n "${S3_SECRET_KEY:-}" ]; then
  (
    while true; do
      sleep "${CLIMATE_REFRESH_SEC:-21600}"
      if /usr/local/bin/refresh-climate.sh; then
        echo "[entrypoint] climate refresh OK $(date -u)"
      else
        echo "[entrypoint] WARNING: climate refresh failed (exit $?)"
      fi
    done
  ) &
fi

echo "[entrypoint] starting nginx (foreground)"
exec nginx -g 'daemon off;'
