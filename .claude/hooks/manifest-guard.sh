#!/bin/bash
# PostToolUse 守門：layerManifest.ts / layerParamsSpec.ts 被 Edit/Write 後
# 立即跑 manifest 三道守門測試，紅燈以 exit 2 把錯誤回饋給 Claude（護欄前移到秒級）。
# 設計：檔案過濾在腳本內做（matcher 只鎖 Edit|Write），非目標檔零成本快速退出。
f=$(jq -r '.tool_input.file_path // empty' 2>/dev/null)
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
