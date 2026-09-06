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
| 前端靜態 | tsc -b、Vite production build、125 test files／1164 pass／3 skip | PASS |
| 本地瀏覽器 | 4188 新 browser，搜尋橋梁四結果，四層 render／來源 popup | PASS |
| 互動 | 比對 MATCHED／NOT_EVALUATED 同步 line＋circle；opacity 0.4、scale 1.5（z14 radius 10.5） | PASS |
| 正式部署／Range／瀏覽器 | 合併前尚未執行；發布後於 PR 補正式站證據 | PENDING |

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
