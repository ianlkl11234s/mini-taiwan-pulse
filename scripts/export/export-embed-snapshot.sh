#!/usr/bin/env bash
# 產生「嵌入用歷史快照」（EM-15 / Phase B）
#
#   ./scripts/export/export-embed-snapshot.sh <layer> <YYYY-MM-DD>
#   ./scripts/export/export-embed-snapshot.sh plaActivity 2026-03-01
#   ./scripts/export/export-embed-snapshot.sh flights     2026-08-06
#
# 兩種產物格式（依 layer 而定）：
#   plaActivity → GeoJSON       （靜態幾何，MapLibre 原生 fill/line 畫）
#   flights     → gzip JSON     （EM-16 回放；body = **匯出鏡像列**陣列，
#                                 形狀同 get_flight_trails / data-collectors 的
#                                 export_daily_trails.py write_gzip_json）
#
# 設計（見 docs/proposal/embed-dynamic-layers.md §3）：
#   嵌入不需要「所有歷史日期」，只需要**文章引用的那一天**。所以不做 AR-14~16 的
#   全量 per-day 匯出，而是寫文章時凍結該日 → 靜態 GeoJSON → CDN → 讀者端 $0。
#
#   凍結同時解掉「文章永久 vs 資料時效」：RPC 是活的，文章是死的。上游 pipeline
#   之後改了資料，已發佈文章裡的地圖不會突然對不上內文。
#
# 產物：public/embed-snapshots/<layer>/<date>.geojson
#       （已 gitignore；走既有 deploy-assets 管線上 S3 → 容器 → nginx → Cloudflare）
#
# ⚠️ 產出後務必檢查 features 數。BACKLOG BL-25 記著幾條上游死管線
#    （flight trails retention ≈9 天、waste matched 全日期 0 rows…），
#    RPC 有回應不代表那天真的有資料。
set -euo pipefail

LAYER="${1:-}"
DATE="${2:-}"

if [[ -z "$LAYER" || -z "$DATE" ]]; then
  echo "用法：$0 <layer> <YYYY-MM-DD>" >&2
  echo "目前支援的 layer：plaActivity | flights" >&2
  exit 1
fi

if [[ ! "$DATE" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]]; then
  echo "❌ 日期格式須為 YYYY-MM-DD，收到：$DATE" >&2
  exit 1
fi

if [[ -z "${SUPABASE_DB_URL:-}" && -f .env ]]; then
  # 只抽需要的那一行，不 `source` 整個 .env ——
  # 該檔含未引號、帶特殊字元的值，bash source 會當成指令執行而報錯。
  SUPABASE_DB_URL=$(grep -E '^SUPABASE_DB_URL=' .env | head -1 | cut -d= -f2- | sed 's/^["'"'"']//; s/["'"'"']$//')
  export SUPABASE_DB_URL
fi
if [[ -z "${SUPABASE_DB_URL:-}" ]]; then
  echo "❌ 需要 SUPABASE_DB_URL（psql 直連）" >&2
  exit 1
fi

OUT_DIR="public/embed-snapshots/$LAYER"
mkdir -p "$OUT_DIR"

case "$LAYER" in
  plaActivity)
    OUT_FILE="$OUT_DIR/$DATE.geojson"
    FORMAT="geojson"
    # 共機活動區：get_pla_tracks_range(p_end_date, p_days=1, p_include_review=false)
    # 顏色與 src/data/plaTracksLoader.ts 的 PLA_KIND_COLORS 一致（rect 走廊 / poly 活動區）。
    # 單日快照 → days_ago 恆為 0，不需要主站那套多日疊加的 ageFade。
    SQL=$(cat <<'EOSQL'
SELECT jsonb_build_object(
  'type', 'FeatureCollection',
  'features', coalesce(jsonb_agg(
    jsonb_build_object(
      'type', 'Feature',
      'geometry', t.geom_geojson,
      'properties', jsonb_build_object(
        'report_date',  t.report_date,
        'days_ago',     0,
        'shape_no',     t.shape_no,
        'shape_kind',   t.shape_kind,
        'kind_label',   CASE WHEN t.shape_kind = 'poly' THEN '活動區 Activity Area'
                             ELSE '活動走廊 Corridor' END,
        'kind_color',   CASE WHEN t.shape_kind = 'poly' THEN '#a855f7' ELSE '#38bdf8' END,
        'vertices',     t.vertices,
        'needs_review', CASE WHEN t.needs_review THEN 1 ELSE 0 END,
        'guided',       CASE WHEN t.guided THEN 1 ELSE 0 END
      )
    )
  ), '[]'::jsonb)
)
FROM public.get_pla_tracks_range('__DATE__'::date, 1, false) t
WHERE t.geom_geojson IS NOT NULL;
EOSQL
)
    ;;
  flights)
    OUT_FILE="$OUT_DIR/$DATE.json.gz"
    FORMAT="rows.gz"
    # EM-16 回放：產出的是**匯出鏡像列**不是 GeoJSON —— 前端拿到後自己解析
    # `trail = "lat,lng,alt,ts;..."` 並跑 splitTrailByGap（src/data/flightTrails.ts），
    # 與主站走 RPC 時完全同一條解析路徑。形狀刻意對齊 data-collectors 的
    # export_daily_trails.py `write_gzip_json`（同一份資料日後可改由保存層回填）。
    #
    # ⚠️ get_flight_trails 的 retention ≈ 7–9 天（BACKLOG BL-25），更早的日期查不到。
    SQL=$(cat <<'EOSQL'
SELECT coalesce(json_agg(row_to_json(t)), '[]'::json)
FROM public.get_flight_trails('__DATE__'::date) t;
EOSQL
)
    ;;
  *)
    echo "❌ 尚未支援的 layer：$LAYER（目前支援 plaActivity / flights）" >&2
    exit 1
    ;;
esac

echo "[export] $LAYER @ $DATE → $OUT_FILE"
# psql 的 -c 不做 :'var' 變數插值，故在 shell 端替換佔位符。
# $DATE 已於上方以 regex 驗證為 YYYY-MM-DD，無注入風險。
SQL="${SQL//__DATE__/$DATE}"

# 先寫未壓縮暫存檔 → 驗完再視格式壓縮／搬正。
# （驗證要讀純 JSON；gzip 版本若中途失敗也不會留下半截的 .json.gz）
RAW_JSON=$(mktemp)
trap 'rm -f "$RAW_JSON"' EXIT

psql "$SUPABASE_DB_URL" \
  -v ON_ERROR_STOP=1 \
  -qAt \
  -c "SET statement_timeout='120s';" \
  -c "$SQL" > "$RAW_JSON"

# 驗收：必須是合法 JSON 且非空（空快照多半代表那天上游沒資料）
FEATURES=$(SNAPSHOT_FORMAT="$FORMAT" python3 -c "
import json, os, sys
try:
    d = json.load(open('$RAW_JSON'))
except Exception as e:
    print('INVALID', e, file=sys.stderr); sys.exit(2)
print(len(d) if os.environ['SNAPSHOT_FORMAT'] == 'rows.gz' else len(d.get('features', [])))
")

if [[ "$FORMAT" == "rows.gz" ]]; then
  gzip -9 -c "$RAW_JSON" > "$OUT_FILE"
else
  cp "$RAW_JSON" "$OUT_FILE"
fi

SIZE=$(du -h "$OUT_FILE" | cut -f1)
echo "[export] ✅ features=$FEATURES  size=$SIZE"

if [[ "$FEATURES" == "0" ]]; then
  echo "[export] ⚠️  features=0 —— 該日上游可能沒有資料（見 BACKLOG BL-25 死管線清單）。" >&2
  echo "[export]     快照仍會產出，但 embed 端會顯示空圖層。確認後再上傳。" >&2
fi
