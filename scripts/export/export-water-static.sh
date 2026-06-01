#!/usr/bin/env bash
# 從 Supabase 匯出水資源靜態資料 → public/geo/water_*.geojson
#
# 需要環境變數: SUPABASE_DB_URL
# 用法: bash scripts/export/export-water-static.sh

set -euo pipefail

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ROOT_DIR="$( cd "$SCRIPT_DIR/../.." && pwd )"
OUT_DIR="$ROOT_DIR/public/geo"

# 從 .env 直接讀取 SUPABASE_DB_URL（避免特殊字元的 source 問題）
if [ -z "${SUPABASE_DB_URL:-}" ] && [ -f "$ROOT_DIR/.env" ]; then
  SUPABASE_DB_URL=$(grep -E '^SUPABASE_DB_URL=' "$ROOT_DIR/.env" | head -1 | cut -d= -f2-)
  export SUPABASE_DB_URL
fi

if [ -z "${SUPABASE_DB_URL:-}" ]; then
  echo "[ERR] SUPABASE_DB_URL not set" >&2
  exit 1
fi

mkdir -p "$OUT_DIR"

# ── Graceful shutdown: kill 時往 child psql 送 SIGTERM，讓連線走 FIN 歸還 pool ──
cleanup () {
  local exit_code=$?
  if [ -n "${CURRENT_PSQL_PID:-}" ] && kill -0 "$CURRENT_PSQL_PID" 2>/dev/null; then
    echo "" >&2
    echo "[INT] Gracefully terminating psql pid=$CURRENT_PSQL_PID" >&2
    kill -TERM "$CURRENT_PSQL_PID" 2>/dev/null || true
    # 最多等 5 秒讓 TCP FIN 完成
    for _ in 1 2 3 4 5; do
      kill -0 "$CURRENT_PSQL_PID" 2>/dev/null || break
      sleep 1
    done
  fi
  exit "$exit_code"
}
trap cleanup EXIT INT TERM

# 每筆查詢設 120s statement_timeout，超過自動取消（避免 jsonb_agg 無限堆積）
PSQL_OPTS=(-At -v ON_ERROR_STOP=1)
PSQL_SET="SET statement_timeout='120s'; SET idle_in_transaction_session_timeout='60s';"

run_export () {
  local filename="$1"
  local label="$2"
  local sql="$3"
  local out="$OUT_DIR/$filename"
  local t0
  t0=$(date +%s)
  printf "[RUN] %-40s " "$label"
  psql "$SUPABASE_DB_URL" "${PSQL_OPTS[@]}" -c "$PSQL_SET $sql" > "$out" &
  CURRENT_PSQL_PID=$!
  wait "$CURRENT_PSQL_PID" || { echo "FAILED"; return 1; }
  CURRENT_PSQL_PID=""
  local size
  size=$(wc -c < "$out" | awk '{printf "%.0f", $1/1024}')
  local ms=$(( $(date +%s) - t0 ))
  echo "${size} KB, ${ms}s"
}

# ── 1. 流域 (river_basins) ──
run_export "water_basins.geojson" "流域" "
SELECT jsonb_build_object(
  'type','FeatureCollection',
  'features', COALESCE(jsonb_agg(feat),'[]'::jsonb)
) FROM (
  SELECT jsonb_build_object(
    'type','Feature','id',id,
    'geometry', ST_AsGeoJSON(ST_Force2D(geom))::jsonb,
    'properties', jsonb_build_object(
      'basin_no',basin_no,'basin_name',basin_name,'area_km2',area_km2)
  ) AS feat
  FROM public.river_basins WHERE geom IS NOT NULL
) s;"

# ── 2a. 河道多邊形 (river_polygons) — 13,262 筆，補齊支流河床面 ──
run_export "water_river_polygons.geojson" "河道多邊形" "
SELECT jsonb_build_object(
  'type','FeatureCollection',
  'features', COALESCE(jsonb_agg(feat),'[]'::jsonb)
) FROM (
  SELECT jsonb_build_object(
    'type','Feature','id',id,
    'geometry', ST_AsGeoJSON(ST_Force2D(ST_SimplifyPreserveTopology(geom, 0.0001)))::jsonb,
    'properties', jsonb_build_object('river_name',river_name,'river_type',river_type)
  ) AS feat
  FROM public.river_polygons WHERE geom IS NOT NULL
) s;"

# ── 2b. 河川線 (river_lines) — 2,015 筆中央管主流 ──
run_export "water_rivers.geojson" "河川線" "
SELECT jsonb_build_object(
  'type','FeatureCollection',
  'features', COALESCE(jsonb_agg(feat),'[]'::jsonb)
) FROM (
  SELECT jsonb_build_object(
    'type','Feature','id',id,
    'geometry', ST_AsGeoJSON(ST_Force2D(ST_SimplifyPreserveTopology(geom, 0.00005)))::jsonb,
    'properties', jsonb_build_object(
      'river_name',river_name,'river_type',river_type,'river_code',river_code)
  ) AS feat
  FROM public.river_lines WHERE geom IS NOT NULL
) s;"

# ── 2c. 堤防 (river_levees) — 4,223 筆防洪骨架 ──
run_export "water_levees.geojson" "堤防" "
SELECT jsonb_build_object(
  'type','FeatureCollection',
  'features', COALESCE(jsonb_agg(feat),'[]'::jsonb)
) FROM (
  SELECT jsonb_build_object(
    'type','Feature','id',id,
    'geometry', ST_AsGeoJSON(ST_Force2D(ST_SimplifyPreserveTopology(geom, 0.00005)))::jsonb,
    'properties', jsonb_build_object(
      'name',name,'levee_type',levee_type,'status',status,
      'river',river,'basin',basin,'county',county,'side',side,
      'length_m',length_m)
  ) AS feat
  FROM public.river_levees
  WHERE geom IS NOT NULL AND status <> '已滅失'
) s;"

# ── 3. 渠道 (宜蘭 ia_yilan) ──
run_export "water_canals.geojson" "渠道 (宜蘭)" "
SELECT jsonb_build_object(
  'type','FeatureCollection',
  'features', COALESCE(jsonb_agg(feat),'[]'::jsonb)
) FROM (
  SELECT jsonb_build_object(
    'type','Feature','id',id,
    'geometry', ST_AsGeoJSON(ST_Force2D(ST_SimplifyPreserveTopology(geom, 0.00005)))::jsonb,
    'properties', jsonb_build_object('source',source)
  ) AS feat
  FROM public.irrigation_canals
  WHERE geom IS NOT NULL AND source='ia_yilan'
) s;"

# ── 4. 水庫蓄水範圍 (reservoir_storage) ──
# LEFT JOIN reference.reservoir_geometry 把 compare_id 打進 properties
# 88/129 能 match（其他 41 筆為副池/無主要水庫對應，compare_id = null）
# 前端可憑 compare_id 打 get_reservoir_context RPC 取得水情+集水區+流域+河川
run_export "water_reservoirs.geojson" "水庫蓄水範圍" "
SELECT jsonb_build_object(
  'type','FeatureCollection',
  'features', COALESCE(jsonb_agg(feat),'[]'::jsonb)
) FROM (
  SELECT jsonb_build_object(
    'type','Feature','id',rs.id,
    'geometry', ST_AsGeoJSON(ST_Force2D(rs.geom))::jsonb,
    'properties', jsonb_build_object(
      'name',rs.name,'reservoir_name',rs.reservoir_name,'storage_area',rs.storage_area,
      'compare_id', NULLIF(g.compare_id, 0))
  ) AS feat
  FROM public.reservoir_storage rs
  LEFT JOIN reference.reservoir_geometry g ON g.res_name = rs.name
  WHERE rs.geom IS NOT NULL
) s;"

# ── 5. 壩體 + 水庫點位 ──
run_export "water_dams.geojson" "壩體 + 水庫點位" "
-- dam_weirs_wra 源檔 SWRESOIR 是 Big5 被當 UTF-8 匯入，中文全糊。
-- 透過 name_en → 手動中文映射補救；無 name_en 的 12 筆以 '(未登錄名稱)' 顯示。
-- water_reservoirs 是乾淨 UTF-8 的 40 筆，保留原中文當代表點。
WITH cht_map(name_en, name_cht) AS (VALUES
  ('Shinshan Reservoir','新山水庫'),
  ('Shishih Reservoir','西勢水庫'),
  ('Chingtan Weir','青潭堰'),
  ('Feitsui Reservoir','翡翠水庫'),
  ('Shihmen Reservoir','石門水庫'),
  ('Paoshan Reservoir','寶山水庫'),
  ('Ronghua Dam','榮華壩'),
  ('Tapu Reservoir','大埔水庫'),
  ('Yongheshan Reservoir','永和山水庫'),
  ('Chientan Reservoir','劍潭水庫'),
  ('Mingde Reservoir','明德水庫'),
  ('Lyiutan Reservoir','鯉魚潭水庫'),
  ('Shihkang Dam','石岡壩'),
  ('Techi Reservoir','德基水庫'),
  ('Kukuan Reservoir','谷關水庫'),
  ('Wushoh Reservoir','霧社水庫'),
  ('Toushih Reservoir','頭社水庫'),
  ('Sunmoon Lake','日月潭'),
  ('Chengong Reservoir','成功水庫'),
  ('Dongwei Reservoir','東衛水庫'),
  ('Shingren Reservoir','興仁水庫'),
  ('Lantan Reservoir','蘭潭水庫'),
  ('Jenitan Reservoir','仁義潭水庫'),
  ('Paiho Reservoir','白河水庫'),
  ('Teyuanpi Reservoir','德元埤水庫'),
  ('Chienranpei Reservoir','尖山埤水庫'),
  ('Tsengwen Reservoir','曾文水庫'),
  ('Wushantou Reservoir','烏山頭水庫'),
  ('Nanhwa Reservoir','南化水庫'),
  ('Chingmein Reservoir','鏡面水庫'),
  ('Hutoupi Reservoir','虎頭埤水庫'),
  ('Akongtien Reservoir','阿公店水庫'),
  ('Chengchinghu Reservoir','澄清湖水庫'),
  ('Fengshan Reservoir','鳳山水庫'),
  ('Mudan Reservoir','牡丹水庫'),
  ('Lungluantan Reservoir','龍鑾潭'),
  ('Zhitan Dam','直潭壩'),
  ('Chingshan Dam','青山壩'),
  ('Tienlun Dam','天輪壩'),
  ('Wujie Dam','武界壩'),
  ('Minghu Reservoir','明湖水庫'),
  ('Chipan Dam','溪畔壩'),
  ('Chimei Reservoir','七美水庫'),
  ('Shian Reservoir','西安水庫'),
  ('Yuanshan Weir','圓山堰'),
  ('Maan Dam','馬鞍壩'),
  ('Chichi Weir','集集攔河堰'),
  ('Kaopinshi Weir','高屏溪攔河堰'),
  ('Luliaoshi Reservoir','鹿寮溪水庫'),
  ('Neiputzu Reservoir','內埔仔水庫'),
  ('Shiaochi Reservoir','小池水庫'),
  ('Ayu Dam','阿玉壩'),
  ('Lohao Dam','羅好壩'),
  ('Chukeng Dam','粗坑壩'),
  ('Kueishan Dam','龜山壩'),
  ('Tunghuei Dam','東惠壩'),
  ('Lungshi Dam','龍溪壩'),
  ('Shuilien Dam','水簾壩'),
  ('Chouchin Reservoir','周津水庫'),
  ('Wugou Dam','五溝壩'),
  ('Tungkangshi Weir','東港溪堰'),
  ('Lonen Weir','羅恩堰')
)
SELECT jsonb_build_object(
  'type','FeatureCollection',
  'features', COALESCE(jsonb_agg(feat),'[]'::jsonb)
) FROM (
  -- dams：cht_map → reference.reservoir_geometry 兩層 JOIN 拿 compare_id
  SELECT jsonb_build_object(
    'type','Feature','id','dam:'||d.id,
    'geometry', ST_AsGeoJSON(ST_Force2D(d.geom))::jsonb,
    'properties', jsonb_build_object(
      'kind','dam',
      'name', COALESCE(m.name_cht, NULLIF(d.name_en,''), '(未登錄名稱)'),
      'name_en', d.name_en,
      'capacity_m3', d.capacity_m3,
      'dam_height_m', d.dam_height_m,
      -- is_reservoir：名稱結尾是「水庫」（壩/堰/潭排除）
      'is_reservoir', (COALESCE(m.name_cht,'') LIKE '%水庫'),
      'compare_id', NULLIF(g.compare_id, 0))
  ) AS feat
  FROM public.dam_weirs_wra d
  LEFT JOIN cht_map m ON m.name_en = d.name_en
  LEFT JOIN reference.reservoir_geometry g ON g.res_name = m.name_cht
  WHERE d.geom IS NOT NULL
  UNION ALL
  -- reservoir points：public.water_reservoirs.id 等同 reference.reservoir_geometry.compare_id
  -- （collector 已改為從 reference 同步，見 migration 048）
  SELECT jsonb_build_object(
    'type','Feature','id','reservoir:'||id,
    'geometry', ST_AsGeoJSON(ST_SetSRID(ST_MakePoint(lng, lat), 4326))::jsonb,
    'properties', jsonb_build_object(
      'kind','reservoir',
      'name',name,
      'basin_name',basin_name,
      'river_name',river_name,
      'design_capacity_wan',design_capacity_wan,
      'effective_capacity_wan',effective_capacity_wan,
      -- 統一單位：萬 m³ × 10000 → m³
      'capacity_m3', COALESCE(effective_capacity_wan, design_capacity_wan, 0) * 10000,
      'is_reservoir', (name LIKE '%水庫'),
      'compare_id', CASE WHEN id ~ '^[0-9]+\$' AND id::integer > 0 THEN id::integer ELSE NULL END)
  ) AS feat
  FROM public.water_reservoirs WHERE lat IS NOT NULL AND lng IS NOT NULL
) s;"

# ── 5b. 水資源管制區 (水源保護區 + 地下水管制區，合併 128 polygon) ──
# zone_kind 分 4 種：protection / groundwater_control_2 / groundwater_control_1 / groundwater_region
# groundwater region polygon 有 33 萬點，用 0.001 (~110m) 積極 simplify；protection 用 0.0001 (~11m)
run_export "water_protection_zones.geojson" "水資源管制區" "
SELECT jsonb_build_object(
  'type','FeatureCollection',
  'features', COALESCE(jsonb_agg(feat),'[]'::jsonb)
) FROM (
  SELECT jsonb_build_object(
    'type','Feature','id','wpz:'||id,
    'geometry', ST_AsGeoJSON(ST_Force2D(ST_SimplifyPreserveTopology(geom, 0.0001)))::jsonb,
    'properties', jsonb_build_object(
      'zone_kind','protection',
      'name',name,'zone',zone,'law_ref',law_ref)
  ) AS feat
  FROM public.water_protection_zones WHERE geom IS NOT NULL
  UNION ALL
  SELECT jsonb_build_object(
    'type','Feature','id','gwz:'||id,
    'geometry', ST_AsGeoJSON(ST_Force2D(ST_SimplifyPreserveTopology(geom, 0.001)))::jsonb,
    'properties', jsonb_build_object(
      'zone_kind','groundwater_'||zone_type,
      'name',zone_name,'zone_no',zone_no)
  ) AS feat
  FROM public.groundwater_zones WHERE geom IS NOT NULL
) s;"

# ── 6. 水利設施 (water_facilities) ──
run_export "water_facilities.geojson" "水利設施" "
SELECT jsonb_build_object(
  'type','FeatureCollection',
  'features', COALESCE(jsonb_agg(feat),'[]'::jsonb)
) FROM (
  SELECT jsonb_build_object(
    'type','Feature','id',id,
    'geometry', ST_AsGeoJSON(ST_Force2D(geom))::jsonb,
    'properties', jsonb_build_object(
      'name',name,'facility_type',facility_type,
      'source',source,'county',county,'operator',operator)
  ) AS feat
  FROM public.water_facilities WHERE geom IS NOT NULL
) s;"

# ── 7.5. 淹水潛勢 (flood_hazard_zones, 650mm/24hr) ──
# 2356 polygon jsonb_agg 會 OOM，改用 \copy stream 逐筆 JSONL 再用 jq 組裝
run_flood_stream () {
  local out="$OUT_DIR/water_flood_extreme.geojson"
  local tmp="$OUT_DIR/.water_flood_extreme.jsonl"
  local t0
  t0=$(date +%s)
  printf "[RUN] %-40s " "淹水潛勢 (650mm/24hr stream)"
  # 用 server-side COPY TO STDOUT（能與 SET statement_timeout 放同一 -c）
  psql "$SUPABASE_DB_URL" "${PSQL_OPTS[@]}" -c "
$PSQL_SET
COPY (
  SELECT jsonb_build_object(
    'type','Feature','id',id,
    'geometry', ST_AsGeoJSON(ST_Force2D(ST_SimplifyPreserveTopology(geom, 0.0001)))::jsonb,
    'properties', jsonb_build_object('depth_class',flood_depth_class,'county',county)
  )::text
  FROM public.flood_hazard_zones
  WHERE geom IS NOT NULL AND scenario='flood_650mm_24hr'
) TO STDOUT
" > "$tmp" &
  CURRENT_PSQL_PID=$!
  wait "$CURRENT_PSQL_PID" || { echo "FAILED"; return 1; }
  CURRENT_PSQL_PID=""
  # 包成 FeatureCollection
  {
    echo -n '{"type":"FeatureCollection","features":['
    paste -sd',' "$tmp"
    echo ']}'
  } > "$out"
  rm -f "$tmp"
  local size
  size=$(wc -c < "$out" | awk '{printf "%.0f", $1/1024}')
  local ms=$(( $(date +%s) - t0 ))
  echo "${size} KB, ${ms}s"
}
run_flood_stream

# ── 8. 監測站 (water_monitoring_stations) ──
run_export "water_monitor_stations.geojson" "監測站" "
SELECT jsonb_build_object(
  'type','FeatureCollection',
  'features', COALESCE(jsonb_agg(feat),'[]'::jsonb)
) FROM (
  SELECT jsonb_build_object(
    'type','Feature','id',id,
    'geometry', ST_AsGeoJSON(ST_Force2D(geom))::jsonb,
    'properties', jsonb_build_object(
      'name',name,'station_type',station_type,
      'source',source,'county',county,'is_active',is_active)
  ) AS feat
  FROM public.water_monitoring_stations WHERE geom IS NOT NULL
) s;"

# ── 9. 滯洪池 (detention_basins) — water-extensions v2 ──
# 140 筆中 56 筆有 geom（taoyuan 11/11, tainan 45/45 完整；其他縣市 0% 待補）
# basin_type: detention / science_park
run_export "water_detention_basins.geojson" "滯洪池" "
SELECT jsonb_build_object(
  'type','FeatureCollection',
  'features', COALESCE(jsonb_agg(feat),'[]'::jsonb)
) FROM (
  SELECT jsonb_build_object(
    'type','Feature','id',id,
    'geometry', ST_AsGeoJSON(ST_Force2D(geom))::jsonb,
    'properties', jsonb_build_object(
      'name',name,'county',county,'township',township,
      'address',address,'agency',agency,'basin_type',basin_type,
      'area_m2',area_m2,'area_ha',(metadata->>'area_ha')::numeric,
      'designed_volume_m3',designed_volume_m3,
      'current_volume_m3',current_volume_m3,
      'max_depth_m',max_depth_m,
      'status',status,'source',source)
  ) AS feat
  FROM public.detention_basins WHERE geom IS NOT NULL
) s;"

echo ""
echo "[DONE] Files in $OUT_DIR"
ls -lh "$OUT_DIR"/water_*.geojson 2>/dev/null | awk '{print "  " $5 "  " $9}'
