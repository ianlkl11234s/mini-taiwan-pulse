# Handoff — 行道樹變化 Street Tree Diff（下游視角）

> **上游 SSOT**：`../../../taipei-gis-analytics/docs/handoff/street_trees_taipei_diff.md`（詳細契約看那份）
> 上游 catalog：`taipei-gis-analytics/docs/data-catalog/urban_open_space/street_trees_taipei_diff.md`（已存在，upstream 契約 verified）
>
> 本檔只放**前端接線的簡表 + 硬依賴欄位**。契約細節不重複寫，只反向引用。

## 上游 handoff 摘要

- 產物路徑（前端 CDN，走 `public/urban/`）：
  - `street_trees_taipei_diff.pmtiles`（3.1MB，sourceLayer `street_trees_taipei_diff`, z5–14）
- 更新頻率：靜態（一次性 diff 快照；2024/11 基準取自 Wayback vs 現在）
- 座標系統：WGS84
- 資料量：99,527 點
- status 三值：`persisted`（存續）/ `disappeared`（2024 有、現在無）/ `appeared`（2024 無、現在有）

（完整契約 → 上游 handoff / catalog doc）

## 前端接線位置

- Overlay：`src/map/overlayRegistry.ts`（`streetTreesTaipeiDiff` 單 circle layer）
- Popup：`src/hooks/useMapInteraction.ts`（hit-test `street-trees-taipei-diff-circle`）+ `src/components/featureInfo/urbanPanels.tsx`（`StreetTreesTaipeiDiffPanel`）+ `registry.tsx`
- 參數：`src/hooks/useTransportParams.ts`（opacity slider + status select，4 接觸點）
- Legend：`src/components/LegendPanel.tsx`（`StreetTreesTaipeiDiffLegend`）+ `LEGEND_REGISTRY`
- UI toggle：`src/components/sidebar/layerCatalog.ts`（`LAYER_COLORS` + THEMES「環境氣候」→「都市開放空間」子分組）+ `src/components/IconRailSidebar.tsx`（`TreePine` icon）
- Types：`src/types/index.ts`（`LayerVisibility` / `ExpandableLayerKey` / `FeatureInfo["layerType"]` 三處）
- Upstream registry：`src/data/upstreamRegistry.ts`

## 硬依賴欄位（改一定爆）

PMTiles keep_attrs 9 欄契約（sourceLayer `street_trees_taipei_diff`；改名 → source 掛不上，layer 全消）：

- `TreeID`（string）— popup 顯示 / 唯一識別。
- `TreeType`（string）— popup Title 樹種。
- `Dist`（string）— popup 路名附註的行政區。
- `Region`（string）— popup「路名」主值。
- `Diameter`（number|null）— popup「胸徑」（cm）；null 時 Row 自動隱藏。
- `TreeHeight`（number|null）— popup「樹高」（m）；null 時 Row 自動隱藏。
- `SurveyDate`（string）— popup「調查日」。
- `status`（string，三值 persisted/disappeared/appeared）— **paint 分色硬依賴**（`["match", ["get","status"], ...]`）+ popup 狀態標籤 + status 篩選。
- `renumber_suspect`（**boolean**）— **paint 透明度硬依賴**（`["case", ["==", ["get","renumber_suspect"], true], ...]`）+ popup 提示列；型別為 boolean，改成 0/1 或字串會讓 case 表達式落 else 分支（疑似重編號點誤判為正常顯示）。

> ⚠️ 上游若移除或改名上述任一欄位（尤其 sourceLayer / `status` 三值語意 / `renumber_suspect` 型別），下游 overlay + popup 直接爆 → **務必先開 upstream handoff**。

## 上游改動 → 下游要跟改的觸發點

| 上游改動 | 下游動作 |
|---|---|
| pmtiles keep_attrs 增刪欄位 | `urbanPanels.tsx` popup 對應 Row 跟改 |
| pmtiles sourceLayer 改名 | `overlayRegistry.ts` 的 `pmtiles.sourceLayer` 跟改 |
| status 新增第 4 值 | `overlayRegistry.ts` match 表 + `StreetTreesTaipeiDiffLegend` + `urbanPanels.tsx` `STATUS_TIER` 三處跟改 |
| `renumber_suspect` 型別/語意改 | `overlayRegistry.ts` 的 case 表達式 + popup 提示文字跟改 |
| 更新 diff 基準（換 Wayback 日期） | README + popup caveat 文字跟改 |

## 部署（D 類 · 新 group `urban/`）

PMTiles 3.1MB ≥ 2MB → 走 **D 類**，新增 group `urban/`，五處：
- `.gitignore`：`public/urban/*.pmtiles`（已加）
- `scripts/deploy/upload-deploy-assets.sh`：urban glob 段（`for f in public/urban/*.pmtiles`，已加）
- `scripts/deploy/pull-deploy-assets.sh`：`mkdir -p $DATA_DIR/urban` + `aws s3 sync $S3/urban/ $DATA_DIR/urban/` + fire glob 補 `--exclude "urban/*"`（已加）
- `nginx.conf`：`location /urban/ { root /data; try_files $uri @dist; ... }`（已加）
- `docker-compose.yml`：比照 fishery/aquaculture 不動（deployContract 測試不驗它）

## 已知不對稱 / 待決

- **TreeID 消失≠砍除**：2024 基準取自 Wayback，可能含颱風後清運滯後；popup 一行 ⓘ 誠實標註。
- **重編號干擾**：`renumber_suspect=true`（同路名同樹種 10m 內配對）可能非真消失/新增；地圖降透明 + popup 提示列。
- **popup footer source 可能空**：若上游未帶 `source_org` / `source_tier`，`SourceFooter` 顯示「資料來源 (Tier ?)」（cosmetic）。
- **狀態**：本地接線完成、tsc + 契約測試綠，**未 commit / 未 push**；PR / squash hash pending。
