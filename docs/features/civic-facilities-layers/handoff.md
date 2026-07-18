# Handoff — civic-facilities-layers（下游視角）

> **上游 SSOT**：`../../../taipei-gis-analytics/docs/handoff/public-facilities.md`（詳細契約看那份；上游 slug 為 `public-facilities`）
>
> 本檔只放**前端接線的簡表 + 上游約定的差異點**。契約細節不重複寫，只反向引用。

## 上游 handoff 摘要

- 產物路徑：8 個靜態快照 `public/{theme}/*.geojson`（git 管理，❌ 無 PMTiles / S3）——`civic_facilities/`（postOffices/iPostBoxes/communityCenters/govServiceOffices/welfareCenters）、`culture/`（publicLibraries）、`poi/`（retailMarkets）、`environment/`（publicToilets）
- 更新頻率：post_offices / ibox / public_toilets quarterly；public_libraries / gov_service_offices / public_retail_markets yearly；community_centers / welfare_centers irregular（welfare_centers 源已 3.5 年未更）
- 座標系統：WGS84，全部 100% 有幾何
- 資料量：1,278 / 2,345 / 1,794 / 702 / 634 / 157 / 731 / 13,281 features（上游 §2.3 community_centers 舊版寫 592/4 縣市已過時，2026-07-17 TGOS 回填後實為 1,794/8 縣市——已請上游同步修正）
- 上游保證：8 個 datasetId 全部 upstreamRegistry HIGH 信心；`public_toilets` pulse 版本刻意精簡到 4 欄（`name/county/grade/type2`），無 `address` / 各類間數 / `diaper_any`

## 前端接線位置

- Overlay：`src/map/overlayRegistry.ts`（8 層樣板：glow+circle；`govServiceOffices` type match 分色、`publicToilets` minzoom 11 + grade match 分色）
- Catalog：`src/components/sidebar/layerCatalog.ts`（`LAYER_COLORS` + 「公共設施」子群 8 key）
- Icon：`src/components/IconRailSidebar.tsx`
- 控制面板：`src/hooks/useTransportParams.ts`（opacity + scale slider ×8）
- 點擊互動：`src/hooks/useMapInteraction.ts`
- Popup：`src/components/featureInfo/infraPanels.tsx`（8 個 Panel function）+ `registry.tsx`
- Legend：`src/components/LegendPanel.tsx`（govServiceOffices type 3 色圖例、publicToilets grade 4 色圖例；其餘 6 層單色進 `layerConsistency.test.ts` 的 `BASELINE_NO_LEGEND`）
- 型別：`src/types/index.ts`（`LayerVisibility` 8 key）
- 資料來源歸屬：`src/data/upstreamRegistry.ts`（8 個 datasetId，全 HIGH）
- Chat 工具：`src/chat/tools/datasets.ts`
- Deploy 契約：`nginx.conf` + `scripts/deploy/pull-deploy-assets.sh`（`civic_facilities/` / `environment/` / `poi/` 三個子目錄）

## 硬依賴欄位（改一定爆）

| 圖層 | 欄位 | 用途 |
|---|---|---|
| postOffices | `name` / `address` / `phone` / `city` / `district` | popup 標題 + 基本資訊 |
| postOffices | `weekday_service` / `weekday_extended_service` / `saturday_service` / `sunday_service` | popup 4 個服務時段旗標（✓/✗） |
| iPostBoxes | `name` / `address` / `relative_location` / `business_hours` | popup 顯示 |
| iPostBoxes | `locker_count` / `cabinet_type` | popup「格數」「櫃型」 |
| communityCenters | `name` / `county` / `town` / `address` | popup 顯示（無分色，county 判斷 partial coverage 8 縣市） |
| govServiceOffices | `type`（`district_office`/`household_registration`/`land_office`） | paint match 3 分色 + popup 類型 label + LegendPanel 圖例 |
| govServiceOffices | `name` / `county` / `jurisdiction` | popup 顯示（地政事務所才有 jurisdiction） |
| publicLibraries | `name` / `county` / `type` | popup 顯示 |
| welfareCenters | `name` / `county` / `service_area` | popup 顯示（popup 固定附註「資料時點 2023-04」，非讀欄位） |
| retailMarkets | `name` / `county` / `business_hours` | popup 顯示 |
| publicToilets | `grade`（`特優級`/`優等級`/`普通級`/`不合格`，缺值 fallback `#9e9e9e`） | paint match 4 分色 + popup 等級 + LegendPanel 圖例 |
| publicToilets | `name` / `county` / `type2` | popup 顯示；**無** `address` / 各類間數 / `diaper_any`（上游 pulse 版本精簡，見下） |

## 上游改動 → 下游要跟改的觸發點

| 上游改動 | 下游動作 |
|---|---|
| `public_toilets` 擴充 `pulse_props_keys`（若上游改 `07_export.py` 補回 `address`/`diaper_any`） | `infraPanels.tsx` PublicToiletPanel 可加無障礙篩選欄位；目前資料不支援 |
| `community_centers` 新增縣市覆蓋 | popup / 圖層說明的「部分縣市」揭露文字要更新縣市清單 |
| `gov_service_offices` 新增 `type` 值 | `GOV_OFFICE_TYPE`（infraPanels.tsx）與 `overlayRegistry.ts` 的 match expression + LegendPanel 圖例三處要同步加 |
| `public_toilets` `grade` 新增等級值 | `TOILET_GRADE_COLOR` + `overlayRegistry.ts` match + LegendPanel 圖例三處同步加 |
| 欄位改名 / 移除 | 上游先改 handoff 再動（上游 §4 約定） |

## 已知不對稱

- 上游 handoff §2.3 標題與 §8 驗收指令目前仍寫 community_centers 舊版「592 點 / 4 縣市」，實際 2026-07-17 TGOS 回填後快照已是 **1,794 點 / 8 縣市**（新北 510 / 彰化 445 / 南投 227 / 桃園 182 / 臺北 162 / 高雄 107 / 花蓮 105 / 金門 56）——本次已請上游同步修正（見上游 §2.3、§7、§8）。
- `publicLibraries` 與既有文化設施層（`culturalFacilities`，typeId=K「特色圖書館」）有實體重疊，上游尚未實作去重，前端也未做名稱比對去重（見 backlog CF-2）。
- `welfareCenters` 資料時點固定 2023-04，popup 已標注但資料本身未更新。
