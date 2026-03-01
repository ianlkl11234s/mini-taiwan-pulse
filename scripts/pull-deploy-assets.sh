#!/bin/sh
# 從 S3 私密下載資料到 /data/（container 內執行）
# 需要環境變數：S3_ACCESS_KEY, S3_SECRET_KEY, S3_REGION, S3_BUCKET

export AWS_ACCESS_KEY_ID="$S3_ACCESS_KEY"
export AWS_SECRET_ACCESS_KEY="$S3_SECRET_KEY"
export AWS_DEFAULT_REGION="${S3_REGION:-ap-southeast-2}"

BUCKET="${S3_BUCKET:-migu-gis-data-collector}"
PREFIX="deploy-assets"
DATA_DIR="/data"
mkdir -p "$DATA_DIR"

FILES="aviation_data.json ship_data.json provincial_road.geojson national_highway.geojson bus_stations_city.geojson bus_stations_intercity.geojson bike_stations.geojson"

for f in $FILES; do
  echo "Pulling $f..."
  aws s3 cp "s3://$BUCKET/$PREFIX/$f" "$DATA_DIR/$f"
done

# Rail 個別檔案（從 tar.gz 解壓）
echo "Pulling rail.tar.gz..."
if aws s3 cp "s3://$BUCKET/$PREFIX/rail.tar.gz" /tmp/rail.tar.gz; then
  mkdir -p "$DATA_DIR/rail"
  tar -xzf /tmp/rail.tar.gz -C "$DATA_DIR"
  rm /tmp/rail.tar.gz
  echo "rail/ extracted to $DATA_DIR/rail/"
fi

echo "All assets pulled to $DATA_DIR"
