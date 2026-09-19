# 本地驗收 2026-09-18

Profile: research/prototype。以下證據不可推論成已部署或全日本覆蓋。

| 項目 | 結果 |
|---|---|
| 隔離 | 前端與上游均為永久 `.worktrees/jp-height-layers-20260918`；原工作區未清理／stash／reset |
| 官方來源 | PLATEAU 新宿区2025 resource metadata CC BY4；Meta/WRI CHMv2 AWS CC BY4 |
| 建物 artifact | 13,629 有效輪廓，13,222 有高度、407 null；中庭孔洞保留；MVT z12–16 |
| 建物 SHA | 1f2a86b9661c7ae1810140959ebdbf9d065a347e62709938e45df8c2e0e48ac5；3,156,972 bytes |
| 樹冠 artifact | 1,205,456 有效像素，1–31m；39 PNG tiles，512px，z9–12 |
| 樹冠 SHA | c2a3989bf95d9213173f6fd073f30f18ed3abdd218f42adc16a5ba4596afefde；1,831,713 bytes |
| 樹冠編碼 QA | 39 tiles 全查：RGBA512、R=G=B、無 opaque zero、SHA match |
| 上游測試 | 建物 8 passed；樹冠 2 passed，含本地 RGBA/alpha/manifest 一致性 |
| 前端完整測試 | 210 files passed、1 skipped；1,605 tests passed、8 skipped |
| 部署契約 | nginx/pull/upload exact-file wiring 測試通過；腳本 syntax 通過，未執行部署 |
| 本地 HTTP | canopy 與 building PMTiles byte range 均為206 |
| Browser 樹冠 | All Off→only canopy；新宿御苑可見 raster，點擊21m；opacity0.70→0.40；圖例來源／日期限制可見 |
| Browser 建物 | 2D 高度分色可見；點擊133.7m/2025/source_id；UI切換3D，pitch40°可見量體，點擊179.5m，CC BY4標示 |
| TypeScript | `npx tsc -b` 通過 |
| Build | `npx vite build` 通過；dist 未包含 jp-heights payload |
| Release | 未commit/push/PR/merge/upload/deploy，PROD theme gate維持隱藏 |

## 修正與限制

- 來源 -9999 → null；TypeScript / Mapbox 顯式處理 missing，0 不當缺值。
- raster async completion 補 request-id guard，避免早先點擊覆蓋新結果。
- source_year 的2025數值可顯示，移除不符合此來源契約的 Tier? footer。
- 日本分頁既有 flyTo 是全國視角，pilot需用 handoff 深連結定位。既有網址 `p.*` 解析不會在主頁還原圖層參數，因此3D需實際點控制；本次不擴改全站URL hydration。
- 實機手機、正式站、本地HTTP之外的CDN、全日本coverage尚未驗證。

## 多尺度與資源限制驗收

- 上游：grid/building 18 tests passed；10km/1km/250m 各自 13,629 count 守恆；null 407 保留。PMTiles verify 通過；抽樣 z4/7、8/10、11/12 正確分尺度。
- Grid：10,398 bytes，最大壓縮tile 2,871 bytes，SHA `11371f83d16f8ebb649a8f494705f8e9b1d45ade053dc4ad0f68aa31c3c632d8`。本地 Range bytes=0-126 回206/127bytes。
- 安裝：真實六檔 checksum 通過；稀疏5,000,001bytes測試grid被拒，target未建立。這是安裝 gate，不是RAM限制。
- Browser：同一頁 z15輪廓→z12 250m格→z10 1km格，grid popup 實測 median28.4m/P90 44.3m/count38，partial說明可見。
- Browser：拖離東京至約137.5E，診斷為 `[]`；同頁拖回139.73E，診斷恢復 `["jp-building-height-grid"]` 且摘要可見。
- Browser：Dark→Light style切換後同一grid source恢復；loading indicator結束；當次error logs空。
- 此驗收沒有量測整站heap/GPU峰值或手機實機，亦沒有大阪／北海道真實產物；不得宣稱全日本壓測通過。

- Controller測試：4/4通過，含100回合來源調度、toggle/style/world-copy/debounce、loading error/suspend清理。測的是source/listener/timer數量，不是heap/GPU bytes。
- 全站測試最後一輪：1609 passed、8 skipped、2 failed；其中1項lifecycle loading測試後續修正通過，另一項既有researchDatasets為5秒逾時，單獨重跑461ms通過。最終針對兩檔重跑9/9 passed，沒有未解失敗；不宣稱同一輪全站全綠。
- manifest/deploy契約原先漏grid宣告已修正，focused 34項相關斷言通過（layerManifest/deployContract）。

- 最終 `npx vite build` 通過（59.93s）；dist未包含JP payload。仍有既有大型chunk警告，本輪未調整全站bundle。
- 最終 `npx tsc -b` 通過（含lifecycle事件mock型別修正）；`git diff --check` 通過。

## 2026-09-18 日本跨區第一批最終驗收

- Scope：東京・新宿、大阪、札幌、福岡、那霸五個局部ROI，57,140筆建物；均有canopy，非五個全市或全國完整覆蓋。
- Catalog installer：16個checksum-addressed PMTiles，共20,958,214 bytes；bytes/SHA與上游manifest吻合；overview56,018 bytes。實際本地Range回應206、127bytes header讀取成功。
- Frontend focused：7 files / 50 tests pass（catalog、lifecycle、height type、probe bounds、manifest、golden、hook），另metadata join4 tests pass；總54個不同測試。包括100-region選取、source≤6、100次style-like循環、off-view/toggle卸載、world-copy、高zoom overzoom、abort/2MBbudget/404/503。
- Build：`npm run build`（tsc -b + Vite）通過；既有large chunk警告保留。無全套single-run綠燈宣稱。
- Browser (CUA, localhost3746)：大阪z14.5輪廓可见，點擊209.4m且授權大阪；z12.5格網可见，點擊250m/median18.8m/P90 51.4m/count77/2025/大阪。
- Browser：札幌、福岡、那霸均建物+樹冠可見，各自只有該城市2個active source；札幌輪廓16.2m、樹冠14m取樣成功且來源札幌。
- Browser：大阪detail→overview只保留一個source；Japan rail飛至全國z4.7後只保留overview，All Off後active=[]；圖例列5區、1個分片、partial覆蓋說明。
- 修復：mapbox-pmtiles roundZoom使z12.5以z13建bucket，grid layer maxzoom13提前排除資料；動態grid移除layer maxzoom並由controller在z13卸載，browser確認修復。
- Independent Terra review：無P1；修正region ID含雙連字號的metadata join與canopy source-coverage顯示，相關測試通過。
- 尚未：全國完整取得、最密集區與長時heap/GPU量測、手機實機、production/Embed全國接線、commit/push/upload/deploy。

## 2026-09-20 小批發布 gate

| Evidence cell | 結果 |
|---|---|
| Analytics Git | PR #100 ordinary merge；merge commit `0ee583f3f64aa9bfc6ecca3fa887c5c0abd5c075` |
| Frontend Git | PR #320 ordinary merge；merge commit `a15db13726fc4743472286662bdf8ef81ef13c50` |
| Frontend regression | 230 files passed、1 skipped；1,718 tests passed、8 skipped；`npx tsc -b`、`npm run build` passed |
| Runtime S3 | 38 immutable PMTiles + catalog，39 objects／23,210,033 bytes；full GET SHA/bytes/content type/cache readback passed |
| Runtime catalog | version `national-local-2026-09-19-metro-mesh-v1`；28,655 bytes；SHA-256 `691006268a7de079eed3f607390dcb5c5f8bf71ab43abbd6cbc4d3cd84199a8b` |
| Production CD | merge commit 的 master CI 與 Zeabur deployment `6aaeb7fb94c4cdf079b8c258` success |
| Production HTTP | catalog 200 JSON／28,655 bytes／SHA match／`max-age=60`；抽樣 PMTiles Range 206／127 bytes／正確 header／一年 immutable cache |
| Production browser | 名古屋 z15 單棟輪廓與 37.1m popup；z10 1km grid 與 median/P90/count/missing popup；東京樹冠可見且取值 18m；無 page error log |

發布只包含 catalog allowlist；`public/jp-heights` 的 legacy 重複檔沒有上傳。raw PLATEAU archive 位於 S3 Deep Archive，和 browser runtime objects 分開；缺值仍為 null／未提供，不當作 0。
