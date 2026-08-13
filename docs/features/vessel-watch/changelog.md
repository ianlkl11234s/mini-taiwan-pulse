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

## 2026-08-13 — 領海界線圖層（VW-3）+ 資料回補完成

**新圖層 `maritimeBoundary`**（「底圖 Base Map → 海域界線」）
- 內政部「中華民國第一批領海基線、領海及鄰接區外界線（98 年修正）」
- 上游 pipeline 早已存在（`taipei-gis-analytics/pipelines/environment/maritime_boundary/`），pulse 從未接
- 4MB GeoJSON（38 feature / 6.7 萬座標點）→ tippecanoe → **355KB PMTiles**
- 3 個 sub-layer：實線（基線 + 12浬）／虛線（24浬，區分法律地位）／基點 circle（z≥5）
- 色票 SSOT `src/data/maritimeBoundaryTypes.ts`；popup 帶「法律意義」一句話
- 底圖定位：線細、opacity 預設 0.65
- 瀏覽器實測：本島 + 釣魚台列嶼 + 南方離島群三層界線正確，popup／圖例全過

**S3 回補完成**
- 前一晚在 2026-04-05 因 DB 連線中斷（`SSL SYSCALL error`）整批掛掉，留下 04-06~07-22 共 108 天缺口
- 改用逐日 + 單日重試三次的 wrapper 重跑，0 天放棄
- 現況：**2026-02-27 ~ 08-13 共 168 天連續零缺口**，588,550 筆 / 685 艘 / 159 MB

**時間軸移動（前一日工作的延續）**
- 船改為依 `currentTime` 在軌跡上插值移動（gap-aware，訊號中斷停在最後已知點並淡化）
- 12 個新測試釘住「中斷期間不得出現在兩點之間的海面上」

**探索後放棄的方向**
- 一度想把圖層接進「歷史模式」（`appMode === "historical"`），實作後發現方向錯誤 → 已 revert
- 原因見 README「為什麼不做歷史模式」
