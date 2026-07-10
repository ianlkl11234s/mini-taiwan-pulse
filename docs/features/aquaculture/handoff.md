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
- 更新頻率：靜態（OSM / 政府開放資料，一次性 / 不定期）
- 座標系統：WGS84
- 資料量：ponds 15,241 面 / zone 62 面 / cageNet 42 面
- 授權：**ponds = OSM ODbL**（不可與政府資料 UNION）；zone / cageNet = 政府開放資料

（完整契約 → 上游 handoff）

## 前端接線位置

- Overlay：`src/map/overlayRegistry.ts`（3 layer fill+line 宣告）
- Popup：`src/hooks/useMapInteraction.ts` + `src/components/featureInfo/fisheryPanels.tsx`（新）+ `registry.tsx`
- Opacity slider：`src/hooks/useTransportParams.ts`
- Legend：`src/components/LegendPanel.tsx`（`AquacultureLegend`）+ `LEGEND_REGISTRY`
- UI toggle：`src/components/sidebar/layerCatalog.ts`（`LAYER_COLORS` + `SECTIONS`「農業」→「養殖漁業」子分組）+ `src/components/IconRailSidebar.tsx`（Fish icon）
- Types：`src/types/index.ts`（`LayerVisibility` 3 key）
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

> ⚠️ 上游若移除或改名上述任一欄位（尤其 pmtiles sourceLayer / keep_attrs），下游 overlay + popup 直接爆 → **務必先開 upstream handoff**。

## 上游改動 → 下游要跟改的觸發點

| 上游改動 | 下游動作 |
|---|---|
| pmtiles keep_attrs 增刪欄位 | `fisheryPanels.tsx` popup 對應 Row 跟改 |
| pmtiles sourceLayer 改名 | `overlayRegistry.ts` 的 `source-layer` 跟改 |
| ponds tippecanoe zoom 範圍改（z5–14） | 檢查前端 ponds 顯示 minzoom 9 是否仍合適 |
| zone / cageNet geojson 欄位改名 | `fisheryPanels.tsx` popup Row 跟改 |
| 新增放養量 G70 / 牡蠣養殖區 | 新增 layer（走 §5 新增 layer SOP + 四鐵則）|

## 已知不對稱 / 待決

- **部署方式未定**：3.1MB pmtiles 進 git 版控 vs gitignore + S3（`upload-deploy-assets.sh` 已備 S3 路徑）— 待用戶決定。
- **屬性稀疏**：ponds 15,241 筆多數無 `produce` / `name` → popup 多欄空（Row 對空值自動隱藏，非 bug）。
- **popup footer source 空**：養殖資料未帶 `source_org` / `source_tier`，`SourceFooter` 顯示「資料來源 (Tier ?)」（cosmetic；OSM 歸屬在地圖 attribution 已有）。
- **狀態**：已驗證，**未 commit / 未 push**；PR / squash hash pending。
</content>
