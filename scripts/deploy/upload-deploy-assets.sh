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

# PT-1 批次 PMTiles（geo 子目錄）：上傳到 deploy-assets/geo/ 鏡像子前綴。
# ⚠️ 為何不上扁平根（2026-07-04 修 13 層 404 教訓）：
#   pull 端 /data/geo/ 用 include-filter 只挑既有扁平 geojson 檔名，扁平根的新 pmtiles
#   挑不進 /data/geo/，反被 fire 的 *.pmtiles glob 誤抓進 /data/fire/ → 前端 /geo/*.pmtiles 404。
#   改走 deploy-assets/geo/ 鏡像後，pull 端 `aws s3 sync $S3/geo/ → /data/geo/` 整夾同步，nginx /geo/ 直送。
# 涵蓋 national_highway / provincial_road / bus_stations_city / fire_hydrants / medical_{clinics,pharmacies,aed,ltc} + water_*。
for f in public/geo/*.pmtiles; do
  [ -f "$f" ] || continue
  name=$(basename "$f")
  echo "Uploading geo/$name (pmtiles mirror)..."
  aws s3 cp "$f" "s3://$BUCKET/$PREFIX/geo/$name" --region ap-southeast-2
done
# agriculture / forestry 的 PMTiles 改由下方 AGRI_FILES / FOREST_FILES 明確清單上傳到各自鏡像子前綴

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
  # 🐷 畜牧 Livestock（靜態點層，去日期穩定檔名）
  # ⚠️ owner-gated：livestock_farms.geojson / slaughterhouses.geojson 已改走 owner-only RPC，
  #    刻意不上傳（斷 prod 供應）；本地 public/ 檔案保留不刪。見 docs/features/owner-gated-layers。
  "public/agriculture/feed_factories.geojson"
  "public/agriculture/livestock_markets.geojson"
  # PT-1 PMTiles（前端 sourceUrl 已切 .pmtiles；geojson 保留但未使用）
  "public/agriculture/agri_retail_companies.pmtiles"
  "public/agriculture/produce_wholesale_companies.pmtiles"
  "public/agriculture/farm_roads.pmtiles"
  "public/agriculture/eco_network_zones.pmtiles"
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

# 🛕 宗教 Religion：上傳到 deploy-assets/religion/ 子前綴（鏡像結構，pull 端整夾 sync）
# 目前 6 個檔都在 git（<5MB）走 dist，此處上傳是為了與其他主題同構 + 日後改走 S3 時零改動
for f in public/religion/*.geojson public/religion/*.pmtiles; do
  [ -f "$f" ] || continue
  name=$(basename "$f")
  echo "Uploading religion/$name..."
  aws s3 cp "$f" "s3://$BUCKET/$PREFIX/religion/$name" --region ap-southeast-2
done

# ⚰️ 殯葬 Funeral：上傳到 deploy-assets/funeral/ 子前綴（鏡像結構，pull 端整夾 sync）
# 5 個檔共 5.77MB 都在 git 走 dist，此處上傳是為了與其他主題同構 + 日後改走 S3 時零改動
for f in public/funeral/*.geojson public/funeral/*.json public/funeral/*.pmtiles; do
  [ -f "$f" ] || continue
  name=$(basename "$f")
  echo "Uploading funeral/$name..."
  aws s3 cp "$f" "s3://$BUCKET/$PREFIX/funeral/$name" --region ap-southeast-2
done

# 🏟️ 運動場館 Sports：上傳到 deploy-assets/sports/ 子前綴（8.4MB 靜態 GeoJSON，去日期穩定檔名）
# 5 sublayer 前端共用此檔 + layer filter。加新檔（如統計 JSON）免改本腳本。
for f in public/sports/*.geojson public/sports/*.json; do
  [ -f "$f" ] || continue
  name=$(basename "$f")
  echo "Uploading sports/$name..."
  aws s3 cp "$f" "s3://$BUCKET/$PREFIX/sports/$name" --region ap-southeast-2
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
  "public/forestry/mountain_huts.geojson"
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
  # PT-1 PMTiles（前端 sourceUrl 已切 .pmtiles；geojson 保留但未使用）
  "public/forestry/hiking_trails.pmtiles"
  # 全台樹冠高度 raster PMTiles（80MB，高度編碼 RGBA z13/512px，PR #83；舊預烤版 canopy_height_taiwan.pmtiles 已退役）
  "public/forestry/canopy_height_rgb_taiwan.pmtiles"
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

# 養殖漁業圖層：上傳到 deploy-assets/fishery/ 子前綴（鏡像結構，pull 端整夾 sync）
# ponds 逐口魚塭 PMTiles 大檔（3.1MB）+ 生產區/箱網 GeoJSON 小檔（後兩者亦在 git dist fallback）
# + 衛星偵測養殖水體 PMTiles（2.5MB）
FISHERY_FILES=(
  "public/fishery/aquaculture_ponds_osm.pmtiles"
  "public/fishery/aquaculture_production_zone.geojson"
  "public/fishery/aquaculture_cage_net.geojson"
  "public/fishery/aquaculture_water_satellite.pmtiles"
)
for f in "${FISHERY_FILES[@]}"; do
  name=$(basename "$f")
  if [ ! -f "$f" ]; then
    echo "Skipping fishery/$name (file not found: $f)"
    continue
  fi
  echo "Uploading fishery/$name..."
  aws s3 cp "$f" "s3://$BUCKET/$PREFIX/fishery/$name" --region ap-southeast-2
done

# 水資源圖層：上傳到 deploy-assets/water_resources/ 子前綴（鏡像結構，pull 端整夾 sync）
# 湖泊/埤塘 PMTiles（11.3MB，純 S3，無 git 小檔）
for f in public/water_resources/*.pmtiles; do
  [ -f "$f" ] || continue
  name=$(basename "$f")
  echo "Uploading water_resources/$name..."
  aws s3 cp "$f" "s3://$BUCKET/$PREFIX/water_resources/$name" --region ap-southeast-2
done

# 都市開放空間圖層：上傳到 deploy-assets/urban/ 子前綴（鏡像結構，pull 端整夾 sync）
# 行道樹 diff/3epoch/全國 + 樹穴 PMTiles + 受保護樹木/河濱喬木/公園 GeoJSON（純 S3，無 git 小檔；glob 動態上傳加新檔免改腳本）
for f in public/urban/*.pmtiles public/urban/*.geojson; do
  [ -f "$f" ] || continue
  name=$(basename "$f")
  echo "Uploading urban/$name..."
  aws s3 cp "$f" "s3://$BUCKET/$PREFIX/urban/$name" --region ap-southeast-2
done

# EM-15 嵌入用歷史快照：整夾鏡像 deploy-assets/embed-snapshots/<layer>/<date>.geojson
if [ -d public/embed-snapshots ]; then
  echo "Uploading embed-snapshots/..."
  aws s3 sync public/embed-snapshots/ "s3://$BUCKET/$PREFIX/embed-snapshots/" --region ap-southeast-2 --no-progress
fi

# Base map PMTiles：上傳到 deploy-assets/base_map/ 子前綴（鏡像結構，pull 端整夾 sync）。
# 6 檔合計 ~406MB（行政邊界 3 + 等高線 2 + OSM 路網 1）。SSOT 在 taipei-gis-analytics。
for f in public/base_map/*.pmtiles; do
  [ -f "$f" ] || continue
  name=$(basename "$f")
  echo "Uploading base_map/$name..."
  aws s3 cp "$f" "s3://$BUCKET/$PREFIX/base_map/$name" --region ap-southeast-2
done

# 路況省道幾何 PMTiles：上傳到 deploy-assets/road/ 子前綴（鏡像結構，pull 端整夾 sync）。
# road_congestion_highway.pmtiles（省道 6818 段幾何，前端 setFeatureState 染色）。
# SSOT 在 taipei-gis-analytics（pipelines/transportation/road/06_export_highway_congestion_pmtiles.sh）。
for f in public/road/*.pmtiles; do
  [ -f "$f" ] || continue
  name=$(basename "$f")
  echo "Uploading road/$name..."
  aws s3 cp "$f" "s3://$BUCKET/$PREFIX/road/$name" --region ap-southeast-2
done

# 全球氣候 PMTiles：上傳到 deploy-assets/climate/ 子前綴（沙塵/海流/風場 PMTiles 切片）。
# 來源是 data-collectors 跑 CMEMS / CAMS / NOAA GFS 後產出的 .pmtiles。
# Collector PMTiles 生成管線尚未上線（plan-misty-fog P5.5），此 glob 先就位。
for f in public/climate/*.pmtiles; do
  [ -f "$f" ] || continue
  name=$(basename "$f")
  echo "Uploading climate/$name..."
  aws s3 cp "$f" "s3://$BUCKET/$PREFIX/climate/$name" --region ap-southeast-2
done

# 環境 raster PMTiles：上傳到 deploy-assets/environment/ 子前綴（鏡像結構，pull 端整夾 sync）。
# 目前是 urban_heat_lst_taiwan.pmtiles（都市熱島 LST 雙通道值編碼 RGBA，z6–11/512px）。
# SSOT 在 taipei-gis-analytics（pipelines/environment/urban_heat_lst/tile_lst_pmtiles.sh），
# 契約與量化參數見 taipei-gis-analytics/docs/handoff/urban_heat_lst.md。
for f in public/environment/*.pmtiles; do
  [ -f "$f" ] || continue
  name=$(basename "$f")
  echo "Uploading environment/$name..."
  aws s3 cp "$f" "s3://$BUCKET/$PREFIX/environment/$name" --region ap-southeast-2
done

# 房地產 PMTiles：上傳到 deploy-assets/coverage/ 子前綴（鏡像結構，pull 端整夾 sync）。
# 只上傳 real_estate_*（26+43MB 大檔走 S3）；gas coverage 小檔（5MB）仍進 git/dist，不上傳。
for f in public/coverage/real_estate_*.pmtiles; do
  [ -f "$f" ] || continue
  name=$(basename "$f")
  echo "Uploading coverage/$name..."
  aws s3 cp "$f" "s3://$BUCKET/$PREFIX/coverage/$name" --region ap-southeast-2
done

# 靜態化 RPC 快照：上傳到 deploy-assets/static-rpc/ 子前綴（鏡像結構，pull 端整夾 sync）
# 見 docs/features/static-to-cdn。新增靜態層跑 export 後直接 upload，免改本腳本。
# ⚠️ owner-gated：以下 12 支快照刻意不上傳（改走 owner-only 直連 RPC，斷 prod CDN 供應）。
#    見 docs/features/owner-gated-layers。get_gas_station_layers 仍為公開，照常上傳。
STATIC_RPC_GATED_EXCLUDE=(
  "get_fossil_fuel_layers.json"
  "get_fossil_fuel_infrastructure.json"
  "get_osm_substations.json"
  "get_osm_power_lines.json"
  "get_osm_power_towers.json"
  "get_ssot_facilities_primary_operating.json"
  "get_ssot_facilities_planned.json"
  "get_ssot_facilities_historical.json"
  "get_ssot_facilities_secondary_small.json"
  "get_ssot_facilities_osm_supplement.json"
  "get_osm_power_plants_static.json"
  "get_ssot_facilities_offshore_zones.json"
)
for f in public/static-rpc/*.json; do
  [ -f "$f" ] || continue
  name=$(basename "$f")
  skip=""
  for ex in "${STATIC_RPC_GATED_EXCLUDE[@]}"; do
    [ "$name" = "$ex" ] && { skip=1; break; }
  done
  [ -n "$skip" ] && { echo "Skipping owner-gated static-rpc/$name (不上傳)"; continue; }
  echo "Uploading static-rpc/$name..."
  aws s3 cp "$f" "s3://$BUCKET/$PREFIX/static-rpc/$name" --region ap-southeast-2
done

# Rail 個別檔案（打包成 tar.gz 上傳）
if [ -d "public/rail" ]; then
  echo "Packing public/rail/ → rail.tar.gz..."
  tar -czf /tmp/rail.tar.gz -C public rail
  echo "Uploading rail.tar.gz..."
  aws s3 cp /tmp/rail.tar.gz "s3://$BUCKET/$PREFIX/rail.tar.gz" --region ap-southeast-2
  rm /tmp/rail.tar.gz
fi

# 公車大檔路線 JSON（gitignore 的四份：taipei 18MB、intercity 87MB、pingtungcounty 16MB、tourist_shuttle 6.7MB）
# 小檔（newtaipei / taoyuan / taichung / tainan / kaohsiung / 其餘縣市）仍進 git，不透過 S3
BUS_BIG_FILES=(
  "public/bus/taipei_bus_routes.json"
  "public/bus/intercity_bus_routes.json"
  "public/bus/pingtungcounty_bus_routes.json"
  "public/bus/tourist_shuttle_routes.json"
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

# 觀光圖層：上傳到 deploy-assets/tourism/ 子前綴（鏡像結構，pull 端整夾 sync）
# 只上傳 D 類 3 大檔（景點 4.4MB + 旅宿 6.7MB + 餐飲 2.1MB）；其餘 9 檔 C 類進 git/dist，不上傳。
TOURISM_FILES=(
  "public/tourism/attractions_national.geojson"
  "public/tourism/hotels_national.geojson"
  "public/tourism/restaurants_national.geojson"
)
for f in "${TOURISM_FILES[@]}"; do
  name=$(basename "$f")
  if [ ! -f "$f" ]; then
    echo "Skipping tourism/$name (file not found: $f)"
    continue
  fi
  echo "Uploading tourism/$name..."
  aws s3 cp "$f" "s3://$BUCKET/$PREFIX/tourism/$name" --region ap-southeast-2
done

echo "Done!"
