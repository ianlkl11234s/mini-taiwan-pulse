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

# 水資源圖層：glob 動態上傳 public/geo/water_*.geojson
# 新增 water 圖層時不用改本腳本，export 完直接跑 upload 即可
shopt -s nullglob 2>/dev/null || true
for f in public/geo/water_*.geojson; do
  [ -f "$f" ] || continue
  name=$(basename "$f")
  echo "Uploading $name (water glob)..."
  aws s3 cp "$f" "s3://$BUCKET/$PREFIX/$name" --region ap-southeast-2
done

# 消防圖層：glob 動態上傳 public/geo/fire_*.geojson（同 water 慣例）
# 新增 fire_xxx.geojson 不用改本腳本，export 完直接跑 upload 即可
for f in public/geo/fire_*.geojson; do
  [ -f "$f" ] || continue
  name=$(basename "$f")
  echo "Uploading $name (fire glob)..."
  aws s3 cp "$f" "s3://$BUCKET/$PREFIX/$name" --region ap-southeast-2
done

# 消防等時圈 PMTiles 向量切片（public/fire/*.pmtiles）
# Mapbox 用 HTTP Range Request 載瓦片 → S3 物件預設支援 byte-range，nginx 配 /fire/ 直送即可
for f in public/fire/*.pmtiles; do
  [ -f "$f" ] || continue
  name=$(basename "$f")
  echo "Uploading $name (pmtiles)..."
  aws s3 cp "$f" "s3://$BUCKET/$PREFIX/$name" --region ap-southeast-2
done

# 農業圖層：上傳到 deploy-assets/agriculture/ 子前綴（鏡像結構，pull 端整夾 sync）
# 與 fire 的扁平 *.pmtiles 分流，避免 pull 的 fire pmtiles glob 誤抓。
# 範圍由本清單控制：要排除某層就把它移出 AGRI_FILES 即可（不上傳 = 該層不上線）。
AGRI_FILES=(
  "public/agriculture/ftw_fields_2025.pmtiles"
  "public/agriculture/crop_suitability_132.pmtiles"
  "public/agriculture/soil_map_national.pmtiles"
  "public/agriculture/soil_fertility_grid_250m.pmtiles"
  "public/agriculture/leisure_farm_zones_2025.pmtiles"
  "public/agriculture/rural_regen_communities_2025.pmtiles"
  "public/agriculture/agriculture_pois.geojson"
  "public/agriculture/agri_wholesale_market_companies.geojson"
  "public/agriculture/agri_retail_companies.geojson"
  "public/agriculture/produce_wholesale_companies.geojson"
)
for f in "${AGRI_FILES[@]}"; do
  name=$(basename "$f")
  if [ ! -f "$f" ]; then
    echo "Skipping agriculture/$name (file not found: $f)"
    continue
  fi
  echo "Uploading agriculture/$name..."
  aws s3 cp "$f" "s3://$BUCKET/$PREFIX/agriculture/$name" --region ap-southeast-2
done

# Rail 個別檔案（打包成 tar.gz 上傳）
if [ -d "public/rail" ]; then
  echo "Packing public/rail/ → rail.tar.gz..."
  tar -czf /tmp/rail.tar.gz -C public rail
  echo "Uploading rail.tar.gz..."
  aws s3 cp /tmp/rail.tar.gz "s3://$BUCKET/$PREFIX/rail.tar.gz" --region ap-southeast-2
  rm /tmp/rail.tar.gz
fi

# 公車大檔路線 JSON（gitignore 的三份：taipei 18MB、intercity 87MB、pingtungcounty 16MB）
# 小檔（newtaipei / taoyuan / taichung / tainan / kaohsiung / 其餘縣市）仍進 git，不透過 S3
BUS_BIG_FILES=(
  "public/bus/taipei_bus_routes.json"
  "public/bus/intercity_bus_routes.json"
  "public/bus/pingtungcounty_bus_routes.json"
)
for f in "${BUS_BIG_FILES[@]}"; do
  name=$(basename "$f")
  if [ ! -f "$f" ]; then
    echo "Skipping $name (file not found: $f)"
    continue
  fi
  echo "Uploading $name (gzip)..."
  gzip -c "$f" > "/tmp/$name.gz"
  aws s3 cp "/tmp/$name.gz" "s3://$BUCKET/$PREFIX/$name.gz" --region ap-southeast-2
  rm "/tmp/$name.gz"
done

echo "Done!"
