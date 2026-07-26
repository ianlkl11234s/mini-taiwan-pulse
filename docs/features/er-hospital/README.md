# <feature-name>

> **Slug**：`<feature-slug>`（與 taipei-gis-analytics handoff 一致）
> **狀態**：planning / dev / staging / shipped / deprecated
> **Owner**：<你>
> **上線日期**：YYYY-MM-DD
> **相關 PR**：#XX #YY

## 一句話說明

<這個 feature 給用戶看到什麼、解決什麼問題>

## 圖層 / 元件

| 名稱（layer key） | 類型 | 資料源 | 狀態 |
|---|---|---|---|
| xxx | point / line / polygon / 3D / raster | PMTiles / RPC / GeoJSON | ✅ |

## 關鍵檔案

- Loader：`src/data/xxxLoader.ts`
- Hook：`src/hooks/useXxxLayer.ts`
- Overlay：`src/map/overlayRegistry.ts`（或 CustomLayer）
- Catalog：`src/components/sidebar/layerCatalog.ts`
- Legend：`src/components/panels/LegendPanel.tsx`

## 資料契約摘要

看 [handoff.md](./handoff.md)。上游 SSOT：`taipei-gis-analytics/docs/handoff/<slug>.md`。

## 相關 backlog

看 [backlog.md](./backlog.md)。

## 歷次改動

看 [changelog.md](./changelog.md)。

## 相關 ADR

- ADR-XXXX（若有）

## 相關文件

- 上游 handoff：`../../../taipei-gis-analytics/docs/handoff/<slug>.md`
- 開發規則：`../../development-rules.md`

---

## 2026-07-26 全醫院分區網格改版

監看模式的 `ERCard` 從「選一家看一家」改成「59 家一次看完」，視覺語彙對齊能源卡的
UNIT OUTPUT 區塊。

- **驅動的資料契約**：`public.get_er_hospital_24h_all()`（gis-platform migration 319，
  無參數、26ms、59 rows、每院約 84 點 `[ts, wait_see, wait_bed, wait_general, wait_icu]`）。
  一次打包省掉「切一家 fetch 一次」的 N 次 RPC。
- **分區**：`src/components/intel/monitor/erCardData.ts` 把 RPC 的 19 個 area_name（縣市）
  收斂成台電四大區 **北部 / 中部 / 南部 / 東部**（宜蘭歸北部，同台電慣例）。實測資料無離島
  縣市 —— 澎湖／金門／連江沒有重度級或兒童急救責任醫院，因此不設「離島」區；未知縣市
  （名單年年評定會變）落「其他」保底，不吃掉資料。
- **版面**：每區一個 section（區名 + 院數），區內小卡按「等一般病床」desc（最壅塞在前，
  無資料墊底）。小卡 = 院名（超長截斷）+ 等床大字（`erCongestionTypes.ts` 嚴重度色）
  + 24h `wait_general_cnt` 迷你 sparkline（沿用 `PressureRing.tsx` 的 `Sparkline`，無座標軸）。
- **移除**：縣市 select、醫院 chip tabs、單院 `TimeseriesSparkline` 大圖、單院 24h fetch 的
  呼叫端。`fetchErHospital24h()` 本身保留 —— popup 的 `EmergencyHospitalPanel` 仍在用。
- **未改**：嚴重度閾值與配色 SSOT（`src/data/erCongestionTypes.ts`）、5 min 輪詢節奏、
  地圖 circle 圖層與 popup。

逐項變更看 [changelog.md](./changelog.md)。
