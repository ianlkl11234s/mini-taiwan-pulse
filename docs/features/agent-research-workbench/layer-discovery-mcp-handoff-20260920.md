# Layer discovery／UI debt／MCP follow-up handoff

> 日期：2026-09-20
> 狀態：cleanup 後下一輪工作；本輪不擴張 MCP runtime
> 證據邊界：repository contract 與本地 tests 不等於 paired MCP、browser、deployment 或 production acceptance。

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
