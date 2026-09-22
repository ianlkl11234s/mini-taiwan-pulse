# Layer discovery／UI debt／MCP follow-up handoff

> 日期：2026-09-20
> 狀態：Pulse／Gateway／stdio MCP 契約已接通；待使用者重啟 MCP 並以實際 owner browser pairing 驗收
> 證據邊界：repository contract 與本地 tests 不等於 paired MCP、browser、deployment 或 production acceptance。

## 2026-09-20 typed analysis 第三階段 checkpoint

- 將已有但原本被主地圖邊界關閉的 `ResearchAnalysisSession` 接回 paired browser。Dataset query 會建立 session-local `resultId`，後續分析只接受該 result reference，斷線／重新配對會清除記憶結果。
- 新 MCP surface：`pulse_plan_data_access`、`pulse_materialize_data`、`pulse_spatial_query`、`pulse_aggregate_records`、`pulse_join_records`、`pulse_calculate_metric`、`pulse_read_series`、`pulse_compare_series`、`pulse_get_data_quality`、`pulse_get_record_evidence`、`pulse_get_analysis_result`、`pulse_get_result_bounds`、`pulse_list_results`、`pulse_remove_result`。
- 現階段 spatial 只允許 actual EPSG:4326 Point 的 Haversine `nearest` / `within_distance`；join 只允許顯式 key 與 cardinality policy。結果保留 source receipts、coverage、freshness、units、nulls、exclusions 與 lineage。
- 尚未完成真正 point-in-polygon、行政區 polygon 分級設色、每面積／每人標準化、raster/zonal statistics 與 network accessibility；未有同版 boundary/population/network descriptor 前繼續 fail-closed。
- 本階段先驗 local frontend/Gateway/MCP schema 與 stdio，再另開獨立 Codex task 進行真 owner pairing 複驗；其結果應追加在本節，不用單元測試代替 browser evidence。

## 2026-09-20 實作 checkpoint

- `src/research/dataContracts.ts` 與 `src/research/contracts/` 現為 Dataset／Access／Query Result
  machine-readable contract；權限只有 `public`、`owner_only`，每次操作重新驗權。
- `src/research/researchDatasets.ts` 是 dataset definition SSOT；舊 chat whitelist 只做相容投影，不再重複
  手寫相同 dataset metadata。
- `search_datasets`、`describe_dataset`、`query_records` 已分離。可搜尋的 PMTiles／owner pilot 可以維持
  describe-only；不會因 catalog entry 自動宣稱可查詢、健康或最新。
- 唯一新 query surface 是既有 adapter 共用的 bounded executor：limit、version-bound cursor、bbox、time、
  field projection、filter allowlist、rows／scan rows／source bytes／response bytes 均 fail-closed；receipt 保留
  source/version/coverage/freshness/missing semantics/access/limits。
- pilots：公開 PMTiles `urban_zoning_taipei`（describe-only）、公開 Statistics snapshot
  `land-use:paddy-area-township`（bounded query）、owner-only `allen_coral_atlas`（describe-only）。
- 6 個 popup EDGE 已逐層在 browser 啟用檢查，維持既有決策：房地產 Grid ×3 使用 hover tooltip；
  `temperatureWave` 是無 raycast 的 3D mesh，值查詢由 2D `temperatureGrid` 提供；
  `waterFloodExtreme` 的 `depth_class` 已由 legend 表達；`powerPoles` 是 296 萬點 overview。
  這些理由已由 `NO_POPUP_LEDGER` 凍結，不批次新增 FeatureInfo。

驗收：focused contract tests、`npx tsc -b`、`npm run build`、browser keyboard smoke 已通過。
完整 `npm test` 為 1755 passed／8 skipped／1 unrelated failure；failure 是 sibling analytics catalog
缺少既有 19 筆日本住宿／醫療 dataset IDs，未在本工作改寫。

MCP 與 Gateway 已在隔離 worktree 恢復現行 relay，加入 `pulse_search_datasets`、
`pulse_describe_dataset`、`pulse_query_records`，並將本機 `pulse-research` 設定指向新 build。
真 stdio client 已驗證 27-tool catalog（含 `pulse_route_request`）、三個新資料工具的 input/output schema 與
URL／SQL／超限／壞 cursor 負向案例；MCP 39 tests、Gateway 49 tests 通過。routing 實際經
OpenRouter `typesafe/jev-1.13` 回傳 structured output，且 receipt 保持 `executed:false`。尚未宣稱實際
owner browser pairing 完成：8791 Gateway
需要既有 Supabase 設定與明確 pilot allowlist，應由使用者重啟 MCP 後以本人登入畫面完成最後 readback。

### 2026-09-20 簡單分析擴充檢查點

- `tw-medical-hospitals.layerRefs` 已從錯誤的 `medHospitals` 修正為 manifest SSOT 的
  `medHospital`，並新增所有 dataset layer reference 必須存在於 manifest 的測試。
- `pulse_summarize_layer` 不再只能走 schools/police legacy registry；會先保留原有已驗證契約，
  不支援時才轉到 DatasetDescriptor -> QueryExecutor 的既有 SSOT。
- 立即 `ready` 為 schools、policeStation、medHospital、publicLibraries。其他單一
  same-origin static GeoJSON 只標示 `on_demand_validation`；實際通過 8 MiB、20,000 rows、
  Point geometry、same-source lock 與 receipt 驗證後才能計數。
- PMTiles、raster、RPC、scene、mixed/custom 來源維持 `not_registered`，需同版 sidecar 或專用
  adapter；不以 viewport/rendered feature count 冒充完整來源。
- 新增 detached local stack runner：`npm run research:local:start|status|stop`。Email 只存於
  process environment，runtime state/log 不寫入 repo 且不記錄憑證。

## 為什麼另立本文件

本輪目標是把專案整理回可理解、可驗證的基線。既有搜尋授權與明確 UI 回歸可視為 cleanup；
DatasetDescriptor、AccessDescriptor、MCP query adapters 與跨介面重構會改變產品契約，留到下一輪。
本文件只保存接手範圍、已知證據與停止條件，不把候選問題寫成已確認缺陷。

## 本輪已收斂

### Layer search

- 搜尋索引由 manifest 派生，可按 label、description、topics、upstream dataset ID、source kind
  與 source ID 命中。
- 回傳的是結構化來源登記摘要；自由文字 implementation note 只供本機索引，不回傳給 UI／tool caller。
- orphan、DEV-only、release gate 與 owner gate 必須 fail-closed；guest 與 owner 不得共用一份永久刪除
  gated layer 的靜態索引。最終契約以本輪 search tests 與 `layerGates.ts` 為準。
- `search_layers` 維持最多 10 筆，不讀資產內容、不把 GeoJSON 放進 context。

### Popup 候選重查

先前「29 個 no-popup candidates」已過期，重查結果：

- 25 個已透過 manifest + `GIS_LAYERS` 接上 FeatureInfo：
  `stationsTHSR`、`osmExpressway`、`provincialRoads`、`highways`、`cyclingRoutes`、
  `freewayCongestion`、`canopyHeight`、`urbanHeat`、`popCount`、`h3Population`、
  `indicators`、`socioeconomic`、`spatialEconomy`、`youbikeFullness`、`iotWraRiver`、
  `iotWraStructure`、`groundwaterWells`、`waterProtectionZones`、`waterRivers`、
  `waterLevees`、`waterBasins`、`waterCanals`、`wasteStopsStatic`、`wasteTruck`、`agriculture`。
- 4 個刻意走 scene tooltip，不是 FeatureInfo 漏接：`busIntercityLive`、
  `realEstateRentalPoint`、`realEstateSalePoint`、`realEstatePresalePoint`。
- 仍需下一輪產品／browser 判斷的 EDGE 只有 6 個：房地產 Grid ×3、`temperatureWave`、
  `waterFloodExtreme`、`powerPoles`。沒有證據前不得批次補 popup。

### UI 一致性

- desktop/mobile sidebar 已補 Enter/Space、focus、`aria-expanded`／`aria-pressed`。
- basemap label toggle 可做同檔等價抽取；MapView 契約不變。
- desktop IconRail 與 mobile bottom sheet 的容器、tab、memo 與 statistics flow 不同；不得為了
  「去重」硬抽共同 row/panel。下一輪只在有相同行為契約與測試時共用。

## 下一輪 MCP 技術債

### 目標模型

```text
LayerDescriptor
  -> DatasetDescriptor
  -> AccessDescriptor
  -> Query Result / Receipt
```

- `LayerDescriptor`：顯示、toggle、legend、popup、params。
- `DatasetDescriptor`：canonical dataset ID、grain、schema、geometry role/CRS、time/version、coverage、
  license、missing/null/suppressed semantics、provenance。
- `AccessDescriptor`：static/CDN/PMTiles/RPC/custom adapter、supported operations、auth/tier、limit、
  pagination、bbox/field projection 與 cost budget。
- `Receipt`：實際使用的版本、範圍、缺值、截斷、來源與驗證狀態；不能把 layer registration
  或 HTTP 200 冒充為資料健康／完整 coverage。

### 必做

1. 盤點 manifest 與 `DATASET_WHITELIST` 的重複／缺口，決定 descriptor SSOT；不可再維護第三份手寫索引。
2. 先定義 machine-readable schema、validator、唯一 ID 與 fail-closed access policy，再接 MCP tools。
3. `search_datasets`／`describe_dataset` 與 query 分離；可被搜尋不代表可讀取或可分析。
4. query 必須有 limit/cursor、bbox/time/field projection、最大 bytes/rows 與每次授權檢查。
5. 以真 stdio client 做 schema、structured output、guest/owner、revocation 與超限負向測試。

### 不做

- 不開任意 URL、SQL、檔案路徑或全量 GeoJSON context。
- 不因 catalog 有 entry 就宣稱資料可用、最新、有授權或 production healthy。
- 不把 missing、suppressed、zero、stale、closed 混成同一狀態。
- 不在未完成 source／license／coverage 語意前批量開放 adapters。

## 建議執行順序

1. 完成 search guest/owner/release gate 契約與 browser keyboard smoke。
2. 對 6 個 EDGE popup 做逐層 browser＋source semantics 決策。
3. 建 Dataset/Access descriptor schema 與 2–3 個體質不同的 pilots。
4. 串接 MCP search/describe，再做一個有界 read/query adapter。
5. 完成 paired MCP、browser、revocation 與 result receipt 驗收後才擴充覆蓋。

## 驗收與停止條件

- `npx tsc -b`、layer search／gate／popup registry tests 全綠。
- guest 搜不到或無法啟用 unauthorized layer；owner 仍能找到其有權圖層；DEV-only 不進 production。
- popup 只對可選取且有有意義屬性的 feature 啟用；tooltip 與 FeatureInfo 的界線寫進 manifest 註解／測試。
- MCP 回傳保留 source/version/coverage/missingness/access/limits，並以真 stdio client 驗證。
- 任一來源授權、geometry、missingness 或 access policy 未定即停止，不用預設值猜測。

## 相關入口

- [`tool-foundation-plan.md`](./tool-foundation-plan.md)
- [`layer-capability-inventory-20260919.md`](./layer-capability-inventory-20260919.md)
- [`bridge-contract.md`](./bridge-contract.md)
- [`analysis-capability-onboarding.md`](./analysis-capability-onboarding.md)
- [`../../development-rules.md`](../../development-rules.md)
