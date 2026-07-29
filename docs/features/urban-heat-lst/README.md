# 都市熱島 Urban Heat（地表溫度 LST）

> **Slug**：`urban-heat-lst`（與 taipei-gis-analytics handoff 一致）
> **狀態**：dev（前端接線完成，待瀏覽器驗收 + S3 上傳）
> **Owner**：migu
> **上線日期**：—
> **相關 PR**：（stacked 於 #92 溫度網格 2D → #93 LASS 微感測三模式之後）

## 一句話說明

把 2019–2025 年 193 景 Landsat 8/9 衛星地表溫度合成成一張全台熱圖，讓人一眼看出
「哪些都市區比周邊農地熱幾度」（熱島強度 ΔT）與「哪些地表在暖季上午就已經燙到 45°C 以上」
（絕對地表溫度）。

## 圖層 / 元件

| 名稱（layer key） | 類型 | 資料源 | 狀態 |
|---|---|---|---|
| 都市熱島 Urban Heat（`urbanHeat`） | raster（雙通道值編碼 RGBA PMTiles） | `public/environment/urban_heat_lst_taiwan.pmtiles`（29.6 MB，z6–11 @512px，EPSG:3857） | ✅ 接線完成 |

**雙顯示模式**（切換 = 換 `raster-color-mix` + `raster-color` + `raster-color-range`）：

| modeIdx | 模式 | 讀哪個通道 | 色帶 | 顯示值域 |
|---|---|---|---|---|
| 0（預設） | 熱島強度 ΔT | R（`ΔT = R/5 − 30`） | 發散 RdBu 反轉，**白鎖 0 K** | −10 ~ +8 K（超出飽和） |
| 1 | 絕對地表溫度 | G（`°C = G/4 + 10`） | 循序 inferno（深紫→橘→黃） | 22 ~ 48 °C ≈ P2–P98 |

## 關鍵檔案

- 色票／值域 SSOT：`src/data/urbanHeatTypes.ts`（兩模式的 mix 係數、range、stop、圖例刻度）
- Overlay：`src/map/overlayRegistry.ts`（`OVERLAY_REGISTRY` **第一筆** — 全島滿版 raster 要排最底層）
- Catalog：`src/components/sidebar/layerCatalog.ts`（`LAYER_COLORS` + `SECTIONS`「環境氣候 › 氣象」）
- Icon：`src/components/IconRailSidebar.tsx`（lucide `ThermometerSun`）
- 參數：`src/hooks/useTransportParams.ts`（`urbanHeatModeIdx` / `urbanHeatOpacity`）
- Legend：`src/components/LegendPanel.tsx`（`UrbanHeatLegend`，兩模式共用同一框）
- 型別：`src/types/index.ts`（`ExpandableLayerKey` + `LayerVisibility`）
- 上游對照：`src/data/upstreamRegistry.ts`（`catalog_missing` — 國際衛星源，非台灣 open data catalog）

無 loader、無 hook：靜態 PMTiles，走 `overlayManager` 既有 pmtiles source 機制；
沒有 JS 端非同步 fetch，所以不需註冊 loadingRegistry（磚的 Range Request 由 Mapbox 自己排程，
同 `canopyHeight`）。

## UX（四鐵則對照）

1. **透明度**：`urbanHeatOpacity` slider，預設 0.75（0.2–1.0，step 0.05）。
2. **圖例**：`UrbanHeatLegend`，依模式換漸層條 + 刻度；註記含
   「Landsat 8/9 地表溫度 · 2019–2025 暖季合成 · USGS」與「不含澎湖（上游無資料）」。
3. **popup**：raster 圖層不可點選 → 不進 `FeatureInfo.layerType`，比照 `canopyHeight`
   （`canopyHeight` 同樣沒有 popup 且不在任何測試 baseline，所以**本次沒有新增任何測試豁免**）。
4. **select**：2 個選項 → `ExpandedControls` 自動渲染成 button row（≥4 才轉原生 dropdown），不爆版。

預設關閉（`useLayerVisibility` 的 `DEFAULT_ON` 只有 `streetTreesTaipeiDiff`）。

## ⚠️ 限制（UI 文案不要越界）

1. **不含澎湖**（覆蓋 0%）。原因在上游：Landsat C2 L2 的 ST 產品在澎湖 94% 陸地就是 nodata，
   剩下的像元 ST_QA 全部超標。金門、馬祖同樣不在資料集內。
2. **這是上午約 10:20 的地表溫度，不是氣溫、不是體感**。柏油正午可比氣溫高 20°C 以上。
   文案不要寫「今天幾度」。
3. **多年 median、不是即時值**。不接時間軸、`currentTime` 不進 deps。
4. **ΔT < 0 不等於涼爽都市**：背景是低海拔農地，國土七成是山，ΔT 中位數 −8 K 多半只是海拔高。
   判讀請看平原內部的相對差異，不要跨海拔比較。
5. **nodata 集中在中央山脈與基隆丘陵**（常年多雲）。空白 ≠ 沒有熱島，是沒資料。
6. **絕對溫度跨年不可比**（各景天氣基線不同）；要比年份請看 ΔT。
7. **低 zoom 的鋸齒是刻意的**（上游 `gdaladdo -r nearest` + 前端 `raster-resampling: nearest`）。
   R/G 是量化數值不是顏色，average / linear 會在 nodata 邊界混出假的冷帶。

## 資料契約摘要

看 [handoff.md](./handoff.md)。上游 SSOT：`taipei-gis-analytics/docs/handoff/urban_heat_lst.md`。

## 相關 backlog

看 [backlog.md](./backlog.md)。

## 歷次改動

看 [changelog.md](./changelog.md)。

## 相關文件

- 上游 handoff：`../../../taipei-gis-analytics/docs/handoff/urban_heat_lst.md`
- 上游方法論：`../../../taipei-gis-analytics/docs/topic-research/remote_sensing/urban-heat-lst-methodology.md`
- 開發規則：`../../development-rules.md`（§4a 圖層 UX 四鐵則）
- 同型別前例：`canopyHeight`（repo 另一個 raster PMTiles 圖層）
