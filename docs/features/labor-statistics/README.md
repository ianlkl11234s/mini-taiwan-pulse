# 勞動與所得 Statistics 前端接線

更新：2026-09-27。本地 DEV 已接入 9 個 `labor_statistics` 圖層，沿用既有 `regionalStatisticsLoader`、store、Mapbox renderer、legend、popup 與 click registry；沒有重抓或重製上游資料，也沒有覆蓋 production `current.json`。

## 範圍與契約

- 9 個 layer keys、12 個 exact release selectors；錯誤、缺少或多餘 dimension 皆拒絕。
- `statsLaborCountyEmploymentByIndustry` 維持單一 toggle，提供 agriculture、industry、manufacturing、services 四個選項。manufacturing 是 industry 子集，UI 明示不得相加。
- 縣市資料是 20/22；金門、連江為 `source_not_covered`，不是 0。村里所得是 7,602/7,973；371 筆為 `source_join_or_time_mismatch`，不補 0。
- popup、details 與 legend 分別揭露申報／戶籍村里、實際工作所在地、人力資源調查居住地，以及資料期與 reference boundary 版本。
- 表 76 的臺灣地區月估計 SE／CI／CV 不建立縣市圖層。

## 本地啟動

第一個 terminal，在 analytics repo 的既有 snapshot 啟動唯讀 server：

```sh
cd /Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/taipei-gis-analytics/output/labor-statistics/cdn/v1
python3 -m http.server 3761 --bind 127.0.0.1
```

第二個 terminal，在本 worktree 啟動前端：

```sh
cd /Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/mini-taiwan-pulse/.worktrees/labor-statistics-frontend-20260927
VITE_LABOR_STATISTICS_PREVIEW=true LABOR_STATISTICS_PREVIEW_PORT=3761 npm run dev -- --host 127.0.0.1 --port 4177
```

若需要 Mapbox／Supabase 的既有本機設定，請以目前專案的 `.env`／`.env.local` 注入；不要複製或提交 secret。只有 DEV、preview flag 開啟、`dataset_id=labor_statistics` 且 layer key 已登錄時，loader 才會走 `/__labor-statistics-cdn`。

## 驗收

- 真實交付根目錄：12/12 selectors 經 hash-validating loader 讀取成功；臺北市全年薪資 73.5、新竹市 90.2。
- 桌面：9 層逐一切換與渲染；legend、details、popup、來源、期間、單位、coverage、位置口徑與 boundary version 均可見；All Off 通過。
- 行業：四個 exact options 均在同一 toggle 內切換成功，製造業子集警語保持可見。
- 手機 viewport 390×844：Statistics tab 包含精確 9 層，代表薪資層可載入 20/22 與來源未涵蓋語意。這是瀏覽器 viewport 驗收，不等於實體裝置效能測試。
- 測試：完整 `npm run test` 為 2,153 passed、192 skipped；focused 55 passed；`npm run build` 通過，僅有既有大型 chunk 警告。

本次尚未 commit、push、發布資料、部署或做 production readback。Git 與後續門檻見 [changelog](./changelog.md) 與 [backlog](./backlog.md)。
