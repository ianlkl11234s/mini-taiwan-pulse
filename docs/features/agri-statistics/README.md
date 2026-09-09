# 農林漁牧 Statistics 正式發布

更新：2026-09-08。24 層已發布至 [Mini Taiwan Pulse 正式站](https://mini-taiwan-pulse.itsmigu.com/)，3 層維持停用。50 releases、1,001,230 observations 與 2,748 exact selector tuples 完成正式回讀；畜禽未報告／遮蔽與真 0 分別保留。

正式驗收與部署證據見 [production acceptance](./evidence/browser-production.json)、[匿名 API 回讀](./evidence/http-readback.json) 及 [changelog](./changelog.md)。以下本地啟動方式保留供重現，不需要啟動 preview 才能在正式站看到資料。

## 工作區

實作位於 `/private/tmp/pulse-agri-ui-20260908`，分支 `codex/agri-statistics-ui-20260908`，基底為本地 master `ce41d5d`（含交通 Statistics golden path）。原始 repo 有其他 session 變更，未修改其工作檔。最初從舊分支建立的 `/private/tmp/pulse-agri-statistics-20260908` 未使用、未修改。

## 啟動

第一個 terminal：

```sh
cd /private/tmp/agri-statistics-wiring-20260908
./venv/bin/python3 pipelines/shared/regional_statistics/verify_frontend_package.py
./venv/bin/python3 pipelines/shared/regional_statistics/frontend_preview.py --port 3743
```

第二個 terminal：

```sh
cd /private/tmp/pulse-agri-ui-20260908
VITE_SUPABASE_URL=http://127.0.0.1:3743 VITE_SUPABASE_ANON_KEY=local-preview-no-remote-credentials VITE_AGRI_STATISTICS_PREVIEW=true AGRI_STATISTICS_PREVIEW_ROOT=/private/tmp/agri-statistics-wiring-20260908 npm run dev -- --host 127.0.0.1 --port 3744
```

開啟 http://127.0.0.1:3744/ ，進入「統計 Statistics」。目前 worktree 使用原 repo 的 ignored node_modules 與 env symlink；地圖底圖需要既有 Mapbox 設定，未複製或揭露 secret。上述 Supabase 覆寫限制本次統計驗收到本機。Preview API 走 Vite 同源代理，geometry 僅從交付 boundary 目錄讀取；DEV 與旗標同時成立才啟用，不包含於 production backend。

## 接線與修改檔案

- `src/data/agriStatisticsRecipes.json` 保留交付機讀資料；`agriStatisticsRecipes.ts` 提供型別與 exact tuple helper。24 個 enabled key 由此派生；3 個 disabled key 無 toggle、manifest 或空殼。
- `regionalStatisticsRecipes.ts`、`statisticsLayerRegistry.ts`、`layerManifest.ts`、`layerParamsSpec.ts`、`src/types/index.ts` 接入既有 Statistics 路徑。保留 `statsRiceHarvest`、`statsPigWaterCounty`，只加跨主題索引，沒有複製 observations/releases。
- `src/components/sidebar/layerCatalog.ts`、`StatisticsDetails.tsx` 提供分類、完整 release whitelist、相依篩選、coverage/health、來源與版本揭露、既有統計索引及 related GIS 連結。
- `src/data/regionalStatisticsLoader.ts`、`statisticsGeometryCache.ts`、`vite.config.ts` 提供 DEV preview adapter、正式 R2 CDN snapshot 契約、geometry hash 與 code/name 對應。資料庫 public RPC 只由 platform publisher 讀取，正式瀏覽器不再呼叫 Supabase。
- `src/map/regionalStatisticsMap.ts`、`gisClickRegistry.ts`、`src/components/LegendPanel.tsx`、`featureInfo/regionalStatisticsPanel.tsx` 接入地圖、點選、legend、斜線遮蔽與 source_status/source_token。畜禽非數值 sidecar 缺失時拒絕載入，不以一般 missing 或 0 取代；observed 數值不強求不存在的 sidecar token。
- 更新現有 loader、geometry、catalog、manifest golden、hook/click registry 測試；新增 `src/data/__tests__/agriStatisticsContract.test.ts`。原交付說明與 selector 放在 `docs/handoff/`。

## 資料語意

24 層：國土利用15、農情4、漁業3、畜禽2。停用：`statsAquacultureStockingCounty`、`statsForestMainProductValueCounty`、`statsForestByproductValueCounty`。

全部 2,748 個 release_options tuple 與 boundary 對應已檢查；filters.options 不做笛卡兒積。國土利用顯示115年1月統計參考（113–114年調查）及實際圖形 `TOWN_MOI_1140318`，依使用者取消相容證明門檻的決定繼續。真0、missing、suppressed、not_reported、STALE、PARTIAL 分別保留；不回推縣市總數、不復活 deprecated 林業分析。

## 原始本地驗收證據

- 交付驗證：24 enabled／3 blocked、50 bundles、2,748 tuples；154/154 SHA-256 檔案一致。封裝 hash 見 `evidence/browser-acceptance.json`。
- `npm test -- --run`：151 個 test files，1,312 passed、3 skipped，見 `evidence/tests.log`。
- 最後來源狀態 guard 修改後，loader／geometry／完整 agri contract 重跑：3 files、29 passed，見 `evidence/final-focused-tests.log`。
- `npm run build`：`tsc -b` 與 Vite build 通過，見 `evidence/build.log`；仍有 bundle 超過500 kB的提示。
- CUA 真實瀏覽器：桌面1280×800，全部24層逐一切換、載入、地圖點選並核對 tooltip；明細與各層觀測值見 `evidence/browser-acceptance.json`。
- 國土利用真0仍顯示0；農情 missing 不補0。養殖面積切2021年後彰化顯示2,919.25公頃，期間同步。
- 手機390×844實際操作國土利用、農情、漁業、畜禽代表層與篩選。鹿在養量的通霄鎮顯示 suppressed／原始 `*`、斜線；not_reported 原始 `-` 保留。水稻一期作1/368、二期作3/368，coverage保持PARTIAL。DOM寬度390、scrollWidth390。
- 重疊雙 legend、切回單一、All Off、透明度0.55→0.50均操作驗證。截圖已在本次 CUA 工具輸出呈現；未另存 screenshot 檔案。手機驗收為瀏覽器 viewport 模擬，未宣稱實體手機驗收。

## 正式發布驗收

使用者後續已授權正式資料寫入、migration、commit、PR、merge 與部署。

- Platform [PR #102](https://github.com/ianlkl11234s/gis-platform/pull/102)：migration 410 與 importer 保留 `source_status`／`source_token`，health 支援 PARTIAL。
- Platform [PR #103](https://github.com/ianlkl11234s/gis-platform/pull/103)：migration 411 使用索引與即時查詢改善 catalog；沒有新增 projection table、trigger 或變更 ACL/RLS。
- Frontend [PR #233](https://github.com/ianlkl11234s/mini-taiwan-pulse/pull/233)：共用已驗證 geometry 與平行載入；[PR #234](https://github.com/ianlkl11234s/mini-taiwan-pulse/pull/234)：畜禽覆蓋率以「鄉鎮×畜種資料筆」表達，選定畜種仍以 368 鄉鎮為分母。
- 正式發布保留 817,967 個 null、14,684 筆畜禽來源狀態；753 個既有 release hashes 未變。停用三層沒有公開 release。
- 正式桌面 1280×720 全部 24 層逐一載入、渲染與地圖點選通過。手機 390×844 完成國土利用、水稻一期／二期、養殖年度切換與畜禽代表層操作；通霄鎮 suppressed（*）、斜線、legend、STALE/PARTIAL 及新版 coverage 單位確認，寬度無水平溢出。結果詳見上述 production acceptance；viewport 模擬不等於實體手機效能測試。
- 完整 frontend tests：1,332 passed、3 skipped；最後覆蓋率修正 11 tests、`tsc -b`、build 通過。Platform importer tests 10 passed，實際 PostgreSQL 整合與 migrations 重跑通過。
- 程式部署 `172a284955d697478c4fa0327ce18daff530bb75`，Zeabur `6aa02d3b7b89d694354a15c7` 狀態 RUNNING。證據見 `evidence/zeabur-final.json`。

載入改善、正式落點及量測限制見 [loading-performance.md](./loading-performance.md)。本次授權的 production 步驟已完成；preview server 仍只供本地重現。
