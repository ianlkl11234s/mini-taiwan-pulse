#!/usr/bin/env bash
# 全國太陽光電施工許可（地號）→ <atlas-src>/energy/renewable_permits_national/（G37，2026-10-31）
#   之後由 build-atlas-public.py --src <atlas-src> --only renewablePermitsNational 切成
#   public/energy/renewable_permits_national.pmtiles（GeoJSON 約 6MB，太大不直接進 git）。
#
# 來源：public.renewable_permits（經濟部能源署 data.gov.tw 176025「電業設置發電設備工作許可證_太陽光電案場土地地號」，
#   申請年度民國 108–113，8,195 列＝案場 × 地號；419 座案場）。
# 座標：gis-platform 已用 twland 地號查詢＋NLSC 地號 geocode 回填 geom（地號代表點，98.1% 有座標；
#   taipei-gis-analytics 的 renewable_permits_20260615.geojson 全部是 (0,0) 佔位，不能直接用）。
# 一列＝一筆土地；容量 capacity_kw 是「整座案場」的值，在同案場每一列重複，前端不可逐點加總
#   （popup 顯示案場容量與該案場地號數 site_count）。
# 個資：業者名稱為法人（2026-10-31 掃描無自然人樣態）；不輸出 raw JSONB。
#
# 需要環境變數 SUPABASE_DB_URL（或 mini 根目錄 .env 有這個 key）；只做唯讀 COPY TO。
# 用法: bash scripts/export/export-renewable-permits-national.sh <atlas-src 目錄>

set -euo pipefail

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ROOT_DIR="$( cd "$SCRIPT_DIR/../.." && pwd )"
[ "$#" -eq 1 ] || { echo "usage: $0 <atlas-src dir>" >&2; exit 1; }
OUT_DIR="$1/energy/renewable_permits_national"
OUT="$OUT_DIR/renewable_permits_national.geojson"

if [ -z "${SUPABASE_DB_URL:-}" ] && [ -f "$ROOT_DIR/.env" ]; then
  SUPABASE_DB_URL=$(grep -E '^SUPABASE_DB_URL=' "$ROOT_DIR/.env" | head -1 | cut -d= -f2-)
  export SUPABASE_DB_URL
fi
if [ -z "${SUPABASE_DB_URL:-}" ]; then
  echo "[ERR] SUPABASE_DB_URL not set" >&2
  exit 1
fi

mkdir -p "$OUT_DIR"
TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT

psql "$SUPABASE_DB_URL" -X -q -At -v ON_ERROR_STOP=1 \
  -c "SET statement_timeout='60s'" -c "SET default_transaction_read_only=on" -c "
COPY (
  SELECT jsonb_build_object(
    'type','Feature',
    'geometry', ST_AsGeoJSON(geom, 6)::jsonb,
    'properties', jsonb_strip_nulls(jsonb_build_object(
      'id', id::text,
      'plant_name', plant_name,
      'operator_name', operator_name,
      'apply_year', apply_year,
      'construction_date', construction_date,
      'capacity_kw', capacity_kw,
      'land_area_sqm', land_area_sqm,
      'county', CASE county WHEN '屏東鎮' THEN '屏東縣' WHEN '嘉義鄉' THEN '嘉義縣' WHEN '桃園縣' THEN '桃園市' ELSE replace(county, '台', '臺') END,
      'township', township,
      'land_section', land_section,
      'land_number', land_number,
      'symbiotic_class', COALESCE(symbiotic_class, 'unknown'),
      'site_count', count(*) OVER (PARTITION BY apply_year, seq_no, plant_name)
    ))
  )
  FROM public.renewable_permits
  WHERE geom IS NOT NULL
  ORDER BY apply_year, seq_no, id
  LIMIT 20000
) TO STDOUT" > "$TMP"

python3 - "$TMP" "$OUT" <<'EOF'
import json, sys
from pathlib import Path
rows = [json.loads(line) for line in open(sys.argv[1], encoding="utf-8") if line.strip()]
out = Path(sys.argv[2])
json.dump({"type": "FeatureCollection", "features": rows}, open(out, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
manifest = {
    "dataset_id": "renewable_permits_national", "last_updated": "2026-06-15",
    "provenance": {"source": "經濟部能源署", "source_url": "https://data.gov.tw/dataset/176025",
                   "license": "政府資料開放授權條款", "fetched_at": "2026-06-15", "vintage": "申請年度民國 108–113 年"},
}
(out.parent / "_manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"{len(rows):,} features → {out}")
EOF
