> ⚠️ 歷史文件（已被 [PLAN-warehouse-20260926](../../PLAN-warehouse-20260926.md) 取代），只作查證，不作施工依據。

# P1 縣市界 local preview 收據

2026-09-25。縣市界固定原表是 `COUNTY_MOI_1140318`，觀測快照日 2025-03-18，原表取得時間未記錄。內政部國土測繪中心 [官方資料頁](https://data.gov.tw/dataset/7442) 列政府資料開放授權條款第 1 版。analytics `county_boundary_20260626.geojson` 為 22 個 EPSG:4326 MultiPolygon，SHA-256 `5044636b840fba57230f15b6728030a09f3d6dc801a86c2301052514acc684d6`；檔名中的 2026-06-26 是處理命名，不能當快照日。analytics PMTiles 的 metadata 指向該原表，惟本 worktree `public/base_map/county_boundary.pmtiles` 缺檔，遠端 release 尚未實讀。

現有 reader 僅在 DEV `VITE_RESEARCH_RAW_BOUNDARIES=1` 註冊 `tw-county-boundaries-raw`，`owner_only` 且 `layerRefs=[]`。本次補上 snapshot、取得時間缺值與 SHA 的契約欄位；本地 raw fixture 的 hole、多面、邊界 `within`/`intersects`、臺北 101 `[121.5654,25.033]` 獨立 oracle 已通過 focused tests（6/6）與 `npx tsc -b`。

正常配對的 3734→8794→MCP session `active` 下，`pulse_describe_dataset` 已讀回新 snapshot `2025-03-18` 與公開授權字串。`pulse_query_records` 對代碼 `63000`、只選 code/name 得臺北市 1 筆，掃描 22 筆／14,719,725 bytes，`analysisComplete=true`；含完整 `geometry` 的同一查詢回 `RESULT_BYTE_BUDGET_EXCEEDED`，無法產生可供 `contains_center` 或地圖呈現的 resultId。這是產品全鏈阻擋，不能將本地 oracle 或屬性查詢稱為 P1 spatial ready。

P1 狀態：本地固定版 polygon reader/契約與幾何反例已完成；`countyBoundary` mapping、全鏈 point-in-polygon／環域相交、browser `ready`/readback 維持 HOLD。下一步需要在已驗證原表上做有界 server-side 空間運算與可傳輸的地圖 geometry，另查公開 runtime 資產同版 receipt；不可把簡化展示面當原表來算。
