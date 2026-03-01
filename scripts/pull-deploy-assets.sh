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

# Rail 個別檔案（從 tar.gz 解壓）
if wget -q -O /tmp/rail.tar.gz "$BASE/rail.tar.gz" 2>/dev/null; then
  mkdir -p "$DATA_DIR/rail"
  tar -xzf /tmp/rail.tar.gz -C "$DATA_DIR"
  rm /tmp/rail.tar.gz
  echo "rail/ extracted to $DATA_DIR/rail/"
fi

echo "All assets pulled to $DATA_DIR"
