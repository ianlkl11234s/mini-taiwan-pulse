#!/usr/bin/env bash
# Weekly Audit — 正式站探測器（C4 回應時間 + B6 CDN 快取有效性）
#
# C4：首頁 HTTP code / time_total / cf-cache-status（首頁是小 SPA HTML，可以 GET）。
#     首頁回應時間 > 3s → yellow；非 200 → red。
# B6：抽樣 8 個代表性靜態資產（跨不同子目錄），用 curl -sI（HEAD，絕不 GET —— 站上有
#     46MB 級檔案）看 cf-cache-status 是 HIT 還是 MISS/DYNAMIC。
#     已知基準（README §3）：/geo/provincial_road.geojson → HIT，首頁 → DYNAMIC。
#
# 不需要任何密鑰（全部打公開正式站 URL），但仍照專案硬約束：輸出絕不含任何疑似機敏字串。
# 建議避開台灣 10:00–20:00 餐期尖峰（固定排在週日晚上或週一早上跑），腳本不強制擋。
#
# 輸出：.claude/.cache/weekly-audit/production.json（不進版控）
# 用法：bash scripts/audit/weekly/probe_production.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../../.." && pwd)"
OUT_DIR="$ROOT_DIR/.claude/.cache/weekly-audit"
OUT_FILE="$OUT_DIR/production.json"
mkdir -p "$OUT_DIR"

PROD_BASE="https://mini-taiwan-pulse.itsmigu.com"
CURL_TIMEOUT=20

# 8 個代表性靜態資產：跨不同子目錄各挑一筆真實存在的 manifest 資產（與 probe_layers.ts
# 的抽樣邏輯呼應，但本檔是純 bash，直接寫死清單即可，不需要解析 TS）。
# 第一筆是 README §3 記錄過的已知基準（cf-cache-status: HIT），其餘涵蓋 geojson/pmtiles 兩種。
SAMPLE_ASSETS=(
  "/geo/provincial_road.geojson"
  "/geo/cctv.geojson"
  "/urban/urban_zoning_taipei.pmtiles"
  "/religion/temples.pmtiles"
  "/education/schools.geojson"
  "/welfare/nursing_homes_national.geojson"
  "/business_registry/company_points_overview_1500m_202608_r2.pmtiles"
  "/water_resources/lakes_ponds_osm.pmtiles"
)

started_at=$(date +%s)
ERRORS_JSONL="$(mktemp)"
ASSETS_JSONL="$(mktemp)"
trap 'rm -f "$ERRORS_JSONL" "$ASSETS_JSONL"' EXIT

add_error() {
  # $1=step $2=message（呼叫端自行確保不含機敏字串）
  jq -n --arg step "$1" --arg message "$2" '{step:$step, message:$message}' >> "$ERRORS_JSONL"
}

# ── C4：首頁（單次 curl 同時拿 headers + timing，避免打兩次） ──
homepage_raw="$(curl -sS -D - -o /dev/null --max-time "$CURL_TIMEOUT" \
  -w $'\n___METRICS___\nHTTP_CODE:%{http_code}\nTIME_TOTAL:%{time_total}\n' \
  "$PROD_BASE/" 2>&1 || true)"

homepage_http_code="$(printf '%s\n' "$homepage_raw" | grep -oE 'HTTP_CODE:[0-9]+' | head -1 | cut -d: -f2 || true)"
homepage_time_total="$(printf '%s\n' "$homepage_raw" | grep -oE 'TIME_TOTAL:[0-9.]+' | head -1 | cut -d: -f2 || true)"
homepage_cf_cache="$(printf '%s\n' "$homepage_raw" | grep -i '^cf-cache-status:' | head -1 | cut -d: -f2- | tr -d '\r' | sed 's/^ *//' || true)"

if [ -z "$homepage_http_code" ]; then
  add_error "C4:homepage" "curl 未取得 HTTP code（逾時或連線失敗）"
  homepage_http_code="null"
  homepage_time_total="null"
  homepage_cf_cache="null"
fi

# ── B6：抽樣資產（HEAD only） ──
for asset in "${SAMPLE_ASSETS[@]}"; do
  url="$PROD_BASE$asset"
  headers="$(curl -sS -I --max-time "$CURL_TIMEOUT" "$url" 2>&1 || true)"
  status="$(printf '%s\n' "$headers" | head -1 | grep -oE '[0-9]{3}' | head -1 || true)"
  cf_cache="$(printf '%s\n' "$headers" | grep -i '^cf-cache-status:' | head -1 | cut -d: -f2- | tr -d '\r' | sed 's/^ *//' || true)"
  content_length="$(printf '%s\n' "$headers" | grep -i '^content-length:' | head -1 | cut -d: -f2- | tr -d '\r' | sed 's/^ *//' || true)"

  if [ -z "$status" ]; then
    add_error "B6:$asset" "curl 未取得 HTTP status（逾時或連線失敗）"
    jq -n --arg path "$asset" \
      '{path:$path, status:null, cf_cache_status:null, content_length:null}' >> "$ASSETS_JSONL"
  else
    jq -n --arg path "$asset" --argjson status "$status" \
      --arg cf "${cf_cache:-unknown}" --arg cl "${content_length:-}" \
      '{path:$path, status:$status, cf_cache_status:$cf,
        content_length:(if $cl == "" then null else ($cl|tonumber) end)}' >> "$ASSETS_JSONL"
  fi
done

assets_json="$(jq -s '.' "$ASSETS_JSONL")"
errors_json="$(jq -s '.' "$ERRORS_JSONL")"

sample_checked=${#SAMPLE_ASSETS[@]}
sample_hit=$(echo "$assets_json" | jq '[.[] | select(.cf_cache_status == "HIT")] | length')
sample_miss_or_dynamic=$(echo "$assets_json" | jq '[.[] | select(.cf_cache_status == "MISS" or .cf_cache_status == "DYNAMIC" or .cf_cache_status == "BYPASS")] | length')
sample_error=$(echo "$assets_json" | jq '[.[] | select(.status == null)] | length')
sample_non200=$(echo "$assets_json" | jq '[.[] | select(.status != null and .status != 200)] | length')

# ── findings ──
findings_jsonl="$(mktemp)"
trap 'rm -f "$ERRORS_JSONL" "$ASSETS_JSONL" "$findings_jsonl"' EXIT

# C4a：首頁狀態碼
if [ "$homepage_http_code" = "null" ]; then
  jq -n '{id:"C4", level:"red", title:"首頁探測失敗", detail:"curl 未能取得首頁回應（逾時或連線失敗）", evidence:""}' >> "$findings_jsonl"
elif [ "$homepage_http_code" != "200" ]; then
  jq -n --arg code "$homepage_http_code" \
    '{id:"C4", level:"red", title:("首頁非 200：HTTP " + $code), detail:"正式站首頁未回 200，需立即確認部署狀態", evidence:""}' >> "$findings_jsonl"
else
  # C4b：回應時間門檻 3s
  slow=$(awk -v t="${homepage_time_total:-0}" 'BEGIN{print (t > 3.0) ? "1" : "0"}')
  if [ "$slow" = "1" ]; then
    jq -n --arg t "$homepage_time_total" --arg cf "$homepage_cf_cache" \
      '{id:"C4", level:"yellow", title:("首頁回應時間偏慢：" + $t + "s（> 3s 門檻）"),
        detail:("cf-cache-status=" + $cf), evidence:""}' >> "$findings_jsonl"
  else
    jq -n --arg t "$homepage_time_total" --arg cf "$homepage_cf_cache" \
      '{id:"C4", level:"green", title:("首頁 200，回應時間 " + $t + "s"),
        detail:("cf-cache-status=" + $cf), evidence:""}' >> "$findings_jsonl"
  fi
fi

# B6：CDN 快取有效性（抽樣 8 個，非 A3 那種全量 404 檢查，這裡只看快取命中狀態）
if [ "$sample_error" -gt 0 ] || [ "$sample_non200" -gt 0 ]; then
  jq -n --argjson err "$sample_error" --argjson non200 "$sample_non200" --argjson checked "$sample_checked" \
    '{id:"B6", level:"yellow", title:("抽樣資產異常：\($err) 個逾時／連線失敗、\($non200) 個非 200（共抽 \($checked) 個）"),
      detail:"詳見 details.sampleAssets（A3 有全量 404 檢查，這裡只是快取有效性抽樣附帶發現）", evidence:""}' >> "$findings_jsonl"
elif [ "$sample_hit" -eq 0 ]; then
  jq -n --argjson checked "$sample_checked" \
    '{id:"B6", level:"yellow", title:("抽樣 \($checked) 個資產全部未命中 CDN 快取（0 HIT）"),
      detail:"與已知基準（/geo/provincial_road.geojson 應為 HIT）不符，可能快取被清空或 Cache Rule 跑掉", evidence:""}' >> "$findings_jsonl"
else
  jq -n --argjson checked "$sample_checked" --argjson hit "$sample_hit" \
    '{id:"B6", level:"green", title:("CDN 快取抽樣：\($hit)/\($checked) HIT"),
      detail:"抽樣資產快取命中率在預期範圍", evidence:""}' >> "$findings_jsonl"
fi

findings_json="$(jq -s '.' "$findings_jsonl")"

ended_at=$(date +%s)
duration_sec=$((ended_at - started_at))

jq -n \
  --arg collected_at "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --argjson duration "$duration_sec" \
  --arg homepage_http_code "$homepage_http_code" \
  --arg homepage_time_total "${homepage_time_total:-null}" \
  --arg homepage_cf_cache "${homepage_cf_cache:-null}" \
  --argjson sample_checked "$sample_checked" \
  --argjson sample_hit "$sample_hit" \
  --argjson sample_miss_or_dynamic "$sample_miss_or_dynamic" \
  --argjson sample_error "$sample_error" \
  --argjson sample_non200 "$sample_non200" \
  --argjson findings "$findings_json" \
  --argjson errors "$errors_json" \
  --argjson assets "$assets_json" \
  '{
    collector: "production",
    collected_at: $collected_at,
    ok: true,
    duration_sec: $duration,
    metrics: {
      homepage_http_code: (if $homepage_http_code == "null" then null else ($homepage_http_code | tonumber) end),
      homepage_time_total_sec: (if $homepage_time_total == "null" then null else ($homepage_time_total | tonumber) end),
      sample_assets_checked: $sample_checked,
      sample_assets_hit: $sample_hit,
      sample_assets_miss_or_dynamic: $sample_miss_or_dynamic,
      sample_assets_error: $sample_error,
      sample_assets_non200: $sample_non200
    },
    findings: $findings,
    errors: $errors,
    details: {
      homepage: { http_code: $homepage_http_code, time_total_sec: $homepage_time_total, cf_cache_status: $homepage_cf_cache },
      sampleAssets: $assets
    }
  }' > "$OUT_FILE"

echo "[probe_production] wrote $OUT_FILE"
echo "[probe_production] homepage=${homepage_http_code} time=${homepage_time_total}s cf=${homepage_cf_cache} sample_hit=${sample_hit}/${sample_checked} duration=${duration_sec}s"
