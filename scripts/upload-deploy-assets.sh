#!/bin/bash
# 上傳大型資料檔到 S3 deploy-assets/
BUCKET="migu-gis-data-collector"
PREFIX="deploy-assets"

FILES=(
  "public/aviation_data.json"
  "public/ship_data.json"
  "public/provincial_road.geojson"
  "public/national_highway.geojson"
  "public/bus_stations_city.geojson"
  "public/bus_stations_intercity.geojson"
)

for f in "${FILES[@]}"; do
  name=$(basename "$f")
  echo "Uploading $name..."
  aws s3 cp "$f" "s3://$BUCKET/$PREFIX/$name" --region ap-southeast-2
done

# Rail bundle（如果存在）
if [ -f "public/rail_bundle.json" ]; then
  echo "Uploading rail_bundle.json..."
  aws s3 cp "public/rail_bundle.json" "s3://$BUCKET/$PREFIX/rail_bundle.json" --region ap-southeast-2
fi

echo "Done!"
