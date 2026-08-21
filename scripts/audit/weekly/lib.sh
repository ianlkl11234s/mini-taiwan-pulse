#!/bin/bash
# scripts/audit/weekly/lib.sh
# 共用 helper：讀 .env、時間戳、JSON 累積與寫檔、密鑰遮蔽。
# 供 collect_supabase.sh / probe_upstream.sh 用 `source` 引入，不單獨執行。
#
# 使用慣例（見 docs/proposal/weekly-audit-2026-08-21/README.md §4）：
#   腳本只「收集」不判斷；每個步驟自己 try/except，失敗記進 errors 並讓 ok:=false，
#   但不可讓整支腳本中斷——其他步驟仍要跑完。

set -uo pipefail

# ---- 路徑 ----
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
CACHE_DIR="$REPO_ROOT/.claude/.cache/weekly-audit"
export REPO_ROOT

# ---- 讀 .env（唯一目的是取得連線字串，絕不 echo 值）----
load_env() {
  if [ -f "$REPO_ROOT/.env" ]; then
    set -a
    # shellcheck disable=SC1091
    . "$REPO_ROOT/.env" >/dev/null 2>&1
    set +a
  fi
}

# ---- 時間戳（固定 +08:00，不依賴系統 TZ）----
now_iso() {
  TZ=Asia/Taipei date +"%Y-%m-%dT%H:%M:%S+08:00"
}

# ---- 計時（macOS date 無 %N，改用 python3 量測秒數）----
timer_start() { python3 -c 'import time; print(time.time())'; }
timer_elapsed() { # $1 = 起始 epoch（浮點秒）
  local start="${1:-0}"
  python3 -c "
try:
    import time
    print(round(time.time() - float(${start:-0}), 1))
except Exception:
    print(0)
"
}

# ---- 密鑰遮蔽：任何輸出最終都要過這一關 ----
redact_secrets() {
  sed -E \
    -e 's#postgres(ql)?://[^"[:space:]]+#<REDACTED>#g' \
    -e 's#eyJ[A-Za-z0-9_=-]{10,}#<REDACTED>#g' \
    -e 's#sk-[A-Za-z0-9]{10,}#<REDACTED>#g'
}

# ---- psql 唯讀查詢 wrapper：回傳單一 JSON 值（jsonb text）----
# 用法：db_json_query "SELECT coalesce(jsonb_agg(row_to_json(t)),'[]'::jsonb)::text FROM (...) t;"
# 每個 session 一律先鎖唯讀交易 + 60s timeout；SQL 內容只能是 SELECT，呼叫端負責。
db_json_query() {
  local sql="$1"
  local out err rc
  err=$(mktemp)
  out=$(psql "$SUPABASE_DB_URL" -At -v ON_ERROR_STOP=1 \
    -c "SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY; SET statement_timeout = '60s'; $sql" \
    2>"$err")
  rc=$?
  if [ $rc -ne 0 ]; then
    echo "psql failed (rc=$rc): $(tr '\n' ' ' < "$err" | redact_secrets | cut -c1-300)" >&2
    rm -f "$err"
    return 1
  fi
  rm -f "$err"
  printf '%s' "$out"
}

# =====================================================================
# 累積器：一支收集器一份報告。init_report 開始，write_report 收尾寫檔。
# =====================================================================

init_report() {
  COLLECTOR_NAME="$1"
  mkdir -p "$CACHE_DIR"
  REPORT_START_EPOCH=$(timer_start)
  METRICS_FILE=$(mktemp)
  FINDINGS_FILE=$(mktemp)
  ERRORS_FILE=$(mktemp)
  echo '{}' > "$METRICS_FILE"
  : > "$FINDINGS_FILE"
  : > "$ERRORS_FILE"
  REPORT_OK=true
  CURRENT_STEP="init"
}

# metrics_set <key> <JSON 值字面量，例如數字/陣列/物件字串>
metrics_set() {
  local key="$1" val="$2" tmp
  tmp=$(mktemp)
  if jq --arg k "$key" --argjson v "$val" '.[$k] = $v' "$METRICS_FILE" > "$tmp" 2>/dev/null; then
    mv "$tmp" "$METRICS_FILE"
  else
    rm -f "$tmp"
    report_error "metrics_set failed for key=${key}（value 不是合法 JSON）"
  fi
}

# metrics_set_str <key> <純文字字串>（自動加引號）
metrics_set_str() {
  local key="$1" str="$2"
  metrics_set "$key" "$(jq -Rn --arg s "$str" '$s')"
}

# metrics_merge <JSON 物件字串>：淺層／深層合併進總 metrics（同名 key 直接覆蓋）
metrics_merge() {
  local obj="$1" tmp
  tmp=$(mktemp)
  if jq --argjson extra "$obj" '. * $extra' "$METRICS_FILE" > "$tmp" 2>/dev/null; then
    mv "$tmp" "$METRICS_FILE"
  else
    rm -f "$tmp"
    report_error "metrics_merge failed（value 不是合法 JSON 物件）"
  fi
}

# finding_add <id> <level: green|yellow|red> <title> <detail> <evidence>
finding_add() {
  jq -nc --arg id "$1" --arg level "$2" --arg title "$3" --arg detail "$4" --arg evidence "$5" \
    '{id:$id, level:$level, title:$title, detail:$detail, evidence:$evidence}' >> "$FINDINGS_FILE"
}

# findings_merge <JSON 陣列字串>：把已組好的 findings 陣列整包併入
findings_merge() {
  local arr="$1"
  echo "$arr" | jq -c '.[]' >> "$FINDINGS_FILE" 2>/dev/null || report_error "findings_merge failed（value 不是合法 JSON 陣列）"
}

# report_error <message>：記錯誤並把整份報告標記 ok:false
report_error() {
  local msg="$1"
  jq -nc --arg step "${CURRENT_STEP:-unknown}" --arg message "$msg" '{step:$step, message:$message}' >> "$ERRORS_FILE"
  REPORT_OK=false
}

# report_error_soft <message>：記錯誤但不影響 ok（用於「跳過」而非「失敗」的情況，例如 sibling repo 不存在）
report_error_soft() {
  local msg="$1"
  jq -nc --arg step "${CURRENT_STEP:-unknown}" --arg message "$msg" '{step:$step, message:$message}' >> "$ERRORS_FILE"
}

write_report() {
  local duration findings_json errors_json out_file
  duration=$(timer_elapsed "$REPORT_START_EPOCH")
  [ -z "$duration" ] && duration=0
  findings_json=$(jq -s '.' "$FINDINGS_FILE")
  errors_json=$(jq -s '.' "$ERRORS_FILE")
  mkdir -p "$CACHE_DIR"
  out_file="$CACHE_DIR/${COLLECTOR_NAME}.json"
  jq -n \
    --arg collector "$COLLECTOR_NAME" \
    --arg collected_at "$(now_iso)" \
    --argjson ok "$REPORT_OK" \
    --argjson duration_sec "$duration" \
    --argjson metrics "$(cat "$METRICS_FILE")" \
    --argjson findings "$findings_json" \
    --argjson errors "$errors_json" \
    '{collector:$collector, collected_at:$collected_at, ok:$ok, duration_sec:$duration_sec, metrics:$metrics, findings:$findings, errors:$errors}' \
    | redact_secrets > "$out_file"
  rm -f "$METRICS_FILE" "$FINDINGS_FILE" "$ERRORS_FILE"
  echo "$out_file"
}
