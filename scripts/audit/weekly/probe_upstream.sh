#!/bin/bash
# scripts/audit/weekly/probe_upstream.sh
# 週巡檢 A 組（資料活性，動態表斷更）+ 上游 sibling repo 唯讀探測。
# 覆蓋：A1 前置（讀 data-collectors 頻率清冊）、A1（live schema 509 表最後資料時間 vs 固定閾值）、
#       F2（半動態重抓提醒，複用 gis-data-onboard 的 check_refresh.py）、
#       三個 sibling repo 的 git status / ahead-behind（只讀不動）。
#
# 硬約束：DB 一律唯讀（唯讀交易鎖 + 60s／單表 5s statement_timeout）；不輸出任何密鑰；
#         sibling repo 任一不存在就跳過記進 metrics.skipped，不報錯；
#         單一步驟失敗記進 errors 並讓 ok:=false，不中斷其他步驟。
#
# 輸出：.claude/.cache/weekly-audit/upstream.json

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./lib.sh
source "$SCRIPT_DIR/lib.sh"

load_env
init_report "upstream"

GIS_PLATFORM_DIR="$REPO_ROOT/../gis-platform"
DATA_COLLECTORS_DIR="$REPO_ROOT/../data-collectors"
ANALYTICS_DIR="$REPO_ROOT/../taipei-gis-analytics"
REALTIME_TABLES_YAML="$DATA_COLLECTORS_DIR/config/realtime_tables.yaml"
CHECK_REFRESH_PY="$ANALYTICS_DIR/.claude/skills/gis-data-onboard/scripts/check_refresh.py"

SKIPPED_FILE=$(mktemp)
: > "$SKIPPED_FILE"
note_skipped() {
  # $1 = 描述文字
  jq -Rn --arg s "$1" '$s' >> "$SKIPPED_FILE"
}

# =====================================================================
# A1 前置 + A1：live schema 動態表斷更掃描
# 一個 python3 連線內做完：先讀 sibling repo 的頻率清冊（純檔案讀取，非 DB），
# 再對 DB 的 live schema 大表逐一掃 max(timestamp 欄位)。
# =====================================================================
CURRENT_STEP="A1"

if [ -z "${SUPABASE_DB_URL:-}" ]; then
  report_error "SUPABASE_DB_URL 未設定，A1 無法掃描"
else
  # yaml 頻率清冊只是「加分」輸入：沒有它 A1 掃描仍要跑，只是 expected_frequency 留空、
  # 全部退回固定閾值判斷（spec 原文：「沒有它就只能用固定閾值」，不是「沒有它就整段跳過」）。
  if [ -f "$REALTIME_TABLES_YAML" ]; then
    export A1_YAML_PATH="$REALTIME_TABLES_YAML"
  else
    note_skipped "A1 前置：$REALTIME_TABLES_YAML 不存在，expected_frequency 留空，A1 掃描改用固定閾值"
    unset A1_YAML_PATH
  fi
  PY_RESULT="$(python3 <<'PYEOF'
import os, json, re

result = {"ok": True, "metrics": {}, "findings": [], "errors": []}

def err(step, exc):
    result["ok"] = False
    result["errors"].append({"step": step, "message": str(exc)[:300]})

# ---------------- A1 前置：讀 data-collectors 頻率清冊（沒有就留空，不算失敗）----------------
expected_frequency = {}
yaml_path = os.environ.get("A1_YAML_PATH")
if yaml_path:
    try:
        import yaml
        with open(yaml_path, encoding="utf-8") as f:
            data = yaml.safe_load(f) or {}
        for t in data.get("tables", []):
            schema = t.get("schema", "live")
            table = t.get("table")
            interval = t.get("expected_interval_min")
            if not table:
                continue
            key = f"{schema}.{table}"
            expected_frequency[key] = f"{interval}min" if interval is not None else None
    except Exception as e:
        err("A1_prereq", e)
result["metrics"]["expected_frequency"] = expected_frequency

# ---------------- A1：live schema 動態表斷更掃描 ----------------
try:
    import psycopg2
    dsn = os.environ["SUPABASE_DB_URL"]
    conn = psycopg2.connect(dsn, connect_timeout=15)
    conn.autocommit = True
    cur = conn.cursor()
    cur.execute("SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY;")
    cur.execute("SET statement_timeout = '60s';")

    cur.execute("""
        SELECT tablename, pg_total_relation_size('live.'||tablename)::bigint
        FROM pg_tables
        WHERE schemaname = 'live'
          AND pg_total_relation_size('live.'||tablename) > 1024*1024
        ORDER BY 2 DESC;
    """)
    big_tables = cur.fetchall()

    cur.execute("""
        SELECT table_name, column_name
        FROM information_schema.columns
        WHERE table_schema = 'live' AND data_type LIKE 'timestamp%';
    """)
    cols_by_table = {}
    for tname, cname in cur.fetchall():
        cols_by_table.setdefault(tname, set()).add(cname)

    # 偏離 task spec 給的原始優先序（多插入 collected_at，緊接 observed_at 之後）：
    # 現場驗證 data-collectors/config/realtime_tables.yaml 顯示幾乎所有 critical 動態表
    # （bus_positions／ship_positions／youbike_snapshots／weather_observations…）
    # 的 time_column 都是 collected_at，原始清單漏了它會讓 A1 對這些主角表整批
    # 落入「no_timestamp_column」、直接失明。回報時已明確揭露此偏離，非未告知變更。
    priority = ['ts', 'timestamp', 'observed_at', 'collected_at', 'recorded_at', 'created_at', 'updated_at', 'fetched_at']

    freshness = []
    no_col_tables = []
    scan_errors = []

    # 單表 5s timeout：避免個別表拖垮整個 509 表掃描
    cur.execute("SET statement_timeout = '5s';")

    for tname, nbytes in big_tables:
        cols = cols_by_table.get(tname, set())
        chosen = next((c for c in priority if c in cols), None)
        if chosen is None:
            no_col_tables.append(f"live.{tname}")
            continue
        try:
            cur.execute(
                f'SELECT max("{chosen}")::text, '
                f'EXTRACT(EPOCH FROM (now() - max("{chosen}")))/3600.0 '
                f'FROM live."{tname}";'
            )
            last_ts, lag_hours = cur.fetchone()
        except Exception as e:
            scan_errors.append({"table": f"live.{tname}", "message": str(e)[:200]})
            try:
                conn.rollback()
            except Exception:
                pass
            continue

        lag_hours = float(lag_hours) if lag_hours is not None else None

        if lag_hours is None:
            level = "yellow"
        elif lag_hours > 168:
            level = "red"
        elif lag_hours > 48:
            level = "yellow"
        else:
            level = "green"

        key = f"live.{tname}"
        # 表名符合 _YYYYMMDD 結尾＝日期分割表慣例（如 bus_positions_20260819）。
        # 這類表本來就是「當日份」歷史快照，過了那天就不會再寫入——不是真斷更，
        # 是本掃描法（逐表看 max(time_column)）的已知誤報來源，標記出來讓後續判讀能分流。
        is_dated_partition = bool(re.search(r'_20\d{6}$', tname))
        freshness.append({
            "table": key,
            "bytes": int(nbytes),
            "time_column": chosen,
            "last_data_at": last_ts,
            "lag_hours": round(lag_hours, 1) if lag_hours is not None else None,
            "level": level,
            "expected_frequency": expected_frequency.get(key),
            "dated_partition": is_dated_partition,
        })

    result["metrics"]["live_table_freshness"] = freshness
    result["metrics"]["live_table_freshness_no_timestamp_column"] = no_col_tables
    summary = {"red": 0, "yellow": 0, "green": 0}
    for row in freshness:
        summary[row["level"]] = summary.get(row["level"], 0) + 1
    summary["no_timestamp_column"] = len(no_col_tables)
    summary["scan_errors"] = len(scan_errors)
    result["metrics"]["live_table_freshness_summary"] = summary

    for e in scan_errors:
        result["errors"].append({"step": "A1_scan", "message": f'{e["table"]}: {e["message"]}'})
    if scan_errors:
        result["ok"] = False

    red_rows = [r for r in freshness if r["level"] == "red"]
    red_dated = [r for r in red_rows if r["dated_partition"]]
    red_live = [r for r in red_rows if not r["dated_partition"]]
    for r in red_live:
        freq_note = f'（預期頻率：{r["expected_frequency"]}）' if r["expected_frequency"] else ""
        result["findings"].append({
            "id": "A1",
            "level": "red",
            "title": f'{r["table"]} 已 {r["lag_hours"]:.0f} 小時無新資料',
            "detail": f'time_column={r["time_column"]}，last_data_at={r["last_data_at"]}{freq_note}，上游 collector 疑似停擺，需人工確認。',
            "evidence": r["table"],
        })
    if red_dated:
        names = ", ".join(r["table"] for r in red_dated[:20])
        if len(red_dated) > 20:
            names += f" …（共 {len(red_dated)} 個）"
        result["findings"].append({
            "id": "A1",
            "level": "red",
            "title": f"{len(red_dated)} 個日期分割表（xxx_YYYYMMDD）判定為斷更，多屬預期",
            "detail": (
                "表名符合 _YYYYMMDD 結尾，多半是「當日份」歷史快照表，過了那天本來就不再寫入——"
                "不是真斷更，是本掃描法（逐表看 max(time_column)）的已知誤報來源。"
                "真正該看的是同主題的 xxx_current／無日期後綴主表；這批建議 skill 判讀時直接降級，"
                "不要逐一當拍板項列出。"
            ),
            "evidence": names,
        })
    yellow_rows = [r for r in freshness if r["level"] == "yellow"]
    if yellow_rows:
        names = ", ".join(r["table"] for r in yellow_rows[:20])
        if len(yellow_rows) > 20:
            names += f" …（共 {len(yellow_rows)} 個）"
        result["findings"].append({
            "id": "A1",
            "level": "yellow",
            "title": f"{len(yellow_rows)} 個 live 表 lag 介於 48~168 小時或無法判斷最後時間",
            "detail": "固定閾值初判（>48h yellow、>168h red），未套用逐表 expected_frequency 動態閾值，skill 判讀時可再用 metrics.expected_frequency 覆寫。",
            "evidence": names,
        })
    if not red_rows and not yellow_rows:
        result["findings"].append({
            "id": "A1", "level": "green",
            "title": f"{len(freshness)} 個 live 大表最後資料時間皆在 48 小時內",
            "detail": "", "evidence": "",
        })

    conn.close()
except Exception as e:
    err("A1", e)

try:
    print(json.dumps(result, ensure_ascii=False))
except Exception as e:
    print(json.dumps({"ok": False, "metrics": {}, "findings": [],
                       "errors": [{"step": "serialize", "message": str(e)[:300]}]}))
PYEOF
)"
  PY_RC=$?

  if [ $PY_RC -ne 0 ] || ! echo "$PY_RESULT" | jq -e . >/dev/null 2>&1; then
    report_error "A1 python3 主體非正常結束（rc=${PY_RC}），live schema 斷更掃描可能部分或全數缺漏"
  else
    py_ok=$(echo "$PY_RESULT" | jq -r '.ok')
    [ "$py_ok" = "false" ] && REPORT_OK=false
    metrics_merge "$(echo "$PY_RESULT" | jq -c '.metrics // {}')"
    findings_merge "$(echo "$PY_RESULT" | jq -c '.findings // []')"
    echo "$PY_RESULT" | jq -c '.errors // [] | .[]' 2>/dev/null | while IFS= read -r e; do
      echo "$e" >> "$ERRORS_FILE"
    done
  fi
fi

# =====================================================================
# F2：半動態資料重抓提醒（複用 gis-data-onboard 的 check_refresh.py）
# =====================================================================
CURRENT_STEP="F2"
if [ ! -f "$CHECK_REFRESH_PY" ]; then
  note_skipped "F2：$CHECK_REFRESH_PY 不存在，跳過半動態重抓提醒"
else
  F2_OUT=$(python3 "$CHECK_REFRESH_PY" 2>&1)
  F2_RC=$?
  if [ $F2_RC -ne 0 ] && [ $F2_RC -ne 1 ]; then
    # 依腳本設計：exit 1 = 有過期項目（正常訊號），其他非 0 才算真的跑壞
    report_error "F2 check_refresh.py 執行失敗（rc=${F2_RC}）：$(echo "$F2_OUT" | tr '\n' ' ' | cut -c1-300)"
  else
    F2_LEVEL="green"
    [ $F2_RC -eq 1 ] && F2_LEVEL="yellow"
    F2_EVIDENCE=$(echo "$F2_OUT" | cut -c1-4000)
    finding_add "F2" "$F2_LEVEL" "半動態資料重抓提醒（check_refresh.py）" \
      "複用 taipei-gis-analytics gis-data-onboard skill 的掃描結果，exit code ${F2_RC}（1=有過期項目）" \
      "$F2_EVIDENCE"
  fi
fi

# =====================================================================
# 三個 sibling repo：git status --porcelain 計數 + ahead/behind（只讀不動）
# =====================================================================
CURRENT_STEP="sibling_repos"
SIBLING_RESULTS="[]"
for repo_path in "$GIS_PLATFORM_DIR" "$DATA_COLLECTORS_DIR" "$ANALYTICS_DIR"; do
  repo_name=$(basename "$repo_path")
  if [ ! -d "$repo_path/.git" ]; then
    note_skipped "sibling repo $repo_name 不存在或非 git repo（${repo_path}），跳過"
    continue
  fi

  dirty_count=$(git -C "$repo_path" status --porcelain 2>/dev/null | wc -l | tr -d ' ')
  branch=$(git -C "$repo_path" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
  upstream_ref=$(git -C "$repo_path" rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>/dev/null)

  if [ -n "$upstream_ref" ]; then
    ab=$(git -C "$repo_path" rev-list --left-right --count '@{u}...HEAD' 2>/dev/null)
    behind=$(echo "$ab" | awk '{print $1+0}')
    ahead=$(echo "$ab" | awk '{print $2+0}')
  else
    behind="null"
    ahead="null"
  fi

  entry=$(jq -nc \
    --arg repo "$repo_name" \
    --arg branch "$branch" \
    --argjson dirty "${dirty_count:-0}" \
    --argjson ahead "$ahead" \
    --argjson behind "$behind" \
    --argjson has_upstream "$([ -n "$upstream_ref" ] && echo true || echo false)" \
    '{repo:$repo, branch:$branch, dirty_files:$dirty, has_upstream:$has_upstream, ahead:$ahead, behind:$behind}')
  SIBLING_RESULTS=$(echo "$SIBLING_RESULTS" | jq --argjson e "$entry" '. + [$e]')
done
metrics_set "sibling_repos" "$SIBLING_RESULTS"

# =====================================================================
# 收尾：skipped 清單
# =====================================================================
SKIPPED_JSON=$(jq -s '.' "$SKIPPED_FILE")
rm -f "$SKIPPED_FILE"
metrics_set "skipped" "$SKIPPED_JSON"

write_report
