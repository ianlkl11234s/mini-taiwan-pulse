#!/usr/bin/env bash
# 產生「嵌入用歷史快照」（EM-15 / Phase B）
#
#   ./scripts/export/export-embed-snapshot.sh <layer> <YYYY-MM-DD>
#   ./scripts/export/export-embed-snapshot.sh plaActivity 2026-03-01
#   ./scripts/export/export-embed-snapshot.sh flights     2026-08-06
#   ./scripts/export/export-embed-snapshot.sh ships       2026-08-06
#   ./scripts/export/export-embed-snapshot.sh rail        2026-08-06
#
# 兩種產物格式（依 layer 而定）：
#   plaActivity     → GeoJSON     （靜態幾何，MapLibre 原生 fill/line 畫）
#   flights / ships → gzip JSON   （EM-16 回放；body = **匯出鏡像列**陣列，
#                                   形狀同 get_flight_trails / get_ship_trails 與
#                                   data-collectors 的 export_daily_trails.py write_gzip_json）
#   rail            → gzip JSON   （EM-16 Phase 3；body = reference.daily_schedules 的
#                                   **時刻表列**陣列。與前兩者的根本差異見下方 rail) case）
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
  echo "目前支援的 layer：plaActivity | flights | ships | rail" >&2
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

# trail 座標量化（各 layer 於 case 內設定預設）。空字串 = 原樣輸出，不做後處理。
# 呼叫端可用環境變數覆寫，含「顯式設空字串以關閉」——量測對照組就是這樣跑的：
#   TRAIL_PRECISION= ./scripts/export/export-embed-snapshot.sh ships 2026-08-06
TRAIL_PRECISION_SET="${TRAIL_PRECISION+yes}"   # 有沒有被呼叫端指定（含空字串）
TRAIL_PRECISION_ARG="${TRAIL_PRECISION:-}"
TRAIL_PRECISION=""
TRAIL_FIELDS=0

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
  ships)
    OUT_FILE="$OUT_DIR/$DATE.json.gz"
    FORMAT="rows.gz"
    TRAIL_FIELDS=3
    TRAIL_PRECISION=$([[ -n "$TRAIL_PRECISION_SET" ]] && printf '%s' "$TRAIL_PRECISION_ARG" || printf '5')
    # EM-16 回放 Phase 2：鏡像 get_ship_trails 的三個欄位（mmsi / ship_type / trail）。
    # trail = "lat,lng,ts;..."（**三欄**，與 flights 的四欄不同 —— 沒有高度）。
    # 前端解析走 src/data/shipTrails.ts，與主站 shipLoader 同一條路徑（含 >40 節
    # GPS 異常過濾與 ship_type 中文→AIS 碼映射）。
    #
    # ⚠️ 座標精度：RPC 原樣是 6 位小數；單日 ~74 萬點時尾數其實是 AIS 噪音
    # （5 位小數 ≈ 1.1m，遠小於 AIS 本身定位誤差）。量化到 5 位由 TRAIL_PRECISION
    # 控制（本 layer 預設 5），見下方後處理段。
    #
    # 2026-08-06 實測（12,305 列 / 738,062 點）：
    #   6 位（原樣）raw 22.8 MiB → gzip 5.48 MiB
    #   5 位        raw 21.6 MiB → gzip 4.78 MiB（−12.8%）  ← 採用
    #   4 位        raw 20.2 MiB → gzip 3.75 MiB（−31.5%，≈11m 精度，放大後會看到階梯）
    # 且 5 位量化後 filterGpsAnomalies 的結果與原樣**逐點相同**
    # （保留 737,280 / 丟棄 782 兩者一致），故確定是無損於行為的瘦身。
    #
    # ⚠️ get_ship_trails 的 retention 與 flights 同量級（BACKLOG BL-25），更早的日期查不到。
    SQL=$(cat <<'EOSQL'
SELECT coalesce(json_agg(row_to_json(t)), '[]'::json)
FROM public.get_ship_trails('__DATE__'::date) t;
EOSQL
)
    ;;
  rail)
    # EM-16 回放 Phase 3 —— **與 flights / ships 是不同物種**。
    #
    #   flights / ships = 軌跡插值型：快照 = 一整天的歷史 GPS 點串，前端只做內插。
    #   rail            = 時刻表推算型：快照 = 「那一天的時刻表」，列車位置由
    #                     TraTrainEngine / RailEngine 在前端**即時算**。
    #
    # 所以 rail 的資料被拆成兩塊，只有前者每天變：
    #   1. 時刻表（本檔產出）      → public/embed-snapshots/rail/<date>.json.gz
    #   2. 幾何（日期無關共用資產）→ public/embed-rail/rail_slim.json.gz
    #      （由 scripts/preprocess/build-rail-slim-bundle.py 產出，不在本腳本範圍）
    #
    # 資料來源 = reference.daily_schedules，**不是** public/rail/tra/master_schedule.json
    # ——後者是 TDX 通用時刻表（週期性班表），不是某一天真正開的車（§9-4 調查結論）。
    # 這張表**永久累積不會過期**，所以 rail 不需要 flights/ships 那套 nightly 保存
    #（§9 D-2「rail 免」）；任何一天都能事後重做快照。
    #
    # 六個系統、兩種語意，一次查出來（body 每列 = 一個系統）：
    #   tra_daily / thsr_daily  → schedule_date = 指定日，**那一天的真實時刻表**
    #   trtc/krtc/klrt/tmrt_fixed → schedule_date 恆為 2025-01-01 的**週期性班表**。
    #     捷運在 Supabase 沒有每日表（TDX 也不發），班表本來就與日期無關；
    #     這份 _fixed 就是主站現在顯示的內容（railLoader 走 `_daily → _fixed` fallback，
    #     捷運永遠落到 _fixed），且與 public/rail/<sys>/schedules/ 的本地散檔逐位元組相同
    #     （已比對 trtc BL-1-0）。列本身帶 system/schedule_date，語意差異自我標示。
    OUT_FILE="$OUT_DIR/$DATE.json.gz"
    FORMAT="rows.gz"
    # 該日沒有 tra_daily → 往回找最近有資料的一天（並改寫輸出檔名，不留假日期）。
    RAIL_DATE=$(psql "$SUPABASE_DB_URL" -qAt \
      -c "SELECT max(schedule_date) FROM reference.daily_schedules
          WHERE system = 'tra_daily' AND schedule_date <= '$DATE'::date;")
    if [[ -z "$RAIL_DATE" ]]; then
      echo "❌ reference.daily_schedules 在 $DATE 之前查無 tra_daily 資料" >&2
      exit 1
    fi
    if [[ "$RAIL_DATE" != "$DATE" ]]; then
      echo "[export] ⚠️  $DATE 無 tra_daily，回退到最近有資料的 $RAIL_DATE" >&2
      DATE="$RAIL_DATE"
      OUT_FILE="$OUT_DIR/$DATE.json.gz"
    fi
    SQL=$(cat <<'EOSQL'
SELECT coalesce(json_agg(row_to_json(t) ORDER BY t.system), '[]'::json)
FROM (
  SELECT system, schedule_date, train_count, data
  FROM reference.daily_schedules
  WHERE (system IN ('tra_daily', 'thsr_daily') AND schedule_date = '__DATE__'::date)
     OR system IN ('trtc_fixed', 'krtc_fixed', 'klrt_fixed', 'tmrt_fixed')
) t;
EOSQL
)
    ;;
  *)
    echo "❌ 尚未支援的 layer：$LAYER（目前支援 plaActivity / flights / ships / rail）" >&2
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
# 量化後 OUT_JSON 會改指向另一個暫存檔；trap 必須同時記得兩個，
# 否則原始（ships 單日 ~24MB）那份每跑一次就漏一個在 /tmp。
OUT_JSON="$RAW_JSON"
QUANTIZED=""
trap 'rm -f "$RAW_JSON" ${QUANTIZED:+"$QUANTIZED"}' EXIT

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

# rail 專屬驗收：rows>0 不夠 —— 少了 tra_daily 仍會有 5 列，看起來「成功」但主角不見了。
# 逐系統點名，缺 TRA/THSR 直接 exit 1，缺捷運只告警（部分系統缺席仍是可用的快照）。
if [[ "$LAYER" == "rail" ]]; then
  python3 -c "
import json, sys
rows = json.load(open('$RAW_JSON'))
by = {r['system']: r for r in rows}
missing = [s for s in ('tra_daily', 'thsr_daily') if s not in by]
if missing:
    print('❌ rail 快照缺少必要系統：' + ', '.join(missing), file=sys.stderr)
    sys.exit(1)
for s in ('tra_daily', 'thsr_daily', 'trtc_fixed', 'krtc_fixed', 'klrt_fixed', 'tmrt_fixed'):
    r = by.get(s)
    if r is None:
        print('[export] ⚠️  缺少 ' + s + '（該系統的列車不會出現）', file=sys.stderr)
        continue
    print('[export]   %-11s %s  train_count=%s' % (s, r['schedule_date'], r['train_count']))
"
fi

# 座標精度瘦身（僅 trail 型 layer）。TRAIL_PRECISION 空字串 = 不動原始資料。
# 只改 `trail` 欄位的**座標**小數位；時間戳與其他欄位一律原樣。
if [[ -n "${TRAIL_PRECISION:-}" ]]; then
  QUANTIZED=$(mktemp)
  TRAIL_PRECISION="$TRAIL_PRECISION" TRAIL_FIELDS="$TRAIL_FIELDS" python3 -c "
import json, os, sys
prec = int(os.environ['TRAIL_PRECISION'])
nfields = int(os.environ['TRAIL_FIELDS'])   # 3 = lat,lng,ts（ships）/ 4 = lat,lng,alt,ts（flights）
rows = json.load(open('$RAW_JSON'))

def q(trail):
    out = []
    for pt in trail.split(';'):
        if not pt:
            continue
        parts = pt.split(',')
        if len(parts) != nfields:
            out.append(pt)          # 形狀不符 → 原樣保留，不猜
            continue
        # 前兩欄是 lat/lng → 量化；其餘（alt / ts）原樣
        head = [('%.*f' % (prec, float(v))).rstrip('0').rstrip('.') for v in parts[:2]]
        out.append(','.join(head + parts[2:]))
    return ';'.join(out)

for r in rows:
    if isinstance(r.get('trail'), str):
        r['trail'] = q(r['trail'])
json.dump(rows, open('$QUANTIZED', 'w'), separators=(',', ':'), ensure_ascii=False)
"
  BEFORE=$(wc -c < "$RAW_JSON" | tr -d ' ')
  AFTER=$(wc -c < "$QUANTIZED" | tr -d ' ')
  echo "[export] 座標量化至 $TRAIL_PRECISION 位小數：raw ${BEFORE} → ${AFTER} bytes"
  OUT_JSON="$QUANTIZED"
fi

if [[ "$FORMAT" == "rows.gz" ]]; then
  gzip -9 -c "$OUT_JSON" > "$OUT_FILE"
else
  cp "$OUT_JSON" "$OUT_FILE"
fi

SIZE=$(du -h "$OUT_FILE" | cut -f1)
echo "[export] ✅ features=$FEATURES  size=$SIZE"

if [[ "$FEATURES" == "0" ]]; then
  echo "[export] ⚠️  features=0 —— 該日上游可能沒有資料（見 BACKLOG BL-25 死管線清單）。" >&2
  echo "[export]     快照仍會產出，但 embed 端會顯示空圖層。確認後再上傳。" >&2
fi
