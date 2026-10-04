# Network Structures release audit — 2026-09-06

## 範圍與保留

從前端 `9124d1f` 與 Analytics `2d31019` 建立獨立 worktree，重建四個缺失路網結構層。未操作原始 dirty checkout、交通統計 worktree 或其他 session 修改。靜態 PMTiles 無 DB migration。

## 分層驗收

| 層級 | 證據 | 結果 |
|---|---|---|
| 來源／產物 | [data-build.json](data-build.json)；OSM PBF MD5、來源 SHA、官方清冊、NLSC 真實行政界 | 4 產物，保留 427 重合端點 Point |
| Analytics | 6 pytest 通過、py_compile、4 個 pmtiles verify | PASS |
| 跨 repo | [上游 PR #79](https://github.com/ianlkl11234s/taipei-gis-analytics/pull/79)，merge 710ff483 | MERGED |
| Storage | [storage-readback.json](storage-readback.json)，13 物件完整 SHA-256 readback | PASS |
| 前端靜態 | tsc -b、Vite production build、128 test files／1186 pass／3 skip | PASS |
| 本地瀏覽器 | 4188 新 browser，搜尋橋梁四結果，四層 render／來源 popup | PASS |
| 互動 | 比對 MATCHED／NOT_EVALUATED 同步 line＋circle；opacity 0.4、scale 1.5（z14 radius 10.5） | PASS |
| 正式部署／Range／瀏覽器 | Zeabur 9fcea980 success；四份 206＋PMTiles v3；缺檔 404；四層正式畫面與官方／比對 popup | PASS |

## 本地讀回

- OSM 承載線：淡海輕軌綠山線 way 658152872，保留 rail／viaduct、來源與資料時間。
- OSM 輪廓：關渡大橋 way 560811571 原生面，不以 buffer 冒充。
- 官方：菜公坑一號橋(4C-23) ID 427，6.4 m 登錄長度；重合端點 Point。
- 比對：同一 ID 的 NOT_EVALUATED，popup 顯示「未評估（缺值）」；MATCHED 篩選排除此點。地圖瓦片拆分／重複 feature 數不作資料筆數。
- 開發期間 HMR／失敗 PMTiles 快取曾使舊 browser 留住未載入狀態；新 browser 可正常載入。沒有因開發快取現象修改共用 visibility store。

## 已修正的接線缺口

四層開放參數面板；動態 filter／scale 按既有 overlayManager 契約重建。popup 保留來源日期意義、null 與 0、官方管理範圍及候選比對語意。nginx 以獨立 prefix 回 404，不回 SPA HTML。

## 既有問題與回滾

Analytics 全站 catalog audit 仍有兩個既存 fatal：GEBCO manifest 額外欄位、MLIT passenger_route 缺 manifest；本次 network_structures 無新增 fatal。前端 build 仍有既存 chunk >500 kB 提示。

以原子 commit 分別保存部署支援、四層接線與驗收文件；透過 revert commit 回滾，保留原分支與 immutable S3 原始資料／圖磚，不刪檔。上游兩個 commit：3ae244f（pipeline）／2ae0cd7（lineage），merge 710ff483。

## 主線整合

PR #222 建立後，主線合併交通統計 PR #221（6f8b1bb）。於本次隔離 worktree 三方合併，保留海運補貼圖層、單選／重疊模式；兩處衝突只涉及快照圖層總數，合計 417 層。既有 params、overlay 與 GIS 點選順序逐項比對未改動。整合版重新通過 128 test files／1186 tests，3 skipped，與 production build。

新 browser 的 light → dark 切換可重建並載入比對層；z7／z14 切換後來源可用。All Off 七個子層皆 hidden 且 0 rendered。開發 HMR 舊 browser 的 style listener 曾產生重複告警，fresh browser 切換僅 Mapbox 正常 setSprite fallback 警告。

## 正式站驗收完成

- [前端 PR #222](https://github.com/ianlkl11234s/mini-taiwan-pulse/pull/222) 已 merge，部署 commit `9fcea980b249bae0e044b76ec364842b7adfb671`，Zeabur 與 master CI success。
- 2026-09-06 15:43:48 UTC 正式 Range／缺檔／popup 讀回：[production-readback.json](production-readback.json)。新 bundle main-IGGoUU7c.js。
- 正式搜尋「橋梁」四結果；OSM 承載線與原生輪廓在關渡同圖可見；官方及比對 ID 427 Point 點選分別顯示 6.4 m 與 NOT_EVALUATED／缺值。
- 這份發布後證據以獨立 docs commit 保存於原 PR 分支，PR 描述連結固定 commit；已發布的程式版本仍為 9fcea980，不為純驗收記錄重啟部署。
