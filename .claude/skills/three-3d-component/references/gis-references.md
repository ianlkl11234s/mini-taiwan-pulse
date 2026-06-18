# 外部 GIS 3D 案例研究筆記

> 配合 `SKILL.md §六` 使用。設計新元件 / 評估方案時參考。

## 1. 技術骨架類

### threebox (Mapbox + Three.js plugin)
- **連結**：https://github.com/peterqliu/threebox / https://github.com/jscastro76/threebox
- **核心**：用 Mapbox `CustomLayerInterface` 包 Three.js，提供 model loader、animation、raycaster
- **借鑒**：我們的 `*CustomLayer.ts` 骨架（共享 GL context + matrix → projectionMatrix）和它一致
- **為何不引入**：本專案 Scene 客製度高（shader / particle / 時間訂閱），引 plugin 反而被約束。骨架抄 pattern 即可。

### Mapbox 官方 3D model 範例
- https://docs.mapbox.com/mapbox-gl-js/example/add-3d-model/
- https://docs.mapbox.com/mapbox-gl-js/example/add-3d-model-threebox/
- **借鑒**：GLB 模型載入 + lighting 設定。**目前未用**（船舶用 orb 而非船模型，是審美選擇）。

### Geodan/mapbox-3dtiles
- https://github.com/Geodan/mapbox-3dtiles
- **借鑒**：3D Tiles spec 在 Mapbox 中的 streaming pattern。未來真實建築要上時參考。

## 2. 視覺化框架類

### deck.gl
- https://deck.gl/
- https://deck.gl/docs/api-reference/mapbox/overview
- **關鍵 layer**：
  - `ArcLayer`：兩端點 + 高度 ∝ 距離。**我們的 `arc` 元件設計來源**
  - `HexagonLayer`：3D hexbin。**對應 `hexgrid` / h3 圖層**
  - `TripsLayer`：時序動畫軌跡。**對應 `flowline` + 列車軌跡**
  - `ColumnLayer`：點上長柱。**對應 `bars`**
- **借鑒**：「interleave 進 Mapbox style」的概念 — 我們的 CustomLayer 走相同 pattern
- **為何不直接用 deck.gl**：捆綁太大（React wrapper + 完整 layer 庫），我們只需挑幾種，自寫更輕

### Kepler.gl
- 借鑒「同一份資料 2D / 3D 切換」「圖層配色 palette」「side-by-side compare」三個 UI 模式
- 我們的圖層 toggle + transparency slider 走相同哲學

### CesiumJS
- https://cesium.com/platform/cesiumjs/
- **強項**：真實全球座標（WGS84 球體 not mercator）、3D Tiles、LOD、Terrain
- **為何不用**：mercator 在台灣尺度沒視覺差異，Cesium 學習 + bundle 成本太高
- **未來**：若做全球或大範圍 3D 建築 → 可考慮

## 3. 學術 / 設計理論類

### Origin-Destination Flow Maps in Immersive Environments
- https://arxiv.org/pdf/1908.02089
- **核心發現**：
  - 3D 弧線高度可承載「流量」或「距離」**第二維度**
  - Bezier > geodesic：geodesic 跨遠距會產生視覺斷裂，Bezier 美且可控
  - 沉浸式（VR）3D flow map 比 2D 在 OD 任務上**準確度提升 ~20%**
- **借鑒**：`arc` 元件已採用 Bezier 高弧。**待補**：高度可調 = 第二維度

### GeoGraphViz: Geographically Constrained 3D Force-Directed Graph
- https://arxiv.org/pdf/2304.09864
- **核心**：force-directed 但節點位置鎖在地理座標
- **借鑒**：`network` 元件設計來源。當圖層需呈現「節點間多對多關係」時用

### Visualising Geographically-Embedded OD Flows (1908.00662)
- https://arxiv.org/pdf/1908.00662
- **2D vs 3D 比較表**（節選）：
  | 任務 | 2D 推薦 | 3D 推薦 |
  |---|---|---|
  | 找 hub | 2D（直觀） | — |
  | 比較流量大小 | — | 3D（高度 = 量） |
  | 沿路徑 trace | — | 3D（disentangle） |
  | 全國 overview | 2D | — |
- **借鑒**：圖層在「全國 overview」預設用 2D，zoom in 後切 3D

### Flow Map — Map UI Patterns
- https://mapuipatterns.com/flowmap/
- **核心技巧**：
  - **Edge bundling**：>50 條流線時必須束起來，否則 spaghetti
  - 線寬編碼流量、顏色編碼類別、動畫編碼方向
- **借鑒**：目前列車光跡未做 edge bundling — **待補**

### Creative Data Visualization in Cartography (11 tips)
- https://www.maplibrary.org/1456/creative-data-visualization-in-cartography/
- **挑出 3 條對我們有用**：
  1. **Cartogram + 3D**：用面積 / 高度雙重編碼
  2. **Tilt + altitude**：pitch 50-60° 是 3D flow map sweet spot（我們 showcase 用 50°，OK）
  3. **Layer 透明度節制**：超過 3 個 3D layer 同開 → 降 opacity 到 0.3-0.5 不然糊

## 4. 創意 / 風格類

### A cinematic web experience (orbit telemetry + ground topography)
- React Three Fiber + custom GLSL + MapLibre
- **借鑒**：「同一場景兩種尺度」概念 — 全台 overview 看 orb 群，zoom in 看單一物件細節

### Zurich 3D archaeological sites
- 真實建築 + 歷史層
- **借鑒**：「時間 = 第三維度」做 timeline scrub 看不同年代

---

## 設計原則總提煉

從上面所有來源綜合：

1. **每個 3D 元件必須回答一個語意問題**。不是「酷不酷」而是「拿掉它讀者少看懂什麼」。
2. **高度承載第二維度**（流量 / 距離 / 重要性）。只用顏色 = 浪費 3D。
3. **同一圖層保持元件家族一致**（全用球，或全用柱，不混）。混搭只在「不同圖層」之間。
4. **邊束 / 抽稀**：>50 條 flowline 或 >500 個 point → 必須減量或聚合。
5. **2D / 3D 切換要有理由**：全國 overview 走 2D，焦點觀察走 3D。
6. **Mercator 在台灣尺度足夠**，不需 Cesium。但全球或極區資料時要重評估。
7. **時間是第四維度**：靜態 3D 沒比 2D 多多少資訊量，動態 3D 才是價值。

---

## Sources

- [Three.js plugin for Mapbox GL JS (threebox)](https://github.com/peterqliu/threebox)
- [Mapbox CustomLayer + Three.js example](https://docs.mapbox.com/mapbox-gl-js/example/add-3d-model/)
- [deck.gl mapbox interleaving](https://deck.gl/docs/api-reference/mapbox/overview)
- [mapbox-3dtiles by Geodan](https://github.com/Geodan/mapbox-3dtiles)
- [CesiumJS platform](https://cesium.com/platform/cesiumjs/)
- [Origin-Destination Flow Maps in Immersive Environments (arxiv 1908.02089)](https://arxiv.org/pdf/1908.02089)
- [GeoGraphViz 3D force-directed (arxiv 2304.09864)](https://arxiv.org/pdf/2304.09864)
- [Visualising Geographically-Embedded OD Flows (arxiv 1908.00662)](https://arxiv.org/pdf/1908.00662)
- [Flow map — Map UI Patterns](https://mapuipatterns.com/flowmap/)
- [Creative Data Visualization in Cartography](https://www.maplibrary.org/1456/creative-data-visualization-in-cartography/)
- [Geographic Network Diagram](https://think.design/services/data-visualization-data-design/geographic-network-diagram/)
- [Best JavaScript Map Libraries 2026](https://js-maps.com/best-javascript-map-libraries/)
