#!/bin/sh
# 從 S3 私密下載資料到 /data/（container 內執行）
# 需要環境變數：S3_ACCESS_KEY, S3_SECRET_KEY, S3_REGION, S3_BUCKET

export AWS_ACCESS_KEY_ID="$S3_ACCESS_KEY"
export AWS_SECRET_ACCESS_KEY="$S3_SECRET_KEY"
export AWS_DEFAULT_REGION="${S3_REGION:-ap-southeast-2}"

BUCKET="${S3_BUCKET:-migu-gis-data-collector}"
PREFIX="deploy-assets"
DATA_DIR="/data"
mkdir -p "$DATA_DIR" "$DATA_DIR/geo" "$DATA_DIR/h3" "$DATA_DIR/bus"

# 採扁平 S3 + 本地分目錄方案：S3 路徑維持 deploy-assets/xxx.ext，
# 下載時依檔案類型落到對應子目錄對應前端 public/{geo,h3}/ 結構

# Root 層：動態資料檔
ROOT_FILES="aviation_data.json ship_data.json"

# geo/ 層：靜態 GeoJSON
GEO_FILES="provincial_road.geojson national_highway.geojson bus_stations_city.geojson bus_stations_intercity.geojson bike_stations.geojson cycling_routes.geojson freeway_congestion.geojson weather_stations.geojson schools.geojson convenience_stores.geojson active_faults.geojson"

# h3/ 層：H3 預聚合
H3_FILES="h3_demographics_res8.json h3_population_res8.json"

for f in $ROOT_FILES; do
  echo "Pulling $f → $DATA_DIR/$f"
  aws s3 cp "s3://$BUCKET/$PREFIX/$f" "$DATA_DIR/$f"
done

for f in $GEO_FILES; do
  echo "Pulling $f → $DATA_DIR/geo/$f"
  aws s3 cp "s3://$BUCKET/$PREFIX/$f" "$DATA_DIR/geo/$f"
done

for f in $H3_FILES; do
  echo "Pulling $f → $DATA_DIR/h3/$f"
  aws s3 cp "s3://$BUCKET/$PREFIX/$f" "$DATA_DIR/h3/$f"
done

# Rail 個別檔案（從 tar.gz 解壓）
echo "Pulling rail.tar.gz..."
if aws s3 cp "s3://$BUCKET/$PREFIX/rail.tar.gz" /tmp/rail.tar.gz; then
  mkdir -p "$DATA_DIR/rail"
  tar -xzf /tmp/rail.tar.gz -C "$DATA_DIR"
  rm /tmp/rail.tar.gz
  echo "rail/ extracted to $DATA_DIR/rail/"
fi

# 公車大檔路線 JSON（gzip 壓縮；小檔隨 git 部署不在此處）
BUS_BIG_FILES="taipei_bus_routes.json intercity_bus_routes.json"
for f in $BUS_BIG_FILES; do
  echo "Pulling $f.gz → $DATA_DIR/bus/$f"
  if aws s3 cp "s3://$BUCKET/$PREFIX/$f.gz" "/tmp/$f.gz"; then
    gunzip -c "/tmp/$f.gz" > "$DATA_DIR/bus/$f"
    rm "/tmp/$f.gz"
  fi
done

echo "All assets pulled to $DATA_DIR"
