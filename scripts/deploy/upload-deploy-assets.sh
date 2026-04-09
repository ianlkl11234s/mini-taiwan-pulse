#!/bin/bash
# 上傳大型資料檔到 S3 deploy-assets/
# 從 .env 讀取 S3 credentials
if [ -f .env ]; then
  export AWS_ACCESS_KEY_ID=$(grep '^S3_ACCESS_KEY=' .env | cut -d'=' -f2)
  export AWS_SECRET_ACCESS_KEY=$(grep '^S3_SECRET_KEY=' .env | cut -d'=' -f2)
  export AWS_DEFAULT_REGION=$(grep '^S3_REGION=' .env | cut -d'=' -f2)
fi

BUCKET=$(grep '^S3_BUCKET=' .env | cut -d'=' -f2 || echo "migu-gis-data-collector")
PREFIX="deploy-assets"

# public/ 結構 2026-04 後已分子目錄（geo/、h3/），但 S3 維持扁平檔名
# 上傳時 basename 會自動剝掉 geo/、h3/ 前綴
FILES=(
  "public/aviation_data.json"
  "public/ship_data.json"
  "public/geo/provincial_road.geojson"
  "public/geo/national_highway.geojson"
  "public/geo/bus_stations_city.geojson"
  "public/geo/bus_stations_intercity.geojson"
  "public/geo/bike_stations.geojson"
  "public/geo/cycling_routes.geojson"
  "public/geo/freeway_congestion.geojson"
  "public/geo/weather_stations.geojson"
  "public/temperature_grid.json"
  "public/h3/h3_demographics_res8.json"
  "public/h3/h3_population_res8.json"
  "public/geo/schools.geojson"
  "public/geo/convenience_stores.geojson"
  "public/geo/active_faults.geojson"
)

for f in "${FILES[@]}"; do
  name=$(basename "$f")
  if [ ! -f "$f" ]; then
    echo "Skipping $name (file not found: $f)"
    continue
  fi
  echo "Uploading $name..."
  aws s3 cp "$f" "s3://$BUCKET/$PREFIX/$name" --region ap-southeast-2
done

# Rail 個別檔案（打包成 tar.gz 上傳）
if [ -d "public/rail" ]; then
  echo "Packing public/rail/ → rail.tar.gz..."
  tar -czf /tmp/rail.tar.gz -C public rail
  echo "Uploading rail.tar.gz..."
  aws s3 cp /tmp/rail.tar.gz "s3://$BUCKET/$PREFIX/rail.tar.gz" --region ap-southeast-2
  rm /tmp/rail.tar.gz
fi

echo "Done!"
