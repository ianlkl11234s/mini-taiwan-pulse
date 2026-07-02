#!/bin/sh
# 週期性把 deploy-assets/climate/ 從 S3 re-sync 到 /data/climate/（entrypoint 背景迴圈呼叫）。
# 全球氣候烤圖 collector（data-collectors）每日更新 S3 texture → 前端不必重啟就追得上。
# 只同步 climate 子前綴（~1.3MB），sync 機制下未變的檔自動跳過。
# 需要環境變數：S3_ACCESS_KEY, S3_SECRET_KEY, S3_REGION, S3_BUCKET。

export AWS_ACCESS_KEY_ID="$S3_ACCESS_KEY"
export AWS_SECRET_ACCESS_KEY="$S3_SECRET_KEY"
export AWS_DEFAULT_REGION="${S3_REGION:-ap-southeast-2}"

BUCKET="${S3_BUCKET:-migu-gis-data-collector}"
aws s3 sync "s3://$BUCKET/deploy-assets/climate/" "/data/climate/" --no-progress
