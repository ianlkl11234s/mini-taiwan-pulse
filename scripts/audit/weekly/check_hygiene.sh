#!/usr/bin/env bash
# Weekly Audit — E 組「Git 與 repo hygiene」收集器（E1 / E2 / E3 / E4）
#
# 見 docs/proposal/weekly-audit-2026-08-21/README.md §2 E 組。
#
#   E1 未 push 的本地 branch：`git for-each-ref` 抓 upstream:track。
#      ⚠️ 「未 push」比字面上的 ahead>0 更寬：沒設定 upstream 的 branch（從沒推過）
#      也算未 push，甚至比 ahead>0 更徹底——一併列入，原因寫進 metrics.e1.unpushed[].reason
#      （no_upstream / ahead / upstream_gone），不靜默漏掉這類 branch。排除 master/main。
#
#   E2 工作區 dirty 檔：`git status --porcelain`。本 repo 長期有平行 session，
#      **只列不動**——finding 明確註記這些檔案可能不是本次巡檢造成的。
#
#   E3 大檔誤入 git：`git ls-files` 逐檔 stat 大小，> 5MB 列出。純讀，不管 .gitignore
#      現況如何（已被 gitignore 的檔案 `git ls-files` 本來就看不到，那是預期行為）。
#
#   E4 `public/` 總量：`du -sk`（不逐檔 hash，控制大目錄掃描耗時）+ 檔案數 +
#      被 git 追蹤的檔案數，純記錄供跨週趨勢比較，無固定閾值。
#
# 輸出：.claude/.cache/weekly-audit/hygiene.json（不進版控）
# 執行：bash scripts/audit/weekly/check_hygiene.sh
#
# 硬約束：純讀，不 commit／不 push／不移動任何檔案／不改 .gitignore；
#         任何子步驟失敗都不中斷整支（靠 `|| true` + errors[] 表達，最終仍寫出 JSON、exit 0）。
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
CACHE_DIR="$REPO_ROOT/.claude/.cache/weekly-audit"
OUT_FILE="$CACHE_DIR/hygiene.json"
mkdir -p "$CACHE_DIR"
cd "$REPO_ROOT"

WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR"' EXIT

STARTED_AT_EPOCH=$(date +%s)

# ── E1：本地 branch 未 push ──────────────────────────────────────
git for-each-ref \
  --format='%(refname:short)%09%(upstream)%09%(upstream:track)%09%(committerdate:iso8601)' \
  refs/heads/ > "$WORKDIR/branches.tsv" 2> "$WORKDIR/branches.err" || true

# ── E2：工作區 dirty 檔（只列不動）────────────────────────────────
git status --porcelain > "$WORKDIR/dirty.txt" 2> "$WORKDIR/dirty.err" || true

# ── E3：大檔誤入 git（被追蹤檔案 > 5MB）───────────────────────────
: > "$WORKDIR/tracked_sizes.tsv"
if git ls-files -z > "$WORKDIR/tracked_files.nul" 2> "$WORKDIR/tracked_files.err"; then
  while IFS= read -r -d '' f; do
    if [ -f "$f" ]; then
      sz="$(stat -f%z "$f" 2>/dev/null || stat -c%s "$f" 2>/dev/null || echo "")"
      if [ -n "$sz" ]; then
        printf '%s\t%s\n' "$sz" "$f" >> "$WORKDIR/tracked_sizes.tsv"
      fi
    fi
  done < "$WORKDIR/tracked_files.nul"
fi

# ── E4：public/ 總量（大目錄用 du -sk，不逐檔 hash）────────────────
PUBLIC_DIR="$REPO_ROOT/public"
if [ -d "$PUBLIC_DIR" ]; then
  du -sk "$PUBLIC_DIR" 2>/dev/null | awk '{print $1}' > "$WORKDIR/public_size_kb.txt" || echo "0" > "$WORKDIR/public_size_kb.txt"
  find "$PUBLIC_DIR" -type f 2>/dev/null | wc -l | tr -d ' ' > "$WORKDIR/public_file_count.txt"
else
  echo "0" > "$WORKDIR/public_size_kb.txt"
  echo "0" > "$WORKDIR/public_file_count.txt"
fi
git ls-files -- public 2>/dev/null | wc -l | tr -d ' ' > "$WORKDIR/public_tracked_count.txt"

FINISHED_AT_EPOCH=$(date +%s)
DURATION_SEC=$((FINISHED_AT_EPOCH - STARTED_AT_EPOCH))

python3 - "$WORKDIR" "$DURATION_SEC" "$OUT_FILE" <<'PY'
import datetime
import json
import os
import re
import sys

workdir, duration_sec_raw, out_file = sys.argv[1], sys.argv[2], sys.argv[3]
try:
    duration_sec = float(duration_sec_raw)
except ValueError:
    duration_sec = 0.0

now = datetime.datetime.now().astimezone()


def read_lines(name):
    p = os.path.join(workdir, name)
    if not os.path.exists(p):
        return []
    with open(p, "r", encoding="utf-8", errors="replace") as f:
        return f.read().splitlines()


def read_int(name, default=0):
    lines = read_lines(name)
    if not lines:
        return default
    try:
        return int(lines[0].strip())
    except (ValueError, IndexError):
        return default


def redact(s):
    s = re.sub(r"postgres(?:ql)?://\S+", "<REDACTED>", s, flags=re.I)
    s = re.sub(r"eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+", "<REDACTED>", s)
    s = re.sub(r"sk-[A-Za-z0-9_-]{10,}", "<REDACTED>", s)
    s = re.sub(r"password\s*=\s*\S+", "password=<REDACTED>", s, flags=re.I)
    return s


findings = []
errors = []
metrics = {}

try:
    # ══════════════════════════════════════════════════════════
    # E1 — 未 push 的本地 branch
    # ══════════════════════════════════════════════════════════
    STALE_DAYS_E1 = 14
    all_branches = [l for l in read_lines("branches.tsv") if l.strip()]
    unpushed = []
    for line in all_branches:
        parts = line.split("\t")
        if len(parts) < 4:
            errors.append({"step": "E1", "message": f"for-each-ref 輸出格式異常，欄位不足：{line!r}"})
            continue
        name, upstream, track, committer_date = parts[0], parts[1], parts[2], parts[3]
        if name in ("master", "main"):
            continue

        ahead_m = re.search(r"ahead (\d+)", track)
        ahead = int(ahead_m.group(1)) if ahead_m else 0
        reason = None
        if "gone" in track:
            reason = "upstream_gone"
        elif not upstream:
            reason = "no_upstream"
        elif ahead > 0:
            reason = "ahead"
        if reason is None:
            continue  # 有 upstream 且非 ahead/gone：已同步或落後，不算「未 push」

        days = None
        try:
            cd = datetime.datetime.strptime(committer_date[:19], "%Y-%m-%d %H:%M:%S")
            cd = cd.replace(tzinfo=now.tzinfo)  # 粗略以本機時區處理，週巡檢容許此誤差
            days = (now - cd).days
        except ValueError:
            errors.append({"step": "E1", "message": f"{name}：committerdate 解析失敗（{committer_date!r}）"})

        unpushed.append(
            {
                "branch": name,
                "reason": reason,
                "ahead": ahead,
                "last_commit": committer_date,
                "days_since_commit": days,
            }
        )

    unpushed.sort(key=lambda b: -(b["days_since_commit"] if b["days_since_commit"] is not None else -1))
    stale_unpushed = [b for b in unpushed if b["days_since_commit"] is not None and b["days_since_commit"] > STALE_DAYS_E1]

    metrics["e1"] = {
        "total_local_branches": len(all_branches),
        "unpushed_count": len(unpushed),
        "stale_threshold_days": STALE_DAYS_E1,
        "stale_unpushed_count": len(stale_unpushed),
        "unpushed": unpushed,
    }
    if stale_unpushed:
        findings.append(
            {
                "id": "E1",
                "level": "yellow",
                "title": f"{len(stale_unpushed)} 個本地 branch 未 push 且超過 {STALE_DAYS_E1} 天未動（共 {len(unpushed)} 個未 push）",
                "detail": "\n".join(
                    f"{b['branch']}（{b['reason']}"
                    + (f" +{b['ahead']}" if b["reason"] == "ahead" else "")
                    + f"，{b['days_since_commit']} 天前，{b['last_commit']}）"
                    for b in stale_unpushed
                ),
                "evidence": "git for-each-ref refs/heads/ 的 upstream / upstream:track / committerdate",
            }
        )
    else:
        findings.append(
            {
                "id": "E1",
                "level": "green",
                "title": f"未 push 的本地 branch 共 {len(unpushed)} 個，皆在 {STALE_DAYS_E1} 天內有動靜",
                "detail": "沒有未 push 且超過閾值天數未動的 branch",
                "evidence": "git for-each-ref refs/heads/",
            }
        )

    # ══════════════════════════════════════════════════════════
    # E2 — 工作區 dirty 檔（只列不動）
    # ══════════════════════════════════════════════════════════
    dirty = [l for l in read_lines("dirty.txt") if l.strip()]
    metrics["e2"] = {"dirty_count": len(dirty), "dirty_files": dirty}
    if dirty:
        shown = dirty[:100]
        findings.append(
            {
                "id": "E2",
                "level": "yellow",
                "title": f"工作區有 {len(dirty)} 個 dirty 檔案",
                "detail": "\n".join(shown) + (f"\n...(+{len(dirty) - 100} 未列出)" if len(dirty) > 100 else ""),
                "evidence": "git status --porcelain — 本 repo 長期有平行 session，這些檔案可能不是本次巡檢造成，只列不動、不代為 commit / revert",
            }
        )
    else:
        findings.append(
            {
                "id": "E2",
                "level": "green",
                "title": "工作區乾淨",
                "detail": "git status --porcelain 無輸出",
                "evidence": "git status --porcelain",
            }
        )

    # ══════════════════════════════════════════════════════════
    # E3 — 大檔誤入 git（> 5MB 被追蹤檔案）
    # ══════════════════════════════════════════════════════════
    LARGE_FILE_BYTES = 5 * 1024 * 1024
    large_files = []
    for line in read_lines("tracked_sizes.tsv"):
        parts = line.split("\t", 1)
        if len(parts) != 2:
            continue
        try:
            size_bytes = int(parts[0])
        except ValueError:
            continue
        if size_bytes > LARGE_FILE_BYTES:
            large_files.append({"path": parts[1], "size_mb": round(size_bytes / 1024 / 1024, 1)})
    large_files.sort(key=lambda f: -f["size_mb"])

    metrics["e3"] = {
        "threshold_mb": 5,
        "large_tracked_count": len(large_files),
        "large_tracked_files": large_files,
    }
    if large_files:
        findings.append(
            {
                "id": "E3",
                "level": "yellow",
                "title": f"{len(large_files)} 個被追蹤檔案超過 5MB",
                "detail": "\n".join(f"{f['path']}（{f['size_mb']} MB）" for f in large_files),
                "evidence": "git ls-files 逐檔 stat 大小（已被 .gitignore 排除的檔案本來就不在 git ls-files 清單內，不會誤報）",
            }
        )
    else:
        findings.append(
            {
                "id": "E3",
                "level": "green",
                "title": "無被追蹤的大檔（> 5MB）",
                "detail": "git ls-files 掃描完成，無異常",
                "evidence": "git ls-files 逐檔 stat 大小",
            }
        )

    # ══════════════════════════════════════════════════════════
    # E4 — public/ 總量（純記錄，無固定閾值）
    # ══════════════════════════════════════════════════════════
    public_size_kb = read_int("public_size_kb.txt")
    public_file_count = read_int("public_file_count.txt")
    public_tracked_count = read_int("public_tracked_count.txt")
    public_size_gb = round(public_size_kb / 1024 / 1024, 2)

    metrics["e4"] = {
        "public_size_kb": public_size_kb,
        "public_size_gb": public_size_gb,
        "public_file_count": public_file_count,
        "public_tracked_count": public_tracked_count,
    }
    findings.append(
        {
            "id": "E4",
            "level": "green",
            "title": f"public/ 共 {public_file_count} 檔／{public_size_gb} GB／{public_tracked_count} 檔被 git 追蹤",
            "detail": "純記錄，供跨週趨勢比較（無固定閾值，異常大小變化由 skill 層判讀時對照上週報告）",
            "evidence": "du -sk public + find public -type f | wc -l + git ls-files -- public | wc -l",
        }
    )

    # ── 子步驟層級的 stderr 一併收進 errors[]（不影響上面已完成的收集）──
    for errname, step in (("branches.err", "E1"), ("dirty.err", "E2"), ("tracked_files.err", "E3")):
        for l in read_lines(errname):
            if l.strip():
                errors.append({"step": step, "message": l.strip()})

    output = {
        "collector": "hygiene",
        "collected_at": now.isoformat(timespec="seconds"),
        "ok": True,
        "duration_sec": round(duration_sec, 1),
        "metrics": metrics,
        "findings": findings,
        "errors": errors,
    }
except Exception as e:  # noqa: BLE001 — 任何未預期例外仍要寫出「失敗但誠實」的 JSON
    output = {
        "collector": "hygiene",
        "collected_at": now.isoformat(timespec="seconds"),
        "ok": False,
        "duration_sec": round(duration_sec, 1),
        "metrics": {},
        "findings": [],
        "errors": [{"step": "fatal", "message": redact(str(e))}],
    }

text = json.dumps(output, ensure_ascii=False, indent=2)
text = redact(text)
with open(out_file, "w", encoding="utf-8") as f:
    f.write(text)

tally = {"red": 0, "yellow": 0, "green": 0}
for fnd in output.get("findings", []):
    tally[fnd["level"]] = tally.get(fnd["level"], 0) + 1
print(f"[check_hygiene] wrote {out_file}")
print(
    f"[check_hygiene] findings: red={tally['red']} yellow={tally['yellow']} green={tally['green']} "
    f"errors={len(output.get('errors', []))} duration={output['duration_sec']}s"
)
PY

# 依契約：探測器失敗不中斷排程，靠 ok:false + errors[] 表達；本腳本一律 exit 0。
exit 0
