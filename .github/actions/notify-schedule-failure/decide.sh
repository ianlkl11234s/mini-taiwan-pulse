#!/usr/bin/env bash
# 判斷排程失敗通知：stdin 讀 `gh run list --json databaseId,conclusion` 的 JSON（新到舊）。
# 用法：decide.sh <本次 run id> <本次 conclusion> < history.json
# 輸出一個字：fail2（剛好連續第 2 次失敗）／recover（連續 2 次以上失敗後恢復）／none
set -euo pipefail
cur_id="$1"; cur_concl="$2"
is_bad() { case "$1" in failure|timed_out|cancelled) return 0 ;; *) return 1 ;; esac; }

# 只取比本次舊、且已結束（有 conclusion）的 run，最近兩次
# 單行輸出（相容 macOS bash 3.2，不用 mapfile）：p1 p2
read -r p1 p2 < <(jq -r --argjson cur "$cur_id" \
  '[.[] | select(.databaseId < $cur and (.conclusion // "") != "")] | sort_by(-.databaseId) | .[0:2] | map(.conclusion) | (.[0] // "-") + " " + (.[1] // "-")')
[ "$p1" = "-" ] && p1=""; [ "$p2" = "-" ] && p2=""

if is_bad "$cur_concl" && [ -n "$p1" ] && is_bad "$p1" && ! { [ -n "$p2" ] && is_bad "$p2"; }; then
  echo fail2
elif [ "$cur_concl" = "success" ] && [ -n "$p1" ] && is_bad "$p1" && [ -n "$p2" ] && is_bad "$p2"; then
  echo recover
else
  echo none
fi
