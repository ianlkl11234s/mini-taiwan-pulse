#!/bin/bash
# PostToolUse 守門：layerManifest.ts / layerParamsSpec.ts 被 Edit/Write 後
# 立即跑 manifest 三道守門測試，紅燈以 exit 2 把錯誤回饋給 Claude（護欄前移到秒級）。
# 設計：檔案過濾在腳本內做（matcher 只鎖 Edit|Write），非目標檔零成本快速退出。
# 解析 stdin JSON：優先 jq，沒裝 jq 就退回 python3（避免沒有 jq 的機器上守門靜默失效）
input=$(cat)
if command -v jq >/dev/null 2>&1; then
  f=$(printf '%s' "$input" | jq -r '.tool_input.file_path // empty' 2>/dev/null)
else
  f=$(printf '%s' "$input" | python3 -c 'import json,sys
try: print(json.load(sys.stdin).get("tool_input",{}).get("file_path","") or "")
except Exception: pass' 2>/dev/null)
fi
case "$f" in
  */src/data/layerManifest.ts|*/src/data/layerParamsSpec.ts) ;;
  *) exit 0 ;;
esac
cd "${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}" || exit 0
out=$(npx vitest run \
  src/components/sidebar/__tests__/layerConsistency.test.ts \
  src/data/__tests__/layerManifest.test.ts \
  src/state/__tests__/layerParamsStore.test.ts 2>&1)
if [ $? -ne 0 ]; then
  {
    echo "⛔ manifest 守門測試紅燈（$(basename "$f") 剛被編輯，修好前別繼續往下做）："
    echo "$out" | grep -E "FAIL|✕|×|AssertionError|→ " | head -25
  } >&2
  exit 2
fi
exit 0
