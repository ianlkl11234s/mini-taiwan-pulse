#!/bin/sh
# 從 S3 同步資料到 /data/（container 內由 entrypoint.sh 呼叫）
# 需要環境變數：S3_ACCESS_KEY, S3_SECRET_KEY, S3_REGION, S3_BUCKET
#
# 2026-06 改版：全面改用 `aws s3 sync`（取代逐檔 cp）。
#   → volume 已有且未變的檔自動跳過，不重複下載（重啟幾乎零流量）。
#   → 加新大檔多數情況不用改本腳本（water_*/fire_* glob、agriculture/ 整夾）。
# 注意：目前 S3 deploy-assets/ 仍是「扁平」結構（檔名直接放根目錄），
#   故 geo/h3 用 --include filter 把扁平檔同步進對應 /data 子目錄。
#   未來搬成「鏡像結構」後可簡化為整夾 sync（見 docs/launch/06_DEPLOY_ASSETS_MIGRATION.md）。

export AWS_ACCESS_KEY_ID="$S3_ACCESS_KEY"
export AWS_SECRET_ACCESS_KEY="$S3_SECRET_KEY"
export AWS_DEFAULT_REGION="${S3_REGION:-ap-southeast-2}"

BUCKET="${S3_BUCKET:-migu-gis-data-collector}"
PREFIX="deploy-assets"
DATA_DIR="/data"
S3="s3://$BUCKET/$PREFIX"
CACHE="$DATA_DIR/.cache"
mkdir -p "$DATA_DIR" "$DATA_DIR/geo" "$DATA_DIR/h3" "$DATA_DIR/bus" "$DATA_DIR/fire" "$DATA_DIR/medical" "$DATA_DIR/agriculture" "$DATA_DIR/business_registry" "$DATA_DIR/industrial_zone" "$DATA_DIR/sports" "$DATA_DIR/flood" "$DATA_DIR/forestry" "$DATA_DIR/fishery" "$DATA_DIR/coverage" "$DATA_DIR/base_map" "$DATA_DIR/climate" "$DATA_DIR/static-rpc" "$DATA_DIR/water_resources" "$DATA_DIR/urban" "$DATA_DIR/road" "$DATA_DIR/culture" "$DATA_DIR/civic_facilities" "$DATA_DIR/hazards" "$DATA_DIR/environment" "$DATA_DIR/poi" "$DATA_DIR/world" "$DATA_DIR/tourism" "$DATA_DIR/religion" "$DATA_DIR/funeral" "$DATA_DIR/welfare" "$DATA_DIR/education" "$DATA_DIR/embed-snapshots" "$DATA_DIR/embed-rail" "$DATA_DIR/global-maritime/gfw-hourly" "$CACHE"

echo "[pull] sync root json → $DATA_DIR/"
aws s3 sync "$S3/" "$DATA_DIR/" --no-progress \
  --exclude "*" --include "aviation_data.json" --include "ship_data.json"

echo "[pull] sync geo → $DATA_DIR/geo/（扁平 S3 + include filter）"
aws s3 sync "$S3/" "$DATA_DIR/geo/" --no-progress --exclude "*" \
  --include "provincial_road.geojson" --include "national_highway.geojson" \
  --include "bus_stations_city.geojson" --include "bus_stations_intercity.geojson" \
  --include "bike_stations.geojson" --include "cycling_routes.geojson" \
  --include "freeway_congestion.geojson" --include "weather_stations.geojson" \
  --include "convenience_stores.geojson" \
  --include "active_faults.geojson" \
  --include "water_*.geojson" --include "water_*.pmtiles" --include "fire_*.geojson" \
  --include "medical_*.geojson"

# PT-1 PMTiles（geo 鏡像子前綴 deploy-assets/geo/）→ /data/geo/（前端請求 /geo/*.pmtiles）
# 與上方扁平 geojson include-filter 並存；aws s3 sync 非破壞（無 --delete），兩者同進 /data/geo/ 不衝突。
# national_highway / provincial_road / bus_stations_city / fire_hydrants / medical_{clinics,pharmacies,aed,ltc} + water_*
echo "[pull] sync geo pmtiles → $DATA_DIR/geo/"
aws s3 sync "$S3/geo/" "$DATA_DIR/geo/" --no-progress

echo "[pull] sync h3 → $DATA_DIR/h3/"
aws s3 sync "$S3/" "$DATA_DIR/h3/" --no-progress --exclude "*" --include "h3_*_res8.json"

# 消防等時圈 PMTiles → /data/fire/
# ⚠️ aws s3 sync 是遞迴的，--include "*.pmtiles" 會連 agriculture/ 子前綴的 pmtiles 都抓，
#    必須用 --exclude "agriculture/*" 排除（否則農業 pmtiles 會被灌進 /data/fire/agriculture/）。
#    未來新增其他「含 pmtiles 的子前綴」也要在此比照排除；搬成鏡像結構後本行可簡化（見 06 搬家計畫）。
echo "[pull] sync fire pmtiles → $DATA_DIR/fire/"
aws s3 sync "$S3/" "$DATA_DIR/fire/" --no-progress --exclude "*" --include "*.pmtiles" --exclude "agriculture/*" --exclude "business_registry/*" --exclude "industrial_zone/*" --exclude "medical/*" --exclude "flood/*" --exclude "forestry/*" --exclude "fishery/*" --exclude "coverage/*" --exclude "base_map/*" --exclude "geo/*" --exclude "road/*" --exclude "urban/*" --exclude "water_*.pmtiles"

# 醫療：鏡像子前綴 deploy-assets/medical/ → /data/medical/（基礎點位 + 等時圈 PMTiles）
echo "[pull] sync medical → $DATA_DIR/medical/"
aws s3 sync "$S3/medical/" "$DATA_DIR/medical/" --no-progress

# 農業：鏡像子前綴 deploy-assets/agriculture/ → /data/agriculture/（整夾 sync，加新檔免改腳本）
# ⚠️ owner-gated：livestock_farms.geojson / slaughterhouses.geojson 改走 owner-only RPC → 排除 +
#    rm -f 清掉既有 volume 殘留舊檔（防繼續供應）。見 docs/features/owner-gated-layers。
echo "[pull] sync agriculture → $DATA_DIR/agriculture/"
aws s3 sync "$S3/agriculture/" "$DATA_DIR/agriculture/" --no-progress \
  --exclude "livestock_farms.geojson" --exclude "slaughterhouses.geojson"
rm -f "$DATA_DIR/agriculture/livestock_farms.geojson" "$DATA_DIR/agriculture/slaughterhouses.geojson"

# 工商登記：版本化 GeoJSON / PMTiles → /data/business_registry/（dated filename 不覆寫舊版）
echo "[pull] sync business_registry → $DATA_DIR/business_registry/"
aws s3 sync "$S3/business_registry/" "$DATA_DIR/business_registry/" --no-progress

# 產業園區：版本化 PMTiles → /data/industrial_zone/（dated filename 不覆寫舊版）
echo "[pull] sync industrial_zone → $DATA_DIR/industrial_zone/"
aws s3 sync "$S3/industrial_zone/" "$DATA_DIR/industrial_zone/" --no-progress

# 🏟️ 運動場館：鏡像子前綴 deploy-assets/sports/ → /data/sports/（整夾 sync，加新檔免改腳本）
echo "[pull] sync sports → $DATA_DIR/sports/"
aws s3 sync "$S3/sports/" "$DATA_DIR/sports/" --no-progress

# 🎓 教育：鏡像子前綴 deploy-assets/education/ → /data/education/（整夾 sync，加新檔免改腳本）
# schools.geojson 2.5MB（6 個點層共用）＋ campus_polygon.pmtiles 4.4MB，兩者皆 gitignore 純走 S3
echo "[pull] sync education → $DATA_DIR/education/"
aws s3 sync "$S3/education/" "$DATA_DIR/education/" --no-progress

# 林業：鏡像子前綴 deploy-assets/forestry/ → /data/forestry/（整夾 sync，加新檔免改腳本）
# 2026-06-10 補：FOREST_FILES 上傳端 6/7 就有、pull 端漏寫 → 容器 /forestry/ 大檔 404
echo "[pull] sync forestry → $DATA_DIR/forestry/"
aws s3 sync "$S3/forestry/" "$DATA_DIR/forestry/" --no-progress

# 養殖漁業：鏡像子前綴 deploy-assets/fishery/ → /data/fishery/（ponds/衛星偵測 PMTiles 大檔；生產區/箱網 geojson 小檔在 dist fallback）
echo "[pull] sync fishery → $DATA_DIR/fishery/"
aws s3 sync "$S3/fishery/" "$DATA_DIR/fishery/" --no-progress

# 水資源：鏡像子前綴 deploy-assets/water_resources/ → /data/water_resources/（湖泊/埤塘 PMTiles，整夾 sync，加新檔免改腳本）
echo "[pull] sync water_resources → $DATA_DIR/water_resources/"
aws s3 sync "$S3/water_resources/" "$DATA_DIR/water_resources/" --no-progress

# 都市開放空間：鏡像子前綴 deploy-assets/urban/ → /data/urban/（台北行道樹變化 PMTiles，整夾 sync，加新檔免改腳本）
echo "[pull] sync urban → $DATA_DIR/urban/"
aws s3 sync "$S3/urban/" "$DATA_DIR/urban/" --no-progress

# 藝文文化：鏡像子前綴 deploy-assets/culture/ → /data/culture/（目前 4 檔全 git 管理走 dist fallback，S3 前綴空 = no-op；保留同構以備未來大檔）
echo "[pull] sync culture → $DATA_DIR/culture/"
aws s3 sync "$S3/culture/" "$DATA_DIR/culture/" --no-progress

# 宗教：鏡像子前綴 deploy-assets/religion/ → /data/religion/（temples PMTiles + 4 GeoJSON
# 目前全 git 管理走 dist fallback，S3 前綴空 = no-op；保留同構以備未來大檔）
echo "[pull] sync religion → $DATA_DIR/religion/"
aws s3 sync "$S3/religion/" "$DATA_DIR/religion/" --no-progress

# 殯葬：鏡像子前綴 deploy-assets/funeral/ → /data/funeral/（5 檔 5.77MB 目前全 git 管理走
# dist fallback，S3 前綴空 = no-op；保留同構以備未來大檔，同 religion 慣例）
echo "[pull] sync funeral → $DATA_DIR/funeral/"
aws s3 sync "$S3/funeral/" "$DATA_DIR/funeral/" --no-progress
# 社福長照：鏡像子前綴 deploy-assets/welfare/ → /data/welfare/（9 檔 5.4MB 目前全 git 管理走
# dist fallback，S3 前綴空 = no-op；保留同構以備未來大檔，同 funeral 慣例）
echo "[pull] sync welfare → $DATA_DIR/welfare/"
aws s3 sync "$S3/welfare/" "$DATA_DIR/welfare/" --no-progress
# 災害：鏡像子前綴 deploy-assets/hazards/ → /data/hazards/（山域事故 geojson 全 git 管理走 dist
# fallback，S3 前綴空 = no-op；保留同構以備未來大檔，同 civic_facilities 慣例）
echo "[pull] sync hazards → $DATA_DIR/hazards/"
aws s3 sync "$S3/hazards/" "$DATA_DIR/hazards/" --no-progress

# 公共設施：鏡像子前綴 deploy-assets/civic_facilities/ → /data/civic_facilities/（geojson 全 git 管理走 dist fallback，S3 前綴空 = no-op；保留同構以備未來大檔）
echo "[pull] sync civic_facilities → $DATA_DIR/civic_facilities/"
aws s3 sync "$S3/civic_facilities/" "$DATA_DIR/civic_facilities/" --no-progress

# 環境：鏡像子前綴 deploy-assets/environment/ → /data/environment/（public_toilets geojson git 管理走 dist fallback，S3 前綴空 = no-op；保留同構以備未來大檔）
echo "[pull] sync environment → $DATA_DIR/environment/"
aws s3 sync "$S3/environment/" "$DATA_DIR/environment/" --no-progress

# POI：鏡像子前綴 deploy-assets/poi/ → /data/poi/（geojson 全 git 管理走 dist fallback，S3 前綴空 = no-op；保留同構以備未來大檔）
echo "[pull] sync poi → $DATA_DIR/poi/"
aws s3 sync "$S3/poi/" "$DATA_DIR/poi/" --no-progress

# 🌍 世界 World：鏡像子前綴 deploy-assets/world/ → /data/world/（Outerview 全球垃圾殘骸 GeoJSON 3.8MB）
echo "[pull] sync world → $DATA_DIR/world/"
aws s3 sync "$S3/world/" "$DATA_DIR/world/" --no-progress

# GFW immutable daily/hourly releases 先 sync，root manifest 最後才以 tmp+mv 原子切換。
# 不加 --delete：release retention 切換時允許容器短暫保留舊 release，
# 避免拿到舊 manifest 的讀者遇到 404。
echo "[pull] sync global-maritime/gfw-hourly → $DATA_DIR/global-maritime/gfw-hourly/"
aws s3 sync "$S3/global-maritime/gfw-hourly/" "$DATA_DIR/global-maritime/gfw-hourly/" \
  --no-progress --exclude "manifest.json" --exclude "v3-shadow/manifest.json"
if aws s3 cp "$S3/global-maritime/gfw-hourly/manifest.json" \
  "$DATA_DIR/global-maritime/gfw-hourly/manifest.json.tmp" --no-progress; then
  mv "$DATA_DIR/global-maritime/gfw-hourly/manifest.json.tmp" \
    "$DATA_DIR/global-maritime/gfw-hourly/manifest.json"
fi
# v3 shadow 與 canonical 共用 immutable release 同步順序；shadow 指標同樣最後 tmp+mv，
# 不能讓 runtime shadow 開關讀到一半新舊 release 的 manifest。
mkdir -p "$DATA_DIR/global-maritime/gfw-hourly/v3-shadow"
if aws s3 cp "$S3/global-maritime/gfw-hourly/v3-shadow/manifest.json" \
  "$DATA_DIR/global-maritime/gfw-hourly/v3-shadow/manifest.json.tmp" --no-progress; then
  mv "$DATA_DIR/global-maritime/gfw-hourly/v3-shadow/manifest.json.tmp" \
    "$DATA_DIR/global-maritime/gfw-hourly/v3-shadow/manifest.json"
fi

# 觀光：鏡像子前綴 deploy-assets/tourism/ → /data/tourism/（景點/旅宿/餐飲 D 類 3 大檔；其餘 9 檔 C 類在 dist fallback）
echo "[pull] sync tourism → $DATA_DIR/tourism/"
aws s3 sync "$S3/tourism/" "$DATA_DIR/tourism/" --no-progress

# 房地產：鏡像子前綴 deploy-assets/coverage/ → /data/coverage/（real_estate_* 大檔；gas 小檔在 dist fallback）
echo "[pull] sync coverage → $DATA_DIR/coverage/"
aws s3 sync "$S3/coverage/" "$DATA_DIR/coverage/" --no-progress

# EM-15 嵌入用歷史快照：整夾 sync（之後加新日期/新圖層零改腳本）
# EM-16 起本夾含 flights/ships/rail 的 `.json.gz`：S3 端**沒有** Content-Encoding metadata，
# 所以 sync 落地的就是原樣 gzip bytes（位元組保真），nginx 原封不動送給瀏覽器，前端自解。
echo "[pull] sync embed-snapshots → $DATA_DIR/embed-snapshots/"
aws s3 sync "$S3/embed-snapshots/" "$DATA_DIR/embed-snapshots/" --no-progress

# EM-16 嵌入用鐵路幾何 bundle：日期無關共用資產，整夾 sync
# 夾內是 rail_slim.<hash>.json.gz（內容雜湊檔名，nginx 給 immutable）+ rail-manifest.json
# （指標檔，nginx 給 max-age=60）。雜湊檔名對整夾 sync 零影響：新 hash 就是新 key。
# 同樣**不加 `--delete`**：volume 上留著舊 hash 檔，短快取期間拿著舊 manifest 的讀者才不會 404。
echo "[pull] sync embed-rail → $DATA_DIR/embed-rail/"
aws s3 sync "$S3/embed-rail/" "$DATA_DIR/embed-rail/" --no-progress

# Base map：鏡像子前綴 deploy-assets/base_map/ → /data/base_map/（行政邊界 + 等高線 + OSM 路網 PMTiles ~406MB）
echo "[pull] sync base_map → $DATA_DIR/base_map/"
aws s3 sync "$S3/base_map/" "$DATA_DIR/base_map/" --no-progress

# 路況省道幾何：鏡像子前綴 deploy-assets/road/ → /data/road/（road_congestion_highway.pmtiles，前端 feature-state 染色）
echo "[pull] sync road → $DATA_DIR/road/"
aws s3 sync "$S3/road/" "$DATA_DIR/road/" --no-progress

# 全球氣候：鏡像子前綴 deploy-assets/climate/ → /data/climate/（CMEMS / CAMS / NOAA GFS 衍生 PMTiles）
# Collector PMTiles 生成管線尚未上線，目前 S3 prefix 可能為空，sync 會 no-op。
echo "[pull] sync climate → $DATA_DIR/climate/"
aws s3 sync "$S3/climate/" "$DATA_DIR/climate/" --no-progress

# 靜態化 RPC 快照：鏡像子前綴 deploy-assets/static-rpc/ → /data/static-rpc/（整夾 sync，加新檔免改腳本）
# ⚠️ owner-gated：12 支快照改走 owner-only 直連 RPC → 排除 + rm -f 清既有 volume 殘留舊檔。
#    get_gas_station_layers 仍公開，照常 sync。見 docs/features/owner-gated-layers。
echo "[pull] sync static-rpc → $DATA_DIR/static-rpc/"
aws s3 sync "$S3/static-rpc/" "$DATA_DIR/static-rpc/" --no-progress \
  --exclude "get_fossil_fuel_layers.json" \
  --exclude "get_fossil_fuel_infrastructure.json" \
  --exclude "get_osm_substations.json" \
  --exclude "get_osm_power_lines.json" \
  --exclude "get_osm_power_towers.json" \
  --exclude "get_ssot_facilities_primary_operating.json" \
  --exclude "get_ssot_facilities_planned.json" \
  --exclude "get_ssot_facilities_historical.json" \
  --exclude "get_ssot_facilities_secondary_small.json" \
  --exclude "get_ssot_facilities_osm_supplement.json" \
  --exclude "get_osm_power_plants_static.json" \
  --exclude "get_ssot_facilities_offshore_zones.json"
for gated in \
  get_fossil_fuel_layers get_fossil_fuel_infrastructure get_osm_substations \
  get_osm_power_lines get_osm_power_towers get_ssot_facilities_primary_operating \
  get_ssot_facilities_planned get_ssot_facilities_historical get_ssot_facilities_secondary_small \
  get_ssot_facilities_osm_supplement get_osm_power_plants_static get_ssot_facilities_offshore_zones; do
  rm -f "$DATA_DIR/static-rpc/$gated.json"
done

# 淹水感測 isochrone：鏡像子前綴 deploy-assets/flood/ → /data/flood/
echo "[pull] sync flood → $DATA_DIR/flood/"
aws s3 sync "$S3/flood/" "$DATA_DIR/flood/" --no-progress

# 警政司法民防：鏡像子前綴 deploy-assets/police_justice/ → /data/police_justice/
# 19 個 dataset 子目錄（每 dataset 自帶 *_20260626.geojson + _manifest.json）+ 3 個 *.pmtiles
mkdir -p "$DATA_DIR/police_justice"
echo "[pull] sync police_justice → $DATA_DIR/police_justice/"
aws s3 sync "$S3/police_justice/" "$DATA_DIR/police_justice/" --no-progress

# Rail：tar.gz 同步到 cache，僅在 archive 有變時才重新解壓
echo "[pull] sync rail.tar.gz → cache"
aws s3 sync "$S3/" "$CACHE/" --no-progress --exclude "*" --include "rail.tar.gz"
if [ -f "$CACHE/rail.tar.gz" ]; then
  if [ ! -f "$DATA_DIR/rail/.extracted" ] || [ "$CACHE/rail.tar.gz" -nt "$DATA_DIR/rail/.extracted" ]; then
    echo "[pull] extracting rail.tar.gz → $DATA_DIR/rail/"
    mkdir -p "$DATA_DIR/rail"
    tar -xzf "$CACHE/rail.tar.gz" -C "$DATA_DIR"
    touch "$DATA_DIR/rail/.extracted"
  else
    echo "[pull] rail unchanged, skip extract"
  fi
fi

# 公車大檔：*.json.gz 同步到 cache，僅在有變時才重新 gunzip
echo "[pull] sync bus *.json.gz → cache"
aws s3 sync "$S3/" "$CACHE/" --no-progress --exclude "*" --include "*_bus_routes.json.gz" --include "tourist_shuttle_routes.json.gz"
for f in taipei_bus_routes.json intercity_bus_routes.json pingtungcounty_bus_routes.json tourist_shuttle_routes.json; do
  gz="$CACHE/$f.gz"
  if [ -f "$gz" ]; then
    if [ ! -f "$DATA_DIR/bus/$f" ] || [ "$gz" -nt "$DATA_DIR/bus/$f" ]; then
      echo "[pull] gunzip $f → $DATA_DIR/bus/"
      gunzip -c "$gz" > "$DATA_DIR/bus/$f"
    fi
  fi
done

echo "[pull] all assets synced to $DATA_DIR"
