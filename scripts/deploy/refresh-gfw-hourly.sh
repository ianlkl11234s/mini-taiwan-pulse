#!/bin/sh
# 週期性把 GFW unified root + immutable releases 從 S3 re-sync 到 frontend volume。
# 不加 --delete：舊 manifest 的短期讀者仍可讀到前一 release。

export AWS_ACCESS_KEY_ID="$S3_ACCESS_KEY"
export AWS_SECRET_ACCESS_KEY="$S3_SECRET_KEY"
export AWS_DEFAULT_REGION="${S3_REGION:-ap-southeast-2}"

BUCKET="${S3_BUCKET:-migu-gis-data-collector}"
mkdir -p /data/global-maritime/gfw-hourly/v3-shadow
aws s3 sync \
  "s3://$BUCKET/deploy-assets/global-maritime/gfw-hourly/" \
  "/data/global-maritime/gfw-hourly/" \
  --no-progress --exclude "manifest.json" --exclude "v3-shadow/manifest.json" --exclude "v4/manifest.json"

# 新 release assets 全部落地後才原子更換可變指標，不暴露半套 release。
if aws s3 cp \
  "s3://$BUCKET/deploy-assets/global-maritime/gfw-hourly/manifest.json" \
  "/data/global-maritime/gfw-hourly/manifest.json.tmp" \
  --no-progress; then
  mv "/data/global-maritime/gfw-hourly/manifest.json.tmp" \
    "/data/global-maritime/gfw-hourly/manifest.json"
fi

# Shadow manifest 是獨立可變指標；immutable v3 assets 已在上方完成同步後才切換。
if aws s3 cp \
  "s3://$BUCKET/deploy-assets/global-maritime/gfw-hourly/v3-shadow/manifest.json" \
  "/data/global-maritime/gfw-hourly/v3-shadow/manifest.json.tmp" \
  --no-progress; then
  mv "/data/global-maritime/gfw-hourly/v3-shadow/manifest.json.tmp" \
    "/data/global-maritime/gfw-hourly/v3-shadow/manifest.json"
fi

# v4 可選正式 release：不存在時保持 no-op；存在時先完成 immutable release
# 同步，再以 tmp+mv 切換 root manifest，舊讀者不會讀到半套資料。
if aws s3 ls \
  "s3://$BUCKET/deploy-assets/global-maritime/gfw-hourly/v4/manifest.json" >/dev/null 2>&1; then
  mkdir -p /data/global-maritime/gfw-hourly/v4/releases
  if aws s3 sync \
    "s3://$BUCKET/deploy-assets/global-maritime/gfw-hourly/v4/releases/" \
    "/data/global-maritime/gfw-hourly/v4/releases/" --no-progress && \
    aws s3 cp \
      "s3://$BUCKET/deploy-assets/global-maritime/gfw-hourly/v4/manifest.json" \
      "/data/global-maritime/gfw-hourly/v4/manifest.json.tmp" \
      --no-progress; then
    mv "/data/global-maritime/gfw-hourly/v4/manifest.json.tmp" \
      "/data/global-maritime/gfw-hourly/v4/manifest.json"
  fi
fi
