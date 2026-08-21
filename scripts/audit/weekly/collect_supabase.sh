#!/bin/bash
# scripts/audit/weekly/collect_supabase.sh
# 週巡檢 B 組（儲存與成本）+ C 組（效能）之 Supabase 唯讀收集器。
# 覆蓋：B1 DB 總量／schema 分佈／top20 大表、B2 retention 缺口候選、
#       B3 pg_cron 健康度、C1 pg_stat_statements 慢查詢原始快照、C3 孤兒 RPC 精算。
#
# 硬約束：DB 一律唯讀（唯讀交易鎖 + 60s statement_timeout）；不輸出任何密鑰；
#         單一步驟失敗記進 errors 並讓 ok:=false，不中斷其他步驟。
#
# 輸出：.claude/.cache/weekly-audit/supabase.json（契約見 docs/proposal/weekly-audit-2026-08-21/README.md）

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./lib.sh
source "$SCRIPT_DIR/lib.sh"

load_env
init_report "supabase"

if [ -z "${SUPABASE_DB_URL:-}" ]; then
  CURRENT_STEP="init"
  report_error "SUPABASE_DB_URL 未設定（.env 缺這個 key 或讀取失敗）"
  write_report
  exit 0
fi

CURRENT_STEP="B1_B2_B3_C1_C3"

# 整支收集邏輯放同一個 python3 連線內完成（省連線往返），
# 每個小節各自 try/except，單節失敗不影響其他節；最後印一行 JSON 給 bash 接手。
PY_RESULT="$(python3 <<'PYEOF'
import os, re, json, subprocess

result = {"ok": True, "metrics": {}, "findings": [], "errors": []}

def err(step, exc):
    result["ok"] = False
    result["errors"].append({"step": step, "message": str(exc)[:300]})

try:
    import psycopg2
except Exception as e:
    err("connect", e)
    print(json.dumps(result, ensure_ascii=False))
    raise SystemExit(0)

conn = None
try:
    dsn = os.environ["SUPABASE_DB_URL"]
    conn = psycopg2.connect(dsn, connect_timeout=15)
    conn.autocommit = True
    cur = conn.cursor()
    cur.execute("SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY;")
    cur.execute("SET statement_timeout = '60s';")
except Exception as e:
    err("connect", e)
    print(json.dumps(result, ensure_ascii=False))
    raise SystemExit(0)

SYSTEM_SCHEMAS = (
    'pg_catalog', 'information_schema', 'cron', 'pgsodium', 'vault',
    'extensions', 'auth', 'storage', 'realtime', 'graphql', 'graphql_public',
    'pgbouncer', 'net', 'supabase_functions', 'pgsodium_masks',
)

# ---------------- B1: DB 總量／schema 分佈／top20 大表 ----------------
try:
    cur.execute("SELECT pg_database_size(current_database()), pg_size_pretty(pg_database_size(current_database()));")
    size_bytes, size_pretty = cur.fetchone()
    result["metrics"]["db_size_bytes"] = int(size_bytes)
    result["metrics"]["db_size_pretty"] = size_pretty

    cur.execute("""
        SELECT schemaname, count(*)::int,
               sum(pg_total_relation_size(schemaname||'.'||tablename))::bigint,
               pg_size_pretty(sum(pg_total_relation_size(schemaname||'.'||tablename))::bigint)
        FROM pg_tables
        WHERE schemaname NOT IN %s
        GROUP BY schemaname
        ORDER BY 3 DESC;
    """, (SYSTEM_SCHEMAS,))
    schema_summary = [
        {"schema": s, "table_count": c, "total_bytes": int(b or 0), "total_pretty": p}
        for s, c, b, p in cur.fetchall()
    ]
    result["metrics"]["schema_summary"] = schema_summary

    cur.execute("""
        SELECT schemaname||'.'||tablename AS tbl,
               pg_total_relation_size(schemaname||'.'||tablename)::bigint AS bytes,
               pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS pretty
        FROM pg_tables
        WHERE schemaname NOT IN %s
        ORDER BY 2 DESC
        LIMIT 20;
    """, (SYSTEM_SCHEMAS,))
    result["metrics"]["top20_tables"] = [
        {"table": t, "bytes": int(b), "pretty": p} for t, b, p in cur.fetchall()
    ]
except Exception as e:
    err("B1", e)

# ---------------- B2: retention 缺口候選（live schema 大表 x cron cleanup 覆蓋）----------------
try:
    cur.execute("""
        SELECT tablename, pg_total_relation_size('live.'||tablename)::bigint
        FROM pg_tables
        WHERE schemaname = 'live'
          AND pg_total_relation_size('live.'||tablename) > 100*1024*1024
        ORDER BY 2 DESC;
    """)
    big_live_tables = cur.fetchall()

    cur.execute("SELECT jobname, command FROM cron.job;")
    cron_jobs = cur.fetchall()
    cleanup_kw = ('delete', 'cleanup', 'prune', 'drop table', 'truncate')

    def has_cleanup_policy(tablename: str) -> bool:
        needle = tablename.lower()
        for jobname, command in cron_jobs:
            text = f"{jobname} {command}".lower()
            if needle in text and any(k in text for k in cleanup_kw):
                return True
        return False

    retention = []
    for tablename, nbytes in big_live_tables:
        covered = has_cleanup_policy(tablename)
        retention.append({
            "table": f"live.{tablename}",
            "bytes": int(nbytes),
            "has_cleanup_policy": covered,
        })
    result["metrics"]["retention_candidates"] = retention
    gap = [r for r in retention if not r["has_cleanup_policy"]]
    result["metrics"]["retention_gap_count"] = len(gap)

    if gap:
        names = ", ".join(r["table"] for r in gap[:25])
        if len(gap) > 25:
            names += f" …（共 {len(gap)} 個）"
        result["findings"].append({
            "id": "B2",
            "level": "yellow",
            "title": f"{len(gap)} 個 live 大表（>100MB）表名未出現在任何 cron cleanup 指令中",
            "detail": (
                "口徑：表名是否以字面出現在 cron.job.command 且該指令含 "
                "delete/cleanup/prune/drop table/truncate 關鍵字。"
                "已知限制：日期分割表（如 xxx_20260815）多半由通用 "
                "cleanup_expired_partitions() 之類的 job 涵蓋，字面比對抓不到，"
                "屬已知誤報來源，需人工複核而非直接當缺口。"
            ),
            "evidence": names,
        })
    else:
        result["findings"].append({
            "id": "B2", "level": "green",
            "title": "live 大表皆有對應 cron cleanup 字面命中",
            "detail": "", "evidence": "",
        })
except Exception as e:
    err("B2", e)

# ---------------- B3: pg_cron 健康度 ----------------
try:
    cur.execute("SELECT count(*)::int FROM cron.job;")
    total_jobs = cur.fetchone()[0]
    result["metrics"]["cron_total_jobs"] = total_jobs

    cur.execute("""
        SELECT status, count(*)::int FROM cron.job_run_details
        WHERE start_time > now() - interval '7 days'
        GROUP BY status;
    """)
    result["metrics"]["cron_7day_status_counts"] = {s: c for s, c in cur.fetchall()}

    cur.execute("""
        SELECT j.jobname, j.schedule, j.active
        FROM cron.job j
        WHERE NOT EXISTS (
            SELECT 1 FROM cron.job_run_details r
            WHERE r.jobid = j.jobid AND r.start_time > now() - interval '7 days'
        )
        ORDER BY j.jobname;
    """)
    zero_run = [{"jobname": n, "schedule": s, "active": a} for n, s, a in cur.fetchall()]
    result["metrics"]["cron_zero_run_jobs"] = zero_run

    cur.execute("""
        SELECT DISTINCT ON (j.jobname) j.jobname, r.start_time::text,
               left(coalesce(r.return_message, ''), 200)
        FROM cron.job_run_details r
        JOIN cron.job j ON j.jobid = r.jobid
        WHERE r.start_time > now() - interval '7 days' AND r.status = 'failed'
        ORDER BY j.jobname, r.start_time DESC;
    """)
    failed = [{"jobname": n, "last_failed_at": t, "last_error": m} for n, t, m in cur.fetchall()]
    result["metrics"]["cron_failed_jobs"] = failed

    active_zero_run = [j for j in zero_run if j["active"]]
    if active_zero_run:
        names = ", ".join(f'{j["jobname"]}({j["schedule"]})' for j in active_zero_run[:20])
        result["findings"].append({
            "id": "B3",
            "level": "red",
            "title": f"{len(active_zero_run)} 個啟用中的 pg_cron job 近 7 天完全沒有執行紀錄",
            "detail": "job 仍是 active=true，但 cron.job_run_details 近 7 天查無任何一筆——疑似排程停擺或剛建立未到首次觸發窗口，需人工確認。",
            "evidence": names,
        })
    inactive_zero_run = [j for j in zero_run if not j["active"]]
    if inactive_zero_run:
        names = ", ".join(j["jobname"] for j in inactive_zero_run[:20])
        result["findings"].append({
            "id": "B3",
            "level": "yellow",
            "title": f"{len(inactive_zero_run)} 個已停用（active=false）的 job 近 7 天無執行紀錄",
            "detail": "非緊急，僅供盤點是否該清除。",
            "evidence": names,
        })
    if failed:
        names = ", ".join(f'{f["jobname"]}' for f in failed[:20])
        result["findings"].append({
            "id": "B3",
            "level": "red",
            "title": f"{len(failed)} 個 job 近 7 天出現過失敗執行",
            "detail": "詳見 metrics.cron_failed_jobs（含最後一次錯誤訊息前 200 字）。",
            "evidence": names,
        })
    if not zero_run and not failed:
        result["findings"].append({
            "id": "B3", "level": "green",
            "title": f"pg_cron {total_jobs} 個 job 近 7 天全數正常執行",
            "detail": "", "evidence": "",
        })
except Exception as e:
    err("B3", e)

# ---------------- C1: pg_stat_statements 慢查詢原始快照（給下週差分用）----------------
try:
    cur.execute("SELECT stats_reset::text FROM pg_stat_statements_info;")
    row = cur.fetchone()
    result["metrics"]["pg_stat_statements_reset_at"] = row[0] if row else None

    cur.execute("""
        SELECT queryid::text, calls, total_exec_time, mean_exec_time, left(query, 120)
        FROM pg_stat_statements
        WHERE mean_exec_time > 200
        ORDER BY mean_exec_time DESC
        LIMIT 40;
    """)
    slow = [
        {
            "queryid": qid,
            "calls": calls,
            "total_exec_time": float(total_t),
            "mean_exec_time": float(mean_t),
            "query": q,
        }
        for qid, calls, total_t, mean_t, q in cur.fetchall()
    ]
    # queryid 用字串存：bigint 範圍超出 JS/JSON number 安全整數，避免下游精度誤差
    result["metrics"]["slow_queries_snapshot"] = slow
    result["metrics"]["slow_queries_count"] = len(slow)
    if slow:
        result["findings"].append({
            "id": "C1",
            "level": "yellow",
            "title": f"{len(slow)} 筆查詢 mean_exec_time > 200ms（累計視圖，本週僅存 raw snapshot）",
            "detail": (
                "pg_stat_statements 是自上次 reset 起的累計值，本次不做判讀，"
                "只存原始快照供下週做差分（見 metrics.slow_queries_snapshot / "
                "pg_stat_statements_reset_at）。呼叫者歸屬（前端 / cron / 上游 repo）"
                "留給 skill 判讀，本收集器不做。"
            ),
            "evidence": f"最慢：{slow[0]['query'][:80]}… mean={slow[0]['mean_exec_time']:.0f}ms calls={slow[0]['calls']}",
        })
except Exception as e:
    err("C1", e)

# ---------------- C3: 孤兒 RPC 精算 ----------------
try:
    cur.execute("""
        SELECT DISTINCT p.proname
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND NOT EXISTS (
              SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e'
          )
        ORDER BY 1;
    """)
    all_funcs = set(r[0] for r in cur.fetchall())

    cur.execute("SELECT command FROM cron.job;")
    cron_blob = " ".join(r[0] or "" for r in cur.fetchall())
    cron_tokens = set(re.findall(r'[a-z0-9_]+', cron_blob.lower()))

    repo_root = os.environ.get("REPO_ROOT", ".")
    frontend_rpcs = set()
    proc = subprocess.run(
        # -a：src/data/layerParamsSpec.ts 含非文字位元組，BSD grep 沒這個旗標會判成 binary
        # 靜默回空結果（不報錯）—— README §3.1 陷阱 1 點名過的坑。
        ["grep", "-arhoE", r"\.rpc\(\s*['\"][a-z0-9_]+", "src/"],
        capture_output=True, text=True, cwd=repo_root,
    )
    for line in proc.stdout.splitlines():
        m = re.search(r'[a-z0-9_]+$', line)
        if m:
            frontend_rpcs.add(m.group(0))

    excluded_cron = all_funcs & cron_tokens
    excluded_frontend = all_funcs & frontend_rpcs
    orphans = sorted(all_funcs - cron_tokens - frontend_rpcs)

    result["metrics"]["orphan_rpc_count"] = len(orphans)
    result["metrics"]["orphan_rpc_candidates"] = orphans
    result["metrics"]["orphan_rpc_pipeline"] = {
        "public_functions_non_extension": len(all_funcs),
        "excluded_referenced_by_cron": len(excluded_cron),
        "excluded_called_by_frontend": len(excluded_frontend),
    }
    preview = ", ".join(orphans[:20])
    if len(orphans) > 20:
        preview += f" …（共 {len(orphans)} 個，完整清單見 metrics.orphan_rpc_candidates）"
    result["findings"].append({
        "id": "C3",
        "level": "yellow",
        "title": f"{len(orphans)} 個 public function 候選孤兒 RPC",
        "detail": (
            "口徑：public schema function 排除 extension-owned（pg_depend deptype='e'）"
            "→ 排除名稱出現在任何 cron.job.command 的 → 排除前端 src/ 有 .rpc() 呼叫的。"
            "剩餘候選裡可能仍有被 RLS policy 或 SECURITY DEFINER 內部呼叫的，"
            "需人工分批判生死，不代表全部可刪。"
        ),
        "evidence": preview,
    })
except Exception as e:
    err("C3", e)

if conn is not None:
    conn.close()

try:
    print(json.dumps(result, ensure_ascii=False))
except Exception as e:
    print(json.dumps({"ok": False, "metrics": {}, "findings": [],
                       "errors": [{"step": "serialize", "message": str(e)[:300]}]}))
PYEOF
)"
PY_RC=$?

if [ $PY_RC -ne 0 ] || ! echo "$PY_RESULT" | jq -e . >/dev/null 2>&1; then
  report_error "python3 收集主體非正常結束（rc=${PY_RC}），輸出不是合法 JSON，此輪 B1/B2/B3/C1/C3 可能部分或全數缺漏"
else
  py_ok=$(echo "$PY_RESULT" | jq -r '.ok')
  [ "$py_ok" = "false" ] && REPORT_OK=false
  metrics_merge "$(echo "$PY_RESULT" | jq -c '.metrics // {}')"
  findings_merge "$(echo "$PY_RESULT" | jq -c '.findings // []')"
  findings_merge_errs="$(echo "$PY_RESULT" | jq -c '.errors // []')"
  echo "$findings_merge_errs" | jq -c '.[]' 2>/dev/null | while IFS= read -r e; do
    echo "$e" >> "$ERRORS_FILE"
  done
  # python 端若有 errors，確保 ok 反映出來（above py_ok 已處理，這裡再保險一次）
  if [ "$(echo "$findings_merge_errs" | jq 'length')" -gt 0 ] 2>/dev/null; then
    REPORT_OK=false
  fi
fi

write_report
