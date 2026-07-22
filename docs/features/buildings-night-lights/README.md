# 建物夜景燈光 Buildings Night Lights

> **Slug**：`buildings-night-lights`
> **狀態**：dev（未 push）
> **Owner**：migu
> **啟動日期**：2026-07-22
> **分支**：`feat/buildings-night-lights`

## 一句話說明

在既有「建物輪廓 Buildings」(`buildingsGba`) 圖層新增**第 4 個顯示模式「夜景燈光」**：深色底圖上以建物高度驅動暖橘／白發光，橘白交錯模擬台灣城市夜空；高樓額外疊一層 Three.js additive bloom 光暈補「爆白」質感。參考「發電廠 Bloom 測試 ✨」的技法。

## 圖層 / 元件

| 名稱 | 類型 | 資料源 | 狀態 |
|---|---|---|---|
| `buildingsGba` mode 3「夜景燈光」 | Mapbox fill | `buildings_3d_taiwan.pmtiles`（既有，152 萬棟） | ✅ |
| `buildings-night-bloom-3d` 高樓 bloom 疊層 | Three.js CustomLayer（`GlowPointsScene`） | 同上 source，render 時 querySourceFeatures 取視野內高樓 | ✅ |

## 運作重點

- **夜景 fill**（純 Mapbox）：`buildingNightLightColorExpr()` 兩組 6 段色階（暖橘家族 / 白光家族）依 `height` 由暗轉亮；`round(height*10) % 3 == 0` 做確定性 pseudo-random 分流 → 約 1/3 白光交錯。全量 152 萬棟、零效能風險。
- **高樓 bloom**（Three.js additive）：夜景模式開啟時，每次 moveend 從 `buildings-gba` source 撈視野內建物 → 篩 `height ≥ 門檻`（slider 40–200m，預設 100m）→ 去重 → 取最高前 **4096 棟**（對齊 `GlowPointsScene` 上限）→ 暖白光暈、核心爆純白、zoom 自適應。低 zoom = 地標群聚發亮、高 zoom = 逐棟 beacon。

## 關鍵檔案

- 配色 SSOT：`src/data/buildingsGbaTypes.ts`（`buildingNightLightColorExpr` / `BUILDING_NIGHT_LEGEND` / `BUILDINGS_GBA_MODES`）
- Fill paint：`src/map/overlayRegistry.ts`（`buildingsGba` entry，modeIdx===3 分支）
- Bloom CustomLayer：`src/map/buildingsNightBloomCustomLayer.ts`
- Bloom Hook：`src/hooks/useBuildingsNightBloomLayer.ts`
- 光暈 primitive（復用）：`src/three/GlowPointsScene.ts`
- 圖例：`src/components/LegendPanel.tsx`（`BuildingsGbaLegend` modeIdx===3）
- 參數 slider：`src/hooks/useTransportParams.ts`（`buildingsGbaBloomMinHeight`）
- 接線：`src/App.tsx`（`useBuildingsNightBloomLayer`）

## 資料契約

**無新契約** — 純視覺模式，復用既有 `buildings_3d_taiwan.pmtiles` 的 `height` 欄位，故不需 upstream handoff / ADR。

## 已知限制 / 坑

- 建物 PMTiles **minzoom 8**，「整島一畫面」（z6-7）無資料；效果落在 **z8+（城市／區域級）**。
- 一份 gl context 只能有一個「同時 render」的 Three.js 光暈 Scene（見 `docs/features/bloom-experiments/README.md` 雙 Scene pitfall）→ **勿與「發電廠/變電所 Bloom 測試」同時開啟**；不同時可見則安全（render 不可見時提前 return）。
- 樓層無真實欄位，沿用 `height/3` 精神直接吃 `height`。

## 歷次改動

看 [changelog.md](./changelog.md)。
