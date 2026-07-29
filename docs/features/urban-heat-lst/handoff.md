# Handoff — 都市熱島 Urban Heat（下游視角）

> **上游 SSOT**：[`../../../taipei-gis-analytics/docs/handoff/urban_heat_lst.md`](../../../taipei-gis-analytics/docs/handoff/urban_heat_lst.md)（詳細契約看那份）
> **機器可讀編碼參數**：`taipei-gis-analytics/data/intermediate/environment/urban_heat_lst/output/urban_heat_lst_encoding.json`
> **上游 pipeline**：`taipei-gis-analytics/pipelines/environment/urban_heat_lst/`
>
> 本檔只放**前端接線的簡表 + 上游約定的差異點**。契約細節不重複寫，只反向引用。

## 上游 handoff 摘要

- 產物路徑：S3 `deploy-assets/environment/urban_heat_lst_taiwan.pmtiles`
  → 本地 `public/environment/urban_heat_lst_taiwan.pmtiles`（gitignored）
  → prod `/data/environment/urban_heat_lst_taiwan.pmtiles`（nginx `location /environment/`）
- 更新頻率：**年更**（手動，每年 10 月後把當年 5–9 月新景納入重算 median）
- 座標系統：EPSG:3857（PMTiles 原生，前端不用轉）
- 資料量：29.6 MB，PNG raster，512 px，z6–11，bounds `[119.215781, 21.806591, 122.113386, 25.595925]`
- 覆蓋：台灣本島 + 綠島/蘭嶼/小琉球，陸地覆蓋率 82.9%；**澎湖 0%**、金馬不在資料集內

（完整契約 → 上游 handoff）

## 前端接線位置

- Loader：**無**（靜態 PMTiles，走 `overlayManager` 的 pmtiles source 機制）
- Hook：**無**
- 色票／值域 SSOT：`src/data/urbanHeatTypes.ts`
- Overlay：`src/map/overlayRegistry.ts`（`OVERLAY_REGISTRY` 第一筆，id `urbanHeat`）
- UI toggle：`src/components/sidebar/layerCatalog.ts`（`LAYER_COLORS` + `SECTIONS`「環境氣候 › 氣象」）
- 參數：`src/hooks/useTransportParams.ts`（`urbanHeatModeIdx` / `urbanHeatOpacity`）
- 圖例：`src/components/LegendPanel.tsx`（`UrbanHeatLegend`）
- 部署：`scripts/deploy/upload-deploy-assets.sh`（`public/environment/*.pmtiles` 段）
  ／`scripts/deploy/pull-deploy-assets.sh`（`environment/` 前綴，早已存在）

## 硬依賴欄位（改一定爆）

值編碼是**硬編在 `urbanHeatTypes.ts` 的 `mix` 係數裡**的，不是從檔案讀的：

| 上游參數 | 前端硬編處 | 用途 |
|---|---|---|
| `channels.R.decode` = `DN/5 − 30` | `URBAN_HEAT_MODES[0].mix = [0.2, 0, 0, -30]` | ΔT 模式的 `raster-color-mix` |
| `channels.R.range` = `[-30, 21]` | `URBAN_HEAT_MODES[0].range` | ΔT 模式的 `raster-color-range` |
| `channels.G.decode` = `DN/4 + 10` | `URBAN_HEAT_MODES[1].mix = [0, 0.25, 0, 10]` | 絕對溫度模式的 `raster-color-mix` |
| `channels.G.range` = `[10, 73.75]` | `URBAN_HEAT_MODES[1].range` | 絕對溫度模式的 `raster-color-range` |
| `channels.A` = 255 有效 / 0 nodata | 不用寫 code | mapbox raster-color 會把 source alpha 乘進結果當 opacity |
| tile `maxzoom` = 11 | `pmtiles: { minzoom: 6, maxzoom: 11 }` | 設 12 會去要不存在的磚 |

## 上游改動 → 下游要跟改的觸發點

| 上游改動 | 下游動作 |
|---|---|
| 改量化參數（offset / scale） | **breaking** — 必改 `urbanHeatTypes.ts` 的 `mix` / `range` |
| 年更重算（只是多幾景） | 檔名不帶日期 → **不用改 code**，重 pull S3 即可；但 P2–P98 會微動，順手核對 stop 首尾 |
| 改 tile zoom 範圍 | 改 `overlayRegistry` 的 `pmtiles.minzoom/maxzoom` |
| 覆蓋範圍變動（例如補上澎湖） | 改 `URBAN_HEAT_COVERAGE_NOTE` 這行圖例註記 |
| 換掉 A 通道語意 | 整層 nodata 處理要重想（目前完全靠 source alpha） |

## 已知不對稱

1. **`raster-color-mix` 的係數基準**：上游 handoff §3.4 假設「Mapbox 先把通道正規化到 0–1
   再進 mix」，因此給的係數是 `[51, 0, 0, -30]` / `[0, 63.75, 0, 10]`（照 repo 既有 `canopyHeight`
   的寫法）。實際讀 mapbox-gl 3.9 原始碼，`computeRasterColorMix()` 的 factor 帶了 `×255`，
   抵銷 texture 取樣的正規化 —— 等效公式是
   `V = mix[0]*R_DN + mix[1]*G_DN + mix[2]*B_DN + mix[3]`，**係數作用在 0–255 原始 DN 上**
   （同 Mapbox 官方 terrain-rgb 解碼範例 `[6553.6, 25.6, 0.1, -10000]` 的寫法）。
   所以前端採用 `[0.2, 0, 0, -30]` / `[0, 0.25, 0, 10]` —— 直接抄 encoding.json 的 decode
   斜率／截距，`["raster-value"]` 就是物理值，色階 stop 也直接寫物理值。
   → 建議上游把 §3.4 的兩段程式碼改成物理值寫法（§3.4 末尾那個「若前端改用 mix 輸出物理值」
   的備註同樣要把 51 / 63.75 改成 0.2 / 0.25）。
2. **顯示值域比上游建議的窄**：上游 §3.4 的 ΔT 色階 stop 從 −20 K 拉到 +14 K；前端收窄到
   −10 ~ +8 K，讓山地飽和在藍端、把對比讓給平原都市。這是刻意的視覺決策，不是契約差異。
3. **同一份 mapbox 假設也影響既有的 `canopyHeight` 圖層**（`mix [6.375,0,0,0]` + `range [0,1]`）。
   若上述解讀正確，該層的色階實際上會整片飽和在最深綠。本 PR 未動它（超出範圍），
   待驗收時一併目視確認。
