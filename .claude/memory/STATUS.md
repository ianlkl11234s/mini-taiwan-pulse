# Status

**最後更新**：2026-08-20（VW-9 Vessel Zone Watch 資料層 + 動物福利三層合流，7 個 PR merged）

> 本檔只保留當前 release truth、blockers 與下一棒。歷史工作留在 git、
> `docs/features/`、`BACKLOG.md` 與 `REFLECTIONS.md`。

## Scope ledger

| repo / system | current truth |
|---|---|
| **mini-taiwan-pulse** | `master` 0/0 與 origin 同步。本輪 merge PR #146（Vessel Zone Monitor 卡）／#147（動物福利三層）／#148（hook cleanup + shiftDate 修復）／#149（backlog 修正）／#150（catalog_missing 修正）。主樹已切回 `master`。 |
| **gis-platform** | `main` 0/0。PR #58 merged：migration **361~366**（原 353~358，因 main 的 animal_welfare 批次 PR #54~57 同時佔用該區段而順延，並同步更新 64 處交叉引用）。 |
| **data-collectors** | `main` 0/0（PR #52 merged）。⚠️ **主樹停在 `feat/gov-events-snapshot`**，屬平行 session 狀態，未代為處理。 |
| **正式 DB（Supabase）** | migration 361~366 已 apply；`vessel_watch_positions` 627,686 筆分帶回補 100%；registry 11 筆假 MMSI 標 `is_excluded`；新增 pg_cron `refresh-vessel-zone-daily`。 |
| **Production（Zeabur / 正式站）** | 本輪**沒有** deploy、沒有正式站 HTTP probe、沒有 browser 驗收。 |

## Release truth matrix

| release unit | build | contract/wire | readback | deploy | HTTP | browser |
|---|---|---|---|---|---|---|
| Vessel Zone 資料層（mig 361~366） | N/A | done：RPC + RLS，anon 角色實測可讀 | done：對帳九格逐格一致；627,686 筆 100% | done：已 apply 正式 DB；cron 實測 succeeded（0.13/0.08s） | N/A | N/A |
| Monitor `VesselZoneCard` | done：`tsc -b` + 650 測試 | done：三處接線，monitorPacking 過 | N/A | **not run** | **not run** | **not run** |
| 動物福利三層 | done：`tsc -b` + 650 測試 | done：六處登記簿 + golden fixture | N/A | **not run** | **not run** | **unknown**：codex session 宣稱通過，本 session 無第一手證據 |
| catalog_missing 修正（9 layer） | done | done | N/A | not run | not run | N/A：純宣告，無視覺變更 |
| render-phase fix（PR #148） | done | done | N/A | not run | not run | **not run** |

⚠️ 對 dev server 6002 做的是 `curl` 抓 module + HTTP 200，那是 **dev server 探測，不是 browser 驗收**。
所有前端 unit 的 browser 欄一律 `not run`。

## Current deliverables

### Vessel Zone Watch（VW-9 展開，VZ-1~VZ-4、VZ-8 完成）

- `spatial.maritime_zones` 12 筆（內政部 98 年公告，4 region × 3 層）
- `vessel_watch_positions` 三欄 + BEFORE INSERT trigger，627,686 筆回補完成
- `live.vessel_zone_daily` 1,259 列 + pg_cron；RPC **4,551 ms → 1.16 ms**
- Monitor 卡片：主視覺為接近帶趨勢（POC 證實進 24 浬 174 天只有 8 天，畫不成趨勢圖）
- registry 排除 11 筆假 MMSI；守門規則正樣本 15/15、負樣本 4/4

實測（三類監看船、全期、四 region）：中國海警 approach_12 **3,018 筆／26 艘／79 天**、
approach_6 971/20、contiguous 1/1；`territorial` 全為 0。
釣魚台貢獻 1,632 筆約當本島四成，統計預設只算臺灣本島。

### 動物福利三層（PR #147）

adoption／shelter pressure／service points。service points 那層原本 21 個檔案停在工作區未 commit，
本輪補 commit 並驗證（`tsc -b` + 650 測試 + 兩個登記簿守門）。實作與 browser 驗收由 codex session 完成。

## Verification

- **主樹（真環境）**：`npx tsc -b` 通過；Vitest **50 檔 650 passed / 0 failed / 0 skipped**。
- ⚠️ 本輪前段多次回報的「649 測試全過」是在 worktree 跑的**假綠** ——
  `upstreamRegistry` 的 catalog 守門測試解不到 sibling repo 會靜默 skip。詳見 `INCIDENTS.md` 同日條目。
- DB 數字全部以第一手 query 驗證，未採信 commit message 或子代理回報。

## Current blockers

1. **無技術阻塞**：VZ-5/VZ-6 可直接開工。
2. **CAT-1**：9 個 layer 現為 `catalog_missing`，需在 taipei-gis-analytics 建 catalog entry 才能改回 `verified`
   （其中 6 個通訊圖層自 08-18 起就是 broken，非本輪造成）。
3. 既有 blockers（G016 AWS key、BR-2/BR-3 deploy authority、DS-01/02 upstream）狀態不變，見 `BACKLOG.md`。

## Next-session entry

1. **repo/branch**：mini-taiwan-pulse `master`（0/0，乾淨）。
2. **第一個可執行步驟**：VZ-5 —— `get_vessel_watch_current` 加 `dist_24nm_nm` / `zone` 回傳欄位。
   ⚠️ 須 **DROP + CREATE**，Postgres 不允許 `CREATE OR REPLACE` 改 `RETURNS TABLE`。
3. **驗收條件**：popup 顯示「距 24 浬線 X.X 浬（分帶）」、船點依 zone 描邊、
   「只看接近船」toggle 可用；`tsc -b` + 全套測試**在主樹**跑過（worktree 綠燈不算數）。
4. **未做的收尾**：`.gis-agent-system/journal/` 當月檔尚未 append 本輪；
   跨 repo handoff（`taipei-gis-analytics/docs/handoff/`）未建，見 VZ-11。

詳細 active work 與 acceptance criteria 見 `BACKLOG.md`；
VZ-* 執行細節見 `docs/features/vessel-watch/backlog.md`。
