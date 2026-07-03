#!/usr/bin/env bash
# 匯出「參數無關的靜態 RPC」輸出成 JSON 快照 → public/static-rpc/<rpc>.json
#
# 目的：讓這些層改讀 CDN 靜態檔（staticRpc()），脫離前端併發排隊 + DB O(N) 負載。
#       見 docs/features/static-to-cdn/README.md
#
# 檔案內容 = RPC 的 JSON 輸出「原樣」（前端 loader 的 transform / popup / legend 不變）。
# 需要環境變數：SUPABASE_DB_URL（psql 直連）
# 用法：
#   bash scripts/export/export-static-rpc-snapshots.sh            # 全跑
#   bash scripts/export/export-static-rpc-snapshots.sh get_osm_substations get_osm_power_lines  # 只跑指定
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
RPCS=(
  # ── Pilot：電網 3 層（BC-8）──
  "get_osm_substations:table"
  "get_osm_power_lines:table"
  "get_osm_power_towers:jsonb"
  # ── Batch 1：param-less 能源靜態（全 RETURNS TABLE，DB 探型別確認）──
  "get_osm_wind_turbines:table"
  "get_osm_solar_farms:table"
  "get_osm_power_plants_static:table"
  "get_renewable_permits_taipei:table"
  "get_offshore_wind_zones:table"
  "get_geothermal_wells:table"
  "get_island_power_grid:table"
  "get_fossil_fuel_infrastructure:table"
  "get_fossil_fuel_layers:table"
  "get_ev_charging_stations:table"
  "get_ssot_facilities_secondary_small:table"
  "get_ssot_facilities_planned:table"
  "get_ssot_facilities_offshore_zones:table"
  "get_ssot_facilities_historical:table"
  "get_ssot_facilities_osm_supplement:table"
  # ── Batch 1b：param-less 廢棄物 sidebar 數量（no-cache，每次 toggle 都打 DB）──
  "get_waste_facility_counts:table"
  "get_waste_disposal_point_counts:table"
  # ── Batch 2：廢棄物參數化（全量匯出，前端 filter）──
  #   RPC 有 city/type 參數，無參呼叫 = DEFAULT NULL = 回全量；前端抓全量後在記憶體 filter。
  #   注意：get_waste_stops 全量 193k 筆 / 56MB，不適合此模式 → 仍走 per-city RPC，未列入。
  "get_waste_routes:table"
  "get_waste_facilities:table"
  "get_waste_disposal_points:table"
  "get_waste_cleaning_squads:table"
  # ── 收尾：主要電廠座標（靜態）；loader 仍另打 realtime 出力 RPC 做 has_realtime join ──
  "get_ssot_facilities_primary_operating:table"
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

kind_of () {
  local want="$1"
  for entry in "${RPCS[@]}"; do
    [ "${entry%%:*}" = "$want" ] && { echo "${entry##*:}"; return 0; }
  done
  return 1
}

if [ $# -gt 0 ]; then
  for want in "$@"; do
    k=$(kind_of "$want") || { echo "[SKIP] $want 不在 RPCS 清單"; continue; }
    run_one "$want" "$k"
  done
else
  for entry in "${RPCS[@]}"; do
    run_one "${entry%%:*}" "${entry##*:}"
  done
fi

echo "[DONE] $OUT_DIR"
ls -lh "$OUT_DIR"/*.json 2>/dev/null | awk '{print "  " $5 "  " $9}'
