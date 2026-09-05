# 提案：把「球面地圖 × Three.js 大量資料渲染」整理成開源 repo

> 2026-09-04 · 狀態：**待拍板**（尚未建立任何 repo、未 push、未對外發布）
>
> 來源專案：`plan-art`（Flight Arc 2.0）、`mini-taiwan-pulse`、`satellite-art`、`mini-taipei-v3`
>
> 本文回答兩件事：① 有沒有人做過？② 要做的話具體怎麼做？

---

## 0. 一句話結論

**有真實空白，值得做。** 官方文件教你「把一個 3D 模型放到球上」；沒有人教你「把數萬條動態軌跡 / 流場粒子 / additive bloom 星點放到球上還維持 60fps」。我們有後者的完整實作與事故記錄。

建議形狀是 **cookbook（docs + 可跑範例）而非 npm 套件**，且**目標函式庫先做一個決定性實驗再定**（見 §4）。

---

## 1. 問題 1：前人研究

### 1.1 最接近的既有專案

| 專案 | 規模／狀態 | 解了什麼 | 缺什麼 |
|---|---|---|---|
| [threebox](https://github.com/jscastro76/threebox) | 688★ · v2.2.7（2024-06-03）後放緩 | Mapbox × Three.js 共用 WebGL context、座標轉換、生命週期封裝 | **完全不含 globe**；無大量軌跡效能、無流場、無 bloom |
| [deck.gl](https://github.com/visgl/deck.gl) / [`GlobeView`](https://deck.gl/docs/api-reference/core/globe-view) | 14.6k★ · 活躍（OpenJS） | 數萬軌跡的 GPU 聚合（TripsLayer / ArcLayer） | GlobeView 官方標示 **experimental**，有已知 globe back-face culling bug（[#7920](https://github.com/visgl/deck.gl/issues/7920)）；自有渲染管線非 Three.js，方法論無法移植 |
| [MapLibre GL JS](https://github.com/maplibre/maplibre-gl-js) globe | 11.5k★ · v6.7.0（2026-09-02） · BSD-3 | **v5.0.0（2025-01）起官方文件化**支援 globe + custom layer | 官方範例只到「單一靜態 3D 模型」層級 |
| [three-globe](https://github.com/vasturiano/three-globe) / [react-globe.gl](https://github.com/vasturiano/react-globe.gl) | 1.6k / 1.3k★ · 活躍 | 純 Three.js 自建球體 + 現成資料層 | 完全繞開 tile 底圖，不是同類方案 |
| [cheeaun/3d-earth](https://github.com/cheeaun/3d-earth) | 84★ · 不活躍 | 唯一真正碰到我們這個技術交集的個人實驗 | 作者自稱 "my noob attempt"，無方法論文件 |
| Cesium / resium | — | 原生球面引擎 | 技術棧完全不同，僅供概念參考 |

`awesome-frontend-gis` / [`Awesome-Geospatial`](https://github.com/sacridini/Awesome-Geospatial)（5.3k★）等清單**沒有**「Mapbox/MapLibre globe + Three.js recipes」這個分類。

### 1.2 三個親自複驗的關鍵事實（決定提案怎麼寫）

**① Mapbox 官方明文說 globe 不支援 custom layer。**
[Globe 指南](https://docs.mapbox.com/mapbox-gl-js/guides/globe/)原文：*"Globe does not yet support `CustomLayerInterface`."*
而 `plan-art` 逆向工程出了可跑的解法。**這是官方說做不到、我們做出來了的東西** —— 價值高，但踩在未文件化 API 上，隨時可能被改掉。

**② MapLibre 的等價 API 比 Mapbox 完整很多。**
直接讀本機 `maplibre-gl@5.24.0` 的 `dist/maplibre-gl.d.ts:4830-4960`，`ProjectionData` 提供：

| 欄位 | uniform | 作用 |
|---|---|---|
| `mainMatrix` | `u_projection_matrix` | globe 時「**把單位球投到螢幕**」 |
| `clippingPlane` | `u_projection_clipping_plane` | 與地平線相交的平面方程式（假設單位球）→ **官方版的「線不要穿到地球背面」** |
| `projectionTransition` | `u_projection_transition` | 0..1，mercator↔globe 插值 |
| `fallbackMatrix` | `u_projection_fallback_matrix` | 動畫式退回 mercator |
| `shaderData.vertexShaderPrelude` | — | **MapLibre 直接把 `projectTile()` 注入你的 vertex shader** |
| `shaderData.variantName` | — | shader 快取 key |

也就是 `plan-art` 手算的 ECEF 數學與手刻的背面剔除，MapLibre 官方都有對應物。

**③ 但 MapLibre 官方的 Three.js × globe 範例只做到 N=1。**
讀[該範例](https://maplibre.org/maplibre-gl-js/docs/examples/add-a-3d-model-to-globe-using-threejs/)：CPU 端算 model matrix、**沒用** shader prelude、**沒有**地平線裁切、**沒有**背面剔除、**沒討論** globe 底圖寫 depth buffer 的問題、渲染物件數 = 1 個 GLTF 建物 + 2 盞燈。

> **空白定義**：從 N=1 靜態模型 → N=數萬動態物件，中間所有的效能、深度、混色、裁切、zoom 自適應知識，目前沒有任何公開來源涵蓋。

### 1.3 「知識庫型 repo」的成功形狀

| repo | 規模／更新 | 結構 |
|---|---|---|
| [webgl-fundamentals](https://github.com/gfxfundamentals/webgl-fundamentals) | 5.0k★ · 2025-02 | docs + inline runnable examples **合一，不發 npm** |
| [webgl2-fundamentals](https://github.com/gfxfundamentals/webgl2-fundamentals) | 2.0k★ · 2026-09-03（很活躍） | 同上 |
| [discoverthreejs-site](https://github.com/looeee/discoverthreejs-site) | 840★ · 2024-04 | 純靜態文件站、無配對 examples → 明顯較易停滯 |

**歸納**：查不到「docs + examples + npm package 三合一」的成功先例。一旦知識庫想被當函式庫依賴，就會退化成「主函式庫文件的一節」（如 deck.gl 的 Performance Guide），不再獨立存在。→ 支持 §6 的 cookbook-first 建議。

### 1.4 授權（原始假設要修正）

| 項目 | 查證結果 |
|---|---|
| Mapbox GL JS v2+ | **不是 BSL**。查 [LICENSE.txt](https://raw.githubusercontent.com/mapbox/mapbox-gl-js/main/LICENSE.txt)，v2.0.0（2020-12-08）起是 **Mapbox 專有授權（Mapbox TOS）**，沒有 BSL 的 Additional Use Grant / Change Date 結構。實質效果類似（可見源碼但非自由再散布），法律定性不同 |
| 實務限制 | 需綁有效 Mapbox 帳戶；[Product Terms](https://cdn.prod.website-files.com/609ed46055e27a02ffc0749b/68dddd2815cb3d82685f0096_Mapbox%20Product%20Terms%20(October%201,%202025).pdf) 禁止用其服務開發與 Mapbox 產品「實質相似或競爭」的應用 |
| 對本 repo 的影響 | 純 `npm install mapbox-gl` 當 dependency + 教學範例，業界慣例可行；README 須聲明「需自備 access token、遵守 Mapbox TOS」。**不可**把 mapbox-gl 源碼／修改版放進 repo 再散布 |
| MapLibre | **BSD-3-Clause**，真開源、無競品限制；globe 自 v5.0.0（2025-01）起 stable（非 experimental） |

---

## 2. 我們手上的資產（按「抽取阻力 × 對外價值」排序）

排序原則：**先看解耦程度，不看酷炫程度。**

| # | 模組 | 來源 | 實際 import 依賴 | 抽取難度 | 價值 |
|---|---|---|---|---|---|
| 1 | `src/three/shaders/globeProject.ts`（138 行）<br>GLSL + JS 雙版貼球投影 + ECEF 背面剔除 | plan-art | 只有 `three` | **easy** | high |
| 2 | `docs/features/trajectory-rendering.md`（187 行）<br>效能除錯方法論案例研究 | plan-art | 純文件 | **easy** | high |
| 3 | `src/three/GlowPointsScene.ts`（248 行）<br>zoom 自適應偽 bloom，檔頭自述「業務無關」 | pulse | `three` + 一個 `toMercator()` | **easy** | high |
| 4 | `public/showcase/`（core 187 行 + effects 4,101 行 = **68 個效果**，9 分類）+ `docs/three-showcase-library.md`（552 行） | pulse | vanilla JS、無 build step | **easy** | high |
| 5 | `src/three/BatchedTrails.ts`（508 行）<br>單 draw call slot 制 + **min-heap 逐出** + 部分 buffer 上傳 | plan-art | `three` + globeProject + 2 個 shader 檔 | **easy** | high |
| 6 | `src/map/climateParticleLineLayer.ts`（789 行）<br>raw WebGL2 向量場粒子（洋流／風向） | pulse | **只有 mapbox-gl 的 type import**（零 runtime 依賴） | **easy** | high |
| 7 | `src/map/gfwV4TrackCustomLayer.ts` + `src/three/GfwV4TrackScene.ts` + 測試（176 行 / 8 case） | pulse | option getter 注入 | medium | high |
| 8 | `src/spike/threeMaplibreSpike.ts`（383 行）<br>**已實測的 Mapbox→MapLibre 移植報告** | pulse | 獨立 spike，不被任何檔案 import | **easy** | high |
| 9 | `src/globe/coordinates.ts` 純球面座標（無 Mapbox） | satellite-art | 零框架依賴 | easy | medium |

### 2.1 為什麼 #1 是 hero asset

`globeProject.ts` 解的問題（`docs/features/atlas-bloom-globe.md` 有完整記錄）：

- Mapbox `CustomLayerRenderMethod` 其實每幀傳 **7 個參數**（`projection` / `projectionToMercatorMatrix` / `projectionToMercatorTransition` / `centerInMercator` / `pixelsPerMeterRatio`），官方 guide 沒教
- globe 底圖用 `DepthMode(LEQUAL, ReadWrite)` **在 custom layer 之前**畫實心球 → Three 材質預設 `depthTest: true` 會讓貼球的線**整片消失**
- 背面剔除必須在 **ECEF 真球面空間**做（mercator 空間下球體是扭曲的、法線方位對不上）；`uCameraEcef` 忘了設 → 變球心 → `dot ≡ −1` → 整片消失，**症狀跟 depth 遮擋長得一模一樣**
- ⚠️ 但注意：`y = −sinφ·R`、`GB_R = 8192/2π` 這些常數是**對齊 Mapbox 內部實作**的（等價其 `globeMetersToEcef`），**不可跨函式庫沿用** —— MapLibre 的 `mainMatrix` 投影的是**單位球**（`d.ts:4834`），縮放基準不同。移植時只搬「思路」不搬常數
- `if (uTransition >= 1.0) return mercPos;` early-out → 拉近時零額外成本

### 2.2 為什麼 #2（文件）排在多數程式碼前面

`trajectory-rendering.md` 記錄了**連續三次猜錯根因**的過程：先懷疑靜態軌跡量、再懷疑光球數量，都排除；最後靠 `performance.now()` 分段計時才發現 `BatchedTrails.writeTrail` 佔 93%（每幀 1,857 架搶不到 slot、`for..of` 找最小值累計 1,114 萬次迭代）。改 min-heap 後 script **72.62 → 14.03 ms/frame**、GPU 使用率 **66% → 97%**（CPU-bound 轉 GPU-bound）。

附帶五條可複用的除錯方法論：「症狀部分消失 ≠ 假說排除」、「兩種根因同一症狀」、「heuristic 疊 heuristic 反而放大誤差」、「不要憑感覺要量」、「順序依賴偽裝噪聲」。

**這份文件本身就是一篇可獨立發表的案例研究**，抽取成本最低、價值不輸程式碼。

### 2.3 一個現成的加分項

`threeMaplibreSpike.ts`（#8）已實測 Three.js InstancedMesh 在 MapLibre custom layer 上與 `map.project()` **逐像素對齊**（z7/z10、pitch 45/60、bearing 20/30 皆 dx=dy=0.00px），並記下四個差異，包含那個會讓物件飛到畫面外約 **−54000px** 的陷阱（該用 `defaultProjectionData.mainMatrix` 而非 `modelViewProjectionMatrix`）。

→ 「改用 MapLibre 當開源目標」不是紙上推論，**mercator 已驗過，globe 還沒**。

---

## 3. 內容架構（recipe 清單）

三層，每層獨立有價值：

**Layer A — 讓 custom layer 貼上球面**（最稀缺）
- A1 Mapbox 篇：7 參數 render signature、ECEF 數學（`y = −sinφ·R`）、`depthTest: false` 的理由、ECEF 空間背面剔除、transition early-out
- A2 MapLibre 篇：`mainMatrix` / `clippingPlane` / `projectionTransition` / `shaderData` 怎麼用
- A3 **移植對照表**（見下方警示）

> ⚠️ **recipe #1 就寫這條**：兩邊的 transition **語意相反**——
> Mapbox `projectionToMercatorTransition`：**0 = 球體、1 = 平面**
> MapLibre `projectionTransition`（`d.ts:4872`）：*"mercator (0) and globe (1)"*
> 任何人移植都會撞上鏡像 bug。這一行就是 cookbook 的價值主張。

**Layer B — N=1 → N=數萬**（最深）
- B1 slot 制批次軌跡：單 draw call、guard 頂點隔離、部分 buffer 上傳、min-heap 逐出
- B2 InstancedMesh + `onBeforeCompile` / `customProgramCacheKey` 注入 per-instance attribute（原生不支援）
- B3 向量場粒子：CPU Euler 平流 + PNG 編碼風場 bilinear sample + 8 float/段 instanced fat-line + VAO 封裝避免污染共用 GL 狀態
- B4 效能除錯方法論（§2.2）

**Layer C — 視覺與工程紀律**
- C1 zoom 自適應：`gl_PointSize` 與 `line-blur` 都是螢幕像素、跟 zoom 完全脫鉤，拉遠會佔滿畫面 → `pow(1.5, zoom−ref)` clamp
- C2 additive blending × depth 的取捨、`renderOrder` 手動排序
- C3 共用 WebGL context 紀律：`autoClear=false`、GL state save/restore、dispose 三件套、**一個 gl context 只掛一個 Three.js CustomLayer**（兩個 WebGLRenderer 互搶 GL state cache → 畫面全黑無報錯）
- C4 GLSL 陷阱：三元運算子對 `vec4` silent fail 要改 `mix()`、fat-line normal 要整段算一次

---

## 4. 目標函式庫：先做一個決定性實驗，不要先選邊

兩條路各有硬傷：

| | Mapbox 優先 | MapLibre 優先 |
|---|---|---|
| 稀缺性 | **高**（官方說做不到） | 中（官方支援，但範例只到 N=1） |
| 授權 | 專有 TOS，讀者需綁帳戶 | **BSD-3，乾淨** |
| 耐久性 | **低**（踩未文件化 API） | 高（官方文件化 API） |
| 現成程度 | 已完整可跑 | mercator 已驗、globe 未驗 |

### MVP：一個時間盒實驗決定目標

**Step 0（先做，很便宜）**：在 `plan-art` 和 `pulse` 的 `render()` 印出 `map.getProjection().name` 與 `arguments.length`，**逐一切過 `StyleSelector` 裡的每個底圖**，z2 與 z10 各量一次。

理由：兩份專案記錄看起來對不上 —— `PRINCIPLES.md:870`（2026-07-02）寫「沒指定 `projection` = 預設 mercator」，`atlas-bloom-globe.md`（2026-07-10）寫「v3 未設 projection 時低 zoom 預設 globe」。但**這可能不是矛盾，而是兩個人在看不同底圖**：兩個 repo 的 `StyleSelector.tsx` 同時列了 v11 系（`dark-v11` / `light-v11`）與 v12 系（`streets-v12` / `satellite-streets-v12`），而 [Mapbox 投影文件](https://docs.mapbox.com/mapbox-gl-js/guides/projections/)說 v12 styles 預設 globe、未設 projection 的 style 預設 mercator。

→ 所以這是**待驗證假設，不是既有結論**。兩個 repo 都是 mapbox-gl **3.18.1**、都沒在 constructor 設 `projection`，變因只剩 style。**用 runtime 量，不要用文件猜**，量完再決定要不要修哪一份記錄。

**Step 1（決定性實驗）**：把 `globeProject.ts` 移植到 MapLibre globe，做成一個**獨立 Vite 頁面、不 import 任何專案模組**。

待驗證的假設（來自 `d.ts:4834` 的 `mainMatrix` 說明「globe 時投影**單位球**」）：
> `plan-art` 已經 per-vertex 預存 `aEcef`。把 `aEcef / GB_R` 縮成單位球當頂點座標、再乘 `mainMatrix` 就完成投影 —— **不需要** `projectTile()` prelude（那會跟 Three 自己的 shader prelude 打架）。
> `clippingPlane` 取代手刻 ECEF 背面剔除；`fallbackMatrix` + `projectionTransition` 取代 `uGlobeToMerc` + `uTransition`。

**Step 2（結果決定路線）**
- 假設成立 → **MapLibre-first**，Mapbox 篇當 appendix（保留「官方說做不到」的稀缺價值，但主線不依賴專有授權）
- 假設不成立 → **Mapbox-first**，README 明寫 TOS 與 token 需求，MapLibre 篇標為 TODO

> **在 Step 1 有結果之前，不要對外宣稱支援哪一個。**

---

## 5. 範例資料計畫（硬約束，不能忽略）

現有專案的資料**都不能直接搬進開源 repo**：

| 不可搬 | 原因 |
|---|---|
| FR24 軌跡（plan-art） | FlightRadar24 ToS |
| Supabase 資料（pulse） | 專案資料庫、含 owner-gated 表 |
| `public/three-showcase.html:142` 的 `MAPBOX_TOKEN = "pk.…"` | **硬編碼 token**，發布前必須移除**並輪替**（已在檔案裡，等於已洩漏） |

替代方案：

| 範例需要 | 建議來源 | 授權狀態 |
|---|---|---|
| 軌跡（B1/B2） | **runtime 生成的合成 great-circle 軌跡** | 零授權問題，且更好 —— 讀者能自己調數量壓測 |
| 機場點位（bloom 星點） | [OurAirports](https://ourairports.com/data/) | ✅ 已查證：*"All data is released to the Public Domain"*，**無強制署名**（歡迎但不要求） |
| 風場／洋流（B3） | NOAA GFS | **待查證**（美國政府作品通常 public domain，但要確認具體產品條款）|
| Token | 讀者自備，`.env.example` + README 說明 | — |
| Three.js | 目前 showcase 走 `unpkg.com/three@0.160.0`（已鎖版本） | 可保留或改本地依賴 |

**新 repo 從乾淨 history 開始**，不要對現有 repo 跑 `git filter-branch`（會動到有平行 session 的工作區，且舊 history 含 token 與私有資料）。

### 5.1 一筆容易被低估的成本

§2 把 showcase（資產 #4）標為 easy，那是**針對 Mapbox** 而言。`public/showcase/core/layer.js` 本身是一個 Mapbox `CustomLayerInterface`；若 §4 Step 1 走向 MapLibre-first，68 個效果需要一次移植 pass —— 照 `threeMaplibreSpike.ts` 記錄的四個差異改（render 第二參數改物件、矩陣改 `defaultProjectionData.mainMatrix`、`gl` 型別改 WebGL2、`renderingMode` 要顯式寫 `"3d"`）。機械性工作、風險低，但**不是零成本**，估算時要算進去。

---

## 6. Repo 形狀：三選一

| 形狀 | 內容 | 維護成本 | 風險 |
|---|---|---|---|
| **A. Cookbook**（建議） | `docs/` recipe 頁 + `examples/` 每個 recipe 一個獨立 Vite 頁 | 低 | 無 API 承諾，改壞不會弄壞別人的專案 |
| B. npm 套件 | `createGlobeLayer()` / `BatchedTrails` / `greatCircleSubdivide` … | **高**（API 設計、semver、CI、issue） | 上游 Mapbox/MapLibre 一改就得跟 |
| C. Hybrid monorepo | `packages/core` 薄 + `examples/` + `docs/` | 中高 | 容易變成「兩邊都做一半」 |

### 建議：A，且**先不發 npm**

理由：
1. §1.3 查不到「docs + examples + npm」三合一的成功先例
2. 資產 #1/#3/#6/#9 幾乎零耦合 —— 這是「**可以直接 vendoring 進 examples 當源碼讀**」的理由，不是「該發套件」的理由。cookbook 讀者要的是看懂並抄走 138 行，不是多一個 dependency
3. 踩在未文件化／新 API 上的東西不適合給 semver 承諾

建議結構：

```
<repo-name>/
├── README.md              # 定位 + 「官方教 N=1，這裡教 N=數萬」 + token/TOS 聲明
├── docs/
│   ├── globe-hugging/     # Layer A（含 Mapbox↔MapLibre 移植對照表）
│   ├── scaling-up/        # Layer B
│   └── discipline/        # Layer C
├── examples/              # 每個 recipe 一個獨立 Vite 頁，可單獨跑
│   └── <slug>/
├── showcase/              # 68 效果案例庫（清 token 後）
└── LICENSE                # MIT
```

### 平行選項（別忽略）：直接貢獻上游

你說目標是「對開源社群做點貢獻」。**新開 repo 不是唯一路徑**，而且可能不是觸及率最高的：

- 往 **MapLibre 官方 examples / docs 送 PR**：「mass trajectories on globe with Three.js」正好補上他們 N=1 範例的缺口，掛在官方站點的曝光遠高於一個新 repo
- 或接手／PR **threebox**（688★ 但無 globe）—— 不過它維護放緩，PR 可能無人 review

**建議**：兩者不衝突。先做 §4 的 MVP，成功後同一份成果既是 cookbook 的第一篇，也是送 MapLibre 的 PR 素材。

---

## 7. 決策點 —— **已於 2026-09-04 拍板**

| # | 決策 | 結論 |
|---|---|---|
| 1 | **IP 歸屬** | ✅ **不算雇主 IP**，可以做。repo 開在 `GIS/globe-hugging/` |
| 2 | 目標函式庫 | ✅ **Mapbox-first**。理由：所有資產今天就在 Mapbox 上跑，零移植風險；MapLibre 篇以 recipe 1.2（標 ⚠️ Unverified）+ 1.3 移植對照表存在，等 §4 Step 1 實驗有結果再升級標記。**加 MapLibre 是加法不是重寫**，所以不阻塞 |
| 3 | Repo 形狀 | ✅ **Cookbook / 範例集，不發 npm** |
| 4 | 上游 PR | ✅ **不做** |
| 5 | Repo 名稱 | ✅ **`globe-hugging`**（沿用 `atlas-bloom-globe.md` 標題裡自己造的詞 "Globe-Hugging"）。GitHub 帳號待定，目前只有本機 repo，**未 push** |
| 6 | 語言 | ✅ **英文為主** |

> 決策 2 的補充：原提案主張「先跑實驗再選邊」。改成 Mapbox-first 的理由是**實驗結果只會決定 1.2 的標記等級，不會改變 repo 結構**——1.1（Mapbox，已驗證）與 1.3（移植對照表，mercator 半邊已實測）都不依賴實驗結果。所以先出貨、實驗當第一個 issue。

---

## 8. 明確不做

- 不建 GitHub repo、不 push、不對外發布 —— 等 §7 決策點 1 與 2 有結論
- 不把 mapbox-gl 源碼或修改版放進 repo
- 不搬 FR24 / Supabase 任何實際資料
- 不對現有 repo 動 history 改寫
- 不預先做 12 個模組的 roadmap —— 先把 §4 MVP 一條做通，用真實抽取成本校準後續

---

## 9. 落地後的紀錄位置

- 決策拍板後 → 開 ADR：`.gis-agent-system/decisions/0013-*.md`（現有最大編號 0012）
- 進度 → 本目錄 + `.gis-agent-system/journal/` 當月檔
- 若確定要做，本文的 §3 recipe 清單即 repo 的 `docs/` 目錄骨架
