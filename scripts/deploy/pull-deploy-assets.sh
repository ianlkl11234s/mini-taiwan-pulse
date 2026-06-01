#!/bin/sh
# 從 S3 同步資料到 /data/（container 內由 entrypoint.sh 呼叫）
# 需要環境變數：S3_ACCESS_KEY, S3_SECRET_KEY, S3_REGION, S3_BUCKET
#
# 2026-06 改版：全面改用 `aws s3 sync`（取代逐檔 cp）。
#   → volume 已有且未變的檔自動跳過，不重複下載（重啟幾乎零流量）。
#   → 加新大檔多數情況不用改本腳本（water_*/fire_* glob、agriculture/ 整夾）。
# 注意：目前 S3 deploy-assets/ 仍是「扁平」結構（檔名直接放根目錄），
#   故 geo/h3 用 --include filter 把扁平檔同步進對應 /data 子目錄。
#   未來搬成「鏡像結構」後可簡化為整夾 sync（見 docs/launch/06_DEPLOY_ASSETS_MIGRATION.md）。

export AWS_ACCESS_KEY_ID="$S3_ACCESS_KEY"
export AWS_SECRET_ACCESS_KEY="$S3_SECRET_KEY"
export AWS_DEFAULT_REGION="${S3_REGION:-ap-southeast-2}"

BUCKET="${S3_BUCKET:-migu-gis-data-collector}"
PREFIX="deploy-assets"
DATA_DIR="/data"
S3="s3://$BUCKET/$PREFIX"
CACHE="$DATA_DIR/.cache"
mkdir -p "$DATA_DIR" "$DATA_DIR/geo" "$DATA_DIR/h3" "$DATA_DIR/bus" "$DATA_DIR/fire" "$DATA_DIR/agriculture" "$CACHE"

echo "[pull] sync root json → $DATA_DIR/"
aws s3 sync "$S3/" "$DATA_DIR/" --no-progress \
  --exclude "*" --include "aviation_data.json" --include "ship_data.json"

echo "[pull] sync geo → $DATA_DIR/geo/（扁平 S3 + include filter）"
aws s3 sync "$S3/" "$DATA_DIR/geo/" --no-progress --exclude "*" \
  --include "provincial_road.geojson" --include "national_highway.geojson" \
  --include "bus_stations_city.geojson" --include "bus_stations_intercity.geojson" \
  --include "bike_stations.geojson" --include "cycling_routes.geojson" \
  --include "freeway_congestion.geojson" --include "weather_stations.geojson" \
  --include "schools.geojson" --include "convenience_stores.geojson" \
  --include "active_faults.geojson" \
  --include "water_*.geojson" --include "fire_*.geojson"

echo "[pull] sync h3 → $DATA_DIR/h3/"
aws s3 sync "$S3/" "$DATA_DIR/h3/" --no-progress --exclude "*" --include "h3_*_res8.json"

# 消防等時圈 PMTiles：只同步「扁平根目錄」的 *.pmtiles（不含 agriculture/ 子前綴）→ /data/fire/
echo "[pull] sync fire pmtiles → $DATA_DIR/fire/"
aws s3 sync "$S3/" "$DATA_DIR/fire/" --no-progress --exclude "*" --include "*.pmtiles"

# 農業：鏡像子前綴 deploy-assets/agriculture/ → /data/agriculture/（整夾 sync，加新檔免改腳本）
echo "[pull] sync agriculture → $DATA_DIR/agriculture/"
aws s3 sync "$S3/agriculture/" "$DATA_DIR/agriculture/" --no-progress

# Rail：tar.gz 同步到 cache，僅在 archive 有變時才重新解壓
echo "[pull] sync rail.tar.gz → cache"
aws s3 sync "$S3/" "$CACHE/" --no-progress --exclude "*" --include "rail.tar.gz"
if [ -f "$CACHE/rail.tar.gz" ]; then
  if [ ! -f "$DATA_DIR/rail/.extracted" ] || [ "$CACHE/rail.tar.gz" -nt "$DATA_DIR/rail/.extracted" ]; then
    echo "[pull] extracting rail.tar.gz → $DATA_DIR/rail/"
    mkdir -p "$DATA_DIR/rail"
    tar -xzf "$CACHE/rail.tar.gz" -C "$DATA_DIR"
    touch "$DATA_DIR/rail/.extracted"
  else
    echo "[pull] rail unchanged, skip extract"
  fi
fi

# 公車大檔：*.json.gz 同步到 cache，僅在有變時才重新 gunzip
echo "[pull] sync bus *.json.gz → cache"
aws s3 sync "$S3/" "$CACHE/" --no-progress --exclude "*" --include "*_bus_routes.json.gz"
for f in taipei_bus_routes.json intercity_bus_routes.json pingtungcounty_bus_routes.json; do
  gz="$CACHE/$f.gz"
  if [ -f "$gz" ]; then
    if [ ! -f "$DATA_DIR/bus/$f" ] || [ "$gz" -nt "$DATA_DIR/bus/$f" ]; then
      echo "[pull] gunzip $f → $DATA_DIR/bus/"
      gunzip -c "$gz" > "$DATA_DIR/bus/$f"
    fi
  fi
done

echo "[pull] all assets synced to $DATA_DIR"
