# N5 RPC／Raster Gate（2026-09-25）

## 盤點結論

`analysis-coverage-20260925.json` 的 manifest source-kind 計數為 52 個 `supabase`、98 個 `pmtiles`、499 個 `custom`。這是 manifest 類型計數，不是可查詢能力計數：目前 778 層中有 69 層具可查詢 descriptor mapping，研究 registry 登記 78 個 dataset；未註冊 descriptor 的 Supabase／custom layer 必須停在 HOLD，不能由畫面已顯示推論 RPC 已接線。

目前可作 verified query pilot 的家族是 regional statistics：

| 家族 | layer key／dataset | 來源與 adapter | 已驗證契約 |
|---|---|---|---|
| 教育縣市 | `statsEducationCountyStudentCount`（同族 `...InstitutionCount`、`...TeacherCount`、`...StaffCount`）／`regional-statistics:statsEducationCountyStudentCount` | `regional-statistics-cdn-v1` immutable release artifact + boundary；`regional-statistics-recipe-v1` | public `statistics_snapshot`；`releaseId` 必填且只能是 recipe allowlist；`query_records`、`aggregate`、`compare_regions` |
| 住宅行政統計 | `statsHousingOccupiedCounty`（同族含 occupied/total/unoccupied/unused 的 county、township keys）／`regional-statistics:statsHousingOccupiedCounty` | 同上 | 同上；geometry 是 generalized MultiPolygon，供行政展示／比較，不代表 raw spatial eligibility |

證據位置：`src/research/statisticsDatasetAdapters.ts:70-84,117-148`；descriptor 會用 exact recipe 的 `dataset_id`、`indicator_id`、`level`、`dimensions`、`boundary_version`，loader 回讀後逐項比對，失配即 `STATISTICS_RELEASE_CONTRACT_MISMATCH`。

## RPC／查詢 gate

若後續要接 Supabase RPC，需先有 registered descriptor 與 reader；source、權限、參數、coverage 必須分開記錄。最小 gate 如下：

1. **權限**：descriptor 明確標示 `public` 或 `owner_only`；查詢結果的 `access.authorized` 必須為 true。未證明可讀的 RPC 不得列為可用資料集。
2. **allowlist**：caller 只能傳 descriptor 宣告的欄位、filters 與 parameters；統計族唯一 caller-controlled selector 是 allowlisted `releaseId`，非法值必須 `RELEASE_NOT_ALLOWED`。不得讓 caller 任意指定 table、RPC 名稱、dataset、dimensions 或 release fallback。
3. **來源與版本**：回傳 `sourceRefs`、release/boundary version 與 checksum/receipt；同一 query 的 scope hash 與 cursor 必須綁定 source。regional statistics 的 `status/source_status/source_token` 必須原樣保留。
4. **coverage／缺值**：`observed` 才可有 finite numeric value；非 observed 必須 `value=null`，不得把 missing、suppressed、not_reported 當 0。行政統計應 materialize 同版 boundary，沒有觀測的區域保留明確 missing polygon。
5. **截斷與分頁**：descriptor 設定上限；regional statistics 為 `maxRowsPerQuery=100`、`maxScanRows=10,000`、`maxResponseBytes=1 MiB`。executor 僅允許 `offset` 或 versioned `cursor` 其一，並回傳 `totalMatched`、`returned`、`displayTruncated`、`nextCursor`；`analysisComplete` 不等於本頁沒有截斷。

證據位置：`src/research/queryExecutor.ts:210-273`、`src/research/statisticsDatasetAdapters.ts:158-188`。現有 loader／RPC 的 runtime 讀取或 HTTP 200 不能單獨證明上述 research contract 已成立。

## Raster HOLD

### HOLD-A：值編碼 raster，尚無 research reader

- `canopyHeight`：asset `./forestry/canopy_height_rgb_taiwan.pmtiles`，Meta/WRI 2020 10m，z6–12；manifest 已標示 `popup=rasterProbe`，R/G/B 為高度通道（R 的 DN 解作公尺高度），但 coverage JSON 仍為 `NO_QUERY_DESCRIPTOR_OR_READER`、`readable/analyzable=unknown_or_unavailable`。
- `urbanHeat`：asset `./environment/urban_heat_lst_taiwan.pmtiles`，Landsat 8/9 ST 暖季合成，z6–11；物理解碼 `ΔT(K)=R/5−30`、`°C=G/4+10`，`A<128` 是 NoData；R=0 仍是合法 −30K，不能當缺值。

兩層雖已有 Mapbox 色帶與 `rasterProbe` UI 前例，尚缺 registered dataset、tile/range 讀取界線、PNG 解碼 receipt、coverage 與 bounded query budget；因此不得宣稱已可查詢。

### HOLD-B：純配色影像

`aqiImagery`、`cwaCloudImagery`、`cwaRadarImagery`、`dustForecast`、`precipRaster` 在 coverage audit 都是 manifest-only／無 descriptor。既有 layer 說明把它們定義為上游或預烤的 image frames，沒有可保證的物理數值通道；不能由顏色反推 AQI、雨量或濃度。除非上游提供數值編碼與 NoData contract，維持 HOLD。

## 下一個最小試點

`statsEducationCountyStudentCount` 已完成單一 recipe 的正常 MCP → Gateway → browser `describe → query_records`：allowlisted `114-elementary-student_count-ba017d835c3a`、臺北市 `63000` 回讀 `value=117650` 人、`status=observed`、`source_token=null`、期間 2025-08-01 至 2026-07-31、`COUNTY_MOI_1140318`，附 release 與 boundary checksum；release health 標記 `stale`，不可稱現況。來源宣告 22/22 county coverage，單一篩選的實讀並非 22 筆逐列 oracle。下一步是 22 縣逐列／缺值與 cursor 驗收，及 `statsHousingOccupiedCounty` 同家族變體。Raster 另案，先做離線 tile probe contract 設計，不與 RPC pilot 混接。

限制：教育統計完成本地正常工具鏈單筆實讀，其餘 gate 只使用本地 manifest、descriptor、loader、測試與文件證據；未證明 production deployment、其他 Supabase RPC 權限或 raster asset 線上可讀。
