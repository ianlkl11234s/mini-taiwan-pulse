# 日本核心警察設施：本機前端接線

日期：2026-09-07。範圍：mini-taiwan-pulse 本機前端；未部署、push、建立 Supabase table 或 collector。

## 上游契約

SSOT：[analytics handoff](../../../../taipei-gis-analytics/docs/handoff/jp-police-facilities.md)。本次讀取 analytics HEAD `d04da366286d34c58600a379a6fec50ae2fe26db`；產物身分以以下 SHA-256 為準。

- 原始名冊時點：2025-04-01。NPA 官方名冊 13,196 筆；有 geometry 13,195；無座標 1。
- QA：`jp_police_facilities_qa_20260907.json`（原始名冊仍為 20260906 產物），hit 13,173、degraded 22（町域 21／丁目 1）、miss 1。
- 複製至 `public/world/jp_police_facilities.pmtiles`，20,783,700 bytes。
- 上下游 SHA-256 一致：`3b6236fbf0a914c43c00e92f5c73c789eeb0a52fd8f757f26431da4eac2d2263`。
- Mapbox custom PMTiles source `jp-police-facilities`，source-layer `jp_police_facilities`，z5–14；circle layer 不設 maxzoom，z15+ overzoom。
- 所有 z5–z14 瓦片均不抽稀：逐 zoom 解碼去重皆為 13,195 個 facility_id，其中 degraded 22。低 zoom 點可能重疊；不可直接把畫面點數稱為全國總數。

| 硬依賴欄位 | 消費與缺值處理 |
|---|---|
| facility_type | 四色、原生 select 與 popup 共用 `jpPoliceFacilityTypes.ts` |
| name / prefecture / address / phone / source_as_of | popup；null、空字串、字串 null 顯示未提供 |
| geom_status | degraded 橘框與約略位置警語 |
| geom_precision / geometry_source | 保留精度及 GSI 圖資／AddressSearch 來源差異 |
| facility_id | 上游唯一鍵；不得以 tile buffer 重複數宣稱設施總數 |

NPA 負責名冊、GSI 負責位置；不推斷即時營運或值勤。唯一無座標「山の街交番」不產生假點。來源標示包含警察庁、国土地理院；未拆解 opaque parent ID。

## 接線

`jpPoliceFacilities` 預設 off，置於既有 Japan rail 的「治安 → 點位」，沒有新增 rail tab。manifest 派生 icon／upstream／label；params spec 提供 opacity、scale、五選項設施類型。Host 經 layerHookRegistry 掛載，不另加 GeoJSON loader。

## 本機驗收

- `npx tsc -b`：通過。
- `npx vitest run`：113 files passed；1,093 tests passed、2 skipped。
- `git diff --check`：通過；golden fixture 僅新增本層 params、gisLayers 與 keyCount 404→405，既有層內容不變。
- CUA 本機瀏覽器：Japan 分類、預設 off、開關、opacity／scale／type select、legend 三種計數與來源標示均已操作確認。
- Light 底圖切換後可見重建的警察點位及 loading 提示。
- z14 札幌可見本部／警察署／交番；z16 北海道警察本部與札幌中央警察署可見，點擊本部得到真實名稱、地址、電話與資料日。
- z16 十和田駐在所：青綠點＋橘框，popup 明示「約略位置」、町域、国土地理院 AddressSearch。
- 初版 z5 可見抽稀點，點擊吉浜交番的 popup 正確顯示電話「未提供」；低 zoom 半徑設為 2px 增加辨識度。z5.43 交番篩選移除青綠駐在所點；無效 index 的 fail-closed 行為有單元測試。
- 回歸修正：Mapbox addLayer 不接受 filter:null；初始全部類型省略 filter，後續 setFilter(null) 清除篩選。瀏覽器修正後重新確認實際點位。

資產只以 Git intent-to-add 標記供既有 dist 供應契約測試辨識，沒有 stage binary 內容或 commit。production HTTP/range／部署另案驗收。

## 2026-09-07 全密度修正

使用者要求日本全景也保留所有點。上游配方改為 `-r1 --no-feature-limit --no-tile-size-limit`，關閉 Tippecanoe 預設低 zoom dropping；重用 resolved GeoJSON，未重跑來源或地理編碼。

- 逐 zoom z5–14：每級 13,195 唯一 facility_id、22 degraded；`pmtiles verify` 通過。
- 前端以內容 hash query version 避免舊 PMTiles Range 快取混入新檔案。
- 本機以使用者截圖同視角 z5.09 驗證全日本密集點位；z16 overzoom 仍有效。
- 原始 20260906 QA 保留為初版歷史，新的 20260907 QA 記錄全密度逐 zoom 數據。

## PR 整合驗收（2026-09-07）

以遠端 master `97cd878` 為基底整合，保留橋梁與區域統計等既有圖層；golden 原有 450 keys 不變，只新增警察設施（451 keys）。`npx tsc -b` 通過；全套 Vitest 131 files passed，1,213 passed / 3 skipped。整合版本本機 3722 另驗全密度點位。前述「未發布」與 113 files 為初版本機驗收記錄；本次已獲使用者授權建立 PR 與 merge。

上游正式整合 commit：`a98e4e96f9c874dd3498edc6430698e892459f47`（analytics PR #82）。前端 PR #224。
