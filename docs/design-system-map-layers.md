# Mini Taiwan Pulse — 地圖圖層視覺規格

> 本檔是 [`design-system.md`](./design-system.md) §13 的完整版：**地圖上**的點、線、面、3D、熱區、網格、影像、文字標籤與圖例該用什麼數值。UI chrome（面板、按鈕、popup）仍以 `design-system.md` 為準。
>
> - **資料表**：[`design-system/layer-style-inventory.json`](./design-system/layer-style-inventory.json)（803 個圖層逐一列出，重跑 `npm run design:audit-layers` 產生）。本檔只放分佈、離群與規則，不逐層抄。
> - **視覺參考**：[`design-system-reference.html`](./design-system-reference.html) 「地圖圖層」區塊（暗／淡並排，標出現況中位值與提案值）。
> - **狀態**：§2 是 2026-09-28 盤點的**現況**；§3、§4 的建議值全部是**提案，待使用者逐項拍板**（§7 清單）。拍板前不改程式；拍板後逐層調整時照 §6 工作流。
> - 分析結果（Agent 畫在地圖上的結果）的視覺規格已定案於 [`features/viz-library/DECISIONS.md`](./features/viz-library/DECISIONS.md)，本檔只引用，不重寫。統計圖層配色另見 [`statistics-layer-guidelines.md`](./statistics-layer-guidelines.md) §4。

## 目錄

1. [怎麼用這份文件](#1-怎麼用這份文件)
2. [現況總覽](#2-現況總覽)
3. [建議規格（提案）](#3-建議規格提案待使用者逐項拍板)
4. [圖例規格](#4-圖例legend規格)
5. [組合範例](#5-組合範例)
6. [調整工作流](#6-調整工作流)
7. [待拍板清單](#7-待拍板清單)
8. [盤點方法與限制](#8-盤點方法與限制)

---

## 1. 怎麼用這份文件

### 1.1 調整一個圖層前先看的欄位

在 `layer-style-inventory.json` 的 `layers.<key>` 查：

| 欄位 | 看什麼 |
|---|---|
| `resolution` | 數值從哪來：`runtime`（`OVERLAY_REGISTRY`，已求值）／`shared-renderer`（統計共用 renderer）／`static-scan`（hook 字面值，**hook 層級，可能是兄弟圖層的值**）／`unresolved`（Three.js 或找不到，只有原因與檔案） |
| `evidence` | 要改的檔與行號 |
| `sublayers[]` | 每個子圖層的 `type`、`role`（`main` 資料本體／`decoration` 光暈、漣漪、點擊熱區）、`values`（z10／z14 半徑、線寬、透明度…）、`colors`（編碼型別 `constant`／`categorical`／`sequential`…）、`themeDiff`（暗／淡不同的屬性） |
| `params` | 控制項預設值：`opacity`、`size`（大小倍率）、`lineWidth`、`height` |
| `legend`／`legendType` | 圖例 id 與型別；到 `legends[]` 查同 id 的 `issues` |
| `ironRules` | 四鐵則：`opacity`、`pointSize`（只判 runtime 點層）、`legend`、`categoricalWithoutLegend`、`popup` |

⚠️ runtime 數值**已乘上滑桿預設值**（例如 `circle-opacity` 已含透明度預設、半徑已含大小倍率 1.0）。要改「預設看起來多大」改 paint 基準值；要改「使用者可調範圍」改 `layerParamsSpec.ts`。

### 1.2 改哪些檔

| 要改的 | 檔案 |
|---|---|
| 一般 Mapbox 圖層的 paint／layout | `src/map/overlayRegistry.ts`（`evidence` 行號）；色票常數在 `src/data/*Types.ts` |
| 自行接線圖層 | `evidence` 指的 `src/hooks/use*Layer*.ts`、`src/map/*Factory.ts`、`src/map/*CustomLayer.ts` |
| 統計圖層（320 層共用） | `src/map/regionalStatisticsMap.ts`（一改全改）；色階 `src/data/statisticsVisuals.ts`／各 recipe |
| 透明度、大小、線寬預設與範圍 | `src/data/layerParamsSpec.ts` |
| 圖例 | `src/components/LegendPanel.tsx`（`LEGEND_REGISTRY` 與子元件）；統計 `src/components/sidebar/StatisticsDetails.tsx` `StatisticsLegend` |
| Three.js 立體 | `src/three/*Scene.ts`、`src/map/*CustomLayer.ts`（照 `three-3d-component` skill） |

### 1.3 驗收步驟（每改一層）

1. **All Off**：側欄按「All Off」，只開這一層（避免別層蓋住或共用 source 干擾）。
2. **兩個縮放**：z10（縣市尺度）與 z14（街區尺度）各看一次；點層再看最密的區域（台北市中心）。
3. **兩種底圖**：暗色（預設）與淡色（`light`／`streets`）各看一次；確認描邊、文字 halo、線色有跟著切換。
4. **四鐵則**：透明度滑桿有效（0.1 與 1.0 兩端）、圖例色與地圖一致（同色、同級距、同單位）、點得到 popup（R2 選取圈出現在正確位置）、選項 ≥4 時是原生下拉。
5. **重跑盤點**：`npm run design:audit-layers`，`git diff docs/design-system/layer-style-inventory.json` 只該動到這一層（與它的圖例）。
6. `npx tsc -b`；改到 `overlayRegistry` paint 時黃金快照會紅——確認差異是本次有意的，再照 `scripts/preprocess/dump-layer-golden.ts` 檔頭說明重產 fixture。

---

## 2. 現況總覽

來源：`layer-style-inventory.json`（2026-09-28，`summary`／`stats`）。以下「主體子圖層」指 `role: main`；光暈、漣漪、點擊熱區等 115 個裝飾子圖層（92 層）另計，不進分佈。

### 2.1 盤點範圍

| 項目 | 數量 |
|---|---|
| 圖層 key（manifest） | **803** |
| `runtime`（`OVERLAY_REGISTRY` 318 筆 config、523 個子圖層） | 294 |
| `shared-renderer`（統計，`regionalStatisticsMap.ts`） | 320 |
| `static-scan`（hook／factory 字面值） | 159 |
| `unresolved` | **30**：Three.js／WebGL CustomLayer 13、有渲染檔但 paint 非字面值 7、無 hook／factory（App 掛載或尚無實作）10 |
| 圖例 entry（`LEGEND_REGISTRY`） | 544（SSR 實際渲染 222、原始碼啟發式 322） |

各 geometry 的圖層數（一層可有多種，例：點＋標籤）：面 489（含統計 320）、點 321、線 192、3D 23、影像 22、網格 14、文字標籤 6（＋點／標籤 3）、熱區 2。

### 2.2 點（circle，主體 191 個子圖層）

| 屬性 | 最小 | P25 | **中位** | P75 | 最大 | 最常見 |
|---|---|---|---|---|---|---|
| 半徑 z10（px） | 0.5 | 3.3 | **4.75** | 6 | 15.3 | 5（25 層）、6.67（17）、1.2（11） |
| 半徑 z14（px） | 1.2 | 4.5 | **6** | 8 | 24.5 | 8（29）、6（26）、3／6.5（各 11） |
| 描邊寬 z14（px） | 0 | 0.6 | **1** | 1 | 2 | 1（62）、0.8（23）、0.5（21）、1.2（20） |
| 不透明度 | 0.08 | 0.7 | **0.85** | 0.9 | 1 | 0.85（71）、0.9（37） |

- 資料驅動半徑（依屬性放大）39 個，以範圍中點計入。
- **描邊色**：133 個隨底圖切換（最常見 暗 `#000000` → 淡 `#ffffff` 50 個；另有 `#0f172a`、`#0d1117`、`#0b1118` 三種近黑）；30 個暗淡都用白 `#ffffff`；15 個反向（暗白 → 淡黑）；11 個無描邊。暗色底圖用白描邊的點層共 47 個。
- 單色點層的 paint 主色與 `LAYER_COLORS` 一致 83 個、不一致 10 個（醫療 5 層 `medHospital`／`medClinic`／`medPharmacy`／`medLTC`／`medAED`、`taxiStand`、`landingStations`、`facHistorical` 等）。
- 點大小控制缺口（runtime 點層）：`noiseEnforcementEvents`、`officialNoiseMonitoring`、`soundCameraLocations`（即 `layerUxPolicy.test.ts` 的 backlog）；`maritimeBoundary` 為登記例外。

### 2.3 線（line，主體 103 個子圖層）

| 屬性 | 最小 | P25 | **中位** | P75 | 最大 |
|---|---|---|---|---|---|
| 線寬 z10（px） | 0.15 | 0.5 | **0.93** | 1.25 | 2.36 |
| 線寬 z14（px） | 0.15 | 0.7 | **1.0** | 1.8 | 4.5 |
| 不透明度 | 0.04 | 0.5 | **0.65** | 0.8 | 1 |

- 端點／接合：107 個用 Mapbox 預設（butt／miter），21 個 round／round，1 個 butt／round。
- 虛線 8 處：`[2,2]`（`osmPowerLines` 海纜、`pipelineOilGas`、`waterBasins`）、`[2,1]`（`noiseCaptureGrid` 三尺度外框）、`[4,3]`（`maritimeBoundary` 24 浬）、`facOffshore` 依狀態切 4 種。
- 11 層的**線寬**隨底圖改變（`airports`、`ports`、`stationsTHSR`、`stationsTRA`、`water*` 等），不是只換色。

### 2.4 面（fill，主體 94 個子圖層＋統計 320 層）

| 屬性 | 最小 | P25 | **中位** | P75 | 最大 |
|---|---|---|---|---|---|
| 面不透明度（runtime） | 0 | 0.2 | **0.37** | 0.55 | 0.85 |

依用途拆開（runtime 主體）：

| 類型 | 數量 | 中位 | 範圍 |
|---|---|---|---|
| 類別色面（分區、範圍） | 24 | 0.5 | 0.16–0.75 |
| 單色面（覆蓋範圍、背景） | 27 | 0.24 | 0–0.6 |
| 序列色面（分級） | 6 | 0.6–0.72 | 0.55–0.72 |
| 網格 | 20 | 0.7–0.85 | 0–0.85 |
| **統計（共用 renderer）** | 320 | 0.55 | 滑桿 |

- 統計圖層（`regionalStatisticsMap.ts:44–51`）：面 0.55（＝透明度滑桿）、外框 **0.8px、色階最深一格**、外框透明度**綁同一個滑桿**、遮蔽 `suppressed` 用 8px 斜線 pattern；色階 5 級 316 層（6 級 2、4 級 1、3 級 1），雙向（負值）2 層；暗／淡完全同值。
- 行政界（`countyBoundary` 等）面透明度 0，只當點擊熱區；外框用線圖層。
- 用 `fill-outline-color`（固定 1px、無法縮放）的主體面 7 個。
- `fill-extrusion` 5 個子圖層預設不透明度 0（3D 開關預設關）。

### 2.5 3D／熱區／網格／影像／文字

| 類型 | 現況 |
|---|---|
| 3D（Mapbox extrusion） | `buildingsGba`、`jpBuildingHeight`、`propertyValueGrid`：高度 = 資料屬性（`get h`、對數壓縮等），開啟後的透明度與高度倍率由滑桿決定 |
| 3D（Three.js／CustomLayer） | 13 層 `unresolved`：`realEstate*Point` ×3、`wf*` 廢棄物設施 ×5、`powerPlantGlow`、`substationEhvGlow`、`powerRegionDemand`、`windField`、`oceanCurrents`；另 `flights`／`ships`／`busLive` 等由 App 掛載的 scene |
| 熱區（heatmap） | 2 層（`powerPoles`、`rainGauge`），皆 static-scan、數值為非字面表達式；runtime 無 heatmap |
| 網格 | 14 層（企業網格、房價網格、`urbanFormGrid`、`noiseCaptureGrid`…），面 0.7–0.85；格線 0.15–0.3px 或無 |
| 影像（raster） | runtime 3 層 0.7／0.75（`urbanHeat` 等）；其餘 CWA 雲圖／雷達、`dustForecast`、`canopyHeight` 為 hook 設定 |
| 文字標籤 | 6 個 symbol 文字子圖層：字型 `["DIN Pro Medium","Arial Unicode MS Regular"]`（`newsEvents` 計數用 Bold），字級 z14 10–13（中位 11.5），halo 1.2–1.25px；地圖**沒有**設定 `localIdeographFontFamily`，中文字形由 Mapbox 伺服器的 Arial Unicode MS 提供 |
| icon（symbol） | 2 層（`osmSubstations`、`osmSubstationsEhv`，`substation-diamond`），`icon-size` 0.06–0.45（依 sprite 原圖尺寸，無法與 circle 半徑直接比） |

### 2.6 暗／淡底圖差異（現況）

523 個 runtime 子圖層中 257 個有暗／淡差異：`circle-stroke-color` 134、`line-color` 63、`circle-opacity` 43、`line-opacity` 39、`circle-color` 39、`fill-color` 11、`line-width` 11、`fill-opacity` 10、`text-color`／`text-halo-color` 各 6。

### 2.7 明顯離群與不一致（前 10）

| # | 項目 | 內容 |
|---|---|---|
| 1 | 點半徑過小 | z14 `wasteStopsStatic` 1.2、`busStationsCity` 1.4、`busStationsIntercity`／`fireHydrants` 1.6、`waterMonitorStations` 2（中位 6） |
| 2 | 點半徑過大 | z14 `newsEvents` 24.5（資料驅動）、`librarySeats`／`livestockMarket` 14、`lngTerminal` 12.8 |
| 3 | 描邊色三套慣例並存 | 暗黑→淡白 50、四種近黑色號、暗淡皆白 30、反向 15 |
| 4 | 線寬離群 | z14 `osmExpressway` 4.5、`speedZoneSegment` 4；細端 `policeIso*` 0.15、房價網格格線 0.3 |
| 5 | 線透明度離群 | `policeIso*` 0.04、`nonUrbanZoning` 0.21、`ports` 0.25、`osmPowerLines` 海纜 0.28 |
| 6 | 面透明度兩極 | 企業網格 0.85、`buildingsGba`／`jpBuildingHeight` 0.75 vs 大量 0.15–0.25 |
| 7 | 暗淡切換時改尺寸 | 11 層改線寬、10 層改面透明度、11 層改點透明度（尺寸與透明度通常不該隨底圖變） |
| 8 | 統計外框 | 用色階最深色 0.8px，與 viz-library M4「區域間 1px 底圖色細縫」不同 |
| 9 | 圖例與地圖色不同 | 醫療 5 層：圖例用 `LAYER_COLORS`（如 `#d32f2f`），地圖用較亮色（`#e53935`）且暗淡不同 |
| 10 | 類別色卻無圖例 | `waterLevees`（`categoricalWithoutLegend`） |

完整離群清單在 JSON `stats.outliers`（規則：> 2×中位或 < 0.5×中位，只計主體子圖層）。

---

## 3. 建議規格（提案，待使用者逐項拍板）

> 每條有代號（對應 §7）。數值以「現況中位值」為錨，並對齊已拍板的 viz-library 與 `layer-onboarding` skill 的 UX baseline；兩者衝突時列成選項，不默選。

### 3.1 點

**P-1 尺寸三階**（半徑 px，`interpolate linear zoom`，再乘大小滑桿）

| 階 | z6 | z10 | z14 | 用途 |
|---|---|---|---|---|
| 小 S | 1.5 | 2.5 | 4 | 密集點（>10k）、參考點（消防栓、公車站、行道樹） |
| **標準 M** | 2.5 | 4 | 6 | 一般 POI（預設） |
| 強調 L | 4 | 6 | 9 | 少量重點設施（≤ 50 點）、即時事件 |

理由：M 的 z10 4／z14 6 貼近現況中位 4.75／6；S、L 約 ×0.65、×1.5。與 viz-library M1（S 3／M 4.5／L 6.5，固定不隨縮放）差在**本站需要隨縮放**；另一選項是直接用 M1 的值當 z12 錨點。與 onboarding 表（<1k：z6 4／z12 8）相比，本案 z12 的 M ≈ 5，較小——onboarding 表是舊值，拍板後請同步更新該表。
資料驅動大小（泡泡）不受三階限制，照 viz-library M3：面積 ∝ 值、rMin 4、rMax 28。

**P-2 描邊**

| 底圖 | 色 | 寬（z10／z14） | 透明度 |
|---|---|---|---|
| 暗 | `#0a0a14`（深色細框） | 0.6／1 | 0.8 |
| 淡 | `#ffffff`（白框） | 0.6／1 | 0.9 |

理由：現況中位寬 1、多數已是「暗黑淡白」；色號收斂成 viz-library M1 的 `#0a0a14`／`#ffffff`，取代 `#000000`、`#0f172a`、`#0d1117`、`#0b1118` 四種。暗色底圖用白描邊的 47 層改為深色（白框在暗底會把點放大、搶視覺）；若某層白框有語意（例：即時事件），需在 §7 逐層例外登記。

**P-3 不透明度**：主體點 0.85（現況中位）；密集 1k–10k 0.8、10k–100k 0.75、>100k 0.6（沿 onboarding 表）。裝飾子圖層見 P-6。

**P-4 密集點處理門檻**

| 點數（全台） | 做法 |
|---|---|
| < 10k | 直接畫 circle |
| 10k–100k | z < 10 用聚合（cluster）或熱區，z ≥ 10 畫點 |
| > 100k | 必須聚合／熱區或 PMTiles 低 zoom 抽稀；z ≥ 12 才畫單點 |

**P-5 icon 與 circle 的選用**：預設 circle。只有「形狀本身帶語意且 circle 分不出」時才用 icon（例：變電所菱形、方向箭頭），且 ≤ 5k 點；icon 在 z14 的顯示尺寸對齊 M 階直徑 12px（`icon-size` = 12 ÷ sprite 原圖邊長）。icon 也必須有對應的圖例圖示。

**P-6 選取與裝飾**：選取狀態**只用** R2 選取圈（`design-system.md` §5.4，`src/map/selectionRing.ts`；`useSelectedFeatureHalo` 已是它的別名），圖層不自己畫選取高亮。光暈／漣漪等裝飾子圖層：半徑 ≤ 主體 ×2、不透明度 ≤ 0.35、`circle-blur` ≥ 0.6，只給即時或進行中資料（呼應 viz-library M8：同時 ≤ 20 個脈衝）。

### 3.2 線

**L-1 線寬三階**（px，`interpolate linear zoom`，再乘線寬滑桿）

| 階 | z6 | z10 | z14 | 用途 |
|---|---|---|---|---|
| 細 | 0.3 | 0.5 | 1 | 網格線、次要參考線、行政區內界 |
| **標準** | 0.6 | 1 | 2 | 一般路線、管線、河川 |
| 強調 | 1 | 2 | 3.5 | 主要路網、焦點路線、縣市界 |

理由：現況中位 z10 0.93／z14 1.0、P75 1.8；本案標準 z14 提到 2，讓 z14 的線與 6px 點視覺重量相當。viz-library L1（1.5／2.5／4）是分析結果在固定尺度的值，對應本案 z12 附近的標準～強調。onboarding 表（主要路網 z6 1／z14 3）與本案強調接近。

**L-2 虛線只用在四種語意**：規劃中／施工中、非實體或推估（海纜、推估路線）、法定界線（海域）、網格外框。值收斂成兩種：`[2,2]`（一般）、`[4,3]`（界線）；`[2,1]` 改 `[2,2]`。實線不得用來表示「不確定」。

**L-3 端點與接合**：路網、軌跡、河川、管線 `line-cap: round`、`line-join: round`；界線與網格 `butt`／`miter`（保持銳角）。

**L-4 透明度**：標準 0.85、參考線 0.6、網格線 0.4；不低於 0.3（現況 `policeIso*` 0.04 在淡底圖幾乎看不到）。

**L-5 道路類與邊界類**

| 類 | 顏色 | 寬 | 暗／淡 |
|---|---|---|---|
| 道路／路網 | 依道路等級類別色 | 等級對應 L-1 細／標準／強調 | 色可切換，寬不變 |
| 行政界 | 中性灰：暗 `#9ca3af`、淡 `#374151`（現況 `countyBoundary`） | 縣市 強調、鄉鎮 標準、村里 細 | 只換色 |
| 法定／海域界 | 類別色＋虛線 `[4,3]` | 標準 | 只換色 |

**L-6 外框（casing）**：只給「強調」線且底圖複雜時用，外框 = 線寬 + 1.5px、底圖色（暗 `#0a0a14`、淡 `#ffffff`），對齊 viz-library L1。

### 3.3 面

**F-1 面透明度三階**

| 階 | fill-opacity | 用途 | 依據 |
|---|---|---|---|
| 統計分級面 | **0.55** | 行政區統計、分級 choropleth | 統計 renderer 現值；onboarding「熱區／密度」0.55 |
| 覆蓋範圍面 | **0.35** | 等時圈、服務範圍、分區、保護區 | onboarding 0.35；現況中位 0.37 |
| 背景參考面 | **0.15** | 行政區、底層分區、只為提示範圍 | onboarding 0.15 |
| 網格 | 0.7 | 規則網格（格小、需讀值） | 現況 0.7–0.85 |

企業網格 0.85、建物 0.75 調到 0.7（網格）或 0.55（分級）。

**F-2 外框**

| 面類型 | 外框 |
|---|---|
| 統計分級面 | 1px 底圖色細縫（暗 `#0a0a14` 0.6、淡 `#ffffff` 0.8），對齊 viz-library M4；取代現行「色階最深色 0.8px」 |
| 覆蓋範圍面 | 1px、與面同色、0.8 |
| 背景參考面 | 0.5px 中性灰，同 L-5 行政界色 |
| 網格 | 無外框，或 0.5px 底圖色格縫（viz-library M6「格間 1px 縫」在 z14 以下降為 0.5） |

一律用獨立 line 子圖層畫外框，不用 `fill-outline-color`（固定 1px、無法隨縮放；現況 7 處）。

**F-3 分級色階**：不自創。統計圖層照 `statistics-layer-guidelines.md` §4（各主題 ColorBrewer 序列色、正負用 PuOr、門檻不隨當次資料重算、至少 `breaks + 1` 色）；Agent 分析結果照 viz-library §1（viridis／magma、暗淡方向相反、5 級）。缺值：統計現行灰色 `#64748b`＋遮蔽斜線，viz-library N1 是「透明底＋45° 細斜線」——兩套是否統一列 §7。

**F-4 fill-extrusion**：高度與顏色用同一指標（viz-library M7），最高約畫面 1/4；開啟時不透明度 0.85、`fill-extrusion-vertical-gradient: true`；高度倍率由滑桿控制，預設 1。

### 3.4 3D／熱區／網格／影像

- **G-1 Three.js／CustomLayer**：不進本檔數值階（值在 shader／材質）。要求：透明度參數、圖例、popup 照四鐵則；新元件照 `three-3d-component` skill 的 checklist。13 層 `unresolved` 在 JSON 有檔案指標，逐層調整時人工讀值後補記到該層 `docs/features/<slug>/`。
- **G-2 熱區**：magma（截）色階、密度 0 完全透明、`heatmap-radius` z10 12／z14 20、`heatmap-opacity` 0.8；z ≥ 12 切回點（與 P-4 門檻一致）。對齊 viz-library M5。
- **G-3 網格**：面 0.7、空格不畫、格縫同 F-2；H3 解析度與方格尺寸照 viz-library M6。
- **G-4 影像**：預設 0.7、滑桿 0.3–1.0（onboarding）；量測值影像（熱島、樹冠高）`raster-resampling: nearest`，照片／雲圖 `linear`；`raster-fade-duration: 0` 給時間序列影像（避免換幀閃爍）。

### 3.5 文字標籤

- **T-1 字型**：地圖標籤只能用 Mapbox glyph 字型（`text-font`），**不受** `design-system.md` §4 的系統字規則約束；維持 `["DIN Pro Medium","Arial Unicode MS Regular"]`，強調用 Bold。提案加設 `localIdeographFontFamily: "PingFang TC","Microsoft JhengHei","Noto Sans CJK TC",sans-serif`（與 `--font-cjk` 同 stack），讓中文字形改用系統字：與 UI 同字、少下載 glyph。需改 `MapView.tsx` 初始化，屬程式改動，拍板後另做。
- **T-2 字級與 halo**：POI 名稱 z10 10／z14 12；計數徽章 11／13 Bold；halo 1.25px、底圖色（暗 `rgba(15,23,42,0.92)`、淡 `rgba(255,255,255,0.94)`，現況已如此）。viz-library N2（分析標籤 10px 粗體＋3px halo）只用於分析結果。
- **T-3 密度**：標籤 z ≥ 13 才出現、`text-allow-overlap: false`；計數徽章可 overlap。

### 3.6 暗／淡底圖差異規則（K-4）

| 隨底圖切換 | 不切換 |
|---|---|
| 點描邊色（P-2）、線外框色（L-6）、行政界線色（L-5）、文字色與 halo（T-2）、序列色階方向（viz-library：暗底越亮越多、淡底越深越多）、類別色的淡色版（viz-library C2） | 半徑、線寬、面透明度、點透明度、虛線、高度 |

現況有 11 層改線寬、10 層改面透明度、11 層改點透明度（去重共 23 層），拍板後逐層改成只換色（若淡底圖真的需要更不透明，應整體調 F-1 的值，而不是單層例外）。

### 3.7 顏色

- **K-1 `LAYER_COLORS` 的角色**：圖層的**識別色**（側欄 icon、單色圖層的預設 paint 色、圖例標題色塊）。單色圖層的 paint 主色必須等於 `LAYER_COLORS`（現況 10 層不一致）；類別或序列圖層的 paint 用自己的色票，`LAYER_COLORS` 只當識別，不要求出現在 paint。
- **K-2 類別色與序列色分工**：類別（不同種類）用類別色，≤ 7 類＋「其他」（viz-library C2）；數量、密度、比率用序列色（淺→深＝低→高）；正負用雙向色。不用彩虹色，不以紅／綠暗示好壞（`statistics-layer-guidelines.md` §4）。
- **K-3 語意色不可挪用**：`design-system.md` §3.5 STATUS（即時綠、警告橘、錯誤紅）與 §3.15 災害語意色只給狀態與警報；資料類別不得用這幾個色號表達一般分類。紅色保留給警報，一律搭配圖示或文字。

---

## 4. 圖例（legend）規格

### 4.1 現況

| 項目 | 現況 |
|---|---|
| 面板 | 右下 200px、收合預設、Agent 分析結果自動展開並排最上（`LegendPanel.tsx:674–770`） |
| 字級 | 9px（`FONT_SIZE.xs`，222 個 SSR 圖例都有）、10px（`FONT_SIZE.sm`，20 個） |
| 字型 | **面板容器 `fontFamily: FONT_DATA`（`LegendPanel.tsx:728`）**，只有標題鈕是 `FONT_CJK`——中文標籤繼承到等寬字，違反 `design-system.md` §4.1 規則 1 |
| 色票尺寸 | 29 種：`10×10` 圓 107、`10×10` 方 37、`9×9` 圓 31、`8×8` 方 14、`8×8` 圓 11、`14×10` 9、`12×12` 圓 5… |
| 淡色 | 子圖例用 `LIGHT_LEGEND` 手刻色（§10.3 已列）；**`StatisticsLegend` 直接用 `COLORS.textDefault`（`StatisticsDetails.tsx:375`），淡色底圖時仍是暗色主題的淺字**，320 個統計圖例都受影響 |
| 標題語言 | 37 個子圖例標題是「英文大寫＋中文」（如 `MEDICAL 醫療據點`、`RELIGION 宗教`），與 §6.1「中文優先」不符 |

圖例型別（`summary.legendTypes`）：

| 型別（腳本分類） | 數量 | 代表 |
|---|---|---|
| 方塊色階列＋遮蔽斜線 | 321（統計 320＋1） | `StatisticsLegend`（斜線僅 agri／social recipe 顯示） |
| 圓點類別 | 118 | `religionTemples`、`tourAttractions` |
| 方塊類別 | 47 | `aviationNoiseZones`、`ecoNetworkZones` |
| 漸層 | 18 | `urbanHeat`、`realEstateRentalGrid`、`windField` |
| 圓點＋方塊 | 17 | `schools`、`funeralFacilities` |
| 線型 | 6 | `osmPowerLines`、`waterCanals`、`roadCongestion`、`freewayCongestion` |
| 大小＋圓點 | 5 | `powerPlants`、`performingVenues`、`commonRegistrationAddresses`、`osmSubstations`、`globalEvents` |
| 圓點＋虛線 | 2 | `maritimeBoundary`、`typhoonTracks` |
| 圓點＋方塊＋線 | 2 | `forestCompartments`、`gasStationCpc` |
| 漸層＋大小＋圓點 | 2 | `earthquakes`、`earthquakesGlobal` |
| 漸層＋圓點／漸層＋方塊 | 各 1 | `riverLevel`／`officialNoiseMonitoring` |
| 大小＋圓點＋方塊＋線 | 1 | `policeStation` |
| 純文字說明 | 3 | `aqiImagery`、`gfwFishingEffort`、`jpWaterFloodHazard`（色階來自 runtime 資料，SSR 取不到） |

沒有雙變量圖例（viz-library V3 已決定不用 3×3 bivariate）。

### 4.2 各型規格（提案）

共通結構：**標題列 → 內容列 → 註記 → 來源（可選）**。

| 元素 | 規格 |
|---|---|
| 標題 | 中文、`FONT_SIZE.sm` 10px、`FONT_WEIGHT` 600、`textStrong`；英文代碼不放標題（§6.1），需要時放註記 |
| 列標籤 | 9px `FONT_CJK`、`textMuted`；數字與單位用 `FONT_DATA`＋tabular-nums |
| 註記（方法、缺值、來源） | 9px、`textDim` |
| 組間距 | 10px；列間距 2–4px；色票與文字間 6px |
| 數值格式 | viz-library N1（≥1 萬寫「1.2 萬」、千分位、百分比 1 位、必寫單位、缺值寫「無資料」） |

| 型 | 色票 | 對應圖層 |
|---|---|---|
| **LG-1 點類別** | 10×10 圓，1px 描邊同 P-2（暗 `#0a0a14`、淡 `#ffffff`） | circle 類別色；色號與 paint 同一常數 |
| **LG-2 面類別** | 12×10 方、圓角 2、外框同 F-2 | fill 類別色 |
| **LG-3 序列分級** | 等寬方塊列（每級 1 格，高 8），下方標實際分界數字；或連續漸層條高 8、滿寬 | 同一組 breaks／colors（統計走 `statisticsLegendRows`，同源） |
| **LG-4 線型** | 20×線寬（最少 2px）的線段；虛線用同一 dasharray | line；線寬用 L-1 的 z14 值等比縮小 |
| **LG-5 大小** | 3 個圓（小／中／大），直徑 = 地圖 z14 實際直徑，標值 | 資料驅動半徑（M3） |
| **LG-6 icon** | 與地圖同一 sprite 圖示 14px | symbol icon |
| **LG-7 缺值／遮蔽** | 16×12 斜線，同地圖 pattern | 統計 suppressed、N1 缺值 |
| **LG-8 熱區／影像漸層** | 漸層條＋兩端「低／高」＋單位 | heatmap、raster |

**暗／淡**：色票色必須用**與地圖同一邊**的 hex（`LegendContext.isDark` 已提供）；文字色一律走 `useLegendTheme()`，不直接用 `COLORS.*`。

**常駐與收合**（LG-9）：
- 必須有圖例：顏色或大小有編碼資料的圖層（類別 ≥ 2、序列、大小）；單色圖層可省略（標題色塊即可），但要在 manifest 以 `legend: null` 登記理由（`layerConsistency` ledger）。
- 面板可整體收合（使用者控制），預設收合維持；分析結果出現時自動展開一次（現行為）。
- popup 開啟時圖例轉精簡版：只留標題＋色階（viz-library G1／G2，現只套用在分析結果；提案擴及一般圖層）。
- 圖例內的註記與來源可收合；色階、分界數字、單位不可收合。

### 4.3 與圖層樣式不一致的圖例（28 個）

來源：`legends[].issues`。分四類；「另有 hook 可能覆寫 paint」的需人工在瀏覽器確認哪一邊是實際畫面。

| 類 | 圖例 id |
|---|---|
| 形狀不符：面圖層用圓點 | `buildingsGba`、`propertyValueGrid`、`urbanFormGrid` |
| 形狀不符：點圖層用方塊 | `fireHydrants`、`govServiceOffices`、`noiseEnforcementEvents`、`soundCameraLocations` |
| 形狀不符：線圖層用點／方塊 | `osmBridgeCarriers`、`osmRoadDrive` |
| 色票不在圖層 paint（確定） | `medHospital`（醫療 5 色全不同）、`officialNoiseMonitoring`（2/9）、`propertyValueGrid`（缺值灰 1/10） |
| 色票不在 registry paint（hook 可能覆寫，待確認） | `facPrimary`（9/11）、`gasStationCpc`（11/14）、`livestockFarmPig`（全部）、`parkingOnstreet`（1/6）、`pollutionPenaltyCritical`（3/11）、`powerPlants`（9/10） |
| 地圖主色暗淡不同、圖例只有一套 | `companyCapitalGrid`、`ecoNetworkZones`、`forestCompartments`、`industrialParkBoundaries`、`industrialParkComparison`、`jpAccommodationDensity`、`medHospital`、`newsEvents`、`ooklaPerformanceGrid`、`realEstateRentalGrid`、`schools`、`waterCanals` |

另：統計 320 個圖例淡色時文字色錯（§4.1）；37 個英文大寫標題；面板容器等寬字。

---

## 5. 組合範例

| 組合 | 地圖建議值 | 圖例 | 現有代表圖層（現況） |
|---|---|---|---|
| 點＋類別色 | M 階 4／6、描邊 P-2、0.85 | LG-1 圓點列 | `religionTemples`（4.5／5.5、描邊 0.8 暗黑淡白、0.8，9 類） |
| 點＋單色（識別色） | M 階、主色＝`LAYER_COLORS` | 可省略或 LG-1 單列 | `playgrounds`（5.1／6、描邊 1.2、0.85） |
| 點大小＋大小圖例 | M3 泡泡 rMin 4／rMax 28、0.75 | LG-5 三圓 | `performingVenues`（3–14、描邊 1、0.85） |
| 密集點 | S 階 2.5／4、0.75、z<10 聚合 | LG-1 | `fireHydrants`（0.8／1.6，過小） |
| 線＋類別色 | 標準 1／2、0.85、round | LG-4 線段 | `osmPowerLines`（0.35–2.1、0.24–0.56、海纜虛線 `[2,2]`） |
| 行政界線 | 強調／標準／細、中性灰暗淡切換 | 不需 | `countyBoundary`（1.9／2.4、0.85、round） |
| 面＋序列色階（統計） | 0.55、1px 底圖色縫 | LG-3 方塊列＋分界數字＋LG-7 | 統計 320 層（0.55、外框最深色 0.8px） |
| 面＋類別色（分區） | 0.35、1px 同色外框 | LG-2 方塊 | `aviationNoiseZones`（0.18、外框 0.88／1.57） |
| 背景參考面 | 0.15、0.5px 灰 | 不需 | `nonUrbanZoning`（線 0.21） |
| 網格＋序列色 | 0.7、空格不畫、0.5px 縫 | LG-3 漸層或方塊 | `realEstateRentalGrid`（0.7、格線 0.3 暗白淡黑） |
| 3D 擠出 | 0.85、高度＝顏色指標 | LG-3＋高度說明 | `buildingsGba`（面 0.75，extrusion 預設關） |
| 熱區 | magma、0.8、radius 12／20 | LG-8 漸層 | `powerPoles`（hook 設定，非字面） |
| 影像 | 0.7、nearest | LG-8 漸層 | `urbanHeat`（0.75、9 色 diverging） |
| 文字標籤 | 10／12、halo 1.25 底圖色 | 不需 | `playgrounds` label（10／11.5、1.25） |

---

## 6. 調整工作流

逐層調整時的 checklist（一次一層或一個家族，一個 PR 可含多層）：

1. **查現況**：`layers.<key>` 的 `evidence`、`sublayers`、`params`、`legend` issues。
2. **改 paint**：照 §1.2 改 `overlayRegistry.ts`／hook／factory；數值套 §3 已拍板的階（寫成共用常數，不散落字面值——拍板後可新增 `src/map/mapStyleScale.ts` 之類的單一來源）。
3. **改控制項**：預設值、範圍改 `layerParamsSpec.ts`；透明度滑桿必須影響全部主體子圖層（四鐵則 1）。
4. **同步圖例**：色票用同一個常數、同一邊（暗／淡）、同一 breaks；形狀照 §4.2 對應表；文字走 `useLegendTheme()`。
5. **截圖比對**：All Off → 單開 → 暗／淡 × z10／z14 四張；改前改後並排存到 `docs/features/<slug>/`（或 PR 描述）。
6. **重跑盤點**：`npm run design:audit-layers`，確認 JSON diff 只動目標層、`legends[].issues` 減少。
7. **黃金快照**：`overlayRegistry` 改動會讓 `layerGoldenSnapshot.test.ts` 紅，確認 diff 後重產 fixture（`npx vite-node scripts/preprocess/dump-layer-golden.ts`）。
8. **guard**：若拍板的規則可機械檢查（例：`fill-outline-color` 禁用、描邊色只能是兩個值、暗淡不得改寬度），在 `layerUxPolicy.test.ts` 加 ratchet（現況違規列 backlog，只減不增），不要一次改完全部。
9. **更新本檔**：§2 數字以重跑結果為準；§7 拍板狀態改「✅ 已拍板（日期）」。

---

## 7. 待拍板清單

回覆格式建議：`P-1 A`、`L-4 同意`、`F-2 改 0.8px` 等。

| 代號 | 題目 | 提案 | 選項／備註 |
|---|---|---|---|
| **P-1** | 點尺寸三階 | S 2.5／4、M 4／6、L 6／9（z10／z14），z6 另有錨點 | A：本案（隨縮放）／B：viz-library M1 固定 3／4.5／6.5 |
| **P-2** | 點描邊 | 暗 `#0a0a14`、淡 `#ffffff`，寬 0.6／1，透明度 0.8／0.9 | 暗底白框的 47 層是否全改深色 |
| **P-3** | 點不透明度 | 主體 0.85；依密度 0.8／0.75／0.6 | |
| **P-4** | 密集點門檻 | <10k 直接畫；10k–100k z<10 聚合或熱區；>100k 必須 | |
| **P-5** | icon 使用條件 | 形狀有語意且 ≤5k 點；z14 顯示 12px | |
| **P-6** | 選取與裝飾 | 選取只用 R2；裝飾 ≤2× 半徑、≤0.35、只給即時資料 | 現有 92 層裝飾是否逐層檢視 |
| **L-1** | 線寬三階 | 細 0.5／1、標準 1／2、強調 2／3.5（z10／z14） | 標準 z14 由現況 1.0 提到 2 |
| **L-2** | 虛線語意與值 | 四種語意；`[2,2]`、`[4,3]` 兩種 | `[2,1]` 併入 `[2,2]` |
| **L-3** | 端點接合 | 路網類 round／round；界線 butt／miter | |
| **L-4** | 線透明度 | 標準 0.85、參考 0.6、網格 0.4、下限 0.3 | |
| **L-5** | 道路 vs 邊界 | 邊界中性灰暗 `#9ca3af`／淡 `#374151`、寬依層級 | |
| **L-6** | 線外框 | 只給強調線，+1.5px 底圖色 | |
| **F-1** | 面透明度三階 | 分級 0.55、覆蓋 0.35、背景 0.15、網格 0.7 | |
| **F-2** | 面外框 | 分級面 1px 底圖色縫（改統計 renderer）；覆蓋同色 1px；背景 0.5px 灰；禁用 `fill-outline-color` | 統計外框改動影響 320 層 |
| **F-3** | 缺值表示 | 統計現行灰 `#64748b`＋斜線 vs viz-library N1 透明底＋斜線 | A：統一成 N1／B：統計維持現行 |
| **F-4** | 3D 擠出 | 開啟時 0.85、vertical-gradient、高度＝顏色指標 | |
| **G-1** | Three.js 圖層 | 不進數值階；四鐵則照舊；讀值後補記 | |
| **G-2** | 熱區 | magma、0.8、radius 12／20、z≥12 切回點 | |
| **G-3** | 網格 | 0.7、空格不畫、0.5px 縫 | |
| **G-4** | 影像 | 0.7、量測值 nearest、時間序列 fade 0 | |
| **T-1** | 地圖字型 | 維持 DIN Pro＋Arial Unicode MS；加 `localIdeographFontFamily` 用系統中文字 | 需改 `MapView.tsx`（程式改動） |
| **T-2** | 標籤字級與 halo | POI 10／12、徽章 11／13、halo 1.25 底圖色 | |
| **T-3** | 標籤密度 | z≥13、不重疊 | |
| **K-1** | `LAYER_COLORS` 角色 | 識別色；單色層 paint 必須相同（修 10 層） | 醫療 5 層以哪一邊為準 |
| **K-2** | 類別／序列分工 | ≤7 類＋其他；序列淺→深；不用彩虹 | 引用現有規則，確認適用全部圖層 |
| **K-3** | 語意色保留 | STATUS／災害色不得當一般類別色 | 是否加 guard |
| **K-4** | 暗／淡切換範圍（§3.6） | 只換色，不換尺寸與透明度 | 23 層需改 |
| **LG-1–LG-8** | 各型圖例規格 | §4.2 表 | 可整批拍板 |
| **LG-9** | 常駐與收合 | §4.2；popup 開啟時一般圖層也轉精簡 | 精簡版擴及一般圖層是新行為 |
| **LG-10** | 圖例字型 | 面板容器改 `FONT_CJK`，數字節點才 `FONT_DATA` | 屬 §4.1 既有規則的修正 |
| **LG-11** | 圖例標題 | 移除英文大寫前綴（37 個） | |
| **LG-12** | 統計圖例淡色 | `StatisticsLegend` 改用圖例主題色 | 320 層 |
| **LG-13** | 28 個不一致圖例 | 逐一修正（§4.3） | 「hook 可能覆寫」6 個先人工確認 |

共 **40** 個代號（P 6、L 6、F 4、G 4、T 3、K 4、LG 13；其中 LG-1–LG-8 可合成一題回覆）。

---

## 8. 盤點方法與限制

- **腳本**：`scripts/design/audit-layer-styles.ts`（`npm run design:audit-layers`，vite-node）。只讀程式碼與 runtime 常數，不讀 `.env`、不連網。輸出排序穩定，重跑結果逐位元相同。
- **runtime**：沿用 `layerGoldenExtract.extractGolden()`（與黃金快照同一把尺），paint／layout 以「暗／淡 × 預設 overlayParams」求值。zoom 插值以自寫求值器算 z10、z14；依屬性變化的值記 `{min,max}`，分佈用中點。
- **shared-renderer**：統計 320 層由 `regionalStatisticsMap.ts` 一支畫，數值記在 `stats.statisticsProfile`，各層只記色階級數。
- **static-scan**：從 `LAYER_HOOK_REGISTRY` 找 hook 檔（找不到時從 MapView／App／Host 的呼叫點反查，只收函式名含圖層字根的呼叫），掃描該檔與其 `../map`、`../three` 匯入檔的 paint 字面值。**是 hook 層級**：`useEnergyPoiLayer` 一支服務 20 層，值可能屬於兄弟層（`siblings` 已列），所以不進統計分佈；geometry 也可能混入兄弟層（例：`useJpWaterLayers` 讓 13 層都帶 raster）。
- **unresolved**：Three.js／WebGL 的值在 shader 與材質、表達式非字面、或沒有渲染實作，**不猜值**。
- **圖例**：`renderToStaticMarkup` 實際渲染每個 `LEGEND_REGISTRY` entry（暗／淡各一次）後分類；用 `useSyncExternalStore` 的圖例（統計、GFW、日本高度）在 SSR 取不到，退回原始碼啟發式（`resolution: static`）。色票比對容差 RGB 各通道 ±6；hook 在 runtime 用 `setPaintProperty` 覆寫的顏色，靜態比對會誤報，已標「需人工確認」。
- **四鐵則**：`opacity`／`pointSize` 與 `layerUxPolicy.test.ts` 的判定相同；`legend`／`popup` 看 manifest 是否為 `null`；select 規則由 `LayerParamControls` 自動處理，不逐層記。
- 本盤點**沒有**截圖逐層目視；所有「看起來太小／太淡」的判斷都以數值離群為準，拍板前請以 §1.3 驗收步驟實看。
