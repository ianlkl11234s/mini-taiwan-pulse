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

# 水利 PMTiles 向量切片：glob 動態上傳 public/geo/water_*.pmtiles（扁平，同 water geojson 慣例）
# S3 物件預設支援 byte-range，nginx /geo/ 直送即可
for f in public/geo/water_*.pmtiles; do
  [ -f "$f" ] || continue
  name=$(basename "$f")
  echo "Uploading $name (water pmtiles glob)..."
  aws s3 cp "$f" "s3://$BUCKET/$PREFIX/$name" --region ap-southeast-2
done

# PT-1 批次 PMTiles：geo / agriculture / forestry 三目錄通吃 *.pmtiles
# 新增 PMTiles 不用改本腳本，跑 tippecanoe 後直接 upload 即可
for d in public/geo public/agriculture public/forestry; do
  for f in "$d"/*.pmtiles; do
    [ -f "$f" ] || continue
    name=$(basename "$f")
    # 避開已被上方明確 glob 上傳的 water_*.pmtiles（aws s3 cp idempotent，重複也 OK）
    echo "Uploading $name (pmtiles glob from $d)..."
    aws s3 cp "$f" "s3://$BUCKET/$PREFIX/$name" --region ap-southeast-2
  done
done

# 消防圖層：glob 動態上傳 public/geo/fire_*.geojson（同 water 慣例）
# 新增 fire_xxx.geojson 不用改本腳本，export 完直接跑 upload 即可
for f in public/geo/fire_*.geojson; do
  [ -f "$f" ] || continue
  name=$(basename "$f")
  echo "Uploading $name (fire glob)..."
  aws s3 cp "$f" "s3://$BUCKET/$PREFIX/$name" --region ap-southeast-2
done

# 醫療 GeoJSON：glob 動態上傳 public/geo/medical_*.geojson
for f in public/geo/medical_*.geojson; do
  [ -f "$f" ] || continue
  name=$(basename "$f")
  echo "Uploading $name (medical glob)..."
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

# 淹水感測 isochrone PMTiles（floodSensorIsochrone layer 使用，雙北試做版）
# 走 deploy-assets/flood/ 子前綴 — 對應 mini-taiwan-pulse public/flood/
for f in public/flood/*.pmtiles; do
  [ -f "$f" ] || continue
  name=$(basename "$f")
  echo "Uploading flood/$name..."
  aws s3 cp "$f" "s3://$BUCKET/$PREFIX/flood/$name" --region ap-southeast-2
done

# 醫療圖層：上傳到 deploy-assets/medical/ 子前綴（鏡像結構，pull 端整夾 sync）
for f in public/medical/*.pmtiles; do
  [ -f "$f" ] || continue
  name=$(basename "$f")
  echo "Uploading medical/$name..."
  aws s3 cp "$f" "s3://$BUCKET/$PREFIX/medical/$name" --region ap-southeast-2
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
  "public/agriculture/farm_roads.geojson"
  "public/agriculture/eco_network_zones.geojson"
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

# 林業圖層：上傳到 deploy-assets/forestry/ 子前綴（鏡像結構，pull 端整夾 sync）
# 包含 12 個原始 GeoJSON / PMTiles + 3 個衍生分析 GeoJSON（D1-D3 ETL 產出）
FOREST_FILES=(
  "public/forestry/national_forest_compartments.geojson"
  "public/forestry/national_forest_compartments.pmtiles"
  "public/forestry/forest_reserve.geojson"
  "public/forestry/forest_reserve.pmtiles"
  "public/forestry/forest_roads.geojson"
  "public/forestry/forest_roads.pmtiles"
  "public/forestry/forest_recreation_areas.geojson"
  "public/forestry/forestry_treatment_works.geojson"
  "public/forestry/mountain_trail_signs.geojson"
  "public/forestry/mountain_signal_points.geojson"
  "public/forestry/forest_education_centers.geojson"
  "public/forestry/wildlife_distribution_3rd.geojson"
  "public/forestry/dam_lakes_in_forest.geojson"
  "public/forestry/wildlife_distribution_3rd_alt.geojson"
  "public/forestry/flat_forest_parks.geojson"
  # 衍生 3 個（ETL D1-D3，初期可能不存在 → skip）
  "public/forestry/wildlife_density_h3.geojson"
  "public/forestry/signal_gap.geojson"
  "public/forestry/trail_coverage_per_compartment.geojson"
  # 全台步道整合（A 林業署 + B OSM 寬版 + C 雪霸/金門 NP + D 北市大縱走 + D 新北 GPX）
  "public/forestry/hiking_trails.geojson"
)
for f in "${FOREST_FILES[@]}"; do
  name=$(basename "$f")
  if [ ! -f "$f" ]; then
    echo "Skipping forestry/$name (file not found: $f)"
    continue
  fi
  echo "Uploading forestry/$name..."
  aws s3 cp "$f" "s3://$BUCKET/$PREFIX/forestry/$name" --region ap-southeast-2
done

# Base map PMTiles：上傳到 deploy-assets/base_map/ 子前綴（鏡像結構，pull 端整夾 sync）。
# 6 檔合計 ~406MB（行政邊界 3 + 等高線 2 + OSM 路網 1）。SSOT 在 taipei-gis-analytics。
for f in public/base_map/*.pmtiles; do
  [ -f "$f" ] || continue
  name=$(basename "$f")
  echo "Uploading base_map/$name..."
  aws s3 cp "$f" "s3://$BUCKET/$PREFIX/base_map/$name" --region ap-southeast-2
done

# 房地產 PMTiles：上傳到 deploy-assets/coverage/ 子前綴（鏡像結構，pull 端整夾 sync）。
# 只上傳 real_estate_*（26+43MB 大檔走 S3）；gas coverage 小檔（5MB）仍進 git/dist，不上傳。
for f in public/coverage/real_estate_*.pmtiles; do
  [ -f "$f" ] || continue
  name=$(basename "$f")
  echo "Uploading coverage/$name..."
  aws s3 cp "$f" "s3://$BUCKET/$PREFIX/coverage/$name" --region ap-southeast-2
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
