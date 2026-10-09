# 地圖圖層規格套用計畫

> 依據：[`docs/design-system/map-layers.md`](../../design-system/map-layers.md) §3／§4（2026-09-28 拍板版）與 §7 拍板結果。
> 盤點資料：`docs/design-system/layer-style-inventory.json`（`npm run design:audit-layers` 重產）。
> 狀態：2026-09-30 R1（#391）、R2（#392、#393、#396、#398、#401）、R3a（#461）、R4（#465，加油站品牌色 #468）完成；R3b 按確認版完成本地實作，待 Claude 驗收（`R3b-report.md`）。規格以 [`docs/design-system/map-layers.md`](../../design-system/map-layers.md) 為準。

## 範圍（盤點數字）

| 項目 | 數量 | 所在 |
|---|---|---|
| runtime 點圖層（circle 主體） | 192 層 | `src/map/overlayRegistry.ts`（`"circle-radius"` 245 處，其中 15 處共用 `BASE_RADIUS`） |
| runtime 線圖層 | 93 層 | 同上 |
| runtime 面圖層 | 78 層 | 同上 |
| 裝飾子圖層（光暈、漣漪） | 92 層、115 個（circle 89、line 26） | 同上 |
| hook 自行畫的圖層（static-scan） | 159 層 | `src/hooks/*`、`src/map/*Factory.ts`（51 個檔含 `circle-radius`） |
| 統計圖層 | 320 層（共用一支） | `src/map/regionalStatisticsMap.ts` |
| 換底圖時改尺寸或透明度 | 28 層 | K-4 |
| 用 `fill-outline-color` | 7 層 | `countyBoundary`、`townshipBoundary`、`villageBoundary`、`facOffshore`、`jpBuildingHeight`、`offshoreWindZones`、`parkingOnstreet` |
| 圖例 | 544 個；與圖層不一致 28 個；英文大寫標題 37 個 | `src/components/LegendPanel.tsx`（6,853 行）、`StatisticsDetails.tsx` |
| 讀不到值（Three.js／App 掛載） | 30 層 | 見 R6 |

## 共同做法（每一輪都適用）

- **單一來源**：R1 新增 `src/map/mapStyleScale.ts`，放全部拍板數值與產生 paint 的小函式；之後各層只呼叫它，不再散寫數字。
- **一輪一個 PR**，都從最新 master 開，前一個 merge 後才開下一個（R2～R4 都會大改 `overlayRegistry.ts`，並行必衝突）。
- **每輪驗收**：`npx tsc -b`、`npm test`；重產黃金快照（`npx vite-node scripts/preprocess/dump-layer-golden.ts`）並確認差異都是有意的；重跑 `npm run design:audit-layers`，JSON 差異只落在本輪範圍；在 3734 用 All Off 單開，暗／淡 × z10／z14 截圖。
- **merge 前給你看**：每輪做一頁改前／改後對照（同拍板比較頁的真實底圖格式），你看過再 merge。
- **guard**：規則能機械檢查的，就在 `layerUxPolicy.test.ts` 加 ratchet（現有違規列 backlog，只減不增），隨各輪收緊。
- 不改資料來源、不改圖層開關與 popup 內容；只改畫法、圖例與控制項預設值。

## R1 基礎：共用數值、統計圖層、圖例面板、地圖字型

> **狀態（2026-09-28）**：完成，PR 見下方「R1 實際結果」。


| 代號 | 改什麼 | 檔案 |
|---|---|---|
| — | 新增 `mapStyleScale.ts`：`POINT_RADIUS` S 3／M 4.5／L 6.5、點描邊（暗 `#0a0a14` 0.8／淡 `#ffffff` 0.9、1px）、點密度透明度 0.85／0.8／0.75／0.6、線寬三階（z10／z14 插值）、線透明度 0.85／0.6／0.4（下限 0.3）、面透明度 0.55／0.35／0.15／0.7、虛線 `[2,2]`／`[4,3]`、熱區參數、標籤字級與 halo | 新檔 |
| F-2 | 統計外框改成 1px 底圖色細縫（暗 `#0a0a14` 0.6／淡 `#ffffff` 0.8），外框透明度不再綁滑桿 | `regionalStatisticsMap.ts:37,51,57` |
| F-3 A | 統計缺值改成透明底＋細斜線（取代灰 `#64748b`＋斜線） | `regionalStatisticsMap.ts:22,47,50,56` |
| LG-12 | `StatisticsLegend` 文字改用圖例主題色 | `StatisticsDetails.tsx:375` 一帶 |
| LG-1–8 | 抽出共用色票元件（點、方、線段、分級列、大小三圓、icon、斜線、漸層），統一尺寸與間距 | `LegendPanel.tsx` |
| LG-10 | 面板容器改 `FONT_CJK`，只有數字用 `FONT_DATA` | `LegendPanel.tsx:728` |
| LG-11 | 37 個標題改成「中文＋英文小字」（同側欄 `splitThemeTitle()`，不轉大寫） | `LegendPanel.tsx` |
| LG-9 | popup 開啟時一般圖層圖例也轉精簡版（目前只有分析結果） | `LegendPanel.tsx:674–770` |
| T-1 | 地圖初始化加 `localIdeographFontFamily`（與 `--font-cjk` 同一組字） | `MapView.tsx:253`、`bbox/BboxSelectorApp.tsx:159` |

影響：320 個統計圖層與全部圖例的外觀一次改變。風險：`LegendPanel.tsx` 很大，只抽共用元件、不改各圖例的資料邏輯。

### R1 實際結果

- **F-2 修正**：淡色底圖上，缺值（透明底）的鄉鎮只有白色細縫，界線看不見；改為「有數值用底圖色細縫、沒數值用行政界中性灰 0.5」（`gradedSeamPaint(isDark, hasValue)`）。
- **F-3 語意**：缺值與遮蔽改完會長得一樣，所以遮蔽改用**交叉斜線**、缺值用單向細斜線（2026-09-28 使用者確認）；`statistics-layer-guidelines.md` §2 已同步。
- **LG-11**：實際轉換 **163** 個標題（原盤點寫 37，只算了英文在前的；另有 82 個「中文＋英文大寫」、17 個含程式變數）。純英文標題（例：`SOIL FERTILITY`、`PLA ACTIVITY`）補上中文；類別前綴（`ENERGY ·`、`HAZARD ·`、`MOVE ·`）拿掉；錯字 `PUMB` 改 `Pump`。
- **LG-1–8**：新增 `src/components/legend/legendKit.tsx`；共用 helper（`FireCatRows`、`UrbanDotRow`、`Swatch`、`Noise*`、`ClimateGradientBar`）已改用 kit。其餘圖例內**手寫色票尺寸 90 處**未逐一改，用 ratchet 測試（`legendKit.test.ts`）只准減少，之後逐層調整時順手換。
- **LG-9**：`LegendPanel` 接 `compact`，停靠 popup 開著時 `LegendNote` 收起。**只有用 `LegendNote` 的註記會收**；多數圖例的註記仍是手寫 div，逐層改時換成 `LegendNote` 才會生效。
- **LG-10**：面板容器改 `FONT_CJK`；手寫的數字節點未逐一改成 `FONT_DATA`（新圖例用 `LegendNum`）。

## R2 點圖層

> **狀態（2026-09-29）**：全部完成——registry #392（資料編碼描邊誤蓋於 #401 還原）、站點 #393、hook 122 層 #396、後續 #398。

### R2 實際結果（registry）

- **做法**：不逐一改 `overlayRegistry.ts` 的 245 處字面值，改在匯出前集中套用：`src/map/pointTiers.ts`（分階表，使用者「全照建議」）＋`src/map/pointSpec.ts`（`withPointSpec`）。大小滑桿照舊有效：半徑＝階 × 滑桿值 ÷ 滑桿預設。
- **P-1 B**：S 25／M 119／L 10 層固定半徑；泡泡 38 層保留各自的依資料半徑（M3 rMin 4／rMax 28 正規化列為後續，部分泡泡仍隨縮放，例：新聞事件）。`maritimeBoundary` 為登記例外（基準點跟線寬控制）。
- **P-2 A**：主體描邊全部底圖色 1px（暗 `#0a0a14` 0.8／淡 `#ffffff` 0.9，跟透明度滑桿）。
- **P-3**：**延到 R5**。多數圖層在各自 paint 裡算透明度（只有 21 個 config 登記 `opacityParam`），集中改容易讓滑桿失效；且依點數分級需要 R5 才會統計的點數。現況中位已是 0.85。
- **P-5**：變電所菱形改固定大小，等級比例保留：超高壓最大級＝L 13px、一般變電所最大級（PS）＝M 9px。
- **P-6**：115 個裝飾子圖層逐一分類。**即時資料 5 層**（新聞事件、落雷台電／氣象署、核安輻射、A1 即時事故）保留光暈，限制半徑 ≤ 主體 ×2、透明度 ≤ 0.35、blur ≥ 0.6；**其他 86 層**的光暈改透明度 0（子圖層保留，因為 `gisClickRegistry` 用它們當點擊範圍）；`hit` 子圖層不動。能源、工業設施雖是 `dynamicData`，資料是靜態設施，不算即時。
- **修正**：裝飾判斷改成整詞比對（`manufacturing-circle` 原被當成 `ring`，製造業公司登記點位因此沒進分階；已補為 M）；audit 腳本同一條規則。
- **副作用（預期）**：密集層在低縮放變重，例：消防栓 z10 由 0.8px 變 3px。R5 會在 z<10 改熱區。
- **驗證**：黃金快照差異只在 `circle-radius`／`circle-stroke-*`／裝飾 `circle-opacity`／`line-opacity`／變電所 `icon-size`；`pointSpec.test.ts` 驗每層預設半徑、描邊、滑桿、光暈。

| 代號 | 改什麼 |
|---|---|
| P-1 B | 半徑改固定 S／M／L（不隨縮放），乘大小滑桿；依資料大小的泡泡層照 viz-library M3（rMin 4、rMax 28） |
| P-2 A | 描邊統一暗 `#0a0a14`／淡 `#ffffff` 1px；47 層白框全改 |
| P-3 | 主體 0.85；依點數 0.8／0.75／0.6 |
| P-5 | 2 個 icon 層（變電所）顯示尺寸對齊 M 9px（分不清時 L 13px） |
| P-6 | 92 層裝飾逐層檢視：靜態資料的光暈移除；即時資料保留，但限 ≤ 2× 半徑、≤ 0.35、blur ≥ 0.6 |

做法：
1. 先產一張**分階表**（每層預設 S／M／L 與理由：點數、是否即時、現況大小）給你確認，再動程式。
2. 按主題家族分批 commit（醫療、教育、公共生活、交通、能源、產業、環境……），同一個 PR。
3. hook 自己畫的點（static-scan）一併改，不另開輪。
4. guard：描邊色只能是兩個值；點半徑不得寫 `interpolate zoom`（泡泡層除外）。

## R3 線、面、網格、影像、文字

拆兩個 PR（同 R2 的 registry／hook 分法）：
- **R3a（2026-09-30）**：OVERLAY_REGISTRY 畫的線與面——L-1～L-5、F-1、F-2、K-4。分階頁 `r3-tiers.html`（使用者確認照建議，只改 `osmPowerLines/cable` 透明度 0.6 → 0.85）→ `src/map/lineFillTiers.ts`；統一套用 `src/map/lineFillSpec.ts`；測試 `src/map/__tests__/lineFillSpec.test.ts`。
- **R3b（2026-09-30 使用者確認）**：hook 線面、G-4 影像、T-2／T-3 文字、F-4 擠出接線；G-3 的 14 層全部維持。計數徽章不升 minzoom，POI 取 max(現值, 13)。待 Claude 依 `R3b-report.md` 驗收；不要 merge。

原始規劃表：

| 代號 | 改什麼 |
|---|---|
| L-1 | 線寬分細／標準／強調三階（z10／z14 插值） |
| L-2 | 虛線只剩 `[2,2]`、`[4,3]`；`[2,1]` 改 `[2,2]` |
| L-3 | 路網、軌跡、河川、管線改圓頭圓角；界線、網格維持尖角 |
| L-4 | 線透明度 0.85／0.6／0.4，下限 0.3（等時圈 0.04 等會變明顯） |
| L-5 | 行政界中性灰，縣市／鄉鎮／村里 對應 強調／標準／細 |
| F-1 | 面透明度四階（企業網格 0.85、建物 0.75 等調整） |
| F-2 | 覆蓋面 1px 同色外框、背景面 0.5px 灰；7 個 `fill-outline-color` 改成獨立 line 子圖層 |
| F-4 | 3D 擠出開啟時 0.85、`vertical-gradient` |
| G-3 | 14 個網格：0.7、空格不畫、0.5px 底圖色格縫 |
| G-4 | 影像預設 0.7；量測值 `nearest`；時間序列 `raster-fade-duration: 0` |
| T-2／T-3 | 6 個文字子圖層：字級 10／12、徽章 11／13、halo 1.25；z ≥ 13 才出現、不重疊 |
| K-4 | 28 層換底圖時只換色，不再改線寬與透明度 |

guard：禁用 `fill-outline-color`；暗淡分支不得改寬度或透明度。

## R4 圖例對齊與識別色

| 代號 | 改什麼 |
|---|---|
| K-1 B | 10 層單色圖層：`LAYER_COLORS` 改成地圖現色（暗色版）；地圖暗淡不同色時，圖例色票跟著切換（醫療 5 層：暗 `#e53935`／淡 `#c62828`） |
| LG-13 | 28 個不一致圖例逐一修正：形狀不符 9 個、色票不在圖層裡 3 個、暗淡只有一套 12 個 |
| LG-13 | 「hook 可能改掉顏色」6 個（主要設施、中油加油站、養豬場、路邊停車、重大污染裁處、發電廠）**先在 3734 實看**，確認實際畫面後才改 |

圖例色票一律引用與 paint 同一個常數，之後重跑盤點，`legends[].issues` 應歸零（hook 6 個視確認結果）。

## R5 密集點改熱區（含 P-3 依點數的透明度）

| 代號 | 改什麼 |
|---|---|
| P-4／G-2 | 點數 10k–100k 的圖層：z < 10 用熱區、z ≥ 10 畫點；> 100k：熱區或 PMTiles 抽稀，z ≥ 12 才畫單點。熱區 magma、0.8、半徑 z10 12／z14 20、密度 0 透明 |

做法：先統計各層實際點數（盤點 JSON 沒有點數），列出候選清單給你確認（預期包含消防栓、公車站、行道樹、公司登記、電線桿等），再逐層加熱區子圖層。圖例加 LG-8 漸層。

## R6 Three.js 圖層的「基本點線面」模式

| 代號 | 改什麼 |
|---|---|
| G-1 | 每個 Three.js／CustomLayer 圖層加一套 Mapbox 原生畫法（circle／line／fill，套用本規格數值），**預設用 Mapbox**；圖層控制項加一個切換，可改回 Three.js 立體版 |

盤點列出的 Three.js 圖層 14 層（原盤點 13 層漏列 `wfMonitoring`）：房價點 3 層（`realEstateSalePoint`、`realEstatePresalePoint`、`realEstateRentalPoint`）、廢棄物設施 6 層（`wf*`，含 `wfMonitoring`）、`powerPlantGlow`、`substationEhvGlow`、`powerRegionDemand`、`windField`、`oceanCurrents`。每層一個 commit；兩種模式都要符合四鐵則（透明度、圖例、popup）。

**`wfMonitoring` 的雙 host 對齊**：它是 `wasteFacilityCustomLayer` 6 個 3D sub-scene 之一（`useThreeJsLayers.ts`），`App.tsx` 同時為同一個 visibility key 建了 Mapbox circle（見 `layerManifest.ts` wf* 區塊註解，兩套渲染都在）。目前沒有渲染模式開關，兩個 host 同時繪製；R6 實作時須讓兩個 host 依同一個模式值切換（預設只畫 Mapbox circle、切到 Three.js 時才畫 3D scene 並隱藏 circle），不可只改其中一邊。

## 待你確認

1. **R6 範圍**：飛機、船、公車、台鐵這些由 App 掛載的 3D 即時圖層（`flights`、`ships`、`busLive`、`rail` 等）要不要也做「基本點線面」模式？還是只做上面 13 層？
2. **R6 切換放哪裡**：每個圖層的控制項各自一個「立體」開關（建議），還是全站一個總開關？
3. **R2 分階表、R5 熱區候選清單**：做到那一步時會先給你確認，不需要現在決定。
