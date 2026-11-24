#!/usr/bin/env bash
# 全球重大事件（AI 初判候選）每月期別檔 → public/static-rpc/get_global_event_month_<YYYYMM>.json
#
# 給長期時間條用（docs/features/longterm-time/STANDARD.md §4）：候選表只保留 180 天（gis-platform 542），
# 過了就從 Supabase 刪掉，所以已結束的月份要在被刪之前存成不再變動的檔案（ADR-0026：不變的歷史放 R2、S3 是正本）。
#
# 規則（排程只算增量，DB 鐵則 R3）：
#   - 月份依台北時間切（網站時間軸一律顯示台北時間，2026-11-23 站主決定）。
#   - 預設只匯出「上個月」與「本月」：上個月結束滿 3 天（等改判、補判落定）才匯出；
#     已結束的月份只要本機有檔、或公開網址（$PUBLIC_BASE/static-rpc/…）已能讀到就跳過，所以換到排程環境也是增量。
#     本月每次重產（標 partial: true，月底後由上一條固定下來）。
#   - 指定月份：bash scripts/export/export-global-event-months.sh 2026-09 2026-10（已發布照樣跳過，加 --force 才重產）。
#   - 不重產超過 150 天前的月份：候選表 180 天後會被清掉，重產會得到殘缺的檔案。
#   - 每個候選取最新版本；不含 AI 判為雜訊者；每列＝一個候選，地點收成陣列（新聞提及的城市／國家代表點，不是精確發生地，
#     座標取到小數 2 位≈1 公里，代表點本來就沒有更細的精度）。
# 唯讀：每個查詢都在 BEGIN READ ONLY 交易內、SET LOCAL statement_timeout（不留 session 設定，見 pooler 坑）。
# 需要環境變數 SUPABASE_DB_URL（與 export-static-rpc-snapshots.sh 相同）。
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
PUBLIC_BASE="${PULSE_PUBLIC_DATA_BASE:-https://data.itsmigu.com}"

FORCE=0
MONTHS=()
for arg in "$@"; do
  case "$arg" in
    --force) FORCE=1 ;;
    [0-9][0-9][0-9][0-9]-[0-9][0-9]) MONTHS+=("$arg") ;;
    *) echo "[ERR] 不認得的參數 $arg（用 YYYY-MM 或 --force）" >&2; exit 2 ;;
  esac
done

month_add() {  # month_add 2026-11 -1 → 2026-10
  python3 -c "import sys; y,m=map(int,sys.argv[1].split('-')); m+=int(sys.argv[2]); y+=(m-1)//12; m=(m-1)%12+1; print(f'{y:04d}-{m:02d}')" "$1" "$2"
}
THIS_MONTH=$(TZ=Asia/Taipei date +%Y-%m)
TODAY_DAY=$(TZ=Asia/Taipei date +%d)
if [ ${#MONTHS[@]} -eq 0 ]; then
  PREV=$(month_add "$THIS_MONTH" -1)
  [ "$((10#$TODAY_DAY))" -gt 3 ] && MONTHS+=("$PREV")
  MONTHS+=("$THIS_MONTH")
fi
OLDEST_OK=$(python3 -c "import datetime as d; t=d.datetime.now(d.timezone.utc)-d.timedelta(days=150); print(t.strftime('%Y-%m'))")

export_month() {
  local month="$1" partial="false"
  local out="$OUT_DIR/get_global_event_month_${month/-/}.json"
  [ "$month" = "$THIS_MONTH" ] && partial="true"
  if [[ "$month" < "$OLDEST_OK" ]]; then echo "[SKIP] $month 早於 $OLDEST_OK（候選表可能已清掉一部分，不重產）"; return 0; fi
  if [ "$partial" = "false" ] && [ "$FORCE" -eq 0 ]; then
    if [ -s "$out" ]; then echo "[SKIP] $month 本機已有檔（已結束的月份不重產；要重產加 --force）"; return 0; fi
    if curl -sfI -o /dev/null --max-time 20 "$PUBLIC_BASE/static-rpc/$(basename "$out")"; then echo "[SKIP] $month 已發布（$PUBLIC_BASE）"; return 0; fi
  fi
  printf "[RUN] %-10s " "$month"
  psql "$SUPABASE_DB_URL" -At -v ON_ERROR_STOP=1 -v month_start="${month}-01T00:00:00+08:00" -v partial="$partial" > "$out.tmp" <<'SQL'
BEGIN READ ONLY;
SET LOCAL statement_timeout = '120s';
-- 月份加減要在台北時區算（UTC 下「9/30 16:00Z + 1 個月」會變成 10/30，漏掉台北的 10/31）。
SET LOCAL TimeZone = 'Asia/Taipei';
WITH latest AS (
  SELECT DISTINCT ON (o.candidate_id) o.*
  FROM intel.global_event_candidate_observations AS o
  WHERE o.observed_at >= :'month_start'::timestamptz AND o.observed_at < (:'month_start'::timestamptz + interval '1 month')
  ORDER BY o.candidate_id, o.available_at DESC, o.observation_sha256 DESC
), kept AS (
  SELECT l.candidate_id, l.observed_at, l.category, l.severity, COALESCE(l.title_zh_tw, l.source_headline) AS title,
         (SELECT jsonb_agg(jsonb_build_array(round((place ->> 'longitude')::numeric, 2), round((place ->> 'latitude')::numeric, 2),
                   CASE place ->> 'location_kind' WHEN 'country_center' THEN 'n' WHEN 'city_center' THEN 'c' WHEN 'event_point' THEN 'e' ELSE 'o' END)
                 ORDER BY place ->> 'place_key')
            FROM jsonb_array_elements(l.places) AS place
           WHERE place ->> 'longitude' IS NOT NULL AND place ->> 'latitude' IS NOT NULL) AS pts
  FROM latest AS l
  WHERE l.decision IS DISTINCT FROM 'drop_noise'
)
SELECT jsonb_build_object(
  'format', 'global-events-month-v1',
  'month', to_char(:'month_start'::timestamptz AT TIME ZONE 'Asia/Taipei', 'YYYY-MM'),
  'timezone', 'Asia/Taipei',
  'partial', :'partial'::boolean,
  'generated_at', now(),
  'note', 'AI 初判候選（未經研究確認），每列＝一則報導候選；不含 AI 判為雜訊者；座標是新聞提及的城市／國家代表點，不是精確發生地',
  'source', 'GDELT GKG 2.1 → Mini Taiwan Pulse 全球情勢 AI 初判（intel.global_event_candidate_observations，每個候選取最新版本）',
  'coverage', jsonb_build_object('first_observed_at', (SELECT min(observed_at) FROM latest), 'last_observed_at', (SELECT max(observed_at) FROM latest)),
  'candidates', (SELECT count(*) FROM latest),
  'noise_excluded', (SELECT count(*) FROM latest WHERE decision = 'drop_noise'),
  'no_location', (SELECT count(*) FROM kept WHERE pts IS NULL),
  'kinds', jsonb_build_object('n', 'country_center', 'c', 'city_center', 'e', 'event_point', 'o', 'other'),
  'cols', jsonb_build_array('id','t','cat','sev','title','pts'),
  'rows', COALESCE((SELECT jsonb_agg(jsonb_build_array(
      substr(k.candidate_id, 6, 12), extract(epoch FROM k.observed_at)::bigint, k.category, k.severity, left(k.title, 24), k.pts)
      ORDER BY k.observed_at, k.candidate_id) FROM kept AS k WHERE k.pts IS NOT NULL), '[]'::jsonb)
);
ROLLBACK;
SQL
  # psql -At 會多印 BEGIN／SET／ROLLBACK 的狀態字；只留 JSON 那一行。
  # 先寫暫存檔，成功才換掉正式檔（失敗不會清掉已定版的月份）。
  grep -E '^\{' "$out.tmp" > "$out.new" && mv "$out.new" "$out" && rm -f "$out.tmp"
  echo "$(wc -c < "$out" | awk '{printf "%.0f", $1/1024}') KB${partial:+$( [ "$partial" = true ] && echo '（本月，partial）')}"
}

for m in "${MONTHS[@]}"; do export_month "$m"; done
echo "[DONE] $OUT_DIR"
