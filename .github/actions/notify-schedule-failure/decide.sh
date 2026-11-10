#!/usr/bin/env bash
# 判斷排程失敗通知：stdin 讀 `gh run list --json databaseId,conclusion` 的 JSON（新到舊）。
# 用法：decide.sh <本次 run id> <本次 conclusion> [門檻 N，預設 2] < history.json
# 輸出一個字：fail（剛好連續第 N 次失敗）／recover（連續 N 次以上失敗後恢復）／none
# N=2：每 15–60 分跑的排程，偶發一次失敗不吵；N=1：每天才跑或已自行去抖的檢查，第一次失敗就通知。
set -euo pipefail
cur_id="$1"; cur_concl="$2"; n="${3:-2}"
case "$n" in ''|*[!0-9]*|0) echo "門檻須為正整數：$n" >&2; exit 2 ;; esac
is_bad() { case "$1" in failure|timed_out|cancelled) return 0 ;; *) return 1 ;; esac; }

# 只取比本次舊、且已結束（有 conclusion）的 run，最近 N 次（新到舊；不足補 -）
prev=()
while read -r c; do prev+=("$c"); done < <(jq -r --argjson cur "$cur_id" --argjson n "$n" \
  '[.[] | select(.databaseId < $cur and (.conclusion // "") != "")] | sort_by(-.databaseId) | .[0:$n] | map(.conclusion) | . + [range(0; $n - length) | "-"] | .[]')

# 前 k 次都失敗？
all_bad() { local k="$1" i; for ((i = 0; i < k; i++)); do is_bad "${prev[$i]}" || return 1; done; return 0; }

if is_bad "$cur_concl" && all_bad $((n - 1)) && ! is_bad "${prev[$((n - 1))]}"; then
  echo fail
elif [ "$cur_concl" = "success" ] && all_bad "$n"; then
  echo recover
else
  echo none
fi
