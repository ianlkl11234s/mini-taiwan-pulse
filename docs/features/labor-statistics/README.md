# 勞動與所得 Statistics 前端接線

更新：2026-09-27。Production 基線已接入 9 個 `labor_statistics` 圖層，沿用既有 `regionalStatisticsLoader`、store、Mapbox renderer、legend、popup 與 click registry。本輪在獨立 worktree 做 UX 改進：村里綜合所得改為 8 階色盲友善 Cividis 色階，並在原「非勞動力」圖層內增加人數／比率切換。沒有重抓、重製或改寫上游資料。

## 範圍與契約

- 9 個 layer keys、12 個 exact release selectors；錯誤、缺少或多餘 dimension 皆拒絕。
- `statsLaborCountyEmploymentByIndustry` 維持單一 toggle，提供 agriculture、industry、manufacturing、services 四個選項。manufacturing 是 industry 子集，UI 明示不得相加。
- `statsLaborCountyNonLaborForce` 維持原 layer key，可切換「人數（千人）」與「非勞動力率（%）」。比率為 `100% − 勞動力參與率`，分母是同一期人力資源調查的 15 歲以上民間人口；資料來自已登錄的 exact participation-rate selector，不新增第 10 個圖層或虛構 selector。
- 縣市資料是 20/22；金門、連江為 `source_not_covered`，不是 0。村里所得是 7,602/7,973；371 筆為 `source_join_or_time_mismatch`，不補 0。
- popup、details 與 legend 分別揭露申報／戶籍村里、實際工作所在地、人力資源調查居住地，以及資料期與 reference boundary 版本。
- sidebar details 的外層只保留必要操作、filter 與 labor 的「位置口徑」；邊界、單位、coverage、missingness、資料期與處理版本收進可展開的「來源與處理紀錄」，同樣套用到其他 Statistics 圖層。
- 表 76 的臺灣地區月估計 SE／CI／CV 不建立縣市圖層。

## 本地啟動

第一個 terminal，在 analytics repo 的既有 snapshot 啟動唯讀 server：

```sh
cd /Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/taipei-gis-analytics/output/labor-statistics/cdn/v1
python3 -m http.server 3761 --bind 127.0.0.1
```

第二個 terminal，在本 worktree 啟動前端：

```sh
cd /Users/migu/.codex/worktrees/labor-statistics-ux-refinement/mini-taiwan-pulse
VITE_LABOR_STATISTICS_PREVIEW=true LABOR_STATISTICS_PREVIEW_PORT=3761 npm run dev -- --host 127.0.0.1 --port 4177
```

若需要 Mapbox／Supabase 的既有本機設定，請以目前專案的 `.env`／`.env.local` 注入；不要複製或提交 secret。只有 DEV、preview flag 開啟、`dataset_id=labor_statistics` 且 layer key 已登錄時，loader 才會走 `/__labor-statistics-cdn`。

## 驗收

- 真實交付根目錄：12/12 selectors 經 hash-validating loader 讀取成功；臺北市全年薪資 73.5、新竹市 90.2。
- 桌面：9 層逐一切換與渲染；legend、details、popup、來源、期間、單位、coverage、位置口徑與 boundary version 均可見；All Off 通過。
- 行業：四個 exact options 均在同一 toggle 內切換成功，製造業子集警語保持可見。
- 所得 UX：7,602 筆 observed values 用 octile 切點顯示 8 階 Cividis 色階；normal、protan、deutan、tritan 四種視覺模擬的相鄰階級明度差異測試通過。
- 非勞動力 UX：桌面與 390×844 mobile Statistics tab 均有人數／比率切換；新竹市實際點擊回讀 40.4%，popup 明示公式、位置口徑、資料期、20/22 coverage 與 reference boundary。這是瀏覽器 viewport 驗收，不等於實體裝置效能測試。
- 測試：合併最新 `master` UI 基線後，focused 107/107、真實 analytics delivery 1/1、TypeScript 與 `npm run build` 通過；完整 suite 為 2,324 passed、193 skipped，無失敗。

本輪 UX 改動的 Git delivery 與 production acceptance 證據統一由 [PR #384](https://github.com/ianlkl11234s/mini-taiwan-pulse/pull/384) 追蹤；本文件只記錄已驗證的資料、測試與本機 browser gates。後續門檻見 [changelog](./changelog.md) 與 [backlog](./backlog.md)。
