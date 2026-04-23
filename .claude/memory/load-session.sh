#!/usr/bin/env bash
# SessionStart hook：將 memory/ 的 3 個核心檔案作為 additionalContext
# 注入到新 session，Claude 開頭就有現況可讀。
#
# 由 .claude/settings.json 的 SessionStart hook 呼叫。
# 用 python3 產 JSON（不依賴 jq）。

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$PROJECT_ROOT"

python3 - <<'PY'
import json, os

def read_or_empty(path):
    try:
        with open(path, "r", encoding="utf-8") as f:
            return f.read()
    except FileNotFoundError:
        return f"(檔案不存在：{path})"

status = read_or_empty(".claude/memory/STATUS.md")
backlog = read_or_empty(".claude/memory/BACKLOG.md")
principles = read_or_empty(".claude/memory/PRINCIPLES.md")

context = (
    "## Mini Taiwan Pulse — Session 記憶已載入\n\n"
    "詳見 `.claude/memory/` 目錄（9 檔分類）或 `.claude/FRAMEWORK.md`。\n"
    "以下三檔已 inline 以快速接上上次結束點：\n\n"
    f"=== .claude/memory/STATUS.md ===\n{status}\n\n"
    f"=== .claude/memory/BACKLOG.md ===\n{backlog}\n\n"
    f"=== .claude/memory/PRINCIPLES.md ===\n{principles}"
)

print(json.dumps({
    "hookSpecificOutput": {
        "hookEventName": "SessionStart",
        "additionalContext": context,
    }
}, ensure_ascii=False))
PY
