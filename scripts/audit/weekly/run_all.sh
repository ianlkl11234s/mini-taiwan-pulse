#!/usr/bin/env bash
# Weekly Audit — 收集器編排（純讀，不改任何專案檔）
#
# 用法：bash scripts/audit/weekly/run_all.sh [--skip-network] [--only <name>]
#
# 六支收集器各自獨立、互不依賴；任何一支失敗都不中斷其他支，
# 失敗事實會記進 _all.json 的 failed[]，由 skill 判讀時據實寫進報告（不靜默補勾）。
#
# ⚠️ 建議執行時段：週日晚上或週一早上。避開台灣 10:00-20:00 餐期尖峰，
#    因為 collect_supabase / probe_upstream 會對正式 DB 下較重的查詢。
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
CACHE_DIR="$REPO_ROOT/.claude/.cache/weekly-audit"
mkdir -p "$CACHE_DIR"
cd "$REPO_ROOT"

SKIP_NETWORK=0
ONLY=""
while [ $# -gt 0 ]; do
  case "$1" in
    --skip-network) SKIP_NETWORK=1; shift ;;
    --only) ONLY="${2:-}"; shift 2 ;;
    *) echo "未知參數：$1" >&2; exit 2 ;;
  esac
done

# name|runner|script|needs_network
COLLECTORS=(
  "supabase|bash|scripts/audit/weekly/collect_supabase.sh|1"
  "upstream|bash|scripts/audit/weekly/probe_upstream.sh|1"
  "layers|tsx|scripts/audit/weekly/probe_layers.ts|1"
  "production|bash|scripts/audit/weekly/probe_production.sh|1"
  "storage|bash|scripts/audit/weekly/collect_storage.sh|1"
  "docs|tsx|scripts/audit/weekly/check_docs.ts|0"
  "hygiene|bash|scripts/audit/weekly/check_hygiene.sh|0"
)

STARTED_AT="$(date -Iseconds)"
OK=(); FAILED=(); SKIPPED=()

for entry in "${COLLECTORS[@]}"; do
  IFS='|' read -r name runner script needs_net <<< "$entry"
  if [ -n "$ONLY" ] && [ "$ONLY" != "$name" ]; then continue; fi

  if [ "$SKIP_NETWORK" = "1" ] && [ "$needs_net" = "1" ]; then
    echo ",skip  $name (--skip-network)"; SKIPPED+=("$name"); continue
  fi
  if [ ! -f "$script" ]; then
    echo "skip  $name (腳本不存在: $script)"; SKIPPED+=("$name"); continue
  fi

  echo ">>  $name ..."
  t0=$(date +%s)
  if [ "$runner" = "tsx" ]; then npx tsx "$script"; else bash "$script"; fi
  rc=$?
  t1=$(date +%s)

  if [ $rc -eq 0 ]; then
    echo "ok   $name ($((t1-t0))s)"; OK+=("$name")
  else
    echo "FAIL $name exit=$rc ($((t1-t0))s)"; FAILED+=("$name")
  fi
done

python3 - "$CACHE_DIR" "$STARTED_AT" "${OK[*]:-}" "${FAILED[*]:-}" "${SKIPPED[*]:-}" <<'PY'
import json, sys, pathlib, datetime
cache, started = pathlib.Path(sys.argv[1]), sys.argv[2]
ok, failed, skipped = sys.argv[3].split(), sys.argv[4].split(), sys.argv[5].split()
collectors = {}
for name in ok:
    f = cache / f"{name}.json"
    if f.exists():
        try:
            collectors[name] = json.loads(f.read_text(encoding="utf-8"))
        except Exception as e:
            collectors[name] = {"ok": False, "errors": [f"JSON parse failed: {e}"]}
out = {
    "run_started_at": started,
    "run_finished_at": datetime.datetime.now().astimezone().isoformat(timespec="seconds"),
    "ok": ok, "failed": failed, "skipped": skipped,
    "collectors": collectors,
}
(cache / "_all.json").write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")

findings = [f for c in collectors.values() for f in c.get("findings", [])]
tally = {lv: sum(1 for f in findings if f.get("level") == lv) for lv in ("red", "yellow", "green")}
print("\n-- 收集完成 --")
print(f"成功 {len(ok)} / 失敗 {len(failed)} / 略過 {len(skipped)}")
print(f"findings: RED {tally['red']} / YELLOW {tally['yellow']} / GREEN {tally['green']}")
if failed:
    print(f"!! 失敗的收集器: {', '.join(failed)} -- 報告必須據實記為 blocked，不可當作無異常")
print(f"-> {cache/'_all.json'}")
PY

if [ ${#FAILED[@]} -gt 0 ]; then exit 1; fi
exit 0
