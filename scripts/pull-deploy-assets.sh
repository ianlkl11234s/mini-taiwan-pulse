#!/bin/sh
# 從 S3 公開 URL 下載資料到 /data/（container 內執行）
BASE="https://migu-gis-data-collector.s3.ap-southeast-2.amazonaws.com/deploy-assets"
DATA_DIR="/data"
mkdir -p "$DATA_DIR"

FILES="aviation_data.json ship_data.json provincial_road.geojson national_highway.geojson bus_stations_city.geojson bus_stations_intercity.geojson"

for f in $FILES; do
  echo "Pulling $f..."
  wget -q -O "$DATA_DIR/$f" "$BASE/$f"
done

# Rail bundle
if wget -q -O "$DATA_DIR/rail_bundle.json" "$BASE/rail_bundle.json" 2>/dev/null; then
  echo "rail_bundle.json downloaded"
fi

echo "All assets pulled to $DATA_DIR"
