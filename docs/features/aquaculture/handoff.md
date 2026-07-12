# Handoff — 養殖漁業 Aquaculture（下游視角）

> **上游 SSOT**：`../../../taipei-gis-analytics/docs/handoff/aquaculture.md`（詳細契約看那份）
>
> 本檔只放**前端接線的簡表 + 硬依賴欄位**。契約細節不重複寫，只反向引用。

## 上游 handoff 摘要

- 上游分支：`taipei-gis-analytics` `feat/aquaculture-pmtiles`
- 產物路徑（前端 CDN，走 `public/fishery/`）：
  - `aquaculture_ponds_osm.pmtiles`（3.1MB，sourceLayer `aquaculture_ponds_osm`, z5–14）
  - `aquaculture_production_zone.geojson`（589KB）
  - `aquaculture_cage_net.geojson`（20KB）
  - `aquaculture_water_satellite.pmtiles`（3.3MB，sourceLayer `aquaculture_water_satellite`, z5–14，keep 8 欄）— ⭐ 新
- 更新頻率：靜態（OSM / 政府開放資料 / 衛星影像衍生，一次性 / 不定期；衛星層上游標 `lifecycle: yearly`）
- 座標系統：WGS84
- 資料量：ponds 15,241 面 / zone 62 面 / cageNet 42 面 / waterSatellite 視覺層 6,094 面（source 8,333，上游已濾湖泊/純光電/山影假陽性；含宜蘭擴張波）
- 授權：**ponds / waterSatellite = OSM ODbL（衍生）**（不可與政府資料 UNION）；zone / cageNet = 政府開放資料

（完整契約 → 上游 handoff；衛星層額外見上游
`docs/data-catalog/fishery/aquaculture_water_satellite.md`）

## 前端接線位置

- Overlay：`src/map/overlayRegistry.ts`（4 layer fill+line 宣告）
- Popup：`src/hooks/useMapInteraction.ts` + `src/components/featureInfo/fisheryPanels.tsx`（含新 `AquacultureWaterSatellitePanel`）+ `registry.tsx`
- Opacity slider：`src/hooks/useTransportParams.ts`
- Legend：`src/components/LegendPanel.tsx`（`AquacultureLegend`，衛星層拆 in_osm 兩色 row）+ `LEGEND_REGISTRY`
- UI toggle：`src/components/sidebar/layerCatalog.ts`（`LAYER_COLORS` + `SECTIONS`「農業」→「養殖漁業」子分組）+ `src/components/IconRailSidebar.tsx`（`Satellite` icon，跟 ponds/zone/cageNet 的 `Fish` icon 區隔）
- Types：`src/types/index.ts`（`LayerVisibility` 加 `aquacultureWaterSatellite`）
- Upstream registry：`src/data/upstreamRegistry.ts`

## 硬依賴欄位（改一定爆）

**`aquaculturePonds`（pmtiles）**：
- **sourceLayer `aquaculture_ponds_osm`** — 改名 → source 掛不上，layer 全消。
- `osm_id` / `osm_type` — 唯一識別 / popup。
- `name` — popup 顯示（僅 ~21 筆有值）。
- `produce` — popup「養殖物」（僅 ~118 筆有值）。
- `area_ha` — popup「面積」（ha）。

**`aquacultureZone`（geojson）**：`zone_name` / `county` / `township` / `area_ha` — popup 顯示。

**`aquacultureCageNet`（geojson）**：`public_no` / `township` / `location` — popup 顯示。

**`aquacultureWaterSatellite`（pmtiles，⭐ 新；keep 8 欄 = 契約 5 + 抽檢 3，2026-07-12 上游 5→8 擴欄）**：
- **sourceLayer `aquaculture_water_satellite`** — 改名 → source 掛不上，layer 全消。
- `detect_id` — 流水號識別。
- `area_ha` — popup「面積」（ha）。
- `in_osm` — **paint 分色硬依賴**（`["case", ["==", ["get","in_osm"], true], ...]`）+ popup「狀態」文字；型別為 boolean，改成 0/1 或字串會讓 case 表達式全部落到 else 分支（誤判成全部漏標候選）。
- `county` — popup 顯示。
- `tile_id` — 未在前端使用，保留供除錯溯源。
- `nlsc_code`（string）/ `nlsc_name`（string，NLSC 官方土地用途中文名，99.3% 覆蓋）— popup「土地使用（NLSC 113年）」顯示 `名稱（代碼）`，如「水產養殖（0102）」；空值 Row 自動隱藏。用戶抽檢可疑面的關鍵證據。
- `solar_symbiotic`（bool）— true 時 popup 顯示「漁電共生」列（此面在光電案場內，但官方認定水產養殖或有魚塭證據而保留）；型別同 `in_osm` 為 boolean，字串化會讓判斷失效（列永不顯示）。

> ⚠️ 上游若移除或改名上述任一欄位（尤其 pmtiles sourceLayer / keep_attrs / `in_osm` 型別），下游 overlay + popup 直接爆 → **務必先開 upstream handoff**。

## 上游改動 → 下游要跟改的觸發點

| 上游改動 | 下游動作 |
|---|---|
| pmtiles keep_attrs 增刪欄位 | `fisheryPanels.tsx` popup 對應 Row 跟改 |
| pmtiles sourceLayer 改名 | `overlayRegistry.ts` 的 `source-layer` 跟改 |
| ponds tippecanoe zoom 範圍改（z5–14） | 檢查前端 ponds 顯示 minzoom 9 是否仍合適 |
| zone / cageNet geojson 欄位改名 | `fisheryPanels.tsx` popup Row 跟改 |
| waterSatellite `in_osm` 型別/語意改（如交集門檻從 50% 調整） | `overlayRegistry.ts` 的 case 表達式 + `AquacultureLegend` 說明文字跟改 |
| waterSatellite 補逐口輪廓（L3 U-Net/SAM） | 評估是否併入 `aquaculturePonds` 或另立新 layer |
| 新增放養量 G70 / 牡蠣養殖區 | 新增 layer（走 §5 新增 layer SOP + 四鐵則）|

## 已知不對稱 / 待決

- **部署方式未定**：pmtiles（ponds 3.1MB + waterSatellite 3.3MB）進 git 版控 vs gitignore + S3（`upload-deploy-assets.sh` 已備 S3 路徑）— 待用戶決定。
- **屬性稀疏**：ponds 15,241 筆多數無 `produce` / `name` → popup 多欄空（Row 對空值自動隱藏，非 bug）。
- **popup footer source 空**：養殖資料（含 waterSatellite）未帶 `source_org` / `source_tier`，`SourceFooter` 顯示「資料來源 (Tier ?)」（cosmetic；OSM / Sentinel-2 歸屬已在地圖 attribution 呈現）。
- **waterSatellite 品質誠實聲明**：10m blob 非逐口輪廓；`in_osm=false` 仍含殘餘假陽性（上游已濾湖泊/純光電/山影三大類 — 8,333 → 視覺層 6,094；擴張波區宜蘭/花蓮縱谷/臺中海線離訓練域較遠，假陽性比例預期高於西南主帶）。前端 popup 一行 ⓘ 提示 + NLSC 土地使用 / 漁電共生兩欄供用戶對照衛星底圖抽檢。
- **狀態**：已驗證，**未 commit / 未 push**；PR / squash hash pending。
</content>
