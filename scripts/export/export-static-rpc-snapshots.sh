#!/usr/bin/env bash
# 匯出「參數無關的靜態 RPC」輸出成 JSON 快照 → public/static-rpc/<rpc>.json
#
# 目的：讓這些層改讀 CDN 靜態檔（staticRpc()），脫離前端併發排隊 + DB O(N) 負載。
#       見 docs/features/static-to-cdn/README.md
#
# 檔案內容 = RPC 的 JSON 輸出「原樣」（前端 loader 的 transform / popup / legend 不變）。
# 需要環境變數：SUPABASE_DB_URL（psql 直連）
# 用法：
#   bash scripts/export/export-static-rpc-snapshots.sh            # 全跑（含下方參數化群組）
#   bash scripts/export/export-static-rpc-snapshots.sh get_osm_substations get_osm_power_lines  # 只跑指定
#   bash scripts/export/export-static-rpc-snapshots.sh @fire @waste_schedule                    # 只跑指定參數化群組
set -euo pipefail

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ROOT_DIR="$( cd "$SCRIPT_DIR/../.." && pwd )"
OUT_DIR="$ROOT_DIR/public/static-rpc"

if [ -z "${SUPABASE_DB_URL:-}" ] && [ -f "$ROOT_DIR/.env" ]; then
  SUPABASE_DB_URL=$(grep -E '^SUPABASE_DB_URL=' "$ROOT_DIR/.env" | head -1 | cut -d= -f2-)
  export SUPABASE_DB_URL
fi
[ -z "${SUPABASE_DB_URL:-}" ] && { echo "[ERR] SUPABASE_DB_URL not set" >&2; exit 1; }
mkdir -p "$OUT_DIR"

PSQL_OPTS=(-At -v ON_ERROR_STOP=1)
PSQL_SET="SET statement_timeout='120s'; SET idle_in_transaction_session_timeout='60s';"

# RPC 清單："<rpc>:<kind>"
#   kind = table  → RETURNS TABLE，用 jsonb_agg 包成陣列
#   kind = jsonb  → RETURNS jsonb，本身已是陣列，直接 SELECT
# 新增靜態層時：在此 append 一行即可（batch 1 之後陸續補）。
# ⚠️ owner-gated（docs/features/owner-gated-layers）：以下 12 支已從匯出清單移除，
#    改走 owner-only 直連 RPC（不再產 CDN 快照，避免重跑又把私有資料放回公開 CDN）：
#      get_osm_substations / get_osm_power_lines / get_osm_power_towers /
#      get_osm_power_plants_static / get_fossil_fuel_infrastructure / get_fossil_fuel_layers /
#      get_ssot_facilities_{primary_operating,planned,historical,secondary_small,osm_supplement,offshore_zones}
#    get_gas_station_layers（公開）取代 get_fossil_fuel_layers，讓加油站層續有快照。
#    ⚠️ get_gas_station_layers 需 migration 套用後才存在，實際 export 前確認 RPC 已建。
RPCS=(
  # ── 加油站（公開，取代 get_fossil_fuel_layers）──
  "get_gas_station_layers:table"
  # ── Batch 1：param-less 能源靜態（全 RETURNS TABLE，DB 探型別確認）──
  "get_osm_wind_turbines:table"
  "get_osm_solar_farms:table"
  "get_renewable_permits_taipei:table"
  "get_offshore_wind_zones:table"
  "get_geothermal_wells:table"
  "get_island_power_grid:table"
  "get_ev_charging_stations:table"
  # ── Batch 1b：param-less 廢棄物 sidebar 數量（no-cache，每次 toggle 都打 DB）──
  "get_waste_facility_counts:table"
  "get_waste_disposal_point_counts:table"
  # ── Batch 2：廢棄物參數化（全量匯出，前端 filter）──
  #   RPC 有 city/type 參數，無參呼叫 = DEFAULT NULL = 回全量；前端抓全量後在記憶體 filter。
  #   get_waste_stops 前端已不用（停靠點改讀 geo/waste_stops_static_*.pmtiles），不匯出。
  "get_waste_routes:table"
  "get_waste_facilities:table"
  "get_waste_disposal_points:table"
  "get_waste_cleaning_squads:table"
  # ── 2026-11 不會變的公開資料改走 CDN（ADR-0026；舊 RPC 待發布後撤，見 gis-platform PENDING）──
  "get_council_districts_2026:jsonb"
  "get_fire_event_years:table"
)

# 參數化群組（"@名稱"）：每個參數值各一檔，前端用完整路徑樣板讀
# （`/static-rpc/<rpc>_<參數>.json`，deploy/cloudflare/site_manifest.py 才認得出引用）。
PARAM_GROUPS=(polling fire waste_schedule reservoir_rivers land_subsidence)

# 垃圾車表定的 8 區分組（必須與 src/types/index.ts WASTE_GROUP_CITIES 一致；
# src/data/__tests__/staticRpcExports.test.ts 會比對）
WASTE_GROUPS=(
  "TaipeiMetro:臺北市,新北市"
  "KeelungYilan:基隆市,宜蘭縣"
  "TaoyuanHsinchuMiaoli:桃園市,新竹市,新竹縣,苗栗縣"
  "CentralTaiwan:臺中市,彰化縣,南投縣"
  "YunChiaNan:雲林縣,嘉義市,嘉義縣,臺南市"
  "Kaoping:高雄市,屏東縣"
  "HualienTaitung:花蓮縣,臺東縣"
  "OffshoreIslands:澎湖縣,金門縣,連江縣"
)

CURRENT_PSQL_PID=""
cleanup () {
  local ec=$?
  if [ -n "${CURRENT_PSQL_PID:-}" ] && kill -0 "$CURRENT_PSQL_PID" 2>/dev/null; then
    kill -TERM "$CURRENT_PSQL_PID" 2>/dev/null || true
    for _ in 1 2 3 4 5; do kill -0 "$CURRENT_PSQL_PID" 2>/dev/null || break; sleep 1; done
  fi
  exit "$ec"
}
trap cleanup EXIT INT TERM

run_one () {
  local rpc="$1" kind="$2"
  local out="$OUT_DIR/$rpc.json"
  local sql
  if [ "$kind" = "jsonb" ]; then
    sql="SELECT public.$rpc();"
  else
    sql="SELECT coalesce(jsonb_agg(t),'[]'::jsonb) FROM public.$rpc() t;"
  fi
  printf "[RUN] %-45s " "$rpc ($kind)"
  psql "$SUPABASE_DB_URL" "${PSQL_OPTS[@]}" -c "$PSQL_SET $sql" > "$out" &
  CURRENT_PSQL_PID=$!
  wait "$CURRENT_PSQL_PID" || { echo "FAILED"; return 1; }
  CURRENT_PSQL_PID=""
  local size rows
  size=$(wc -c < "$out" | awk '{printf "%.0f", $1/1024}')
  rows=$(python3 -c "import json;print(len(json.load(open('$out'))))" 2>/dev/null || echo "?")
  echo "${size} KB, ${rows} rows"
}

# 任意 SQL（回傳單一 jsonb）→ $OUT_DIR/<name>.json
run_sql () {
  local name="$1" sql="$2"
  local out="$OUT_DIR/$name.json"
  printf "[RUN] %-45s " "$name"
  psql "$SUPABASE_DB_URL" "${PSQL_OPTS[@]}" -c "$PSQL_SET $sql" > "$out" &
  CURRENT_PSQL_PID=$!
  wait "$CURRENT_PSQL_PID" || { echo "FAILED"; return 1; }
  CURRENT_PSQL_PID=""
  echo "$(wc -c < "$out" | awk '{printf "%.0f", $1/1024}') KB"
}

q_list () {  # 單欄查詢 → 一行一值
  psql "$SUPABASE_DB_URL" "${PSQL_OPTS[@]}" -c "$PSQL_SET $1"
}

run_group () {
  case "$1" in
    polling)
      # 2024 投開票所：RPC get_polling_stations_2024 一次最多 5000 筆，直接讀表（欄位同 RPC，
      # 只收有站址座標者）。欄式 cols/rows 省體積；熱區（原 get_polling_stations_2024_heat）由同一份算。
      run_sql "polling_stations_2024" "SELECT jsonb_build_object(
        'meta', jsonb_build_object(
          'total', (SELECT count(*) FROM reference.polling_stations_2024),
          'mapped', (SELECT count(*) FROM reference.polling_stations_2024 WHERE geometry_is_station AND geom IS NOT NULL),
          'loaded_at', (SELECT max(loaded_at) FROM reference.polling_stations_2024)),
        'cols', jsonb_build_array('lng','lat','county','town','village','station_no','name','address','precision',
          'pres24_electors','pres24_votes','pres24_valid','pres24_turnout',
          'pres24_dpp_votes','pres24_dpp_pct','pres24_kmt_votes','pres24_kmt_pct','pres24_tpp_votes','pres24_tpp_pct'),
        'rows', COALESCE((SELECT jsonb_agg(jsonb_build_array(
          round(ST_X(p.geom)::numeric, 6), round(ST_Y(p.geom)::numeric, 6),
          p.county, p.town, p.village, p.station_no, p.name, p.address, p.precision,
          p.pres24_electors, p.pres24_votes, p.pres24_valid, p.pres24_turnout,
          p.pres24_dpp_votes, p.pres24_dpp_pct, p.pres24_kmt_votes, p.pres24_kmt_pct,
          p.pres24_tpp_votes, p.pres24_tpp_pct) ORDER BY p.county, p.station_no)
          FROM reference.polling_stations_2024 p WHERE p.geometry_is_station AND p.geom IS NOT NULL), '[]'::jsonb));"
      ;;
    fire)
      for y in $(q_list "SELECT year FROM public.get_fire_event_years() ORDER BY 1;"); do
        run_sql "get_fire_events_by_year_$y" "SELECT coalesce(jsonb_agg(r),'[]'::jsonb) FROM public.get_fire_events_by_year($y) r;"
      done
      ;;
    waste_schedule)
      # 7 個星期幾 × 8 區分組＝56 檔，全部產（空的也要是 []，前端缺檔會整層失敗）
      local dow entry group cities
      for dow in 0 1 2 3 4 5 6; do
        for entry in "${WASTE_GROUPS[@]}"; do
          group="${entry%%:*}"; cities="${entry#*:}"
          run_sql "get_waste_schedule_day_${dow}_${group}" \
            "SELECT coalesce(jsonb_agg(r),'[]'::jsonb) FROM public.get_waste_schedule_day(string_to_array('$cities', ','), $dow) r;"
        done
      done
      ;;
    reservoir_rivers)
      for id in $(q_list "SELECT DISTINCT compare_id FROM reference.reservoir_watershed WHERE compare_id IS NOT NULL ORDER BY 1;"); do
        run_sql "get_reservoir_watershed_rivers_$id" "SELECT public.get_reservoir_watershed_rivers($id);"
      done
      ;;
    land_subsidence)
      # 地層下陷單站月均時序（popup 趨勢圖）：每站一檔，檔名＝站號 UTF-8 hex
      # （站號含 `:`、`(`；與 src/data/landSubsidenceLoader.ts landSubsidenceStationFileId 一致）。
      # 原表 public.land_subsidence_readings 預定搬離 Supabase（ADR-0026）；DROP 後本群組無法重跑，
      # 資料年更、要更新時先從 S3 supabase-export/public.land_subsidence_readings/ 回灌再跑。
      local sid hex
      while IFS= read -r sid; do
        [ -n "$sid" ] || continue
        hex=$(printf '%s' "$sid" | xxd -p | tr -d '\n')
        run_sql "get_land_subsidence_timeseries_$hex" \
          "SELECT coalesce(jsonb_agg(r),'[]'::jsonb) FROM public.get_land_subsidence_timeseries('$sid', NULL, NULL, 'month') r;"
      done < <(q_list "SELECT DISTINCT station_id FROM public.land_subsidence_readings ORDER BY 1;")
      ;;
    *) echo "[SKIP] 未知群組 @$1"; return 0 ;;
  esac
}

kind_of () {
  local want="$1"
  for entry in "${RPCS[@]}"; do
    [ "${entry%%:*}" = "$want" ] && { echo "${entry##*:}"; return 0; }
  done
  return 1
}

if [ $# -gt 0 ]; then
  for want in "$@"; do
    if [ "${want#@}" != "$want" ]; then run_group "${want#@}"; continue; fi
    k=$(kind_of "$want") || { echo "[SKIP] $want 不在 RPCS 清單"; continue; }
    run_one "$want" "$k"
  done
else
  for entry in "${RPCS[@]}"; do
    run_one "${entry%%:*}" "${entry##*:}"
  done
  for g in "${PARAM_GROUPS[@]}"; do run_group "$g"; done
fi

echo "[DONE] $OUT_DIR"
ls -lh "$OUT_DIR"/*.json 2>/dev/null | awk '{print "  " $5 "  " $9}'
