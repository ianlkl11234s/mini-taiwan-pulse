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
# 資料來源（2026-11-09 起）：Supabase public.flood_hazard_zones 已刪（gis-platform migration 545），
# 改讀 S3 整表匯出檔 s3://migu-gis-data-collector/supabase-export/public.flood_hazard_zones/full-20261109.csv.gz
# （17,303 列，geom 是 EWKT）。簡化與欄位對應照原本的 SQL（ST_SimplifyPreserveTopology 0.0001、去 Z、
# 深度級距正規化），改用 python3＋shapely 做。
# 需要 S3 金鑰：mini 根目錄 .env 的 S3_ACCESS_KEY／S3_SECRET_KEY／S3_REGION（或已設好的 AWS_* 環境變數）。
# 也可用 FLOOD_ZONES_CSV=<本機 csv.gz 路徑> 跳過下載。
# 用法: bash scripts/export/export-flood-scenarios.sh [scenario ...]（不帶參數＝全部 10 個）
# 產出 gitignored，走 S3 deploy-assets（upload-deploy-assets.sh 的 water_*.pmtiles glob），發版當天上傳。

set -euo pipefail

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ROOT_DIR="$( cd "$SCRIPT_DIR/../.." && pwd )"
OUT_DIR="$ROOT_DIR/public/geo"

SRC_S3="s3://migu-gis-data-collector/supabase-export/public.flood_hazard_zones/full-20261109.csv.gz"
SRC_ROWS=17303
command -v tippecanoe >/dev/null || { echo "[ERR] tippecanoe not found" >&2; exit 1; }
python3 -c "import shapely" 2>/dev/null || { echo "[ERR] python3 shapely not installed (pip3 install shapely)" >&2; exit 1; }

SCENARIOS=(
  flood_150mm_6hr flood_250mm_6hr flood_350mm_6hr
  flood_200mm_12hr flood_300mm_12hr flood_400mm_12hr
  flood_200mm_24hr flood_350mm_24hr flood_500mm_24hr flood_650mm_24hr
)
if [ "$#" -gt 0 ]; then SCENARIOS=("$@"); fi

mkdir -p "$OUT_DIR"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

SRC_CSV="${FLOOD_ZONES_CSV:-}"
if [ -z "$SRC_CSV" ]; then
  if [ -z "${AWS_ACCESS_KEY_ID:-}" ] && [ -f "$ROOT_DIR/.env" ]; then
    AWS_ACCESS_KEY_ID=$(grep -E '^S3_ACCESS_KEY=' "$ROOT_DIR/.env" | head -1 | cut -d= -f2-)
    AWS_SECRET_ACCESS_KEY=$(grep -E '^S3_SECRET_KEY=' "$ROOT_DIR/.env" | head -1 | cut -d= -f2-)
    AWS_DEFAULT_REGION=$(grep -E '^S3_REGION=' "$ROOT_DIR/.env" | head -1 | cut -d= -f2-)
    export AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_DEFAULT_REGION
  fi
  SRC_CSV="$TMP_DIR/flood_hazard_zones.csv.gz"
  echo "[GET] $SRC_S3"
  aws s3 cp "$SRC_S3" "$SRC_CSV" --no-progress >/dev/null
fi

for scenario in "${SCENARIOS[@]}"; do
  [[ "$scenario" =~ ^flood_[0-9]+mm_[0-9]+hr$ ]] || { echo "[ERR] bad scenario $scenario" >&2; exit 1; }
  short="${scenario#flood_}"
  jsonl="$TMP_DIR/$short.jsonl"
  out="$OUT_DIR/water_flood_${short}.pmtiles"
  t0=$(date +%s)
  printf "[RUN] %-20s " "$short"
  python3 - "$SRC_CSV" "$scenario" "$short" "$SRC_ROWS" > "$jsonl" <<'PY'
import csv, gzip, json, sys
import shapely
from shapely import wkt
from shapely.geometry import mapping
src, scenario, short, expect = sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4])
FIX = {"0.3-0.>3.0": "0.3-0.5", "0.>3.0-1.0": "0.5-1.0"}
def num(v):
    return int(v) if v not in ("", None) else None
csv.field_size_limit(sys.maxsize)
total = 0
with gzip.open(src, "rt", newline="") as f:
    for r in csv.DictReader(f):
        total += 1
        if r["scenario"] != scenario or not r["geom"]:
            continue
        g = wkt.loads(r["geom"].split(";", 1)[-1])  # EWKT "SRID=4326;MULTIPOLYGON …"
        g = shapely.force_2d(g).simplify(0.0001, preserve_topology=True)
        d = r["flood_depth_class"] or None
        print(json.dumps({"type": "Feature", "id": int(r["id"]), "geometry": mapping(g),
            "properties": {"scenario": short, "rainfall_mm": num(r["rainfall_mm"]),
                "duration_hr": num(r["duration_hr"]), "depth_class": FIX.get(d, d),
                "county": r["county"] or None, "town": r["town"] or None}}, ensure_ascii=False))
if total != expect:
    sys.exit(f"source rows {total} != {expect}")
PY
  n=$(wc -l < "$jsonl" | tr -d ' ')
  # 參數沿用 2026-06 water_flood_extreme.pmtiles 的 generator_options；10 支同一個 -l
  tippecanoe -q -o "$out" -l flood_scenario -Z5 -z13 \
    --no-tiny-polygon-reduction --drop-smallest-as-needed --force \
    --attribution "經濟部水利署 淹水潛勢圖（data.gov.tw 25766）· 政府資料開放授權條款第1版" \
    "$jsonl"
  size=$(wc -c < "$out" | awk '{printf "%.1f", $1/1048576}')
  echo "${n} features, ${size} MB, $(( $(date +%s) - t0 ))s"
done
