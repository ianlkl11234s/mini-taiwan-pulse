#!/usr/bin/env bash
# 本機測試：bash .github/actions/notify-schedule-failure/test-decide.sh
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
fail=0
# check <預期> <本次 id> <本次 conclusion> <歷史 JSON> [門檻]
check() {
  got="$(printf '%s' "$4" | bash "$here/decide.sh" "$2" "$3" ${5:-})"
  if [ "$got" = "$1" ]; then echo "ok   $1 ($3)"; else echo "FAIL 預期 $1 實得 $got ($3 / $4)"; fail=1; fi
}
S='{"databaseId":%s,"conclusion":"%s"}'
# shellcheck disable=SC2059
h() { local out="" sep=""; while [ $# -gt 0 ]; do out+="$sep$(printf "$S" "$1" "$2")"; sep=","; shift 2; done; echo "[$out]"; }

check none    50 failure "$(h 40 success 30 success)"          # 第 1 次失敗
check fail    50 failure "$(h 40 failure 30 success)"          # 剛好第 2 次
check none    50 failure "$(h 40 failure 30 failure 20 success)" # 第 3 次
check none    50 failure "$(h 40 failure 30 failure 20 failure)" # 第 4 次
check recover 50 success "$(h 40 failure 30 failure 20 success)" # 連續失敗後恢復
check recover 50 success "$(h 40 failure 30 failure 20 failure)" # 長期失敗後恢復
check none    50 success "$(h 40 failure 30 success)"          # 單次失敗後成功
check none    50 success "$(h 40 success 30 failure)"
check none    50 failure "[]"                                  # 沒歷史
check fail    50 failure "$(h 40 failure)"                     # 歷史只有 1 筆失敗（p2 缺）
check recover 50 success "$(h 60 success 40 failure 30 failure)" # 比本次新的 run 不計入
check fail    50 timed_out "$(h 45 failure 40 success)"        # timed_out 視為失敗
check none    50 failure "$(h 45 '' 40 failure 30 failure)"    # 未結束的 run 略過 → 第 3 次
# 門檻 1（每日排程、CFW 用量）：第一次失敗就通知，恢復時通知
check fail    50 failure "$(h 40 success)" 1
check none    50 failure "$(h 40 failure)" 1
check recover 50 success "$(h 40 failure)" 1
check none    50 success "$(h 40 success)" 1
check fail    50 failure "[]" 1
# 門檻 3
check fail    50 failure "$(h 40 failure 30 failure 20 success)" 3
check none    50 failure "$(h 40 failure 30 success)" 3
check recover 50 success "$(h 40 failure 30 failure 20 failure)" 3
check none    50 success "$(h 40 failure 30 failure 20 success)" 3
exit $fail
