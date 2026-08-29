# Status

**最後更新**：2026-08-30（GFW v4／layer catalog PR 收斂與 memory 同步）

> 本檔只保留目前主線、release truth、blockers 與下一棒；歷史過程留在 git、
> feature 文件與 `REFLECTIONS.md`。

## Scope ledger

| repo / system | current truth |
|---|---|
| **mini-taiwan-pulse root** | `master == origin/master == 928fddb`，工作區乾淨；PR #182（GFW v4）與 #183（layer catalog）皆已 squash merge |
| **preserved worktrees** | GFW v4、catalog、marine observations、noise layers worktree 均保留且乾淨；不是本次再發布範圍 |
| **backup evidence** | `backup/master-pre-sync-20260829` 保留兩顆過時 memory commits；不可原樣 cherry-pick，僅供回溯 |
| **external systems** | 本輪只有 GitHub push／PR／merge／branch cleanup；未執行 DB mutation、object upload、deploy、CDN 或 production HTTP readback |
| **local browser** | 6002 曾服務舊 GFW worktree，不能證明 #183；該 listener 已停止，尚待從 root `master` 重啟後驗收 |

## Release truth matrix

| release unit | build | contract/wire | stage | upload | readback | pull | deploy | HTTP | browser |
|---|---|---|---|---|---|---|---|---|---|
| GFW v4 PR #182 | done：`npx tsc -b`、132 focused tests、GitHub CI/review | done：merged `706ec66` | N/A | not run | not run | N/A | not run | not run | done：舊 GFW worktree localhost 可載入；非 production |
| Layer catalog PR #183 | done：`npx tsc -b`、focused tests、GitHub CI/review | done：merged `928fddb` | N/A | not run | not run | N/A | not run | not run | blocked：6002 曾服務錯 worktree，須重啟 root master 後驗收 |

## Current blockers / next-session entry

1. **Local browser acceptance（ready）**：在 root worktree 以 `gis-up` 重啟 6002；驗收為 World 排在 Layers 後、分類／multi-select 控制可見，且 console 無 error/warn。
2. **Production release（not run）**：若要發布，先另行授權 deploy；驗收為目標 commit 的 production HTTP 與 browser readback。
3. **Maritime data gate（blocked）**：GFW token/licence 與 collector snapshot gate 仍未在本輪驗證；不能把 v4 UI merge 寫成資料已上線。

## Verification boundaries

- GitHub CI/review 與 local TypeScript／unit tests 證明程式整合，不等於 deploy 或 production browser。
- localhost 只能證明其實際服務的 checkout；hard reload 不會跨 worktree 載入最新 `master`。
