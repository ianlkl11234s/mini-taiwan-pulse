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

FILES=(
  "public/aviation_data.json"
  "public/ship_data.json"
  "public/provincial_road.geojson"
  "public/national_highway.geojson"
  "public/bus_stations_city.geojson"
  "public/bus_stations_intercity.geojson"
  "public/bike_stations.geojson"
  "public/cycling_routes.geojson"
  "public/freeway_congestion.geojson"
  "public/weather_stations.geojson"
  "public/temperature_grid.json"
)

for f in "${FILES[@]}"; do
  name=$(basename "$f")
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
