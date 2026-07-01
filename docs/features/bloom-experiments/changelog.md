# bloom-experiments — changelog

## 2026-07-01 — Initial 4-layer bloom 實驗場

**分支**：`feat/power-plant-glow`

### 新增
- `src/three/GlowPointsScene.ts` — 通用 Point bloom primitive（Points + additive halo shader + zoom 自適應）
- `src/map/powerPlantGlowCustomLayer.ts` + `src/hooks/usePowerPlantGlowLayer.ts` — 發電廠 Bloom（209 主要電廠）
- `src/map/substationEhvGlowCustomLayer.ts` + `src/hooks/useSubstationEhvGlowLayer.ts` — 變電所 EHV Bloom（38 座超高壓）
- `src/hooks/usePowerLinesGlowTestLayer.ts` — 高壓輸電線 Bloom（純 Mapbox 4-pass line-blur 疊層，2,305 條）
- `src/hooks/useAviationRestrictedGlowLayer.ts` — 機場管制 rim glow（CTR/CONTROL/SURFACE/RCR/DANGER/ULZ/CIRCUIT）
- `docs/features/bloom-experiments/` 資料夾

### 決策
- **不動任何正式 layer**：以測試 layer 並存，方便 side-by-side 對照
- **點：Three.js additive**，因為視覺質感明顯優於 Mapbox
- **線 + 面：純 Mapbox 疊層**，避開「一 gl context 塞兩個 THREE.WebGLRenderer」的 state 打架問題
- Point 資料源從 `get_ssot_power_plants_with_output`（會 timeout）改用 `fetchFacPrimary`（有 60min cache、更輕）

### 學到
- **Points 天然 billboard + gl_PointSize 是螢幕像素** → 拉遠光暈不會縮，需要 shader 自己乘 zoom 縮放係數
- **同一 mapbox gl context 不能塞兩個 THREE.WebGLRenderer**（詳見 README pitfall 段）
- Mapbox `line-blur` 是絕對像素，跟 Points 一樣有 zoom-invariant 問題（本次尚未修）

### 尚未做
- 線 Mapbox 疊層加 zoom-interpolate width + blur（現在拉遠也會太肥）
- 面 rim glow 用 Three.js additive（現在是 Mapbox 疊層，效果 70%）
- 整合 legend / featureInfo panel（現在是純視覺 layer，無 popup）
- Refactor `OsmPowerLinesGlowScene` → 通用 `GlowLinesScene`（跟 Point 對稱）
