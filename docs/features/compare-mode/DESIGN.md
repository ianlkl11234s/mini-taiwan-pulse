# 通用「比較模式」（Q-E 方案 2）技術調查與分期設計

> **狀態**：設計已定案（五題已決定，見下節）；P0 試驗在分支 `spike/compare-mode-p0`（`docs/features/compare-mode/P0-SPIKE.md`）；**P1 已實作**（分支 `feat/compare-mode-p1`，實作紀錄與已知限制見文末「P1 實作紀錄」）。Q5 的〔待確認〕：P1 照推論一併記細項（`cmpdl`／`cmpdr`）。
> **行號基準**：本文所有路徑與行號以調查當時的 **`origin/develop` @ `dda9caa0`**（2026-11-11）為準；之後程式改動不回頭更新行號，引用前請用 `git show dda9caa0:<path>` 對照。

## 使用者決定（2026-11-11）

| 題目（§5） | 決定 | 對實作的意思 |
|---|---|---|
| Q1 第一期以外的圖層 | **(a)** 照畫在左側並標「只在左側」 | P1 不支援的層在比較模式只畫在主地圖（左），「顯示在」控制停用並旁註；視野提示卡加一段說明 |
| Q2 統計層左右可以不同的範圍 | **(b)** 期別＋細項（例：性別），不到任意指標 | 右側多「右側期別」與「右側細項」選單；細項不同時色階門檻可能不同，圖例要能拆成左右兩份（只在門檻不同時拆） |
| Q3 手機 | **(c)** 等 P0 實測再定 | 實測前先照 (b) 準備退路：手機不提供入口，打開含比較的網址時退回單地圖並提示 |
| Q4 第二張地圖的生命週期 | **(a)** 開才建、關就銷毀 | 每開一次比較算一次 Mapbox map load；關閉時 `map.remove()` |
| Q5 分享網址 | **(a)** 記比較開關、把手位置、側別、左右兩側期別（只限比較中的統計層） | `urlState` 新增參數、不升 `v`。〔待確認〕Q2 允許細項不同，推論細項也要一併記（同樣只限比較中的統計層），P1 開工前請使用者確認 |

> 調查原文（以下各節）寫於 2026-11-11 唯讀調查。主 checkout 當時落後 origin 36 個 commit，本文以 origin/develop 為準。
> 相關 repo 未改動。沒查到的事寫「沒查到」。數字旁註明怎麼數的。
> 另一個 worker 的分支 `feat/viz-presentation-circles`（PR #1008）（`.worktrees/viz-presentation-1`）調查開始時沒有改動，交稿前已出現未提交的實作（見 §6a）；本文主體照提案 Q-A／Q-B 的模型設計，§6a 列出與其實作的交集。

---

## 0. 結論先講

| 問題 | 結論 |
|---|---|
| Mapbox 有沒有原生「把某些圖層裁到螢幕一側」 | **沒有。** `clip` 圖層只移除 3D model／symbol；3.34 新增的 `raster-mask` 是「用 fill 圖層的地理形狀遮 raster」，實驗性、未公開文件、只限 raster，而且本站鎖在 3.18.1。兩者都不是螢幕分割（§1）。 |
| 可行路徑 | **雙地圖＋CSS 裁切＋鏡頭同步**（mapbox-gl-compare 的做法）是唯一有官方範例、行為可預期的做法。「單地圖用 scissor 夾心」技術上沒被 Mapbox 擋（3.18.1 painter 不追蹤 scissor 狀態），但完全未實測、風險高，只建議當限時 spike（§1.4）。 |
| 現有程式對單一地圖的依賴 | 圖層大多已經「把 map 當參數」：350 個 hook 掛載點全部透過 `deps.mapRef` 拿地圖、overlay 管理器每個函式都收 `map`、統計是 `attachRegionalStatistics(map)`。真正的耦合在**共用狀態**：可見性只有一份、統計資料 store 一層只有一組、overlay 的 hydrate 記錄是模組層級、點擊只綁主地圖、loading 任務 id 不分地圖（§2）。 |
| 建議分期 | P0 spike（小）→ P1 殼＋raster 底圖類＋統計（含同層左右不同期別）（大）→ P2 靜態 PMTiles／GeoJSON（中～大）→ P3 動態與 3D：**建議明確宣告不支援**，在 UI 標「只在左側」（小）；真要支援是「大」（§3）。 |
| 最大風險 | ① 統計 store 與 attach 函式的共用狀態（照抄一份 attach 掛到第二張地圖，關比較時會把主地圖的統計資料一起清掉，§2.2）；② 第二個 WebGL context 在手機的記憶體（只能實測）；③ 每開一次比較就多一次 Mapbox **計費 map load**。 |
| 使用者決定 | 5 題已於 2026-11-11 決定，見文首「使用者決定」與 §5。 |

---

## 1. 裁切機制調查

### 1.1 版本

- `package.json`：`"mapbox-gl": "^3.9.0"`；`package-lock.json` 鎖 **3.18.1**（`node_modules/mapbox-gl` 也是 3.18.1）。
- npm 最新版 **3.34.2**（`npm view mapbox-gl version`，2026-11-11）。

### 1.2 候選原生功能逐一確認

| 候選 | 實際做的事 | 能不能當螢幕分割 | 出處 |
|---|---|---|---|
| `clip` 圖層 | 「Layer that removes 3D content from map」；不畫東西，用一個**地理多邊形**擋住它下面的 3D 內容。`clip-layer-types` 只接受 `"model"`、`"symbol"`；`clip-layer-scope` 限定作用的 style 片段。GL JS 3.5／3.6 起，3.18 起支援 `visibility`。 | **不能**：不裁 fill／line／circle／raster；而且是地理範圍不是螢幕範圍。 | Mapbox Style Spec layers #clip（https://docs.mapbox.com/style-spec/reference/layers/#clip）；本機型別 `node_modules/mapbox-gl/dist/mapbox-gl.d.ts:2034-2046`（3.18.1，`clip-layer-types?: Array<"model" \| "symbol">`） |
| `raster-mask`／`raster-mask-mode`（3.34 新增） | style-spec 原文：「The id of a `fill` layer in the same style whose polygons should clip this layer」；mode 為 `clip-path-intersect`／`clip-path-exclude`。標 `experimental: true`、`private: true`，sdk-support js 3.34.0。官方 style spec 網頁上目前**查不到**這兩個屬性（未公開文件）。 | **只對 raster 有效，而且是地理遮罩**。理論上可每次鏡頭移動時把「螢幕右半」反算成經緯度多邊形寫進一個透明 fill 圖層，讓右側 raster 只畫在右半。但：要升級到 3.34（跨 16 個 minor）、屬性是 private／experimental、每次 `move` 都要 `setData`（GeoJSON 交給 worker 重切，拖曳時會延遲一兩幀、邊緣抖動，**未實測**）、統計面量圖（fill）完全用不上。 | mapbox-gl-js CHANGELOG 3.34.1「Add `raster-mask` and `raster-mask-mode` paint properties so a raster layer can be clipped to, or excluded from, the geometry of a fill layer」（raw.githubusercontent.com/mapbox/mapbox-gl-js/main/CHANGELOG.md）；`mapbox-gl@3.34.2/dist/style-spec/index.cjs` 的屬性定義 |
| `setPadding`／padding | 只改相機中心的偏移，所有圖層照畫全畫面。 | 不能 | CHANGELOG 搜 `inset`、`view`、`padding` 只有 padding 相關修正，沒有「多視窗／分割視圖」功能（3.18–3.34 全部掃過） |
| 多 view／inset | 3.x CHANGELOG 沒有這類功能（搜 `clip\|scissor\|split\|swipe\|viewport\|inset\|view\|multiple maps`）。只有 0.x 時代「multiple maps on the same page」與「shared WebWorker pool」 | — | 同上 CHANGELOG 第 1566、3058 行 |
| CustomLayer 的 `render(gl, …)` | 自訂圖層只能畫自己的東西；不能裁其他原生圖層。3.33 起多給 projection/view matrix。 | 單獨不行，見 §1.4 夾心法 | CHANGELOG 3.33.0 |

**結論**：在 3.18.1 與最新 3.34.2 都沒有「把任意圖層裁到螢幕某一側」的原生 API。

### 1.3 雙地圖＋CSS 裁切（建議路徑）

- 官方範例「Swipe between maps」（https://docs.mapbox.com/mapbox-gl-js/example/mapbox-gl-compare/）：兩個地圖容器疊在一起，上面那個用 CSS `clip` 裁掉一半，`mapbox-gl-sync-move` 同步鏡頭。npm `mapbox-gl-compare` 0.6.0（2026-06-22 更新）、`@mapbox/mapbox-gl-sync-move` 0.4.0。
- 兩張地圖一樣大、同一組相機參數 → 像素對齊；右圖用 `clip-path: inset(0 0 0 X%)`。CSS Masking Level 1 對 `clip-path` 寫「By default, pointer-events must not be dispatched on the clipped-out (non-visible) regions of a shape」（https://www.w3.org/TR/css-masking-1/#the-clip-path ，憑記憶引用、本次未重新開網頁核對），所以把手左邊的拖曳／點擊應落到主地圖——**列入 P0 實測**（桌機三大瀏覽器＋iOS Safari）；不成立時改用兩個容器各自 `overflow:hidden` 的寬度裁切。
- Mapbox 自 0.x 起多個 Map 共用 WebWorker pool（CHANGELOG 第 3058 行），但每張地圖各有自己的 WebGL context、圖磚快取、GeoJSON 來源。
- **計費**：Mapbox 定義「A map load occurs whenever a Mapbox GL JS Map object is initialized on a webpage」（https://docs.mapbox.com/help/glossary/map-loads/）。所以**每開一次比較 = 多一次 map load**。免費額度數字沒查到（官方定價頁 https://www.mapbox.com/pricing/ 未讀）。
- 建議不直接用 `mapbox-gl-compare` 的 UI（要符合 design spec 的把手、鍵盤、主題），只抄它的鏡頭同步邏輯（`move` 事件互相 `jumpTo`，加防重入旗標）。

### 1.4 單地圖「scissor 夾心」（只當 spike）

想法：在要「只顯示右側」的圖層前插一個 CustomLayer 呼叫 `gl.enable(SCISSOR_TEST)`＋`gl.scissor(右半)`，之後再插一個關掉。

- 查到的事實：3.18.1 的 painter **沒有把 scissor 納入它快取的 GL 狀態**；整份 `mapbox-gl-unminified.js` 只有 debug 畫框（第 77190-77193 行 `drawDebugSSRect`）用到 `SCISSOR_TEST`。所以 Mapbox 不會主動把它重設，夾在中間的原生圖層繪製會被裁到。
- **全部未實測**，已知風險：
  1. 只能裁「連續一段圖層堆疊」：左／右／兩側的圖層要依側別重新 `moveLayer` 排序，會改到現有疊放順序（overlay、hook 各自 `beforeId`，順序是 load-bearing，見 `src/layers/layerHookRegistry.tsx` 開頭註解）。
  2. 同一統計層左右不同年份仍要兩組 source／layer（id 加後綴），統計 attach、點擊登記簿都要改。
  3. 渲染分 offscreen／opaque／translucent 多個 pass；heatmap、hillshade、地形 draping 先畫進 framebuffer 再合成，scissor 在哪個 pass 生效無法預期；圖層內部的 `context.clear`（stencil／depth）也會被 scissor 裁到，可能留下殘影。
  4. symbol 碰撞是全圖做的，右側標籤可能把左側標籤擠掉。
  5. 依賴未公開行為，Mapbox 任何一版把 scissor 納入狀態管理就會壞。
- 建議：除非 P0 spike（限 1 天）在桌機與手機都證明 2、3 項沒問題，否則不採用。好處只有「省一個 WebGL context 與一次 map load」。

---

## 2. 現有程式對「單一地圖」的依賴盤點

數法：在 origin/develop 的 `src/` 用 `rg` 計，排除 `*.test.*` 與 `__tests__/`。

### 2.1 地圖物件從哪裡來

| 項目 | 數字 | 說明 |
|---|---|---|
| 主站 `new mapboxgl.Map` | 1 處 | `src/map/MapView.tsx:292`（另有 `src/bbox/BboxSelectorApp.tsx:160` 是獨立工具頁） |
| `mapRef` 字樣 | 1,639 次／194 檔 | 包含型別、參數傳遞 |
| `mapRef.current` | **421 次／145 檔** | 提案說「約 424 處」就是這個數字（實際讀取地圖物件的地方） |
| 全域 debug 把手 | `window.__map`（`MapView.tsx` load 事件內，只在 dev 或 `?debug`） | 不影響正式行為 |
| hook 掛載點 | `LAYER_HOOK_REGISTRY` **350 筆**（`{ id:` 計數），對應 249 個 Host 元件（`hosts/*.tsx` 內 `LayerHostComponent =` 計數）、30 個 host 檔 | 每個 Host 透過 `deps.mapRef` 拿地圖（hosts 內 `deps.mapRef` 出現 259 次）。`layerHostDeps.ts` 註解寫的「104 個 Host」是舊數字。 |
| 地圖物件來源的形式 | **props bundle，不是 context／全域** | `src/layers/layerHostDeps.ts` 的 `LayerHostDeps.mapRef`；`<LayerHosts deps={…}>` 由 App 傳入（`src/layers/LayerHost.tsx`）。 |

→ 好消息：「把同一批 Host 再掛一次、`mapRef` 換成第二張地圖」在型別上是通的。壞消息在共用狀態（下表）。

### 2.2 依圖層種類的耦合與掛第二地圖的難度

manifest 數法：`src/data/layerManifest.ts` 的 `LAYER_MANIFEST` 手寫 entry 共 **756 筆**（依 `source.kind` 分：custom 333、geojson 175（另 32 筆為 geojson 陣列）、pmtiles 97（另 41 筆陣列）、supabase 69、混合／引用常數 9）。**統計圖層不在這 756 筆裡**，是由 recipe 程式產生（`layerManifest.ts:468` 起的 `statisticsManifestParams(recipe.layer_key)` 等），render key 約 910 個（提案附錄引 map-layers §3.6 K-4）。

| 類別 | 怎麼拿地圖、怎麼決定開關 | 共用狀態（掛第二地圖會出事的地方） | 難度 |
|---|---|---|---|
| **統計面量圖** | `attachRegionalStatistics(map, getIsDark)`，`MapView.tsx:473` 呼叫一次；內部迴圈 `STATISTICS_RENDER_KEYS` | ① `layerVisibilityStore` 直接讀（`regionalStatisticsMap.ts:67,70,109`）；② 資料 `regionalStatisticsStore` 以圖層 key 為鍵、**模組層級 Map**（`src/state/regionalStatisticsStore.ts:13-18`），一層只有一組 selection；③ `setSelection` 會寫 localStorage（`:62-67`，key `mini-taiwan:regional-statistics:v1`）；④ attach 內 `syncOpacityDefaults` 會改寫 `layerParamsStore`（`regionalStatisticsMap.ts:37-54`）；⑤ **cleanup 對所有 key 呼叫 `regionalStatisticsStore.disable`**（`:127`）——直接再 attach 一份到第二地圖，關比較時會把主地圖的統計資料清空。 | 中：要把 attach 參數化（store key 映射、可見性來源、是否負責透明度預設），store 支援命名空間 key（例 `key::R`）且不寫 localStorage |
| 色階 | `statisticsFillCase` 用 recipe 的**固定門檻**（`src/data/statisticsFillColor.ts:27-45`），門檻由 key＋指標＋細項決定，**跟期別無關** | — | 左右不同年份可共用同一份圖例（只要指標與細項相同） |
| **靜態 PMTiles／GeoJSON（OVERLAY_REGISTRY）** | `MapView` 在 `style.load`／`load` 呼叫 `addAllOverlays(map, OVERLAY_REGISTRY, …)`、`setOverlayVisible(map, …)`（`MapView.tsx:324-470`）；`OVERLAY_REGISTRY` 約 323 筆 config（`src/map/overlayRegistry.ts` 內 `    id: "` 計數；子圖層型別 circle 179、line 81、fill 37、symbol 7、heatmap 3、fill-extrusion 2，`layerType\|type:` 計數） | overlayManager 大多已按地圖分開（`pmtilesSourceUrlByMap`、`paintCacheByMap` 等 6 個 `WeakMap`，`src/map/overlayManager.ts:95,280,286,295,526,588`），**但** `hydratedSources`、`fallbackHydratedSources`、`hydrateGeneration` 是模組層級、以 sourceId 為鍵（`:645-649`）——第二張地圖的同名 source 會被當成「已載入」而不抓資料；`resetOverlayHydration()` 清的是全部。loading 任務 id `overlay-hydrate:${sourceId}` 也會撞。 | 中：三個集合改成 per-map `WeakMap`；loading id 加側別。**先例**：`/embed` 已把 OVERLAY_REGISTRY 的靜態子集跑在另一個地圖實例（而且是 MapLibre），白名單規則在 `src/embed/embedWhitelist.ts`（排除 `dynamicData`、`GATED_LAYERS`、`RELEASE_HOLD_LAYERS`），自訂 factory 的靜態版在 `src/embed/factoryOverlayConfigs.ts`。 |
| 其他 MapView 內建工廠層 | `ensureH3Layers`、`ensurePopCountLayers`、`ensureYoubikeLayers`、農業、消防／醫療等時圈（`MapView.tsx:395-410`） | 參數讀 `overlayParamsRef`、可見性讀 store | 中（P2 逐個評估或列不支援） |
| **hook 型圖層（含動態）** | 350 個掛載點。`src/hooks/` 共 205 個非測試檔：159 檔吃 `mapRef`、131 檔用 `useMapReadyTick`、104 檔自己 `addLayer`（固定字串 layer id）、**62 檔訂 `timeStore`**、79 檔用 loadingRegistry、21 檔有模組層級 `let`／`new Map/Set`、8 檔直接讀 `layerVisibilityStore`／`layerParamsStore`／`layerParamRefs`、82 檔碰 `window.`／`document.` | 可見性經 `HostSlot` 的追蹤式 Proxy 從 `layerVisibilityStore` 讀（`src/layers/LayerHost.tsx`，`createVisibilityView`）；參數 `useLayerParams(key)` 一份；時間 `timeStore` 是單例（`src/state/timeStore.ts:26-31` 模組層級 `currentTime`，`:81` export） | 依 hook 而定。純函式型（例 `useHistoricalMapLayer(mapRef, key, visible, opacity, eraIdx)`，`src/hooks/useHistoricalMapSinicaLayer.ts:32-88`）可直接掛第二地圖；有模組層級狀態或直接讀 store 的要逐支改 |
| **raster（歷史底圖、影像）** | 古地圖六層共用一支 hook，外部 XYZ raster，`historicalMapHosts.tsx` 每層一次呼叫；hook 內 raster source 的有 9 檔（`useHistoricalMapSinicaLayer`、`useGibsSnowCoverLayer`、`useJpGsiTerrainLayers`、`useGbLandLayers`、`useCaTerrainLayers`、`useJpWaterLayers`、`useMapchallengeDay08PlanLayer`、`useIeBathymetryLayer`、`useDustForecastLayer`）；OVERLAY_REGISTRY 另有 raster PMTiles（例 `urbanHeat`） | 古地圖 hook 只吃參數、無模組狀態；`keepLoadingUntilMapIdle` 的任務 id 用 sourceId（會撞） | **小**：P1 首選 |
| **Three.js／CustomLayer** | `src/three/*Scene.ts` 21 個、`src/map/*CustomLayer.ts` 21 個、28 檔有 `type: "custom"`；renderer 共用地圖的 gl（`context: gl`，例 `src/three/FlightScene.ts:70-72`）；集中在 `useThreeJsLayers`（讀 `layerVisibilityRef`、`paramRefs`、`timeRef`） | scene 綁單一 gl context、以 ref 拿資料、拾取（pick）寫在主地圖點擊處理裡 | **大**：每個 scene 要能建第二份；建議宣告不支援 |
| **popup／選取** | 唯一點擊處理 `useMapInteraction.bindEvents(map)`，`clickBoundRef` 保證只綁一次（`src/hooks/useMapInteraction.ts:129-133`）；命中清單 `src/map/gisClickRegistry.ts`（first-hit-wins，順序由 `layer-golden.json` 凍結）；`featureInfo` 只有一份 | 點擊用全域可見性 ref 判斷要不要拾取 3D 物件 | 中：右圖另綁一次（同一份登記簿，因為 layer id 相同），可見性換成右側視圖；FeatureInfo 加 `side` 欄位給 popup 標「右側」 |
| **loadingRegistry** | 247 檔引用（含 loader） | 任務 id 不含地圖；兩張地圖同時載同一層會互相 start/end | 小：attach／hook 傳入 id 前綴 |
| **圖例** | `src/components/LegendPanel.tsx`（825 行）自己訂 `layerVisibilityStore`；統計圖例 `StatisticsLegend`（`src/components/sidebar/StatisticsDetails.tsx`）讀 `regionalStatisticsStore` | 單一可見性、單一統計 selection | 小～中：見 §4 |
| **時間軸** | `timeStore` 單例 | 左右共用同一時刻（本設計接受） | 無（不做左右不同時刻） |
| **Agent（MCP）** | `src/research/MainMapConnection.tsx:65` 的 Props 收單一 `map`；開圖層走 `layerVisibilityStore`、控制項走 `src/research/layerControls.ts`（`applyLayerControl` 呼叫控制項的 `onChange`） | Agent 設相機 → 主地圖動，右圖靠同步跟著動；Agent 開圖層 → 預設「兩側」 | 小（第一期 Agent 不能指定左右；`describeLayerControls` 不列出右側控制，避免 readback 不一致） |
| **分享網址** | `src/lib/urlState.ts`：記鏡頭、layers、sm、date、h、rsys、style、theme、ui、lang、c（`:277-309`）；**不記圖層參數**（統計期別也不記）；`v` 不符直接回 `{}`（`:219`） | — | 小～中：新增參數**不可升版號**；見 §3 |

### 2.3 能集中修改的「咽喉點」

直接讀 `layerVisibilityStore` 的檔只有 21 個（`rg -l`），其中真正決定「圖層畫不畫」的是 4 處：`MapView.tsx`（overlay）、`layers/LayerHost.tsx`（hook 型，經 `HostSlot`）、`map/regionalStatisticsMap.ts`（統計）、`hooks/useThreeJsLayers.ts`（3D）。所以「左圖不畫只在右側的圖層」可以在這 4 處換成「側別可見性視圖」完成，不必改 350 個 hook。

---

## 3. 分期方案

共同狀態模型（P1 建立，後續沿用）：

```ts
// src/state/compareStore.ts（新）
interface CompareState {
  enabled: boolean;
  split: number;                  // 0..1，把手位置（桌機為 x，手機上下分割時為 y）
  orientation: "vertical" | "horizontal";
  sides: Partial<Record<LayerKey, "left" | "right" | "both">>;  // 缺省 = both
  rightStatistics: Partial<Record<StatisticsRenderKey, { releaseId: string }>>; // 第一期只允許改期別
  rightBasemap?: MapStyleId;      // 右側底圖（可選，P1 末段，見下）
}
```

- 主地圖＝左側；第二張地圖＝右側，疊在上面用 CSS 裁切。
- 「側別可見性視圖」：`left(k) = vis[k] && side(k) !== "right"`、`right(k) = vis[k] && side(k) !== "left" && supportedOnRight(k)`。
- `supportedOnRight(k)` 依期別擴大；不支援的層在比較模式裡只畫在左側，UI 標「只在左側」。

### P0：spike（小，約 1 天）

- 在 dev 分支做最小雙地圖：同步鏡頭、CSS 裁切、把手；量測：桌機與一支中階 Android、一支 iPhone 的記憶體（Chrome `performance.memory`／Safari Web Inspector）與拖曳幀率；開關 10 次確認 WebGL context 有釋放（`map.remove()`）。
- 可選：限時半天試 §1.4 scissor 夾心，只為決定要不要放棄雙地圖。
- 驗收：上述數字寫進 `docs/features/compare-mode/`；不合併。

### P1：殼＋raster 底圖類＋統計（大）

要改的檔與介面：

| 檔案 | 改動 |
|---|---|
| `src/state/compareStore.ts`（新） | 上述狀態＋訂閱；`supportedOnRight` 判斷（P1：古地圖六層 key、統計 render key） |
| `src/map/CompareMapView.tsx`（新） | 第二張地圖：**延遲建立**（開比較才 `new Map`，計一次 map load）；同 `styleUrl`／主題／Pure Black／地名開關／語系（`bindBasemapLanguage`）；`attributionControl: false`（版權由主地圖 AttributionBar 統一顯示，加上右側圖層來源）；`ensureTerrainIfTilted` 同步；`style.load` 要做的事從 `MapView.tsx:324-417` 抽成共用函式後只跑 P1 支援的部分 |
| `src/map/compareSync.ts`（新） | 鏡頭同步：雙向 `move` → `jumpTo`（center/zoom/bearing/pitch/padding），防重入旗標；Agent `flyTo` 只打主地圖 |
| `src/components/compare/CompareDivider.tsx`（新） | 把手：右圖容器 `clip-path: inset(...)`；把手 `role="slider"`、鍵盤 ←→ 5%；手機見下 |
| `src/map/regionalStatisticsMap.ts` | `attachRegionalStatistics(map, getIsDark, opts)`：`opts.storeKey(k)`、`opts.isVisible(k)`、`opts.ownsOpacityDefaults`、`opts.loadingPrefix`；cleanup 只 disable 自己的 key（現在 `:127` 是全部） |
| `src/state/regionalStatisticsStore.ts` | 支援命名空間 key（例 `${key}::R`）；`setSelection(key, recipe, { persist: false })`，右側不寫 localStorage |
| `src/state/statisticsLinkedSelect.ts`／`src/data/statisticsParamsSpec.ts` | 新增一個「右側期別」連動選單（provider 帶 side），選項沿用左側的 release 清單；**與另一個 worker 同檔，需排在其 PR 合併後** |
| `src/layers/LayerHost.tsx` | `LayerHosts` 收 `visibilitySource`（預設＝現行 store；左圖傳左側視圖）；新增 `<CompareLayerHosts>` 只掛 P1 支援的 Host（古地圖 Host）並傳右側 `mapRef`＋右側視圖 |
| `src/map/MapView.tsx` | overlay 與統計的可見性改走左側視圖；其他不動 |
| `src/hooks/useHistoricalMapSinicaLayer.ts` | `keepLoadingUntilMapIdle` 任務 id 加側別前綴（`:81`） |
| `src/hooks/useMapInteraction.ts` | 右圖另綁一次點擊（只處理 P1 支援的層：統計；古地圖沒有可點物件） |
| `src/lib/urlState.ts` | 新參數（不升 `v`）：`cmp=1`、`cmps=<split>`、`cmpr=<key>,<key>`（只在右）、`cmpl=…`（只在左）、`cmpy=<key>:<releaseId>`（右側期別）。**同時要記左側期別**（否則別人打開分享網址看到的左側年份取決於自己 localStorage）——現行 urlState 不記任何圖層參數，這是新增語意，見 §5 Q5 |
| `src/App.tsx` | 工具列入口、比較時掛 `CompareMapView`；拍攝模式、私人畫面時比較仍可用（P1 不另處理） |
| `src/components/sidebar/*` | 圖層列展開區加「顯示在」分段控制（左／右／兩側，§5.8 ≤3 選項）；統計層兩側時多一列「右側期別」 |

右側底圖（P1 末段，可選）：`CompareMapView` 的 style 用 `rightBasemap ?? 主地圖 styleUrl`，在比較模式提示卡或工具列「比較」的 popover 放一個底圖選單（沿用 §5.19 圖示樣式）；切換時只對第二張地圖 `setStyle` 並在其 `style.load` 重建右側圖層。用途：左暗色／右衛星。工作量小，若 P1 太大可延到 P2。

「只在右側」的統計層用哪一組選擇：
- 側別＝兩側：左圖用原本的 selection（key），右圖用 `key::R`（只有期別可不同，預設同左）。
- 側別＝只在右側：右圖仍用**原本的 selection（key）**，期別選單就是原本那一列（不出現「右側期別」）；`key::R` 不建立。
- 側別＝只在左側：同現行。
- 從「兩側且右側期別不同」改成「只在右側」時，把 `key::R` 的期別寫回 key 再丟棄 `key::R`，畫面不跳年份。

圖例與 popup：
- 統計層左右只差期別 → **一份圖例**（色階門檻相同，§2.2），標題下一行小字「左 2018 ｜ 右 2025」；其他圖例照舊。
- 圖層只在一側 → 圖例列尾加小字「左」或「右」。
- popup：點右側統計面 → 同一個停靠 popup，標題後加「（右側・2025）」；選取圈畫在被點的那張地圖。

手機：
- 寬度 < 斷點時改**上下分割**（`orientation: "horizontal"`），上＝左側、下＝右側；只能拖把手改比例，地圖本身照常平移（兩張圖同步，所以在哪一半拖都一樣）。
- 入口收在手機標頭 `⋯`（§5.29 不得加外露按鈕）。
- 記憶體：見 P0 量測；量不過就第一期手機不提供入口（但能開分享網址→自動退回單地圖並提示）。

效能與記憶體風險：
- 第二個 WebGL context＋第二份底圖圖磚快取＋第二份統計 GeoJSON（鄉鎮層幾 KB～十幾 KB／份，村里層較大）；古地圖 raster 圖磚兩邊各抓。
- 兩張地圖同時 render：拖曳時 GPU 負擔約兩倍（未實測）。
- 關比較時 `map.remove()` 釋放；不保留隱藏地圖（保留可省 map load 但吃記憶體，見 §5 Q4）。

測試策略：
- 單元：compareStore（側別預設、supportedOnRight）；側別可見性視圖（左圖不畫 right-only）；統計 store 命名空間（右側不寫 localStorage、右側 disable 不影響左側）；attach cleanup 只清自己的 key；urlState 往返（不升版、舊網址不受影響）。
- 既有守門：`layerHookRegistry.test.ts`、`layerConsistency`、`layer-golden.json` 不應變（P1 不動登記簿順序）；若加點擊層，golden 要重生——共用檔，由主 agent 處理。
- 瀏覽器：開比較、拖把手、左右選不同年份、切底圖（style.load）後兩邊都還在、關比較後主地圖統計仍在、分享網址重開一致。手機上下分割實機看一次。

工作量：**大**（新檔 4–5 個、改共用檔 8–10 個，其中 `statisticsParamsSpec.ts`、`urlState.ts`、圖例與另一個 worker 重疊）。
主要風險：統計 store／attach 的共用狀態改壞主地圖統計；與「呈現方式」PR 的衝突；手機記憶體。

### P2：靜態 PMTiles／GeoJSON（中～大）

- 範圍：`OVERLAY_REGISTRY` 中 `!dynamicData` 且非 gated／release-hold 的 config（規則照 `src/embed/embedWhitelist.ts`，但不需要 MapLibre adapter），以及 MapView 內建工廠層中純靜態者（農業、等時圈 PMTiles）。manifest 層級估：geojson 175＋陣列 32、pmtiles 97＋陣列 41（實際以 registry 過濾後的數量為準，P2 開工時用 runtime 算一次）。
- 改動：
  - `src/map/overlayManager.ts`：`hydratedSources`／`fallbackHydratedSources`／`hydrateGeneration`（`:645-649`）改成以 map 為鍵的 `WeakMap`；`resetOverlayHydration(map)`；loading id 加側別。
  - `CompareMapView`：`style.load` 跑 `addAllOverlays(map2, rightConfigs, …)`，訂右側可見性與 `layerParamsStore`（參數兩側共用，第一版不做左右不同透明度）。
  - 點擊：右圖綁定處理全部 overlay 型 popup。
  - `supportedOnRight` 擴大到這批 key。
- 測試：overlayManager per-map hydrate；兩張地圖同時開同一層各自有資料；切底圖後重 hydrate。
- 風險：PMTiles 自訂 source（`registerPmtilesSourceTypeOnce`）兩張地圖共用協定處理是否有狀態（未查）；`jpHeightLifecycle` 依視野產生 source（`createJpHeightLifecycle(map)`）要不要支援右側（建議 P2 排除）。

### P3：動態與 3D（建議：宣告不支援，小；真要做：大）

- 動態：manifest supabase 69 筆＋hook 中 62 檔訂 `timeStore`、79 檔用 loadingRegistry。掛第二地圖等於每層雙倍 RPC／egress 或要改成共用資料快取。
- 3D：21 個 Scene、21 個 CustomLayer，scene 綁 gl context，拾取寫在主地圖點擊處理裡。
- 建議：P3 只做「不支援」的 UI：比較模式中這些層的「顯示在」控制停用並顯示「比較模式只顯示在左側」，視野提示卡（§5.42）加一段「N 個圖層在比較模式只顯示在左側」。工作量小。之後真有需求再逐層評估（每層中～大）。

---

## 4. 與設計規範（`docs/design-system/spec.md`）的衝突與要新增的條文

| 條文 | 衝突／要改 | 建議 |
|---|---|---|
| §5.17 工具列：組成固定、禁止新增一排或浮動按鈕、禁止新的主要按鈕 | 「比較」入口要進工具列 | 在第二組（分享、說明…）加一顆**一般圖示按鈕**（lucide `Columns2`，13px），開啟時 accentFaint 底；spec 組成順序要改寫 |
| §5.29 手機標頭：禁止外露按鈕 | — | 入口放 `⋯` 選單，開關類項目 `aria-pressed` |
| §5.11 圖層控制區順序（資料篩選→顏色→透明度→…）、禁止手寫控制 JSX | 「顯示在：左／右／兩側」要排在哪 | 新增類別「比較」排**最前**，只在比較模式出現；用規格產生（`layerParamsSpec` 派生），不手寫；`layerParamsOrder.test.ts` 詞彙表補一列 |
| §5.8 分段控制 ≤3 | 左／右／兩側剛好 3 個 | 用分段控制 |
| §5.37 連動選單 | 右側期別 | 同元件，標籤「右側期別」；左側原本的「資料期別」在比較模式改名「左側期別」 |
| §5.32 圖例 | 左右不同期別 | 不拆兩份圖例；標題下加一行 `LegendNote` 風格小字「左 2018 ｜ 右 2025」；只在一側的層列尾加「左」「右」。符合使用者偏好「圖例單純、調整放圖層展開」 |
| §5.42 視野提示卡（禁止另做右上提示元件） | 第一次開比較的操作說明、不支援圖層的提示 | 加第四段：「拖中間把手比較；N 個圖層只顯示在左側」，按鈕「知道了」；不另做元件 |
| §5.24 時間軸、§5.25 z-index | 把手的層級 | 把手 `Z_INDEX.mapOverlay`（與時間軸同層），新增 §5.45「比較把手」：2px 線（暗 `#fff` 0.8／淡 `#111827` 0.6）＋28px 圓形把手、`role="slider"`、鍵盤操作、手機 44px 觸控區 |
| §5.20 拍攝模式 | 拍攝時要不要保留把手 | 建議保留分割但隱藏把手的圓鈕，只留線（拍攝模式本來就隱藏 UI） |

UI 草案（文字）：
1. 工具列「比較」→ 地圖中間出現直線與圓形把手，右上提示卡第四段說明。
2. 開著的每個圖層列，展開後最上面多一列「顯示在 ［左｜右｜兩側］」，預設兩側；收合時列尾在非兩側時顯示小字「左」「右」。
3. 統計層選「兩側」時，「資料期別」改名「左側期別」，下面多一列「右側期別」（預設同左）。
4. 不支援的層（P1 時除古地圖與統計外全部）：「顯示在」停用，旁註「比較模式只顯示在左側」。
5. 再按一次「比較」或按 Esc 結束；結束後狀態保留在網址之外的 session 記憶（下次開比較沿用上次的側別）。

---

## 5. 使用者已決定的題目（5 題，2026-11-11）

> 以下保留當時的選項與分析供追溯；每題最後一行「**決定**」為使用者答案。

### Q1　第一期以外的圖層，在比較模式裡怎麼處理
- 為什麼要你決定：P1 只支援古地圖與統計，其他 700 多層開著時畫面會變成「只有左邊有」，你要接受這個過渡狀態，或改成更保守的行為。
- 選項：(a) 照畫在左側並標「只在左側」；(b) 開比較時自動暫時關掉不支援的層，結束比較再恢復；(c) 不支援的層開著時不允許進入比較。
- 改到什麼：(a) 只多一段提示與控制停用；(b) 要記住並恢復可見性，與 Agent／分享網址互動變複雜；(c) 最簡單但最不好用。
- 建議：**(a)**。
- 當時的風險說明：若其實期待 (b)，看到「只有一邊有」會以為壞掉——所以 UI 必須明標「只在左側」。
- **決定：(a)** 照畫在左側並標「只在左側」。

### Q2　統計層左右可以不同的範圍
- 為什麼要你決定：只差「期別」時色階相同、圖例一份；若允許左右換不同指標或細項，圖例要拆成兩份、比較也容易誤讀。
- 選項：(a) 只允許期別不同；(b) 期別＋細項（例：性別）；(c) 任何指標都可以。
- 改到什麼：(a) 一個「右側期別」選單；(b) 右側再加細項選單、圖例遇門檻不同時拆兩份；(c) 等於兩張獨立地圖，圖例與 popup 全部要分兩份。
- 建議（當時）：(a)，(b) 之後視需要。
- 當時的風險說明：(c) 會把 P1 推得更大，圖例也會違反「單純」偏好。
- **決定：(b)** 期別＋細項可左右不同，不開放任意指標。§3 狀態模型的 `rightStatistics` 要改成 `{ releaseId, variant? }`（細項欄位名稱 P1 開工時依統計連動選單實際結構定）；細項不同而門檻不同時，圖例拆左右兩份，相同時維持一份。

### Q3　手機怎麼辦
- 為什麼要你決定：手機窄、多一個 WebGL 地圖可能讓舊手機變慢或閃退（只能實測）。
- 選項：(a) 手機也開放，改上下分割、入口在 `⋯`；(b) 第一期手機不提供入口，打開含比較的分享網址時退回單地圖並提示；(c) 等 P0 量測結果再定。
- 改到什麼：(a) 多一套方向與觸控處理；(b) 只多一個退回提示。
- 建議：**(c)**，量測前先照 (b) 準備退路。
- 當時的風險說明：直接 (a) 可能在舊 iPhone 上出現白畫面且難以重現。
- **決定：(c)** 等 P0 實測再定；實測前照 (b) 準備退路（手機不提供入口，開到含比較的網址退回單地圖並提示）。

### Q4　Mapbox 計費與第二張地圖的生命週期
- 為什麼要你決定：每 `new Map` 一次就算一次 map load（官方定義）。關比較時銷毀地圖省記憶體但再開又計一次；隱藏不銷毀則一次瀏覽只計一次但一直佔記憶體。
- 選項：(a) 開才建、關就銷毀；(b) 第一次開建立，之後隱藏重用；(c) 只給登入會員或站主使用。
- 改到什麼：(a) 最簡單；(b) 要處理隱藏時暫停 render 與資料更新；(c) 加權限判斷。
- 建議：**(a)**，map load 增量先觀察一個月（目前免費額度數字沒查到）。
- 當時的風險說明：若比較功能很熱門，map load 可能明顯增加。
- **決定：(a)** 開才建、關就銷毀。

### Q5　分享網址要不要記比較狀態（包括期別）
- 為什麼要你決定：現在網址不記任何圖層參數（統計期別也不記，`urlState.ts`、map-layers §3.6）。比較的意義在「左 2018／右 2025」，不記期別的話別人打開會看到不同年份。
- 選項：(a) 記比較開關、把手位置、側別、**左右兩側期別**（只限比較中的統計層）；(b) 只記開關與側別，期別不記；(c) 不記。
- 改到什麼：(a) urlState 新增 4–5 個參數（不升版號），統計期別第一次進網址；(b) 少一個參數，但分享結果不可靠。
- 建議：**(a)**。
- 當時的風險說明：(b)／(c) 分享出去的比較圖會跟你看到的不一樣。
- **決定：(a)** 記比較開關、把手位置、側別、左右兩側期別（只限比較中的統計層）。〔待確認〕因 Q2 決定 (b)，推論左右細項也應一併記入（同樣只限比較中的統計層），P1 開工前確認。

---

## 6. 沒查到／未實測的事

- Mapbox map load 的免費額度數字（定價頁未讀）。
- `raster-mask` 在 3.34 的實際效能與拖曳時的邊緣行為（未實測；且非公開屬性）。
- scissor 夾心法在 opaque／offscreen pass、地形 draping、heatmap 下的行為（未實測）。
- 第二個 WebGL 地圖在實體手機的記憶體與幀率（只能實測，列為 P0）。
- `mapbox-pmtiles` 自訂 source 在兩張地圖同時使用時有沒有共用狀態（沒讀）。
- `mapbox-gl-compare` 的授權條款（沒查；本設計不直接使用其 UI）。
- `clip-path` 裁掉的區域不收指標事件：引用規範原文但本次未重新核對網頁，列入 P0 實測。
- OVERLAY_REGISTRY 中「非動態、非 gated」的精確筆數（要在 runtime 算，靜態 grep 會漏掉 factory 產生的 config）。

## 6a. 交稿前補查：「呈現方式」worker 的進行中改動（未 commit）

交稿前再看 `.worktrees/viz-presentation-1`：已有未提交改動 21 檔＋新檔（`src/state/statisticsPresentationStore.ts`、`src/data/statisticsPresentation.ts`、`src/data/presentationOverrides.ts`、`src/map/statisticsCircles.ts`）。與比較模式的交集：
- `src/map/regionalStatisticsMap.ts` +67 行（比例圓 source `<key>-circles`、`<key>-circle-halo`／`<key>-circle` 子圖層、`renderCircles`）——P1 要參數化的正是這支 attach，**P1 必須在該 PR 合併後才開工**，並讓比例圓也走「store key 映射＋側別可見性」。
- 呈現方式狀態 `statisticsPresentationStore` 以圖層 key 為鍵 → 比較模式第一期建議左右共用同一呈現方式（不做「左面量圖、右比例圓」）。
- `pm=` 已定為 `pm=<layerKey>:<mode>`（`src/lib/urlState.ts` diff）；比較模式的新參數照同樣「只記非預設、不升版號」的寫法。
- 該 PR 也改 `gisClickRegistry.ts`（比例圓圖層 id），P1 右圖點擊綁定要包含它。

## 7. 主要出處

- Mapbox clip 圖層：https://docs.mapbox.com/style-spec/reference/layers/#clip
- Mapbox GL JS CHANGELOG（3.18.1–3.34.2）：https://raw.githubusercontent.com/mapbox/mapbox-gl-js/main/CHANGELOG.md
- `raster-mask` 屬性定義：`https://unpkg.com/mapbox-gl@3.34.2/dist/style-spec/index.cjs`
- Swipe between maps 範例：https://docs.mapbox.com/mapbox-gl-js/example/mapbox-gl-compare/
- Map load 定義：https://docs.mapbox.com/help/glossary/map-loads/
- repo（origin/develop dda9caa0）：`src/map/MapView.tsx`、`src/map/regionalStatisticsMap.ts`、`src/state/regionalStatisticsStore.ts`、`src/data/statisticsFillColor.ts`、`src/map/overlayManager.ts`、`src/layers/LayerHost.tsx`、`src/layers/layerHostDeps.ts`、`src/layers/layerHookRegistry.tsx`、`src/hooks/useMapInteraction.ts`、`src/hooks/useHistoricalMapSinicaLayer.ts`、`src/state/timeStore.ts`、`src/lib/urlState.ts`、`src/embed/embedWhitelist.ts`、`src/research/MainMapConnection.tsx`、`src/research/layerControls.ts`、`docs/design-system/spec.md`

---

## P1 實作紀錄（2026-11-11，分支 `feat/compare-mode-p1`）

UI 規格正本：`docs/design-system/spec.md` §5.45（並改 §5.11 比較類、§5.17、§5.32、§5.42.3）；樣式：`map-layers.md` §3.11。

**狀態模型**
- `src/state/compareStore.ts`：`{ enabled, split, sides }`，只活在這次瀏覽（不寫 localStorage）。`sides` 缺省＝兩側；不支援的層一律「左」。
- 統計左右選擇只在 `regionalStatisticsStore`：左＝`key`、右側另選才建 `key::R`（含 `::` 的 key 不寫 localStorage）；左側換指標丟掉 `key::R`；改成「只在右側」先把右側選擇搬回左側（`src/state/compareStatistics.ts`）。
- 統計多地圖共存：`attachRegionalStatistics(map, getIsDark, { storeKey, isShown, primary, … })`。主地圖（primary）擁有 `key` 的載入／停用；右圖只擁有 `key::R`，關右圖不會清掉左側資料（`regionalStatisticsMap.test.ts` 多地圖段）。
- 右側期別／細項控制項：由左側統計連動選單規格派生（`rightStatisticsSpecs`，provider `statisticsRight`），不進 `LAYER_PARAMS_SPEC`；Agent、場景存檔、黃金快照不受影響。

**分享網址**（`src/lib/urlState.ts`，不升 `v`）：`cmp=1`、`cmpx=<0.05–0.95>`（0.5 不寫）、`cmpl`／`cmpr=<key>,…`、`cmpdl`／`cmpdr=<key>:<後綴>=<值>;…`（逗號分隔多層；後綴＝連動選單 name 去掉 layerKey，例 `Period`、`DimCause`）。左側一律記（看網址的人 localStorage 可能記著別的期別），右側只在與左側不同時記。舊網址沒有 `cmp` 時輸出逐位元組不變（測試）。

**與 §4 表格的差異**：§4 寫「顯示在」由 `layerParamsSpec` 派生並在 `layerParamsOrder.test.ts` 詞彙表補一列；實作改成**不進** `LAYER_PARAMS_SPEC`（`src/state/compareControls.ts` 只給面板用），理由是進規格會讓 Agent、場景存檔、黃金快照都看到一個只在比較模式有意義的參數。所以沒有詞彙表那一列，排序由 `withCompareControls` 固定：「顯示在」→ 左側期別／細項 → 右側期別／細項 → 其餘。
**拖把手的成本**：App、圖層列標籤、展開區、統計圖例只訂開關與側別（`useCompareSelector`），拖把手只重繪右圖裁切與把手；網址停 250ms 才寫（避免 Safari replaceState 次數上限）。

**點擊**：右半由右圖另綁 click（統計面／比例圓）→ 同一個停靠 popup，properties 帶 `compare_side: "right"`，popup 第一列「比較：右側」。

**Agent（MCP）**：鏡頭與圖層控制照單地圖行為，作用在主地圖（左）；右圖靠鏡頭同步跟著動。Agent 不能設側別或右側期別（P1 不做，列 BACKLOG）。

**已知限制（P1 不處理）**
- 量測、右鍵選單、游標座標、定位標記、Agent 畫上的分析結果只在左（主）地圖；3D 地形照主地圖鏡像，3D／Three.js 圖層只在左側。
- 右半的 hover／點擊只處理統計層；古地圖沒有 popup（同單地圖）。
- `clip-path` 裁切與把手指標行為只在 Chromium（agent-browser）驗過；Safari／Firefox、手機實機未測。
- Esc 結束比較只在焦點在把手時有效（不攔全域 Esc，避免和量測、popup 衝突）。
- 手機 URL 改寫會去掉比較參數（退回單地圖後再分享不帶比較）。

