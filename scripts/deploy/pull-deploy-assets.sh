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
mkdir -p "$DATA_DIR" "$DATA_DIR/geo" "$DATA_DIR/h3" "$DATA_DIR/bus" "$DATA_DIR/fire" "$DATA_DIR/medical" "$DATA_DIR/agriculture" "$DATA_DIR/flood" "$DATA_DIR/forestry" "$DATA_DIR/coverage" "$DATA_DIR/base_map" "$DATA_DIR/climate" "$DATA_DIR/static-rpc" "$CACHE"

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
  --include "water_*.geojson" --include "water_*.pmtiles" --include "fire_*.geojson" \
  --include "medical_*.geojson"

echo "[pull] sync h3 → $DATA_DIR/h3/"
aws s3 sync "$S3/" "$DATA_DIR/h3/" --no-progress --exclude "*" --include "h3_*_res8.json"

# 消防等時圈 PMTiles → /data/fire/
# ⚠️ aws s3 sync 是遞迴的，--include "*.pmtiles" 會連 agriculture/ 子前綴的 pmtiles 都抓，
#    必須用 --exclude "agriculture/*" 排除（否則農業 pmtiles 會被灌進 /data/fire/agriculture/）。
#    未來新增其他「含 pmtiles 的子前綴」也要在此比照排除；搬成鏡像結構後本行可簡化（見 06 搬家計畫）。
echo "[pull] sync fire pmtiles → $DATA_DIR/fire/"
aws s3 sync "$S3/" "$DATA_DIR/fire/" --no-progress --exclude "*" --include "*.pmtiles" --exclude "agriculture/*" --exclude "medical/*" --exclude "flood/*" --exclude "forestry/*" --exclude "coverage/*" --exclude "base_map/*" --exclude "water_*.pmtiles"

# 醫療：鏡像子前綴 deploy-assets/medical/ → /data/medical/（基礎點位 + 等時圈 PMTiles）
echo "[pull] sync medical → $DATA_DIR/medical/"
aws s3 sync "$S3/medical/" "$DATA_DIR/medical/" --no-progress

# 農業：鏡像子前綴 deploy-assets/agriculture/ → /data/agriculture/（整夾 sync，加新檔免改腳本）
echo "[pull] sync agriculture → $DATA_DIR/agriculture/"
aws s3 sync "$S3/agriculture/" "$DATA_DIR/agriculture/" --no-progress

# 林業：鏡像子前綴 deploy-assets/forestry/ → /data/forestry/（整夾 sync，加新檔免改腳本）
# 2026-06-10 補：FOREST_FILES 上傳端 6/7 就有、pull 端漏寫 → 容器 /forestry/ 大檔 404
echo "[pull] sync forestry → $DATA_DIR/forestry/"
aws s3 sync "$S3/forestry/" "$DATA_DIR/forestry/" --no-progress

# 房地產：鏡像子前綴 deploy-assets/coverage/ → /data/coverage/（real_estate_* 大檔；gas 小檔在 dist fallback）
echo "[pull] sync coverage → $DATA_DIR/coverage/"
aws s3 sync "$S3/coverage/" "$DATA_DIR/coverage/" --no-progress

# Base map：鏡像子前綴 deploy-assets/base_map/ → /data/base_map/（行政邊界 + 等高線 + OSM 路網 PMTiles ~406MB）
echo "[pull] sync base_map → $DATA_DIR/base_map/"
aws s3 sync "$S3/base_map/" "$DATA_DIR/base_map/" --no-progress

# 全球氣候：鏡像子前綴 deploy-assets/climate/ → /data/climate/（CMEMS / CAMS / NOAA GFS 衍生 PMTiles）
# Collector PMTiles 生成管線尚未上線，目前 S3 prefix 可能為空，sync 會 no-op。
echo "[pull] sync climate → $DATA_DIR/climate/"
aws s3 sync "$S3/climate/" "$DATA_DIR/climate/" --no-progress

# 靜態化 RPC 快照：鏡像子前綴 deploy-assets/static-rpc/ → /data/static-rpc/（整夾 sync，加新檔免改腳本）
echo "[pull] sync static-rpc → $DATA_DIR/static-rpc/"
aws s3 sync "$S3/static-rpc/" "$DATA_DIR/static-rpc/" --no-progress

# 淹水感測 isochrone：鏡像子前綴 deploy-assets/flood/ → /data/flood/
echo "[pull] sync flood → $DATA_DIR/flood/"
aws s3 sync "$S3/flood/" "$DATA_DIR/flood/" --no-progress

# 警政司法民防：鏡像子前綴 deploy-assets/police_justice/ → /data/police_justice/
# 19 個 dataset 子目錄（每 dataset 自帶 *_20260626.geojson + _manifest.json）+ 3 個 *.pmtiles
mkdir -p "$DATA_DIR/police_justice"
echo "[pull] sync police_justice → $DATA_DIR/police_justice/"
aws s3 sync "$S3/police_justice/" "$DATA_DIR/police_justice/" --no-progress

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
