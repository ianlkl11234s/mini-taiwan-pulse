#!/usr/bin/env bash
# 淹水潛勢 10 情境 → public/geo/water_flood_<scenario>.pmtiles（G29 方向 A）
#
# 取代 export-water-static.sh 第 7.5 節只匯出 650mm/24h 的做法：一個情境一支 PMTiles，
# 前端切情境時換 source url（禁止 10 情境打成同一支再 filter —— 每塊圖磚會帶 10 倍資料）。
# 情境清單與前端 src/data/floodScenarios.ts 同一份順序，新增／改名要兩邊一起改。
#
# 深度級距正規化（2026-10-29 SELECT DISTINCT 實測）：澎湖、金門、連江三縣在 8 個情境
# 沒有 0.3-0.5／0.5-1.0 兩級，改成兩種髒值，筆數一一對應（650mm：澎湖 6/6、金門 5/5、連江 4/4），
# 判讀為上游把 "5" 字元替換成 ">3.0" 的字串錯誤：
#   "0.3-0.>3.0" → "0.3-0.5"
#   "0.>3.0-1.0" → "0.5-1.0"
# 其他值（0.3-0.5／0.5-1.0／1.0-2.0／2.0-3.0／>3.0）照原樣。
#
# 需要環境變數 SUPABASE_DB_URL（或 mini 根目錄 .env 有這個 key）；只做 COPY TO（唯讀）。
# 用法: bash scripts/export/export-flood-scenarios.sh [scenario ...]（不帶參數＝全部 10 個）
# 產出 gitignored，走 S3 deploy-assets（upload-deploy-assets.sh 的 water_*.pmtiles glob），發版當天上傳。

set -euo pipefail

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ROOT_DIR="$( cd "$SCRIPT_DIR/../.." && pwd )"
OUT_DIR="$ROOT_DIR/public/geo"

if [ -z "${SUPABASE_DB_URL:-}" ] && [ -f "$ROOT_DIR/.env" ]; then
  SUPABASE_DB_URL=$(grep -E '^SUPABASE_DB_URL=' "$ROOT_DIR/.env" | head -1 | cut -d= -f2-)
  export SUPABASE_DB_URL
fi
if [ -z "${SUPABASE_DB_URL:-}" ]; then
  echo "[ERR] SUPABASE_DB_URL not set" >&2
  exit 1
fi
command -v tippecanoe >/dev/null || { echo "[ERR] tippecanoe not found" >&2; exit 1; }

SCENARIOS=(
  flood_150mm_6hr flood_250mm_6hr flood_350mm_6hr
  flood_200mm_12hr flood_300mm_12hr flood_400mm_12hr
  flood_200mm_24hr flood_350mm_24hr flood_500mm_24hr flood_650mm_24hr
)
if [ "$#" -gt 0 ]; then SCENARIOS=("$@"); fi

mkdir -p "$OUT_DIR"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

for scenario in "${SCENARIOS[@]}"; do
  [[ "$scenario" =~ ^flood_[0-9]+mm_[0-9]+hr$ ]] || { echo "[ERR] bad scenario $scenario" >&2; exit 1; }
  short="${scenario#flood_}"
  jsonl="$TMP_DIR/$short.jsonl"
  out="$OUT_DIR/water_flood_${short}.pmtiles"
  t0=$(date +%s)
  printf "[RUN] %-20s " "$short"
  psql "$SUPABASE_DB_URL" -X -At -v ON_ERROR_STOP=1 -c "
SET statement_timeout='120s'; SET idle_in_transaction_session_timeout='60s';
COPY (
  SELECT jsonb_build_object(
    'type','Feature','id',id,
    'geometry', ST_AsGeoJSON(ST_Force2D(ST_SimplifyPreserveTopology(geom, 0.0001)))::jsonb,
    'properties', jsonb_build_object(
      'scenario', '$short',
      'rainfall_mm', rainfall_mm,
      'duration_hr', duration_hr,
      'depth_class', CASE flood_depth_class
                       WHEN '0.3-0.>3.0' THEN '0.3-0.5'
                       WHEN '0.>3.0-1.0' THEN '0.5-1.0'
                       ELSE flood_depth_class END,
      'county', county,
      'town', town)
  )::text
  FROM public.flood_hazard_zones
  WHERE geom IS NOT NULL AND scenario='$scenario'
) TO STDOUT
" > "$jsonl"
  n=$(wc -l < "$jsonl" | tr -d ' ')
  # 參數沿用 2026-06 water_flood_extreme.pmtiles 的 generator_options；10 支同一個 -l
  tippecanoe -q -o "$out" -l flood_scenario -Z5 -z13 \
    --no-tiny-polygon-reduction --drop-smallest-as-needed --force \
    --attribution "經濟部水利署 淹水潛勢圖（data.gov.tw 25766）· 政府資料開放授權條款第1版" \
    "$jsonl"
  size=$(wc -c < "$out" | awk '{printf "%.1f", $1/1048576}')
  echo "${n} features, ${size} MB, $(( $(date +%s) - t0 ))s"
done
