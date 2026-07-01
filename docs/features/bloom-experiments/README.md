# bloom-experiments

> **Slug**：`bloom-experiments`
> **狀態**：dev（測試 layer，未 ship 到正式視覺）
> **Owner**：migu
> **啟動日期**：2026-07-01
> **分支**：`feat/power-plant-glow`
> **相關 PR**：(暫緩)

## 一句話說明

參考 [DeusData/codebase-memory-mcp](https://github.com/DeusData/codebase-memory-mcp) 的 3D graph UI 發光美學，把「bloom 濾鏡 + additive blending + 中心爆白」的技法搬進 mini-taiwan-pulse，讓能源相關 layer 有星系感的視覺質感。

作為**視覺實驗場**，不動任何正式 layer，用戶可以 side-by-side 比較 bloom 版 vs. 原生版。

## 4 個測試 layer

| 名稱（layer key） | 類型 | 技法 | 資料源 | 狀態 |
|---|---|---|---|---|
| `powerPlantGlow` | Point | **Three.js Points + additive halo shader**（自研 GlowPointsScene） | `fetchFacPrimary` (SSOT L1，209 主要電廠) | ✅ |
| `substationEhvGlow` | Point | **複用** GlowPointsScene | `fetchOsmSubstations` → filter EHV (38 座) | ✅ |
| `powerLinesGlow` | Line | **純 Mapbox 4-pass line-blur 疊層**（halo-far / mid / near / core） | `fetchOsmPowerLines` (2,305 條) | ✅ |
| `aviationRestrictedGlow` | Polygon (rim) | **純 Mapbox 4-pass line-blur 疊層 + fill** | 既有 `aviation_airspace` PMTiles filter | ✅ |

## 三種技法的分工

### 技法 A：Three.js Points + additive halo（點）
- **檔案**：`src/three/GlowPointsScene.ts`（通用 primitive）
- **shader**：一支 Points draw call，fragment 内做 3 段 halo（core / mid / far）+ `AdditiveBlending`
- **參數化**：接口只吃 `{lon, lat, colorHex, sizeNorm}[]` — 未來任何 Point layer 30 分鐘可 bloom 化
- **Zoom 自適應**：`setZoom(mapboxZoom)` 走 shader uniform，拉遠自動縮小（`pow(1.5, zoom - 10)` clamp 0.15~3.5）

### 技法 B：Three.js instanced line shader（線）
- **檔案**：`src/three/OsmPowerLinesGlowScene.ts`（**既有**，本 feature 沒動）
- **shader**：instanced quad expansion + vertex 展開 fat-line + fragment `exp(-t²)` falloff + additive
- **雙 pass**：wide halo + narrow core，2 mesh 疊 additive
- **限制**：**一份 gl context 不能 mount 兩個實體 Scene**（狀態互相污染），詳見 pitfalls 段

### 技法 C：Mapbox 疊層 4-pass line-blur（線 + 面 rim glow）
- **檔案**：`src/hooks/usePowerLinesGlowTestLayer.ts`、`src/hooks/useAviationRestrictedGlowLayer.ts`
- **原理**：4 個 mapbox line layer 疊 → `line-blur=14/6/2/0` × `line-width=22/10/4/1.5` × `opacity=0.15/0.28/0.5/0.95` → 從外圍柔和暈到中心亮
- **面**：以 polygon 邊界當 line 走同套疊層，得到 rim glow 效果（無 additive 但可接受）
- **限制**：Mapbox 沒 additive blending，重疊處無法自然爆白（比 Three.js 弱）

## 關鍵檔案

| 用途 | 路徑 |
|---|---|
| 通用 Point bloom primitive | `src/three/GlowPointsScene.ts` |
| 發電廠 CustomLayer | `src/map/powerPlantGlowCustomLayer.ts` |
| 發電廠 Hook | `src/hooks/usePowerPlantGlowLayer.ts` |
| 變電所 CustomLayer | `src/map/substationEhvGlowCustomLayer.ts` |
| 變電所 Hook | `src/hooks/useSubstationEhvGlowLayer.ts` |
| 高壓輸電線 Hook（純 Mapbox）| `src/hooks/usePowerLinesGlowTestLayer.ts` |
| 機場管制 rim glow Hook | `src/hooks/useAviationRestrictedGlowLayer.ts` |
| 側邊欄 catalog | `src/components/sidebar/layerCatalog.ts`（4 個 key 加在「能源 → 電力·廠 / 電力·電網」）|

## 參數可調

四個 layer 都有 slider（在 sidebar 展開 layer 卡片時顯示）：

| Layer | 參數 |
|---|---|
| 發電廠 Bloom | 透明度 + **大小 0.2× ~ 3×** |
| 變電所 EHV Bloom | 透明度 + **大小 0.2× ~ 3×** |
| 高壓輸電線 Bloom | 透明度 + 寬度倍率 |
| 機場管制 Rim Glow | 透明度 |

## Pitfall — 兩個 Scene 打架

**症狀**：新增 `PowerLinesGlowTest` CustomLayer 用同一份 `OsmPowerLinesGlowScene` class，setData 收到 2,305 條，但畫面完全沒東西。

**根因**：原生 `useOsmPowerLinesGlowLayer` 已經在 `App.tsx:900` mount 一個 Scene 實例，我又 mount 第二個。兩個 `THREE.WebGLRenderer` 分別包同一個 Mapbox gl context，各自維持獨立 state cache。第一個 renderer 跑完 GL state 被改動，第二個以為 state 是預設值 → shader program / VBO / uniform 對不上 → 什麼都不畫。

**解法**：Line 測試改走**純 Mapbox 疊層**（技法 C），避開 Three.js 共 context 問題。順便得到「Three.js vs Mapbox」兩種技法的直接對照。

**通則**：一份 Mapbox gl context 建議**只掛一個** Three.js CustomLayer 實例，多個特效走 InstancedMesh + Scene 分組（同 Scene 內），不要 mount 多個 Scene。

## 相關 backlog

看 [backlog.md](./backlog.md)。

## 歷次改動

看 [changelog.md](./changelog.md)。
