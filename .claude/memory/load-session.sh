#!/usr/bin/env bash
# SessionStart: route to relevant memory without preloading unrelated history.
set -euo pipefail
python3 - <<'JSON_OUTPUT'
import json
print(json.dumps({"hookSpecificOutput": {"hookEventName": "SessionStart", "additionalContext": "Mini Taiwan Pulse：依 AGENTS.md／CLAUDE.md 做本次工作。有接手需求才查 .claude/memory/README.md 或 docs/features 的相關指標；不要整包載入 STATUS、BACKLOG 或 PRINCIPLES。圖層／資料接線使用 layer-onboarding，保留來源、時間、缺值與 geometry 語意。"}}, ensure_ascii=False))
JSON_OUTPUT
