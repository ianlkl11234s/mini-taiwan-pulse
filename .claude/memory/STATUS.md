# Status

**最後更新**：2026-08-27（CWA／ISOHE 海洋固定站 local checkpoint）

> 本檔只保留當前 touched repo、release truth、blocker 與下一棒；功能細節見
> `docs/features/marine-observations/`。其他 repo／舊 release 狀態本次未重驗。

## Scope ledger

| repo / system | current truth |
|---|---|
| **mini-taiwan-pulse** | local branch `codex/marine-observations-cwa-isohe`，intended base `origin/master@019f7f8`；CWA／ISOHE vertical slice 與 popup viewport fix 已 commit，尚未 push／PR／merge／deploy |
| **production Supabase** | migration 378 與三支 public RPC 為既有 production contract；本 session 只做 read-only smoke，沒有 DB write 或 migration side effect |
| **localhost browser** | feature worktree 曾由 `127.0.0.1:3721` 驗收；這不是 production frontend acceptance |

## Release truth matrix

| release unit | build | contract/wire | stage | upload | readback | pull | deploy | HTTP | browser |
|---|---|---|---|---|---|---|---|---|---|
| CWA／ISOHE marine observations frontend | done：tsc、unit、build | done：loader/layer/popup/history/registries | N/A | not run | done：production RPC 兩來源非零 | N/A | not run | done：localhost 3721 | done：獨立 toggles、popup/history、viewport overflow |

## Verification evidence

- Commits：`84a175b`（完整 vertical slice）、`542a7d0`（popup viewport overflow）、`dfc3e32`（feature checkpoint）。
- Full validation：`npx tsc -b`、68 個 Vitest files（751 passed／1 existing skipped）、`npm run build` 通過。
- Follow-up validation：targeted Vitest 11/11、`git diff --check`、browser console 無 warn/error。
- Production read-only smoke：CWA／ISOHE stations/current/history 均有非零結果，cross-source rows 為 0；測試未把站數寫死。
- Browser：兩層可獨立切換；popup 保留 source、時間、unit、depth、quality、missing/invalid 與 vertical datum；history 24h／7d lazy-load 成功。
- Overflow regression：7 metrics 測站加展開圖例，在 964×984 與 1280×720 viewport 均維持 panel top 16px，內容可內部捲動到底。

## Blocker / next-session entry

- Blocker：沒有 push、PR、merge 或 deploy 授權；正式站目前仍沒有此功能。
- Repo／branch：`mini-taiwan-pulse`／`codex/marine-observations-cwa-isohe`。
- 第一個動作：重新 fetch 並確認 branch 對最新 `origin/master` 的 ahead/behind；取得 owner 授權後才 push 明確 refspec。
- 驗收條件：CI 通過，正式站兩層可獨立開關，popup/history 成功，console/network 無 RPC 或 Mapbox 錯誤。

## Boundaries

- 本 session 未修改 `gis-platform` 或 `data-collectors`。
- Production RPC readback 不等於 frontend deploy；localhost browser acceptance 不等於正式站驗收。
- 分支與 worktree 先保留本地，不自動 push、merge、deploy 或移除。
