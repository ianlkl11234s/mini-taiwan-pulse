#!/usr/bin/env bash
# SessionStart: route to relevant memory without preloading unrelated history.
# 另附「工作區新鮮度」提示（BACKLOG DEV-6）：
#   - 本 checkout 相對 origin/develop 落後幾個 commit（hook、skills、CLAUDE.md 都從工作區載入，落後時要用 git show 讀新版）
#   - ../.gis-agent-system 相對其 origin 預設分支的落後／領先（分叉要分開寫）
#   - docs/PROJECTS.md「有期限的事」過期清單（讀 origin/develop 版，check-entry-docs 的 deadline 規則）
# 硬限制：不改工作區（只讀 + 背景 git fetch 更新遠端追蹤 ref）、不阻塞（fetch 丟背景、顯示的是上一次 fetch 的結果並標時間）、
# 任何一步失敗都靜默略過，整段提示最多 6 行。
set -uo pipefail

ROOT="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
FETCH_TIMEOUT="${PULSE_HOOK_FETCH_TIMEOUT:-5}"

# 背景 fetch：限時、失敗靜默、與 hook 本身脫鉤（stdout/stderr 導走，hook 不等它）
bg_fetch() {
  local repo="$1" ref="$2"
  [ -n "${PULSE_HOOK_NO_FETCH:-}" ] && return 0
  (
    GIT_TERMINAL_PROMPT=0 git -C "$repo" fetch -q origin "$ref" >/dev/null 2>&1 &
    pid=$!
    ( sleep "$FETCH_TIMEOUT"; kill "$pid" 2>/dev/null ) >/dev/null 2>&1 &
    wait "$pid" 2>/dev/null
  ) </dev/null >/dev/null 2>&1 &
  disown 2>/dev/null || true
}

# 上一次 fetch 的時間（FETCH_HEAD 的 mtime，本地時間 MM-DD HH:MM）
fetch_age() {
  local f
  f="$(git -C "$1" rev-parse --git-path FETCH_HEAD 2>/dev/null)" || return 0
  case "$f" in /*) ;; *) f="$1/$f" ;; esac
  [ -f "$f" ] || { echo "未曾 fetch"; return 0; }
  date -r "$(stat -f %m "$f" 2>/dev/null || stat -c %Y "$f")" "+%m-%d %H:%M" 2>/dev/null
}

MSGS=()

# ── 1. 本 checkout vs origin/develop
if git -C "$ROOT" rev-parse --verify -q origin/develop >/dev/null 2>&1; then
  bg_fetch "$ROOT" develop
  counts="$(git -C "$ROOT" rev-list --left-right --count HEAD...origin/develop 2>/dev/null)"
  ahead="${counts%%[[:space:]]*}"; behind="${counts##*[[:space:]]}"
  if [ -n "$counts" ] && [ "${behind:-0}" -gt 0 ] 2>/dev/null; then
    extra=""
    if ! git -C "$ROOT" diff --quiet HEAD origin/develop -- CLAUDE.md AGENTS.md .claude/ 2>/dev/null; then
      extra="；CLAUDE.md／.claude（hook、skills、memory）與 origin 不同"
    fi
    MSGS+=("本 checkout 落後 origin/develop ${behind} 個 commit（領先 ${ahead}；上次 fetch $(fetch_age "$ROOT")）${extra}。讀文件請用 \`git show origin/develop:<path>\`，不要讀工作區檔；更新主 checkout 要先問使用者。")
  fi
fi

# ── 2. ../.gis-agent-system vs 其 origin 預設分支
COMMON="$(git -C "$ROOT" rev-parse --path-format=absolute --git-common-dir 2>/dev/null)"
GIS_ROOT="$(dirname "$(dirname "${COMMON:-$ROOT/.git}")")"
AGS="$GIS_ROOT/.gis-agent-system"
if [ -d "$AGS/.git" ] || [ -f "$AGS/.git" ]; then
  dref="$(git -C "$AGS" symbolic-ref -q --short refs/remotes/origin/HEAD 2>/dev/null)"
  dref="${dref:-origin/master}"
  if git -C "$AGS" rev-parse --verify -q "$dref" >/dev/null 2>&1; then
    bg_fetch "$AGS" "${dref#origin/}"
    counts="$(git -C "$AGS" rev-list --left-right --count "HEAD...$dref" 2>/dev/null)"
    a="${counts%%[[:space:]]*}"; b="${counts##*[[:space:]]}"
    if [ -n "$counts" ]; then
      if [ "$a" -gt 0 ] 2>/dev/null && [ "$b" -gt 0 ] 2>/dev/null; then
        MSGS+=(".gis-agent-system 與 ${dref} 分叉：落後 ${b}、領先 ${a}（本機有未 push 的 commit；上次 fetch $(fetch_age "$AGS")）。讀 ADR／計畫書用 \`git -C ../.gis-agent-system show ${dref}:<path>\`。")
      elif [ "$b" -gt 0 ] 2>/dev/null; then
        MSGS+=(".gis-agent-system 落後 ${dref} ${b} 個 commit（上次 fetch $(fetch_age "$AGS")）。讀 ADR／計畫書用 \`git -C ../.gis-agent-system show ${dref}:<path>\`。")
      elif [ "$a" -gt 0 ] 2>/dev/null; then
        MSGS+=(".gis-agent-system 領先 ${dref} ${a} 個 commit（未 push）。")
      fi
    fi
  fi
fi

# ── 3. PROJECTS「有期限的事」過期清單（origin/develop 版；node 不在或檔不在就略過）
CHECKER="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." 2>/dev/null && pwd)/scripts/dev/check-entry-docs.mjs"
if command -v node >/dev/null 2>&1 && [ -f "$CHECKER" ]; then
  REF=origin/develop
  git -C "$ROOT" rev-parse --verify -q "$REF" >/dev/null 2>&1 || REF=HEAD
  overdue="$(
    node --input-type=module -e '
      // 文件內容由 node 自己 git show（BACKLOG 約 300KB，不經環境變數，避免撞 ARG_MAX）
      const { execFileSync } = await import("node:child_process");
      const { checkEntryDocs, taipeiToday } = await import(process.argv[1]);
      const show = (p) => { try { return execFileSync("git", ["-C", process.argv[2], "show", `${process.argv[3]}:${p}`], { encoding: "utf8", maxBuffer: 32 << 20, stdio: ["ignore", "pipe", "ignore"] }); } catch { return ""; } };
      const P = show("docs/PROJECTS.md"), B = show(".claude/memory/BACKLOG.md");
      if (!P || !B) process.exit(0);
      const lines = P.split("\n");
      const ws = checkEntryDocs({ projects: P, backlog: B, today: taipeiToday() }).filter((p) => p.rule === "deadline");
      const items = ws.map((w) => {
        // 表頭：| 期限 | 事項 | 誰 | BACKLOG |
        const cells = (lines[w.line - 1] || "").split("|").map((c) => c.trim()).filter(Boolean);
        const due = (w.message.match(/\d{4}-\d{2}-\d{2}/) || [""])[0];
        const what = (cells[1] || "").replace(/\*\*/g, "").slice(0, 20);
        const id = (cells[3] || "").split(/[（( ]/)[0];
        return `${id || "L" + w.line} ${what}…（${due}）`;
      });
      if (items.length) console.log(`PROJECTS 有期限的事已過期 ${items.length} 項：${items.slice(0, 4).join("、")}${items.length > 4 ? "…" : ""}；請寫〔結果 YYYY-MM-DD：…〕或改期。`);
    ' "file://$CHECKER" "$ROOT" "$REF" 2>/dev/null
  )"
  [ -n "$overdue" ] && MSGS+=("$overdue")
fi

STATUS=""
if [ "${#MSGS[@]}" -gt 0 ]; then
  STATUS="$(printf '%s\n' "${MSGS[@]}" | head -n 5)"
fi

STATUS="$STATUS" python3 - <<'JSON_OUTPUT'
import json, os
base = "Mini Taiwan Pulse：依 AGENTS.md／CLAUDE.md 做本次工作。有接手需求才查 .claude/memory/README.md 或 docs/features 的相關指標；不要整包載入 STATUS、BACKLOG 或 PRINCIPLES。圖層／資料接線使用 layer-onboarding，保留來源、時間、缺值與 geometry 語意。"
status = os.environ.get("STATUS", "").strip()
ctx = base + ("\n工作區新鮮度：\n" + status if status else "")
print(json.dumps({"hookSpecificOutput": {"hookEventName": "SessionStart", "additionalContext": ctx}}, ensure_ascii=False))
JSON_OUTPUT
