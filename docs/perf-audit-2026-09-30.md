# 效能盤點與優化 — 2026-09-30

> 起因：打開「工商登記」圖層時電腦風扇狂轉。
> 範圍：地圖渲染、圖層生命週期、首屏載入、資料傳輸、部署體積。
> 上線 PR：pulse #464、#467、#471、#472、#476、#477；analytics #124。
> 前一次同類改造見 [`perf-overhaul-2026-06.md`](./perf-overhaul-2026-06.md)。

## TL;DR

| 面向 | 改造前 | 改造後 |
|---|---|---|
| 全關＋暫停時地圖重畫 | 5 秒 20–29 次（永不 idle） | 0 次 |
| 靜態／動態 3D 圖層暫停時 | 每幀重畫（60fps） | 0 次；只在時間或資料變動時重畫 |
| All Off | 有時殘留圖層（例：雷達） | 與逐一關閉同一路徑，關乾淨 |
| 工商三層全台視角 | 約 35 萬點 × 4.5px＋描邊 | 低 zoom 小點無描邊；拖動單幀耗時約 −45% |
| 工商 allzoom PMTiles | 124／103／128 MB | 70／57／72 MB（點數不變） |
| 首屏 JS | 8.61 MB | 6.2 MB（three／h3／統計明細改按需） |
| 播放時 App 重渲 | 每秒 4 次整棵＋~104 個 Host | 5 秒 1 次（按播放那次） |
| 開關單一圖層 | 102 個 Host 重渲 | 只重渲該 Host |
| 公車路線 JSON（gzip） | 53 MB | 31 MB（去掉可推導的 `cumDist`） |
| 部署搬運 | 含約 470 MB 未使用檔 | 已排除 |

## 1. 發熱的根因

三個原因疊加，缺一個都不會那麼熱：

1. **點被放大**：2026-09-28 的點分階統一（`1d1b6938`）把工廠、製造業公司、列管設施三層（各 8–18 萬點）改成固定 4.5px＋1px 描邊。原本 z0–7 只有 0.7–1px、無描邊。全台視角約 35 萬個圓，填充量約為畫面像素的 20 倍以上。
2. **tile 內容重**：三個 `*_allzoom.pmtiles` 依上游契約「不可抽稀」，但 `--buffer=64` 讓低 zoom 每個 tile 幾乎帶全島的點，z7 點數重複約 3.5 倍，單 tile 解壓約 15 MB。
3. **地圖停不下來**：
   - 隱藏圖層被改 paint 後 transition 卡住（見 §2.1），**沒開任何圖層也在重畫**。
   - 13 個 CustomLayer 可見時在 `render()` 內無條件 `triggerRepaint()`，暫停也 60fps。這違反 `PRINCIPLES.md` §3D 效能 早已寫下的規則。

## 2. 做了什麼

### 2.1 圖層生命週期（#464）

- **A0 卡住的 paint transition**：Mapbox 對一個圖層做任何 `setPaintProperty` 都會替該圖層的「所有」paint 屬性建 transition；隱藏圖層不會 recalculate，transition 永不結束 → `style.hasTransitions()` 恆 true → 無限重畫。詳見 pitfall [`2026-09-30-hidden-layer-paint-transition.md`](../.claude/pitfalls/2026-09-30-hidden-layer-paint-transition.md)。
  - `overlayManager.setPaintPropertyGuarded`：隱藏時暫存 paint，重新顯示才寫入。
  - 水庫 dim 只還原自己改過的值；農地隱藏時不改 paint。
  - 漣漪類圖層所有 paint 屬性 transition 設 0。
  - `MapView` 每次 `style.load` 將 style 根層 transition 設 `{duration:0, delay:0}`（`map.style.setTransition`，Mapbox v3 無公開 Map API）。本專案「平滑過渡」一律指資料插值，不需要 GL 淡入。
- **D1 All Off**：改走與逐一關閉相同的路徑（`statisticsDisplayModeStore.allOff`），附「All Off＝逐一關閉」測試；修雷達在 All Off 後被舊的每秒回呼設回可見。
- **關閉後仍在算的工作**：日本水資源關閉仍改樣式、YouBike 每模擬分鐘 setState App、船舶／航班關閉仍抓資料、全球海事輪詢、4 個常駐 200ms timer、橋梁雨量隱藏被 `isStyleLoaded()` 擋住。

### 2.2 只在變化時重畫（#464、#476）

- 動態 CustomLayer（航班、船舶、列車、公車、垃圾車）改以 `subscribeTimeRepaint` 訂閱 timeStore，時間變動才重畫。
- 靜態圖層只在資料或參數改變時重畫。
- 裝飾動畫（燈塔、溫度波、消防站漣漪、清運設施轉環、垃圾車音符）依使用者決定，可見時可持續動畫，關閉即停。
- 公車平滑改為時間基準，收斂後停止。
- 地震漣漪只在 20 分鐘新地震窗內跑 RAF（PF-11a）。
- 漣漪類動畫以 `src/utils/throttledRaf.ts` 降到約 20fps，相位以時間計算，速度不變。
- live 模式時鐘由每幀改為每秒 1 次。
- 3D 重畫改由 `src/state/threeRepaintSignal.ts` 明確通知，不再依賴 App render（PF-9）。

### 2.3 工商登記（#464、analytics #124、#467）

- **A1 點樣式特例**：`src/map/pointSpec.ts` 的 `DENSE_POINT_OVERRIDES`。半徑隨 zoom（z0 0.7 → z14 起回 M tier 4.5），z11 以下無描邊；規格記在 `docs/design-system/map-layers.md` §3.1。
- **PF-1 重切**：上游 `08_allzoom_density.py` 點位檔 `--buffer=64 → 8`，輸出 `*_allzoom_b8.pmtiles`。各 zoom 點數與舊檔相同，z0／z14 逐點一致。buffer 8（512px tile 下 ≥16 CSS px）涵蓋最大點半徑 14.5px。細節見 `docs/features/business-registry-company-layers/handoff.md`。
- **不做的選項**：低 zoom 抽稀（違反上游「不可抽稀」契約）、tile 只帶 id＋點擊再查（−91%，但要改 popup 資料來源）。兩者都由使用者否決。

### 2.4 首屏與按需載入（#464、#471、#476）

- h3-js、13 個主要 3D 圖層、10 個獨立 3D 圖層都改成第一次可見才 `import()`。
  - 以 `three-layers-anchor` 等佔位圖層維持 beforeId 順序。
  - 第一次開任何圖層後，`src/lib/prewarmLayerChunks.ts` 在 idle 時預載 three／h3。這是使用者要求：「開圖層後先把工具下載好」。
- 統計配方拆成同步小目錄與非同步明細：
  - `statisticsRecipeCatalog.ts` 是同步小目錄。
  - `statisticsRecipeDetails.ts` 是非同步明細，agri／social 各自 chunk。
  - 明細未載入時讀取會丟 `STATISTICS_RECIPE_DETAILS_NOT_LOADED`，不回空陣列。
  - 320 個統計圖層的配方、資料來源總覽、側欄目錄，與改前逐項相同。
- `withLoading` 支援 `signal`：被取消的請求不算「載入失敗」（PF-11c）。

### 2.5 React 重渲（#471、#476）

- `useTimeline` 不再把 currentTime 回傳給 App；由 `useUiTime()` 讓時間軸、截圖模式時鐘等葉元件自己訂閱。
- 列車、公車、客運、台灣好行、航班、船舶的計數移到 `src/state/liveCountStore.ts`，只有側欄那一列訂閱。關閉圖層即歸零。
- `LayerHosts` 做 `React.memo`；每個 Host 經 `HostSlot` 只訂閱實際讀到的 visibility key（PF-8）。

### 2.6 資料傳輸與部署（#464、#467、#471、#477）

- **公車路線**：前端載入時以原公式重算 `cumDist`。
  - 4 個 S3 大檔改為 `*_v2.json`，19 個 git 內小檔原地覆寫。
  - chiayi 保留原內容，因為研究端以其 SHA 作身分。
  - 以真實軌跡比對約 1 萬車次，位置差 ≤ 0.10 m。
- **PMTiles**：Ookla 行動／固定、全台清運點位、日本宗教 OSM 改 PMTiles，各 zoom 保留全量 feature。
- **聊天工具**：清運查詢改讀 `waste_stops_chat_20261001.json`（columnar，2.1 MB），結果與原 GeoJSON 一致。
- **nginx**：`gzip_vary on`、`gzip_comp_level 6`；PMTiles 不壓縮（保留 Range）。
- **部署清單**：排除約 470 MB 無 runtime 引用的舊 GeoJSON／PMTiles，以及被取代的 `*_allzoom.pmtiles`、v1 公車檔。
  - `.dockerignore` 排除 4 個已被取代的全量 GeoJSON。
  - S3 物件與本機檔都不刪。

### 2.7 順手修的既有 bug

- 垃圾車音符：`uOpacity` 只宣告在 vertex shader，fragment 編譯失敗，音符從未畫出。
- 水庫 3D 柱：切換底圖後不重建。

## 7. 後續：切主題／拖透明度不重抓資料（2026-10-01）

規則：主題、透明度、大小只改樣式（`setPaintProperty`），不可重抓資料、`setData`、重建圖層或重新訂閱 timeStore。

- 靜態掃描 hook 中「deps 含主題／透明度、body 會抓資料或建圖層」的 effect 共 38 個，逐檔確認：19 個 hook＋共用工廠 `src/hooks/factories/timelineSliceLayer.ts`（地下水、河川水位、雨量）要修；日本 11 個與其餘為冪等 add-if-missing，不用改。
- 做法：抓資料／生命週期 effect 拿掉樣式 deps，初始樣式讀 ref；另開只 `setPaintProperty` 的樣式 effect。工廠 controller 回傳 `updateStyle()`。
- 換底圖（`setStyle`）會清掉自訂圖層：以前靠 `isDark` 變動重跑 effect「順便」重建（代價是重抓）。現在各 hook 監聽 `style.load`，用快取資料重建＋`setData`，不重抓。`style.load` 當下 `isStyleLoaded()` 可能仍為 false，重建要略過這個檢查。
- 瀏覽器實測（雨量、淹水感測、抽水站、IoT 結構物、最新火災、清潔隊、動物福利據點）：暗→淡→暗兩次換底圖，七層都在、筆數不變，資料請求 0（唯一請求是 registry 靜態檔重新灌入，既有行為）；四個透明度滑桿拖到最小，資料請求 0。

## 3. 沒做／待決定

見 `.claude/memory/BACKLOG.md` §Performance audit follow-ups：

- **PF-3** 公車路線 RDP 簡化（約 3 m，intercity gzip 14.5 → 3.0 MB）：使用者決定暫緩。
- **PF-5** Retina 解析度上限：mapbox-gl 3.18 沒有 `pixelRatio` 選項；唯一做法是全域覆寫 `devicePixelRatio`，會影響 Three.js 與其他 canvas，待決定。
- **已知未改**：船舶資料下載中按 All Off，下載不會中斷，會跑完才消失「載入中」。使用者決定維持現狀。

## 4. 量測方法（之後可重用）

- **地圖是否 idle**：用 agent-browser 取得 `window.__map`，數 5 秒內 `map.on('render')` 次數；再看 `__map.style.hasTransitions()`。
  - 全關＋暫停必須是 0。
  - 追來源：包 `map.triggerRepaint` 與 `setPaintProperty` 記 stack。
- **React 重渲**：dev 的 `window.__layerRenderCounts`；需要時在 App 頂端暫時計數。
- **首屏 JS**：`npx vite build`，計算 `index.html` 引用加上其靜態 import 閉包。
- **tile 成本**：`pmtiles` CLI 或 python 解 tile，看各 zoom 的點數與 bytes。
- **headless 注意**：SwiftShader 只有約 1–6 fps，絕對毫秒不可信，只看比例與次數。時間軸需要防背景節流參數才會前進。

## 5. 教訓

- 規則寫在 `PRINCIPLES.md` 不代表會被遵守：「靜態 3D 不要在 render 內 triggerRepaint」4 月就寫了，9 月仍有 13 個圖層違反。量測腳本（render 次數＝0）比規則文字有效。
- 視覺統一（點分階）要檢查資料量級：同一套 tier 套在 10 萬點圖層上，成本差兩個數量級。特例要登記在規格文件，不要默默繞過。
- 「沒開圖層」不等於「沒在工作」：常駐 Host、殘留 transition、常駐 timer 都會讓地圖永不 idle。
- 換資產內容一律換檔名：nginx 對帶日期檔名設一年 immutable，同名覆寫會讓使用者拿到舊檔。
