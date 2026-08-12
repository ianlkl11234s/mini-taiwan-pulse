# Changelog — Vessel Watch

## 2026-08-12 — 資料層 + 前端圖層同日上線

**Migrations（全部已 apply）**
- `339_vessel_watch.sql` — 兩張表、`classify_vessel()` / `is_watch_candidate()`、每小時 sweep cron、retention 註冊（`NULL` = 永久）
- `340_vessel_watch_rpc.sql` — `get_vessel_watch_current` / `_trails` / `_classes`，開放 anon
- `341_vessel_watch_mmsi_guard.sql` — MMSI 有效性守門（前端驗收抓到的 bug）
- `342_vessel_watch_reclassify.sql` — 用軌跡表真實 `ship_type` 重算 registry

**資料**
- 母表 21 天搶救：109,997 筆 / 366 艘
- 名冊 seed：654 艘 / 12 分類（51 待人工審）
- S3 回補 2026-02-28 起：背景執行中

**前端**
- `vesselWatch` 圖層（情勢 → 軍事），純 Mapbox circle + line
- 12 類色票、popup、圖例、opacity + 軌跡天數 slider，manifest 零 `null` 豁免

**過程中修掉的 4 個 bug**
1. `array_agg` 對空集合回傳 NULL → 每週掃描第二次執行才會爆（兩支腳本都補 `COALESCE`）
2. `S3Storage.list_files()` 回傳 dict 非字串 → 2 月逐檔路徑會 `TypeError`
3. 軌跡未在訊號中斷處切段 → 橫跨海峽的虛構航跡（實測最大間隔 67 小時，59% 的船受影響）
4. MMSI `999999999`（助航設備）被判「軍艦」→ ITU 規定船舶首碼為 2-7，名冊有 17 艘這類

**已知待辦** → `backlog.md`
