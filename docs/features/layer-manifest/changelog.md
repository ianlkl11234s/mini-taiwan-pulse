# Layer Manifest — Changelog

## 2026-08-11 — Phase 0：黃金快照護欄

`8abbd97` `test(manifest): Phase 0 黃金快照護欄（348 key × 全登記簿 + 突變自測）`

把搬移前的全部登記資料凍結成 committed fixture。12 個 section：
`colors` `icons` `labels` `gated` `themes` `sidebarSections` `upstream` `legend`
`featureInfo` `gisLayers` `overlays` `params`。348 key，fixture 1.35 MB / 57,589 行。

- 抽取器 `src/data/__tests__/layerGoldenExtract.ts` —— 測試與 dump 腳本**共用同一份**
  （兩邊各寫一份必漂移）
- dump 腳本必須用 `vite-node` 不能用 `tsx`：相依鏈會碰到 `src/lib/supabase.ts` 的
  `import.meta.env`（Vite 專屬），tsx 沒有這個 shim 會直接 TypeError
- 23 條測試：逐 section `toEqual` + 整份 canonical JSON 逐位元 + 決定性 + 覆蓋度 + 突變自測

### 精度

除 `GIS_LAYERS`（函式內區域常數，runtime 取不到 → 原始碼文字解析，沿用
`mapInteractionLayers.test.ts` 已在用的前例）外，全部是 runtime 真值：

- **transportParams 控件**走 `react-dom/server` 的 `renderToStaticMarkup` 實跑 hook
  取預設 state（等價 renderHook）。本專案沒有 `@testing-library/react`，且
  `vitest.config.ts` 的 environment 是 `node` —— 這條路不需要新增任何依賴。
  `ExpandableLayerKey` 是 type-only、runtime 無法迭代 → 改成對 348 key 全掃
  `getControls`（switch default 回 `[]`，安全），另以原始碼的 `case` 清單雙向斷言覆蓋。
- **OVERLAY_REGISTRY 的三種函式型欄位**（`paint` / `layout` / layer-level `filter`）
  以 isDark ∈ {true,false} × 預設 `overlayParams`（539 keys）求值成 JSON，
  **不快照函式原始碼**。每次求值包 try/catch，失敗記 deterministic marker。

### 護欄的護欄

4 條突變自測，全部走**測試真正在用的那個比對函式**（不是另寫一個 `!==`）：
改一個顏色值 / 刪一條 `GIS_LAYERS` / 打亂 `GIS_LAYERS` 順序（集合相同順序不同，
驗 first-hit-wins 語意有被保護）/ 改一個 overlay paint 的 dark 分支。

### 建構過程抓到的三個真問題

1. `-0` vs `0`：`JSON.stringify(-0)` 是 `"0"`，但 `toEqual` 走 `Object.is` 會判為不同
   → 「fixture 逐位元相等但 section toEqual 紅」，訊息完全看不懂。sanitize 補正規化。
2. 5 個 key（`activeFaults` `aqiStations` `landingStations` `submarineCables` `windPlan`）
   在 `useTransportParams` 寫死 `case "x": return [];` —— **有意**沒有控件，不能跟
   「抽取器沒掃到」混為一談 → 覆蓋斷言改成解析 `emptyByDesign` 後雙向比對。
3. 非決定性來源：`cultureTodayStr()` / `tourTodayStr()` 把「今天」烤進 filter literal
   → 正規化成 `__TODAY_DASH__` / `__TODAY_SLASH__`，否則 fixture 每天爆。

### 附帶改動

`IconRailSidebar.tsx` 的 `LAYER_ICONS` 加 `export`（抽取器要逐 key 讀 icon `displayName`）。

---

## 2026-08-11 — Phase 1：schema + 5 試點層

`574c3a6` `feat(manifest): Phase 1 schema —— LayerManifestEntry 型別 + 5 試點層登記資料`

`src/data/layerManifest.ts`。欄位分兩類：已派生（`color` `icon` `label` `labelMobile`
`expandable` `gated` `upstream`）與僅宣告（`section` `dataClass` `source` `legend`
`popup` `params`，Phase 3-4 才接線）。

`dataClass` A-D 刻意對齊「前端怎麼拿到資料」而非「資料在講什麼」：
A 靜態 GeoJSON / B PMTiles（連帶 nginx + deploy 清單）/ C 動態 Supabase / D 前端自繪。

5 試點層與挑選理由見 [README.md](./README.md)。

`5dc9230` `refactor(manifest): 4 張登記簿改雙軌派生 + 契約測試（5 試點層搬移零失真）`

`LAYER_COLORS` / `THEMES` 的 LayerDef / `LAYER_ICONS` / `UPSTREAM_REGISTRY` 四張表
改成 `Omit<Record<全集>, ManifestKey>` + spread merge。

- **THEMES 走就地替換不是 append**：`{ key: "cctv", label: … }` 換成
  `fromManifest("cctv")`，位置一格不動。THEMES 是有序巢狀結構，順序即 UI 顯示順序。
- 選填欄位用條件賦值而非 `labelMobile: m.labelMobile` —— 後者會產生一個值為
  `undefined` 的**存在的 key**，跟「key 不存在」在序列化比對上是兩回事。
- `fromManifest` 內把 entry 顯式標成 `LayerManifestEntry`：`LAYER_MANIFEST` 走
  `satisfies`，逐筆型別只含該筆真的寫了的欄位，直接讀 `m.gated` 會被 TS 判成不存在。

新增 `layerManifest.test.ts`（12 條）釘住「僅宣告」欄位與現況登記簿一致 ——
沒人驗證的宣告會在半年內悄悄爛掉，等 Phase 3 要拿來派生時才發現對不上，
那時 manifest 反而變成錯誤來源。已實測會咬（故意寫錯 popup 與控件數，兩條都紅）。

### 等價證明

黃金快照 fixture **一位元未動**、23 條全綠 = 5 層搬移零失真。
`npx tsc -b` 0 error｜`npx vitest run` **508 passed | 1 skipped**（基準 473 → +23 +12）。

---

## 2026-08-11 — Phase 2 批 1：25 層（宗教 6・殯葬 5・文化 5・消防 5・微型 4）

`cc64857` 前置護欄｜`7f339e5` 宗教｜`3f325bf` 殯葬｜`83ef421` 文化｜`71b31d9` 消防｜`1aa3d6b` 微型 4

manifest 5 → **30 entry**。四張手寫表（`LAYER_COLORS` / `THEMES` LayerDef /
`LAYER_ICONS` / `UPSTREAM_REGISTRY`）對這 25 key 殘留 grep 命中 0。
`npx tsc -b` 0 error｜`npx vitest run` **507 passed | 1 skipped**（與批 1 前基準相同，
本批未增減任何測試）｜黃金快照 fixture 自 Phase 0 起**一位元未動**。

### 三個拍板落地

1. **色票引用外部常數**（backlog 待拍板第 1 項）：宗教／殯葬的 `color` 欄寫
   `RELIGION_LAYER_COLORS.religionTemples` 這種**引用**，不複製 hex。那兩個常數同時餵
   `LAYER_COLORS` 與圖層自己的 paint 表達式，是三邊共用的 SSOT。
   為此 manifest 的 import 白名單放寬到「零 import 的純色票常數檔」（religionTypes /
   funeralTypes 各自 0 個 import，無 cycle 風險）。教育批 3 沿用同規約。
2. **legend id = LEGEND_REGISTRY entry 的首個 key**（第 4 項）：三種形狀都撞過了 ——
   獨佔（退化成同名，文化 5 層）、家族共用（宗教 6 → `religionTemples`、殯葬 5 →
   `funeralFacilities`）、**與自身 key 完全無關**（`civilDefenseShelter` → `policeStation`，
   它掛在警政司法民防 18 key 共用的圖例上）。第三種是規約真正的壓力測試，批 4 搬
   執法治安 20 層時是同一組 id。
3. **dataClass D 的定義澄清**：本批 6 層無 `OVERLAY_REGISTRY` entry 卻不是自繪 ——
   `fireEvents`/`fireLatest` 走 Supabase RPC、`worldTrashDebris` 走靜態 geojson、
   `fireIsochrone` 走 PMTiles factory、`funeralOperatorDensity` 是純數值 JSON join
   鄉鎮界切片、`plaActivity` 走 RPC。D 的操作性定義本來就是「沒有 registry entry →
   派生機制不適用」，與資料長相無關；真實來源記進 `source.note`（rail 試點即此模式）。
   docstring 已就地改寫，批 4-8 還有太空 16 / 水資源 12 / 廢棄物 17 層 D 直接沿用。

### 前置護欄：GIS_LAYERS 的常數引用列（`cc64857`）

`GIS_LAYERS` 有 2 筆 layer id 陣列寫成常數引用（`DISASTER_ALERT_CLICK_LAYERS` /
`PLA_ACTIVITY_CLICK_LAYERS`），`extractGisLayers` 的 regex 要求字面 `[...]` → 整列被跳過。
後果不是少一筆快照，是 **manifest 只能把這兩層宣告成 `popup: null`**（已知為假），
Phase 3 依 `popup` 派生 `GIS_LAYERS` 時會靜默丟掉它們的點擊接線。

修法刻意**不動主 regex**（動了這兩列就進 `gisLayers` section，fixture 得重跑 ——
等於拿「搬移零失真」的護欄去換一個解析改良）。改成獨立 export
`extractGisConstRefTypes()`，只回 layerType 字串、不進 fixture，由
`layerManifest.test.ts` union 進 `gisTypes`。批 5 的 `disasterAlert` 直接受益。

### 本批撞到的形狀（批 3 起可直接沿用）

- **popup 漂移最密集的是消防**：5 層裡 4 層 `key ≠ layerType`
  （`fireStations`→`fireStation` 單複數差一個 s、`fireHydrants`→`fireHydrant`），
  且 `fireEvents` / `fireLatest` **共用同一個 `"fireEvent"`**（多對一）。
  backlog 預期多對一要到批 3 教育才出現，實際批 1 就撞到，schema 無需改動。
- **`LayerSource` 單數形夠用**：本批 25 層無同 key 多 config。批 4 的
  `propertyValueGrid`×3 仍是待處理項。
- **`section` 非 null 夠用**：本批 25 層全在 THEMES 內。批 8 的 10 個 orphan key 仍待處理。

### ⚠️ 交接給後續批次：唯一沒有機械護欄的一步

雙軌 `Omit` + spread 的 tsc 三向護欄有一個**擋不到的漏法**：
`HANDWRITTEN_LAYER_COLORS` 裡的 `...RELIGION_LAYER_COLORS` 這類 **spread 不觸發
excess property check**。搬走 key 後若忘了刪 spread ——
tsc 綠、黃金快照綠、契約測試綠（manifest 在後面蓋、值又相同），
但登記根本沒真搬走，留下「改 manifest 畫面沒反應」的暗雷。純靠人記得。
批 3 搬教育時要刪 `...EDUCATION_LAYER_COLORS`（已在原處留註解警告）。

同理，**THEMES 的舊 literal 若忘了換成 `fromManifest(...)`** 也是全綠。
機械驗證只能靠 grep：`grep -cE 'key: "(本批全部 key)"' layerCatalog.ts` 必須是 0。

---

## 2026-08-11 — Phase 2 批 2：28 層（基礎建設 11・運動休閒 6・觀光 11）

`5d33117` 基礎建設｜`40f038e` 運動休閒｜`b292d21` 觀光

manifest 30 → **58 entry**。四張手寫表對這 28 key 殘留 grep 命中 0
（`^  key:` 與 `key: "key"` 兩種形狀分開數，各 0）。
`npx tsc -b` 0 error｜`npx vitest run` **507 passed | 1 skipped**（與批 1 後相同，
本批未增減任何測試）｜黃金快照 fixture 自 Phase 0 起**一位元未動**。

### 本批的價值：驗證「機械化流程」

backlog 對批 2 的期待是「驗證批次搬移的機械化流程能不能自動產生 manifest entry」。
做法是先寫一支**只讀**的抽取腳本（跑完即刪，不進 repo），對 28 key 逐一從
`LAYER_COLORS` / `THEMES` / `LAYER_ICONS` / `UPSTREAM_REGISTRY` / `OVERLAY_REGISTRY` /
`LEGEND_REGISTRY` / `GIS_LAYERS` / `extractGolden().params` 讀出 12 個欄位，
再照抄進 manifest。結論：**除 `description` / `topics` 兩個人讀欄位外全部可機械產生**。

其中兩個欄位的機械判準值得寫死給後續批次：

- **`legend`**：`key` 不在 `LEGEND_REGISTRY` 任何 entry 的 `keys` 裡 → `null`；
  在的話取**該 entry 的首個 key**（拍板④）。**不看圖層「感覺該不該有圖例」** ——
  本批 28 層有 14 層合法無 legend，憑感覺補一定會發明出不存在的圖例 id，
  Phase 3 依 `legend` 派生時就會指向一個沒有的元件。
- **`popup`**：拿該 key 的 `OVERLAY_REGISTRY` config 的 layer id
  （`${sourceId}-${suffix}`）去反查 `GIS_LAYERS` 命中的那筆 `type`。
  本批 28 層全部剛好命中 1 筆，且全部存在於 `HEADER_LABELS`。

### 三個主題的形狀是互補的（一次撞完三種極端）

| | 基礎建設 11 | 運動休閒 6 | 觀光 11 |
|---|---|---|---|
| `labelMobile` | 0/11 | 0/6 | **11/11** |
| `popup` 與 key 同名 | **0/11**（全是單數形） | 場館 5 層 **5 → 1** `sportsVenue` | **11/11 同名** |
| `legend: null` | 7/11 | 0/6 | 7/11 |
| `dataClass` | 全 A | 全 A | 全 A |

- **基礎建設的 popup 全數漂移**（`postOffices`→`postOffice`、`iPostBoxes`→`iPostBox`…）
  比批 1 消防的 4/5 更危險：整齊到肉眼掃過去像同名，只有逐 key 反查才看得出差一個 s。
- **運動場館 5 層是目前最徹底的多對一**，四個維度同時共用：同一份
  `./sports/all_venues.geojson` **同一個 `sourceId`**（5 個 OverlayConfig 的 `id` 各異、
  `sourceId` 相同 → hydrate 只 fetch 一次，各層以「場館類別」filter 切分）、
  同一筆 legend entry、同一個 popup layerType、同一個 catalog dataset。
  ⚠️ 契約測試的 `OVERLAY_REGISTRY.filter(c => c.id === k).toHaveLength(1)` 是**按 `id`**
  不是按 `sourceId`，共用 sourceId 不會踩到它 —— 這與 backlog 批 4/6 的
  「同 key 多 config」是**完全不同的問題**，別混為一談。
- **觀光的 legend 與 select 控件同源**：有圖例的 4 層（`tourAttractions` /
  `tourHeritage` / `tourEvents` / `tourHotels`）恰好就是有分類下拉的那 4 層。
  有分色維度才需要圖例，反之單色 POI 就是 `legend: null`。

### 色票拍板①的第二種答案：「核對後不引用」

批 1 立的規約是「外部色票常數用引用不複製」。批 2 三個主題**逐一核對後都不適用**，
理由一致且值得記下來當判準：

`tourTypes.ts` / `sportsTypes.ts` 匯出的是 **category-keyed** 的分色資料
（`TOUR_ATTRACTIONS_CATEGORY_COLOR` 依 `category` 欄位值、`SPORTS_CATEGORY_COLOR`
依「場館類別」欄位值），**不是 layer-key-keyed 的 `*_LAYER_COLORS` 記錄**，
而且 `LAYER_COLORS` 從未 import 它們 —— 兩者從來就不是同一份 SSOT。

判準：**看的是「這個常數有沒有在餵 LAYER_COLORS」，不是「這個主題有沒有色票檔」。**
hex 撞色是巧合（`tourHeritage` 的 `#6d4c41` 同時是該表 Culture 類色兼 fallback 基底、
`tourHotels` 的 `#1976d2` 是「旅館」類色），引用它們反而會建立一條假的依賴。
已在 `layerManifest.ts` 觀光/運動兩個 section header 與 `layerCatalog.ts` 原處
就地註記，免得批 3-8 重新爭論。

### 一個差點漏掉的形狀

`tourRestaurants` 在 `UPSTREAM_REGISTRY` **不在觀光區塊**，落在教育區塊後面
（歷史原因）。按主題「整段刪」會漏掉它 —— tsc 的 excess property 會擋下來，
但那是最後一道防線；後續批次刪手寫表請**逐 key grep 定位**再刪，不要靠區塊註解。

---

## 2026-08-11 — Phase 2 批 3：33 層（教育 17・林業 16）

`b506144` 教育｜`97b6d62` 林業

manifest 58 → **91 entry**。四張手寫表對這 33 key 殘留 grep 命中 0
（`^  key:` 與 `key: "key"` 兩種形狀分開數，各 0）。
`npx tsc -b` 0 error｜`npx vitest run` **507 passed | 1 skipped**（與批 1/2 後相同，
本批未增減任何測試）｜黃金快照 fixture 自 Phase 0 起**一位元未動**。

### ⚠️ 本批唯一沒有機械護欄的一步：`...EDUCATION_LAYER_COLORS` 已整行刪除

批 1 末節交接的那個漏法，批 3 是第一個真的要執行它的批次（批 2 三個主題都沒有
餵 `LAYER_COLORS` 的色票常數）。做法：刪 `HANDWRITTEN_LAYER_COLORS` 的 spread 行
＋ `layerCatalog.ts` 對 `educationTypes` 的孤兒 import，然後
`grep -nE '^\s*\.\.\.EDUCATION_LAYER_COLORS'` 驗證非註解形狀 0 命中
（原處留的字串出現在說明註解裡，數 `grep -c` 會誤判成 1 —— 要限定行首才是真的）。

拍板①判準逐條對上：`EDUCATION_LAYER_COLORS` 是 **layer-key-keyed** 且
**正在餵 `LAYER_COLORS`**（原本就是一行 spread），同時餵 `overlayRegistry` 的
paint 與 `LegendPanel` —— 三邊共用的 SSOT。`educationTypes.ts` 0 個 import，
白名單成立。**唯一例外是總覽層 `schools`**：它不在該常數裡（色票是手寫表自己的
字面 `#42a5f5`）→ 寫字面 hex。

林業則走批 2 的反向判準：`forestReserveTypes` 的 `FOREST_RESERVE_TYPE_MATCH`
（依保安林種類）與 `canopyGiantsTypes` 的距離帶都是 **category-keyed 表達式**、
`LAYER_COLORS` 從未 import → 不引用，寫字面 hex。兩種答案在同一批出現，
判準（「有沒有在餵 LAYER_COLORS」）本身也被驗證了一次。

### 同一批撞完兩極：教育與林業幾乎每個維度都相反

| | 教育 17 | 林業 16 |
|---|---|---|
| `labelMobile` | **17/17** | **2/16**（mountainHuts / hikingTrails） |
| popup 形狀 | 多 key 擠進同一個 layerType | **依幾何型別分類**的泛型 layerType |
| `legend` | 17/17 同一個 id `schools` | 14/16 同一個 id + 2 獨佔 |
| `legend: null` | 0 | 0 |
| `dataClass` | A 12 / B 5 | A 11 / B 5 |

- **教育的 labelMobile 與批 2 觀光是不同款**：觀光是「桌機全稱、手機只留中文」，
  教育是**手機版反而多帶筆數**（`國小 Elementary` → `國小 (2,656)`）。
  逐 key 抄，不要套主題級假設。
- **popup 多對一的規模紀錄**：`school` 一個 layerType 對 **7 個 layer**
  （schools + 5 個 eduSchool* + eduRemoteSchools，同一份 schools.geojson 的 filter
  切分），`eduCampus` 對 2、`eduDistrictK12` 對 2。backlog 只預期到 k12 這一組。
  批 1 消防已證明 schema 不用改，這裡只是規模更大。
- **林業的泛型 layerType 是新形狀**：`forestryPolygon`(3) / `forestryPOI`(8) /
  `forestryLine`(1) 三個「按幾何型別」而非「按主題」命名的 layerType 吃掉 12 層。
  ⚠️ 這種形狀**用子群名猜會猜錯** —— `forestFlatParks` 列在「分區」子群但資料是
  點位，走 `forestryPOI` 不是 `forestryPolygon`。只有反查 layer id 才看得出來。
- **`canopyHeight` 是本批唯一 `popup: null`**（raster 切片，GIS_LAYERS 無條目），
  也是唯一**沒有 `sourceLayer` 的 pmtiles**（raster 無 vector layer）。
  `LayerSource` 的 optional `sourceLayer` 正是為這形狀留的，schema 無需改動。

### 共用 sourceId 的規模也創新高

教育三組共用 sourceId（`edu-schools` ×7、`edu-campus` ×2、`edu-district-k12` ×2），
比批 2 運動場館的 ×5 更大。再次確認：契約測試的
`OVERLAY_REGISTRY.filter(c => c.id === k).toHaveLength(1)` 是**按 `id`**，
共用 `sourceId` 不會踩到它 —— 與批 4/6 的「同 key 多 config」是不同問題。

### 觸點 #20 核對（非改動）

林業 dataClass B 的 5 層 PMTiles（`national_forest_compartments` / `forest_reserve` /
`forest_roads` / `hiking_trails` / `canopy_height_rgb_taiwan`）全數已在
`scripts/deploy/upload-deploy-assets.sh` 清單內，manifest 的 `source.url` 與之一致。
教育的 3 份切片（`campus_polygon` / `school_district_k12` / `cram_schools`）走純 S3，
`nginx.conf` 與 pull/upload 腳本都已有對應說明。**本批只核對宣告，未改部署設定。**

### 又一個「區塊註解不可信」的實例（這次是鏡像）

批 2 是「別主題的 key 混進本主題區塊」（`tourRestaurants` 落在教育區塊後面）；
批 3 是**反過來**——`schools` 三張表都不在教育區塊裡：`UPSTREAM_REGISTRY` 落在
檔案下方 realEstate 前、`LAYER_COLORS` / `LAYER_ICONS` 落在上方（都是為了保留
原 z-order 的歷史位置）。兩個方向都撞過了，結論不變：**逐 key grep 定位再刪。**

### 記一筆現況異常（本次不動）

`forestAlishanRail` 的 `sourceUrl` 與 `datasetId` 都是
`wildlife_distribution_3rd_alt`、渲染成 circle 走 `forestryPOI`，與「阿里山鐵路」
的圖層標題不符。manifest 照現況登記並在 entry 就地註明 —— 搬移階段的鐵則是
**零失真**，修資料對應是另一件事，不夾帶。

---

## 2026-08-11 — Phase 2 批 4：46 層（執法治安 20・醫療 8・房地產 7・人口社經 6・全球氣候 5）

`15b9756` schema 擴充（拍板②）｜`7bf9b82` 房地產｜`59dcf46` 醫療｜
`64cf237` 執法治安｜`22b451e` 人口社經｜`e73f677` 全球氣候

manifest 91 → **137 entry**。四張手寫表對這 46 key 殘留 grep 命中 0
（`^  key:` 與 `key: "key"` 兩種形狀分開數，各 0）。
`npx tsc -b` 0 error｜`npx vitest run` **507 passed | 1 skipped**（測試條數自批 1
起未增減，本批兩處改動都是就地改寫既有 `it` 與既有 Set）｜
黃金快照 fixture 自 Phase 0 起**一位元未動**。

### 拍板②落地：`LayerSource` 支援同 key 多 config（`15b9756`）

`LayerManifestEntry.source` 由 `LayerSource` 擴成 `LayerSource | LayerSource[]`。
選陣列而非新增 `kind:"multi"` 變體，理由是**侵入最小**：91 筆既有 entry 一個字元
都不用改、`satisfies` 的 literal 推導不受影響、Phase 3 派生時展開 sourceId 也最直接。

契約測試改成單／複數走同一條路徑：`Array.isArray` 正規化 → 筆數比對 →
**逐位對齊**逐欄比。index 配對不是圖方便 —— OVERLAY_REGISTRY 的順序決定 layer 疊放、
Phase 3 派生 `GIS_LAYERS` 又是 first-hit-wins，順序 load-bearing，順手釘住。
`kind:"custom"` 維持只能單數形（沒有 registry entry 可以多配）。

兩次突變自測（陣列路徑在 propertyValueGrid 進來前跑不到，不自測等於沒護欄）：
1. `cctv.source` 暫塞成兩筆 → 「cctv 宣告 2 筆 overlay source，OVERLAY_REGISTRY 實際 1 筆」
2. propertyValueGrid 陣列裡 150m 與 450m 對調 → 「propertyValueGrid[0] sourceId 宣告錯」

⚠️ **仍有 3 個 key 待用**（`stationsTRA`×2 批 8、`waterRivers`×2 / `waterReservoirs`×2
批 6）。它們的 config 順序同樣 load-bearing，照 propertyValueGrid 的寫法即可。

### 新增第三種 popup 真值來源：`extractNonGisFeatureTypes`

批 1 為「GIS_LAYERS 的 layer id 寫成常數引用」補了 `extractGisConstRefTypes`。
批 4 撞到更極端的一種：`windField` / `oceanCurrents` 的 popup **完全不經 GIS_LAYERS**
—— 向量 feature 全部沒命中時 fallback 去 `sampleClimateFields`，直接
`setFeatureInfo({ layerType: "climateField" })`。點哪都能讀值，本來就不對應任何
layer id，兩個既有解析器都抓不到。

不補這支這兩層只能宣告 `popup: null`（已知為假），Phase 3 派生會靜默丟掉
「點地圖讀氣候場」。做法照批 1：只回 type 字串、**不進 fixture**。
順帶收進來的 `ship` / `waterDam`（Three.js scene 自己 raycast）讓批 6/8 直接受益。
突變自測：拿掉 union → windField 那條紅。

### popup 判準的三層修正（本批最重要的交接）

批 2 定的機械判準是「拿 `${sourceId}-${suffix}` 反查 GIS_LAYERS」。批 4 證明
**它只對 A/B/C 體質成立**，D 體質必須逐層讀 factory 的 layer id 常數：

| 情形 | 例子 | 照抽取器填 null 的後果 |
|---|---|---|
| D 但有 popup | `medIsochrone`/`medDesert` → `medicalIsochrone` | 丟掉等時圈點擊 |
| D 且 key ≠ layerType | `earthquakesGlobal` → `earthquakeGlobal`、`typhoonTracks` → `typhoonTrack` | 丟掉點擊 |
| D 且不經 GIS_LAYERS | `windField`/`oceanCurrents` → `climateField` | 丟掉氣候場讀值 |
| D 且真的沒有 | 人口社經 6 層、`dustForecast` | 正確 |

**「D 體質 → popup null」是錯的捷徑，「D 體質 → 一定要找到 popup」也是錯的。**
唯一做法是逐層打開 hook / factory 看它 addLayer 了什麼 id，再對 GIS_LAYERS。

### 三種「共用」形狀已全部撞完

| 形狀 | 例子 | 契約測試 |
|---|---|---|
| 多 key 各自一筆 config，共用 `sourceId` | 教育 `edu-schools`×7、房地產 `re-grid`×3 | 按 `id` 過濾，不受影響 |
| **同 key 多筆 config**（拍板②） | `propertyValueGrid`×3 | 陣列 + 逐位對齊 |
| **兩個 key 一個 layer** | `medIsochrone`/`medDesert` 共用 `medical-isochrone-fill` | 兩者 source/popup 必然相同 |

第三種是批 4 新撞到的。Phase 3 依 popup 派生 `GIS_LAYERS` 時要小心別把它當重複條目去重。

### 五個主題的形狀

| | 執法 20 | 醫療 8 | 房地產 7 | 人口社經 6 | 全球氣候 5 |
|---|---|---|---|---|---|
| dataClass | A14 B5 C1 | A1 B4 C1 D2 | B4 D3 | **D6** | **D5** |
| popup 與 key 同名 | **20/20** | 1/8（僅 erHospital；另 5→1 + 2→1） | 1/7 | 0（全 null） | 0（2 單數形 + 2 fallback + 1 null） |
| `legend: null` | 0 | 0 | 0 | 2 | 0 |
| `labelMobile` | 0/20 | 0/8 | 1/7 | 0/6 | 0/5 |

- **醫療一個主題撞完四種 dataClass** —— 前三批沒有任何主題做到。
- **執法 popup 20/20 同名**是前三批沒出現過的整齊度，但整齊是結果不是前提，
  仍逐 key 反查（20 筆各命中 1）。
- **legend 大規模共用**：執法 17 層共用 `policeStation`（該 entry 實際 18 key，
  多出的 `civilDefenseShelter` 是批 1 壓測拍板④的那層）；醫療 POI 5 層共用
  `medHospital`；房地產 6 層共用 `realEstateRentalGrid`。

### 色票拍板①：本批 46 個全部「不引用」

46 個色票在 `HANDWRITTEN_LAYER_COLORS` 原本就是字面 hex，**沒有任何
`*_LAYER_COLORS` 常數在餵這張表**（`propertyValueTypes.ts` 匯出的是 bands / scales
這類 category-keyed 分色資料，同批 2 `tourTypes` 的情形）→ 寫字面。
本批無 spread 可刪（批 3 之後 `HANDWRITTEN_LAYER_COLORS` 已一個 spread 都不剩）。

### 區塊註解不可信的第三種（前兩種在批 2/3）

批 2 是「別主題 key 混進本區塊」、批 3 是「本主題 key 散在別處」，批 4 是
**註解涵蓋範圍與內容從一開始就對不上**：`LAYER_COLORS` 的 `// 警政司法民防 17 layer`
底下刪掉 20 層後接的是**航空管制 4 層**；`LAYER_ICONS` 的 `// 警政司法民防 17 layer`
與 `// 警察覆蓋分析` 兩行同時變空殼。另外 `realEstatePresalePoint` 在
`UPSTREAM_REGISTRY` 排在 `propertyValueGrid` **後面**（同主題內順序也不可信）。
三種都撞過了，結論不變：**逐 key grep 定位再刪**，本批用只讀腳本逐 key 定位執行。

### 記一筆現況出入（本次不動）

`medDesert` 的 `upstream.processing` 寫「> 30 分鐘」，`medicalIsochroneLayerFactory`
實際 filter 的 level 是 `over15`（> 15 分鐘）。upstream 照抄、description 記渲染實況，
兩者出入就地註明 —— 同批 3 `forestAlishanRail`，修資料對應不夾帶。

### 觸點 #20 核對（非改動）

本批 dataClass B 共 13 層，`source.url` 的目錄前綴只落在
`/coverage/`、`/urban/`、`/geo/`、`/medical/`、`/police_justice/` 五個
—— 全部已有對應的 `nginx.conf` location 區塊（nginx 是**目錄級**規則不是逐檔，
新增同目錄切片不需要改 nginx）。**本批只核對宣告，未改部署設定。**

⚠️ 但 `scripts/deploy/upload-deploy-assets.sh` 是**逐檔清單**，本批未逐檔比對
（批 3 林業有比對，因為那批是新上的切片）。批 4 全是既有已上線圖層，
清單若有缺早就 404 了 —— 不過 Phase 5 改寫 `/new-layer` 時，
「manifest 的 `source.url` ↔ deploy 清單」值得做成一條機械斷言。

---

## 2026-08-11 — Phase 2 批 5：40 層（底圖 12・災害 12・太空 16）

`410cac7` schema（popup 陣列）｜`529c828` 底圖｜`fc762a5` 災害｜`61eb3e9` 太空

manifest 137 → **177 entry**。四張手寫表對這 40 key 殘留 grep 命中 0
（`^  key:` 與 `key: "key"` 兩種形狀分開數，各 0）。
`npx tsc -b` 0 error｜`npx vitest run` **507 passed | 1 skipped**（測試條數自批 1
起未增減，本批對 `layerManifest.test.ts` 的改動是就地改寫既有 `it`）｜
黃金快照 fixture 自 `8abbd97` 起**一位元未動**。

### ⚠️ 代拍的 schema 決定（拍板⑤候補，待 owner 追認）：`popup` 支援陣列

`LayerManifestEntry.popup` 由 `T | null` 擴成 `T | T[] | null`，形狀與拍板②的
`source` 同構（陣列而非新變體 → 137 筆既有 entry 零改動、`satisfies` 推導不受影響）。

觸發它的是 `earthquakeReplay`：`ensureEarthquakeReplayLayers` 一次建 5 個 layer，
其中**兩個各自有 GIS_LAYERS 條目、各自有 panel 元件**——
`eq-replay-station-circle` → `earthquakeReplayStation`（GIS_LAYERS 第 90 列）、
`eq-replay-town-fill` → `earthquakeReplayTown`（第 286 列）。
只宣告一個 = 已知為假，Phase 3 派生時靜默丟掉另一個接線。

契約測試單／複數走同一條正規化路徑，逐一驗 `HEADER_LABELS` + `gisTypes` + 去重 +
**順序**（`gisRows.findIndex` 比對 GIS_LAYERS 出現序）。
⚠️ 順序 load-bearing 但**不代表相鄰**：first-hit-wins 下點層排前段、大面積面層
刻意置末（本例相隔近 200 列）。陣列只保證相對先後，**不取代** README 已登記的
Phase 3 `clickPriority` 欄位。

兩次突變自測（陣列路徑在 earthquakeReplay 進來前跑不到），拿 `cctv.popup` 暫塞：
`["newsEvent","cctv"]` → 順序紅；`["cctv","cctv"]` → 去重紅。

### popup 判準的第四層修正：HEADER_LABELS 有條目 ≠ 有 popup

批 4 立的是「D 體質 → popup null 是錯的捷徑」。本批撞到**反向**的另一半：
`hillshade` 在 `HEADER_LABELS` 有一條 `hillshade: "山體陰影"`，但 `GIS_LAYERS`
**沒有**它的條目。那條 label 只是 BYOK chat bridge（`App.tsx` 的 `highlightPoint`，
任何 `layerType in HEADER_LABELS` 都能標）的 layerType 全集，不構成點擊接線。
`dustForecast` / `canopyHeight`（批 3/4 的 `popup: null`）連 HEADER_LABELS 都沒有，
所以前幾批沒撞到這種形狀。批 8 的 `osmExpressway` 同款。

**兩個方向現在都有反例了**：D 不等於沒有 popup；有 HEADER_LABELS 也不等於有 popup。
唯一可靠做法仍是逐層讀 hook 的 `addLayer` id 再對 GIS_LAYERS。

### 三個主題的形狀

| | 底圖 12 | 災害 12 | 太空 16 |
|---|---|---|---|
| dataClass | B 9 / D 3 | D 7 / C 4 / A 1 | **D 16** |
| popup 與 key 同名 | **11/12**（hillshade 為 null） | 1/12 | 0（16 → 1 `satellite`） |
| `legend: null` | 5 | 1（activeFaults） | 0 |
| `labelMobile` | 6/12 | 1/12 | 0/16 |

- **底圖是繼批 4 執法治安之後第二個 popup 幾乎全同名的主題**（11/12）；
  災害則一批撞完五種形狀（同名複數 `earthquakes` / 去複數 s `activeFault`
  `mountainRescueIncident` / 多對一 `lightningStrike` `disasterAlert` /
  **完全異名** `nuclearRadiation` → `nuclearStation` / **一對多** earthquakeReplay）。
- **太空是本工程規模最大的共用**：legend 16 → 1 且 popup 16 → 1 同時發生，
  雙雙超過批 3 教育 `school` 的 1 對 7。16 個 toggle 只是同一份 `cat` 欄位的
  layer-level filter，連 `source.note` 都抽成共用常數 `SAT_SOURCE_NOTE`
  （不是省字：寫 16 份會給人「各自有不同來源」的錯誤印象）。
- **「satellites 家族可能走自己的 picking」的風險項驗完是否定的**：逐一讀
  `useSatellitesLayer` 的 5 個 `addLayer`，只有 `sat-current-point` 進 GIS_LAYERS，
  且是字面陣列 → 本批**不需要補解析器**（批 1 / 批 4 各補過一支）。
  ⚠️ 這個「不需要」是讀 hook 讀出來的，不是從 D 體質推出來的。

### dataClass 別看檔案長相（本批最容易踩的一步）

`hillshade` / `slopeVector` / `aspectVector` 沒有 OVERLAY_REGISTRY entry → D，
但 slope/aspect **是不折不扣的 PMTiles**（`./base_map/slope_vector.pmtiles` z5-12）。
只機械掃 `dataClass === "B"` 去對部署清單會漏掉它們。
災害的 7 個 D 也全不是自繪（NCDR 示警 5 + 地震 2 都是 hook 自建 source 餵 Supabase）。

backlog 對本批的預估「災害 3 C + 7 D」實際是 **7 D / 4 C / 1 A** ——
**預估欄不可信，逐 key 判**（批 1 已有同款教訓）。

### legend 家族已有 manifest 成員時沿用其既有 id（拍板④的精煉）

`urbanZoningNewTaipei` 與試點 `urbanZoningTaipei` 共用 `UrbanZoningLegend`。
機械規則「取 LEGEND_REGISTRY entry 首個 key」會給 `"urbanZoningTaipei"`，
但試點早於拍板④、已寫 `"urbanZoning"` —— 兩個 id 對一個元件，Phase 3 依 id 分組
派生 `LEGEND_REGISTRY` 會派生出兩筆。拍板④背後 load-bearing 的性質是
**共用元件 ⇔ 共用 id**，故填 `"urbanZoning"`，不回頭改試點（搬移不夾帶）。

判準精煉為：**加入的 legend 家族若已有 manifest 成員 → 沿用其既有 id；
同一筆 registry entry 永不產生第二個 id。**
⚠️ 批 6 的環境污染 4 層同款（試點 `pollutionFacility` 的 `"pollution"`
也是 pre-拍板④ 的 freeform id）。這兩個是 manifest 裡**僅有的兩個**非首 key 的 legend id。

### 色票拍板①：40 個全部「不引用」

三個主題各有一個看起來該引用的常數，逐一核對後都不適用：
`disasterAlertTypes.ALERT_GROUPS[].types`（event_term-keyed）、
`satelliteTypes.SATELLITE_COLORS`（category-keyed）、
`nonUrbanZoningTypes` / `buildingsGbaTypes` / `urbanZoningTypes`（match 表達式）
—— **全部沒有在餵 `LAYER_COLORS`**。

⚠️ `SATELLITE_COLORS` 是判準遇過**最像該引用卻不該引用**的一組：16 個 layer key 與
16 個 category 一一對應、hex 逐一相同。但判準是「有沒有在餵 `LAYER_COLORS`」，
撞色是巧合不構成引用理由（同批 2 `tourTypes` 的邏輯，只是這次巧合到 100%）。

無 spread 可刪。`IconRailSidebar` 刪孤兒 `Map` / `CloudLightning` / `Atom` / `Rewind`
（`Satellite` 保留 —— 衛星情報 Console 的 rail 按鈕仍在用）。

### 區塊註解不可信（第五、六種變形）

前三批分別是「別主題 key 排在本區塊尾」（批 2）、「本主題 key 散在別處」（批 3）、
「註解涵蓋範圍對不上」（批 4）。本批兩種新的：

1. **別主題 key 夾在本區塊正中間**：`osmExpressway` 在 `LAYER_COLORS` / `LAYER_ICONS`
   都夾在 `osmRoadDrive` 與 `hillshade` 之間，THEMES 位置卻是「交通 Move / 路網」（批 8）。
   按區塊整段刪會連它一起刪掉。
2. **註解指向的是下一段的別主題**：`LAYER_COLORS` 災害區塊中間的
   `// 全球氣候 GLOBAL CLIMATE` 底下緊接的是 NCDR 示警 5 層（全球氣候 5 層已於批 4 搬走）。

結論不變：**逐 key grep 定位再刪**。

### 記兩筆現況出入（本次不動）

1. `buildingsGba` 的 `upstream.note` 寫檔名 `buildings_3d_taiwan.pmtiles`，
   `OVERLAY_REGISTRY` 實際載 `buildings_value_taiwan.pmtiles`。
2. `./base_map/township_boundary.pmtiles` 被 `earthquakeReplay` 的鄉鎮震度面
   **另建一個 source**（`eq-replay-township` + promoteId + feature-state，通用路徑
   不支援 → 不進 OVERLAY_REGISTRY）：同一個檔跨兩個 layer key，刪檔會連帶弄壞地震回放。

兩者都已在對應 entry 就地註明（同批 3 `forestAlishanRail` / 批 4 `medDesert` 的慣例）。

### 觸點 #20 核對：本批**有**逐檔比對，發現一個真缺口

本批 `source.url` 涉及的靜態檔目錄：`/base_map/`、`/urban/`、`/hazards/`、`/geo/`
—— nginx 四個 location 區塊都存在。逐檔比對 `upload-deploy-assets.sh`：

| 檔 | 部署路徑 | 結論 |
|---|---|---|
| base_map 6 個 PMTiles（行政界 3 / 等高線 2 / OSM 路網 1） | glob `public/base_map/*.pmtiles` → S3 → pull sync | ✅ |
| `slope_vector.pmtiles` / `aspect_vector.pmtiles`（dataClass **D** 卻是 PMTiles） | 同上 glob 涵蓋 | ✅ 但腳本註解寫「6 檔」，實際是 **8 檔** |
| urban 3 個 PMTiles | glob `public/urban/*.pmtiles`＋`/urban/` 有 dist fallback | ✅ |
| `hazards/mountain_rescue_incidents.geojson` | git 管理＋`/hazards/` 有 dist fallback | ✅ |
| `geo/active_faults.geojson` | upload 逐檔清單有列、pull `--include` 有列 | ✅ |
| **`base_map/hillshade.png`（8.7MB，git 管理）** | ⚠️ **無路徑**（見下） | ❌ 待 owner 確認 |

**`hillshade.png` 的缺口**：它 git 管理 → build 後在 `dist/base_map/`，但
`nginx.conf` 的 `location /base_map/` 只有 `root /data;`、**沒有 `try_files $uri @dist;`**
（`/urban/` `/hazards/` `/geo/` 都有）；而 upload/pull 兩支腳本對 base_map 都只處理
`*.pmtiles`，PNG 不在其中。兩條路都不通 = 正是 PT-1 那類「宣告在、檔案上不去」。
`slope.png` / `aspect.png` 同樣情形（但那兩張已被 PMTiles 版取代，不確定是否仍在用）。

⚠️ **本批只核對記錄，未改任何部署檔**（任務書要求）。修法有兩條（給 owner 選）：
給 `/base_map/` 補 dist fallback，或把 PNG 加進 upload glob。
另外 Phase 5 改寫 `/new-layer` 時，「manifest 的 `source.url`（含 `source.note` 裡的
custom 檔路徑）↔ nginx location ↔ deploy 清單」值得做成一條機械斷言 ——
本批證明**光掃 dataClass B 不夠**，D 的 note 裡也藏著要部署的檔。

---

## 2026-08-11 — Phase 2 批 6：42 層（環境氣候 19・水資源 23）

`45faee8` schema（source 陣列混合 kind）｜`49ff8b8` 環境氣候｜`d39edf1` 水資源

manifest 177 → **219 entry**。四張手寫表對這 42 key 殘留 grep 命中 0
（`^  key:` 與 `key: "key"` 兩種形狀分開數，各 0）。
`npx tsc -b` 0 error｜`npx vitest run` **507 passed | 1 skipped**（測試條數自批 1
起未增減，本批對 `layerManifest.test.ts` 的改動是就地改寫既有 `it`）｜
黃金快照 fixture 自 `8abbd97` 起**一位元未動**。

### ⚠️ 代拍的 schema 決定（拍板⑥候補，待 owner 追認）：source 陣列允許混合 `kind`

批 4 的拍板②留下一句「陣列各元素的 `kind` 必須同質（dataClass 只有一個值）」。
批 6 的 `waterReservoirs` 直接證偽：**水庫面走 PMTiles、壩體點走 GeoJSON**，
同一個 toggle 兩條載入路徑。`propertyValueGrid`×3 / `waterRivers`×2 /
`stationsTRA`×2 都是同質，所以前五批沒撞到。

型別不用改（`LayerSource[]` 本來就容得下），改的是**判準**：
`dataClass` 取「上線路徑最重」的那個 kind ——

    pmtiles(B) ＞ supabase(C) ＞ geojson(A)

B 背著 nginx location + deploy 清單的義務（漏了直接 404，PT-1 的教訓），
A 只是一支 fetch。用 precedence **不用「首元素的 kind」**：precedence 與陣列
順序無關，而順序服務的是疊放語意（first-hit-wins），不該連帶決定體質。

契約測試就地改寫既有 `it`：per-element 的形狀斷言（`sourceId` / `sourceUrl` /
`pmtiles` 三欄 / `dynamicData`）原樣留在迴圈內，只把 `dataClass` 斷言移出迴圈
改由 kind 集合算期望值。**同質 entry 的期望值與逐筆斷言時逐字相同**
（218 筆強度零損失），混合才走 precedence。`kind:"custom"` 分支不動。

突變自測（混合路徑在 waterReservoirs 進來前跑不到）：`dataClass` 暫改 `"A"` →
紅在「waterReservoirs 的 source kind 是 {pmtiles,geojson}，dataClass 應為最重路徑
pmtiles」。

### legend 拍板④的例外條款：本批證明它是**逐 entry** 不是逐子群

backlog 批 6 欄寫「環境污染 4 層 legend 直接沿用 `"pollution"`」。實際照
`LEGEND_REGISTRY` 逐 key 查，那個子群橫跨**兩筆 entry、兩個元件**：

| entry | keys | 本批填的 legend id |
|---|---|---|
| `PollutionSeverityLegend` | `pollutionFacility`（試點）, `pollutionSite` | `"pollution"`（沿用試點的 pre-拍板④ freeform id） |
| 裁處圖例 | `pollutionPenalty{Critical,General,Mobile}` | `"pollutionPenaltyCritical"`（機械規則取自家首 key） |

4 層全填 `"pollution"` 會被契約測試「同一個 legend id 的 key 必須落在同一筆
`LEGEND_REGISTRY` entry」擋下——**測試是對的**。批 5 精煉的那句話
load-bearing 的是「**共用元件 ⇔ 共用 id**」，不是「同一個 sidebar 子群」。
非首 key 的 legend id 仍只有 `urbanZoning` / `pollution` 兩個（都是試點遺留）。

### 兩個主題的形狀

| | 環境氣候 19 | 水資源 23 |
|---|---|---|
| dataClass | A 3 / B 9 / D 7 | A 5 / B 6 / **D 12** |
| popup 與 key 同名 | 8/19（另 3→1 裁處、2 個單數形、1 個異名 `microSensor`、5 個 null） | 9/23（另 3 個去複數 / 縮短、1 個**陣列**、10 個 null） |
| `legend: null` | 3 | 7 |
| `labelMobile` | 4/19（僅環境污染 4 層） | 0/23 |

- **水資源 12 個 D 沒有一個是「自繪」**：全是 hook 自建 source 餵 Supabase RPC
  的即時水情層（同批 5 災害的形狀）。backlog 的「水資源 12 層 D 體質」預估
  這次數字對了，但體質的**理由**與預期不同。
- **環境氣候一個主題四種 dataClass 都有**（繼批 4 醫療之後第二次），
  且影像類 3 層（`cwaCloudImagery` / `cwaRadarImagery` / `aqiImagery`）
  是**同一套 image source + raster layer 實作**跨兩個子群共用。
- **`aqiStations` 的 `params` 是 `null`**（`useTransportParams` 寫死 `return []`，
  Phase 0 記錄的 emptyByDesign 5 key 之一），而 THEMES 是 `expandable: true` ——
  兩者不一致是現況，照抄不夾帶修正。同理 `taipeiPumb` 的 label 拼字「Pumb」
  （正字為 Pump）也照抄，快照會擋任何手癢。

### 雙生字：本批密度最高，`groundwater` 那組是真的會判錯

| 一組 | 差別 | 判錯的後果 |
|---|---|---|
| `groundwater` vs `groundwaterWells` | 前者面/線子群、timeline 驅動彩色、**擁有 GIS_LAYERS 的 `groundwater-circle`**；後者點位子群、靜態灰點 backdrop、layer id 是 `groundwater-wells-circle`（**不在** GIS_LAYERS） | 兩層同一支 loader、只差 RPC，憑名字或主題判會把 popup 掛錯層 |
| `floodSensor` vs `floodSensorIsochrone` | **反過來**：各有自己的 GIS_LAYERS 條目（popup 各自宣告），卻**共用同一筆 legend entry** | 憑「有沒有自己的 popup」推 legend 會推錯 |
| `riverLevel` / `iotWraRiver` / `waterRivers` | 三者無關（水位站 / IoT 感測 / 河川面線） | 純命名巧合 |

刪手寫表與殘留 grep 一律用 `^  key:` 與 `key: "key"` 兩種精確錨定分開數。

### `waterDam` 的既有記載已過時（任務書沿用了它）

批 4 把 `waterDam` 收進 `extractNonGisFeatureTypes`（Three.js scene 自己 raycast），
批 6 任務書據此寫「`waterDam` popup 不經 GIS_LAYERS」。實際上 `GIS_LAYERS`
**有** `["water-reservoir-dams-core", …] → waterDam` 的字面條目 —— raycast 是
**並存的第二條路徑**，不是唯一路徑。兩個解析器都涵蓋它，`gisRows.findIndex`
拿得到有效 index，順序斷言直接過，無需特殊處理。

### 觸點 #20 核對：逐檔比對，無新缺口，但記一個鏡像不一致

本批 `source.url`（含 D 層 `source.note` 裡的檔路徑）涉及五個目錄：

| 目錄 | 檔 | nginx location | upload / pull |
|---|---|---|---|
| `/geo/` | water_* 12 檔（geojson+pmtiles）、pollution_{penalties,sites}.pmtiles、weather_stations.geojson | ✅ root + dist fallback | ✅ `water_*` glob ＋ `public/geo/*.pmtiles` 鏡像子前綴；pull 端 include filter 有列 |
| `/urban/` | street_trees ×3、tree_pits、protected_trees、riverside_trees | ✅ root + dist fallback | ✅ 整夾 glob + sync |
| `/environment/` | urban_heat_lst_taiwan.pmtiles | ✅ root + dist fallback | ✅ 整夾 glob + sync |
| `/water_resources/` | lakes_ponds_osm.pmtiles | ✅ root（純 S3，刻意無 fallback） | ✅ 整夾 glob + sync |
| `/flood/`（D 層 `floodSensorIsochrone`） | uswg_isochrone_3min.pmtiles（47KB，**git 管理**） | ⚠️ **沒有 `location /flood/`** | ✅ upload/pull 都有 |

`/flood/` 是批 5 `hillshade.png` 缺口的**鏡像**：那個是兩條路都不通，
這個是 **git/dist 那條通、S3 那條死**（upload + pull 把檔推到 `/data/flood/`，
nginx 從來不讀那裡）。目前不會 404（dist 有檔），但 S3 那半是空轉；
若哪天該檔改成 S3-only（例如切片變大移出 git），就會變成真 404。
⚠️ **本批只核對記錄，未改任何部署檔。**

### 區塊註解不可信：本批是「註解與內容完全對得上」的對照組

前四批撞了五種變形。批 6 兩個主題的四張手寫表區塊**全部名實相符**——
但這不構成「可以按區塊整段刪」的理由：本批仍是逐 key 定位刪除，
只是這次逐 key 的結果與區塊剛好一致。**判準不變，變的只是運氣。**

---

## 2026-08-11 — Phase 2 批 7：47 層（廢棄物 18・農業 29）

`a1d7e3b` 前置護欄（第四支解析器）｜`6489881` 廢棄物｜`7e6e0a1` 農業

manifest 219 → **266 entry**（Phase 2 已搬 261/343）。四張手寫表對這 47 key 殘留
grep 命中 0（`^  key:` 與 `key: "key"` 兩種形狀分開數，各 0）。
`npx tsc -b` 0 error｜`npx vitest run` **507 passed | 1 skipped**（測試條數自批 1
起未增減）｜黃金快照 fixture 自 `8abbd97` 起**一位元未動**。

**本批無 schema 改動**（拍板②⑤⑥的三種擴充都夠用，47 層全在 THEMES 內），
唯一新增的是解析器 —— 那走批 1 / 批 4 的既有前例，不是新拍板。

### 前置護欄：第四種 popup 真值來源 `extractCustomHandlerFeatureTypes`（`a1d7e3b`）

廢棄物 13 層（wf* 9 + wd* 4）的點擊接線**完全不在 `useMapInteraction.ts`**：

| 檔 | 形狀 | 覆蓋 |
|---|---|---|
| `map/wasteMapboxLayers.ts` | 8 個 circle 子層各自 `map.on("click", coreLayerId, …)` | wf* 4 + wd* 4 |
| `map/wasteFacilityCustomLayer.ts` | `facilityRowToFeatureInfo`（目前無呼叫端，留作形狀證據） | — |
| `App.tsx` | 對 3D scene 的 raycast 結果 inline `setFeatureInfo` | 3D 設施 6 層 |

三支既有解析器一個都抓不到 → 這 13 層只能宣告 `popup: null`（已知為假），
Phase 3 派生 `GIS_LAYERS` 會靜默丟掉整個廢棄物主題的點擊。做法照批 1 / 批 4：
只回 type 字串、**不進 fixture**，由 `layerManifest.test.ts` union 進 `gisTypes`。

兩處實作細節值得記：

1. **兩條 regex 精確錨定值位置，不做整行掃描** —— wasteMapboxLayers 的 layerType 是
   **三元運算**（`props["kind"] === "facility" ? "wasteFacility" : "wasteDisposalPoint"`），
   整行掃 `"..."` 會把左邊的 `"kind"` / `"facility"` 一起收進 `gisTypes`。
   ternary 那條用 `[^\n?]*` 把比對範圍夾在該行第一個 `?` 之前。
2. **「有沒有抓到」逐檔判、不能用聯集大小** —— 三支檔都產出 `"wasteFacility"`，
   後兩支的**新增數**本來就可能是 0，用聯集判會誤報「接線消失」。

突變自測（臨時腳本，跑完即刪）：只餵三元式那行 → 只得
`["wasteDisposalPoint","wasteFacility"]`（noise 未被收入）；餵空檔 → throw。

### popup 判準的第五層修正：**有 click handler ≠ 有 popup**

批 4 立「D 體質 → popup null 是錯的捷徑」，批 5 立「HEADER_LABELS 有條目 ≠ 有 popup」。
批 7 的新反例是 `wasteSchedule`：`WasteScheduleScene.pickRoute` 命中後走
`setWasteScheduleTooltipInfo`（獨立 tooltip 狀態，同列車／公車 tooltip），
**不是 `setFeatureInfo`** → 不構成 FeatureInfo 接線，`popup: null`。

至此四個方向都有反例：D 不等於沒 popup；HEADER_LABELS 有不等於有；
不在 useMapInteraction 不等於沒有；**有點選互動也不等於有 popup**。
唯一可靠做法仍是逐層讀 hook 的 addLayer id 與 handler 實際 set 了什麼。

### 兩個主題的形狀

| | 廢棄物 18 | 農業 29 |
|---|---|---|
| dataClass | **D 17 / A 1** | **A 5 / B 9 / C 8 / D 7**（四種齊） |
| `legend: null` | **18/18** | 5/29（其餘 10 個 id 照機械規則取首 key） |
| popup 與 key 同名 | 0（13 → 2 家族 layerType、1 個去複數 s、4 個 null） | 21/29（1 個 7→1、3 個 null） |
| `labelMobile` | 14/18 | **0/29** |

- **廢棄物 legend 18/18 全 null** 是拍板④「不看圖層感覺該不該有圖例」規約遇過
  最極端的一次（前紀錄是批 2 的 14/28）。整個主題在 `LEGEND_REGISTRY` 一筆條目都沒有。
- **廢棄物 17 個 D 沒有一個是自繪**：全走 Supabase RPC（wasteLoader / wasteScheduleLoader），
  只是渲染各自建 source/layer 或 Three.js scene（同批 5 災害、批 6 水資源）。
  backlog 預估的「17 層 D」數字對了，理由同樣與預期不同。
- **`wfMonitoring` 是唯一兩套渲染路徑並存的一層**：既是 wasteFacilityCustomLayer 的
  6 個 3D sub-scene 之一，也在 wasteMapboxLayers 的 8 個 circle 子層裡。popup 兩邊
  都是 `wasteFacility`，宣告不受影響 —— 但它證明「一個 key 一種渲染」不是通則。
- **農業一個主題四種 dataClass 全到齊**（繼批 4 醫療、批 6 環境氣候之後第三次），
  backlog 預估的「8 C + 9 B」兩個數字都對，A/D 分佈未預估。
- **農業 D 7 層全是 `agricultureLayerFactory` 的 PMTiles factory**（同批 3 fireIsochrone /
  批 6 floodSensorIsochrone）—— 又一次證明「掃 dataClass B 去對部署清單會漏」。
  唯一例外是 `agriPOI`：D 之中唯一的 geojson lazy hydrate（空 FC 起手，visible 才 fetch）。
- **農業 C 8 層的 `fallbackUrl` 刻意不部署**：飼養場 7 + 屠宰場走 owner-only RPC，
  `livestock_farms.geojson` / `slaughterhouses.geojson` 在 upload 腳本裡有註解說明
  不上傳、pull 端還 `rm -f`。**這是斷 prod 供應的設計，不是部署缺口** ——
  觸點 #20 的機械斷言未來要能區分這兩者。
- 飼養場 7 層各自一筆 config **共用 `sourceId` `livestock-farms`**（同批 3 教育 ×7），
  仍寫單數形；popup 也是 7 → 1。⚠️ 它們同時列在 `GATED_LAYERS`，但 THEMES 的
  LayerDef **沒有** `gated: true` —— GATED_LAYERS 是另一張 runtime 表、不在派生的
  四張裡，manifest 的 `gated` 對齊 LayerDef 現況不填。

### 色票拍板①：47 個全部「不引用」

- 廢棄物：`wasteLoader` 的 `WASTE_FACILITY_COLORS` / `WASTE_DISPOSAL_COLORS` 是
  **facility_type / point_type-keyed**（餵 wasteMapboxLayers 的 circle-color）。
- 農業：`agriPOITypes` 的 `AGRI_POI_TYPES[].color` 是 **poi_type-keyed**（餵 factory 的
  match 表達式）。

兩者 `LAYER_COLORS` 都從未 import → 寫字面 hex。hex 逐一相同（`wfIncinerator` 的
`#ef4444` ＝ incinerator、`agriPOI` 的 `#6a1b9a` ＝ agritourism_certified）是巧合，
同批 5 `SATELLITE_COLORS` 的判準。`HANDWRITTEN_LAYER_COLORS` 自批 3 起無 spread 可刪。

### 區塊註解不可信：第七、八種變形

1. **orphan 夾在本區塊正中間**：`LAYER_COLORS` 的廢棄物區塊裡，`wasteRoute` /
   `wasteStop` 插在 `wasteCleaningSquads` 與 `wfIncinerator` 之間。它們**不在 THEMES**
   （由 wasteTruck 子 UI 控制，批 8 才搬），按區塊整段刪會連它們一起刪掉 ——
   而且刪了 tsc **會**擋（缺屬性），但那是最後一道防線。形似批 5 的 `osmExpressway`，
   差別在那個是「別主題」、這個是「根本不在 THEMES」。
2. **同一主題在同一張表裡分成兩段**（批 3「本主題 key 散在別處」的加強版）：
   三張表都有第二段農業 —— `LAYER_COLORS` / `LAYER_ICONS` 的
   `farmRoads` + `ecoNetworkZones`、`UPSTREAM_REGISTRY` 的面分區 3 + 土壤 3 + 那兩層，
   全落在教育註解之後。批 3 的 `schools` 是單一 key 走失，本批是**六到八個 key 一起**。

結論不變：**逐 key grep 定位再刪**。本批兩主題都用只讀腳本逐 key 定位執行。

### 雙生字（本批精確錨定清單）

`wasteSchedule` ≠ `wasteScheduleNote`｜`wasteStopsStatic` ≠ `wasteStop`（orphan）｜
`agriSoil` ≠ `agriSoilFertility`｜`aquacultureWaterSatellite` ≠
`aquacultureWaterSatelliteMoa` ≠ `aquacultureWaterUnion`。
一律用 `^  key:` 與 `key: "key"` 兩種精確錨定分開數。

### 記一筆現況出入（本次不動）

`aquacultureWaterUnion` 的 key 少一個 `satellite`：sourceId / 檔名 / sourceLayer
全都是 `aquaculture_water_satellite_union`。已在 entry 就地註明（同批 3
`forestAlishanRail` / 批 4 `medDesert` / 批 5 `buildingsGba` 的慣例）。

### ⚠️ 觸點 #20 逐檔比對：發現一個**新的兩條路都不通**

| 目錄 | nginx location | 結論 |
|---|---|---|
| `/geo/`（`waste_stops_static.geojson`，git 管理） | root + dist fallback | ✅ 走 dist |
| `/agriculture/`（16 檔） | root（**純 S3，刻意無 fallback**，同 `/sports/`） | ✅ 14 檔在 `AGRI_FILES`；2 檔刻意不傳（見下） |
| `/fishery/`（7 檔） | root + dist fallback | ⚠️ 見下表 |

`/agriculture/` 的兩個「不傳」是**設計**：`livestock_farms.geojson` /
`slaughterhouses.geojson` 已改走 owner-only RPC，upload 腳本註解在案、pull 端 `rm -f`。

`/fishery/` 逐檔：

| 檔 | git/dist | `FISHERY_FILES`（S3） | 結論 |
|---|---|---|---|
| `aquaculture_ponds_osm.pmtiles` | gitignore | ✅ | ✅ |
| `aquaculture_production_zone.geojson` | ✅ | ✅ | ✅ 雙保險 |
| `aquaculture_cage_net.geojson` | ✅ | ✅ | ✅ 雙保險 |
| `aquaculture_water_satellite.pmtiles` | gitignore | ✅ | ✅ |
| `aquaculture_water_satellite_moa.pmtiles`（10.2MB） | ✅ | ❌ | ⚠️ S3 那半空轉（批 6 `/flood/` 的鏡像） |
| `aquaculture_water_satellite_union.pmtiles`（3.1MB） | ✅ | ❌ | ⚠️ 同上 |
| **`aquaculture_integrated.pmtiles`** | **gitignore L126** | **❌** | ❌ **兩條路都不通** |

**`aquaculture_integrated.pmtiles` 是批 5 `base_map/hillshade.png` 之後第二個
「兩條路都不通」**：gitignore 第 126 行排除（無 git → 無 dist）、不在 `FISHERY_FILES`
（無 S3 → `/data/fishery/` 沒有）、本地 `public/fishery/` 也沒有這個檔。
`aquacultureIntegrated` 這層的 `source.url` 指過去會 404。

⚠️ 待 owner 確認：prod 是否曾**手動**上傳過該檔 —— pull 端對 `/fishery/` 是整夾
`aws s3 sync`，手動傳進 S3 前綴就會流下來，腳本清單漏列不必然等於線上壞掉。
修法一行：把它加進 `FISHERY_FILES`（moa / union 兩檔同理，讓 S3 那半不再空轉）。

⚠️ **本批只核對記錄，未改任何部署檔。**

---

## 2026-08-11 — Phase 2 批 8：82 層（交通 31・能源 41・orphan 10）→ **348/348 全量完成**

`1eb4911` 拍板③ schema｜`385abae` 交通 18｜`705cf06` 交通 13｜
`3eedab8` 能源電力 15｜`1763d7a` 能源石化 15｜`97fe82f` 能源再生+覆蓋 11｜
`462c05a` orphan 10

manifest 266 → **348 entry**。Phase 2 結案。

### 終局斷言（機械核對，不是人工目測）

| 項目 | 結果 |
|---|---|
| LayerVisibility key 數（黃金 fixture `colors`） | **348** |
| `LAYER_MANIFEST` entry 數 | **348** |
| 三方相等／未搬移／多出／重複 | ✅ ／ 0 ／ 0 ／ 0 |
| `section: null`（orphan）entry | 10 |
| `HANDWRITTEN_LAYER_COLORS` 表內非註解行 | **0** |
| `HANDWRITTEN_LAYER_ICONS` 表內非註解行 | **0** |
| `HANDWRITTEN_UPSTREAM` 表內非註解行 | **0** |
| `THEMES` 的 LayerDef 字面殘留 | **0**（338 個全走 `fromManifest`） |
| 行首色票 spread 殘留 | 0 |

`npx tsc -b` 0 error｜`npx vitest run` **507 passed | 1 skipped**（測試條數自批 1
起未增減）｜黃金快照 fixture 自 `8abbd97` 起**一位元未動**。

### ⚠️ 拍板③ 落地，且必須擴大（代拍，待 owner 追認）

原始拍板只寫「`section` 允許 null」。實際做下去發現**不夠**：黃金快照的 `labels`
section 只有 338 筆 —— 10 個 orphan **連 label 都沒有**（`LAYER_LABELS` 由 THEMES
派生，沒有 LayerDef 就沒有 label），而 `label` 是必填欄位。

**不替 orphan 發明 label**：那會在 SSOT 裡放一個沒有任何登記簿能驗證的事實，
正是 `layerManifest.test.ts` 開頭那段（沒人驗證的宣告會悄悄爛掉、等 Phase 3 要拿來
派生時才發現對不上）要防的東西。`legend` / `popup` 用 null 表達「有意識地沒有」，
這裡改用**型別**表達「不存在」：

```ts
LayerManifestThemedEntry  section: LayerSection + label/labelMobile/expandable/gated
LayerManifestOrphanEntry  section: null        + 上述四欄皆 `?: never`
type LayerManifestEntry = Themed | Orphan      // 判別欄位 = section
```

共同欄位抽成 `LayerManifestBase`（`color` / `icon` / `upstream` 三張 348-key 全量表
orphan 也在裡面，照樣派生）。**266 筆既有 entry 一個字元未動。**

⚠️ `?: never` 不是「選填」的花俏寫法：union 的 excess property check 取**所有成員
屬性的聯集**，單純省略欄位擋不住 orphan 偷寫 `label`（不算 excess，assignability 也過）。

`fromManifest` 加 orphan guard（throw）：走到那裡代表有人把 orphan 寫進 THEMES，
是接線錯誤不是資料錯誤，早炸勝過渲染一顆沒有文字的 toggle；順帶把 union 收斂成 themed。

契約測試兩處**就地改寫**（未增減條數）：`section` 斷言改**雙向**（null ⇒ themeLocation
必須也是 null —— 只驗單邊的話「把還在 THEMES 的層宣告成 orphan」會靜默過關，等於讓它
從派生鏈消失）；LayerDef 斷言對 orphan 走反方向 pin（THEMES 查無此 key ＋
`LAYER_LABELS[k]` 也是 undefined）。

四次突變自測（暫時 entry，驗完即刪）：
1. `cctv.section` 改 null（label 還在）→ **tsc 紅**（兩個變體都不接受）
2. 暫時 orphan entry 寫假 `section` → 契約測試**兩條紅**
3. 暫時 orphan entry 寫 `label` → **tsc 紅**（label 不可為 never）
4. 暫時 orphan entry 正確寫 `section: null` → 12 條全綠（正控組）

### 「orphan」只描述「不在 THEMES」，**不等於死碼**

backlog 與 `UPSTREAM_REGISTRY` 都用 "stale/unused color" 稱呼這 10 個 key，
逐一打開後發現是三種完全不同的東西：

| 體質 | key | 實況 |
|---|---|---|
| ① 有 registry entry ＋ 有 consumer（5，全 C） | facOffshore / islandPowerGrid / osmSolarFarms / osmPowerPlantsStatic / powerPlants | App.tsx 照樣把 `layerVisibility.<key>` 餵進 `useEnergyPoiLayer`，只是被 SSOT 6-layer 取代後移出 sidebar（key 與渲染都保留） |
| ② 無 registry entry 但**有 consumer**（2） | powerStatusHud / powerRegionDemand | monitor 面板的供電燈號 HUD ＋ 北中南東 4 區 3D bars；App.tsx 909 行以 `\|\|` 合成 `energyDashboardActive` 驅動 `usePowerDashboard`（5 分鐘 poll，兩層共用不重複拉） |
| ③ 真的沒有渲染（3） | medICUBeds / wasteRoute / wasteStop | medICUBeds 全 repo 無 hook；另兩個見下 |

⚠️ ②的 `UPSTREAM_REGISTRY` note 寫 "stale/unused color" 是**過時的**，
照抄（搬移零失真）但在 entry 就地註明實況。

⚠️ **`wasteRoute` / `wasteStop` 是新的現況出入**：`layerConsistency` 註解稱
「由 wasteTruck 子 UI 控制」，逐檔 grep 全 repo **找不到任何 consumer**
（只有 types 宣告 ＋ 三張全量表）。照現況登記並註明，修對應是另一件事
（同批 3 `forestAlishanRail` / 批 4 `medDesert` / 批 7 `aquacultureWaterUnion`）。

### legend 家族跨越「在不在 THEMES」這條線，**而且是雙向的**

- orphan 沿用 THEMES 成員的 id：`islandPowerGrid` → `"offshoreWindZones"`、
  `osmSolarFarms` / `osmPowerPlantsStatic` → `"osmWindTurbines"`
- **反過來**：`powerPlants`（orphan）自己是家族首 key，THEMES 裡的
  `powerGenerationUnit` 得沿用它 → `legend: "powerPlants"`

10 個 orphan 有 **7 個非 null legend**（null 的只有 medICUBeds / wasteRoute /
wasteStop —— 恰好就是「真的沒有渲染」那 3 個）。⚠️ Phase 3 依 legend 分組派生
`LEGEND_REGISTRY` 時**不能只掃有 section 的 entry**，兩個方向都會漏。

### popup 判準：第五層修正的最大規模實例（有點選互動 ≠ 有 popup）

交通「即時運具」5 層裡**只有 `ships`** 走 `setFeatureInfo`，其餘四層命中後另有去處：

| key | 命中後去哪 | popup |
|---|---|---|
| `busLive` / `touristShuttleLive` | `setBusTooltipInfo`（兩者共用同一個 bus tooltip） | null |
| `flights` | `setTooltipInfo`（flight tooltip，含高度計算） | null |
| `busIntercityLive` | `useMapInteraction` **連 picking 分支都沒有** | null |
| `ships` | `setFeatureInfo({ layerType: "ship" })` | `"ship"` |

照「Three.js scene 一定有 popup」推會四層全填錯（批 7 `wasteSchedule` 的同款，
一次四個）。`ships` 由批 4 的 `extractNonGisFeatureTypes` 涵蓋。

**第六種「只有反查才看得出來」：有 registry entry 卻 `popup: null`** ——
`stationsTHSR` 的 4 個 layer id 全是 `station-polygons-thsr-poly-*`，而 `GIS_LAYERS`
的 `railStation` 兩筆收的是 `station-points-{tra,metro}-pt-*`。三個車站層長得極像，
憑「都是車站」推會多派生一組假接線。反過來 `stationsTRA` / `stationsMetro` 是
**兩組 layer id 共用同一個 layerType**（批 4「兩個 key 一個 layer」的鏡像）。

`osmExpressway` 則是批 5 `hillshade` 反例的第二例：`HEADER_LABELS` 有
`"快速道路 (OSM)"`，`GIS_LAYERS` 沒有條目 → `popup: null`。

### `powerPlant` 是全 manifest 最大的 popup 多對一：**8 個 layer 共用**

`facPrimary` / `facPlanned` / `facHistorical` / `facSecondary` / `facOsmSupplement` /
`powerGenerationUnit`（批 8-3）＋ orphan `powerPlants` / `facOffshore`。
超過批 3 教育 `school` 的 1 對 7，且與批 5 太空 16→1 **不同類** ——
那是 16 個 toggle 對同一份 source 做 filter 切分，這裡是**六份不同 RPC 的結果共用一個
panel**。Phase 3 依 popup 派生 `GIS_LAYERS` 時 8 筆各自要有自己的條目，不能去重。

### legend 14 → 1：本工程第二大共用（僅次於批 4 執法治安的 18）

石化 14 層共用一筆 entry → 首 key `"gasStationCpc"`。⚠️ 第 15 層 `fossilFuelInfra`
**不屬這個家族**（掛 `EnergySpecialtyLegend`，首 key `offshoreWindZones`，那些層在
再生能源子群）。批 6 立的「**逐 registry entry 判、不是逐 sidebar 子群判**」再次生效。
⚠️ `fossilFuelInfra` 也是石化唯一的 key ≠ layerType（→ `fossilFuelFacility`）——
**legend 與 popup 兩個維度的例外剛好同一層**，因為它是 legacy 層、當初跟能源 MVP
一起接的線，兩張表都留在舊家族裡。

### 拍板②第五個「同 key 多 config」：`stationsTRA` ×2

面（`station-polygons`）在前、點（`station-points`）在後，順序＝OVERLAY_REGISTRY
出現序（決定疊放，測試逐位對齊）。兩筆 kind 同質（geojson）→ `dataClass` 直接是 A，
不走批 6 的 precedence。popup 只由第二筆貢獻。

### 三張手寫表歸零：degenerate case 已實測

`ManifestKey` 現在涵蓋全部 348 key → `Omit<Record<全集>, ManifestKey>` 退化成 `{}`。
**空物件字面合法**（tsc 0 error），護欄語意仍在：從 manifest 刪任何 key 會立刻讓合成的
`Record` 缺屬性而報錯。三張表**保留不刪** —— Phase 3-4 若有新 key 一時無法進 manifest
（例如 section 未定），這裡是唯一合法暫放處。逐批的「已搬走」roll-call 註解收斂成一段
說明（歷史在本檔）；批 1 記載的「spread 不觸發 excess property check」警告保留在
COLORS 表。`IconRailSidebar` 的 lucide import 從 60 行縮到 13 行 ——
剩下的沒有一顆是餵圖層的，全是本元件自己的 UI。

### ⚠️ 手寫殘留清單（扣除機制性程式碼後**唯一**剩下的一項）

**`TRANSPORT_LABELS`（`layerCatalog.ts`）—— 第五張表，不在派生的四張裡。**
`Record<TransportType, string>` 6 筆，值與 manifest 的 `label` 逐字重複
（`rail` 自 Phase 1 試點起即如此，其餘 5 個自批 8 起）。**不搬的理由**：它的 key 空間是
`TransportType` 不是 `keyof LayerVisibility`，硬套 `Omit<…, ManifestKey>` 會弄壞型別
意義。已就地註記，留給 Phase 3 連同 `LEGEND_REGISTRY` / `GIS_LAYERS` 一起派生化。
處置同批 7 的 `GATED_LAYERS`（另一張 runtime 表，同樣不在四張裡）。

### 區塊註解不可信：第九、十種變形

9. **`aviationRestrictedGlow` 名字與資料都是航空**（共用 `aviation_airspace.pmtiles`），
   THEMES 位置卻在**能源 / 電力 · 廠**（跟其他 Bloom 測試層放一起）。按名字猜主題會猜錯。
10. `UPSTREAM_REGISTRY` 標著「Stub entries for keys **not in THEMES**」的那一段，
    中間夾了 4 個 Bloom/Glow —— **它們是在 THEMES 裡的**，只是同樣掛 `pulse_only`。
    按段落標題判斷會誤以為它們是 orphan。

（另 `osmExpressway` 是批 5 記過的第五種變形實際執行，`wasteRoute`/`wasteStop`
是批 7 記過的第七種。）

### 雙生字（本批密度最高，一律用 `^  key:` 與 `key: "key"` 兩種精確錨定分開數）

`powerPlants`（orphan）≠ `powerPlantGlow` ≠ `osmPowerPlantsStatic`（orphan）≠
`industrialPowerPlant`（popup 也不同：後者是 `industrialPowerPlant`，前三個走
`powerPlant`）｜`osmPowerLines` ≠ `powerLinesGlow`｜`osmSubstations` ≠
`osmSubstationsEhv` ≠ `substationEhvGlow`｜`gasStation*` 5 ≠ `gasCoverage*` 4｜
`wasteStop`（orphan，無 consumer）≠ `wasteStopsStatic`（批 7，真的在渲染）｜
`serviceArea` ≠ `serviceAreaPolygon`（兩個獨立 key/source/popup，色票成對不是共用）。

### 其餘形狀

- **dataClass 分佈**（機械統計，非人工重數 —— 見下方「⚠️ 數字更正」）：
  交通批 8 內 31 層 = A 13 / B 4 / C 2 / D 12（加試點 rail/cctv → 主題 33 層
  A 14 / B 4 / C 2 / D 13，**四種全到齊**，第四個這樣的主題）；
  能源 41 層 = **A 1 / B 5 / C 30 / D 5**（A 只有 `windPlan`；D 只有 4 個 Bloom/Glow
  ＋ `powerPoles`）；orphan 10 = C 5 / D 5。
- **`busStationsCity` 是 PMTiles、`busStationsIntercity` 是 geojson** —— 同一個子群
  兩種載入路徑，掃主題判體質會錯。
- `roadCongestion` 的 GIS_LAYERS 條目是 `road-congestion-hit`：**刻意加的透明加寬命中層**
  （四鐵則③ 細線點擊命中率）。對照組 `freewayCongestion` 沒補這層 → `popup: null`。
- `powerGenerationUnit` 的 registry config 只有一個 `hit` 層（柱體是 Three.js
  `PowerGenerationBeamScene`）—— 有 entry → C 不是 D。
- **`windPlan` 的 `params: null` 是 emptyByDesign**（Phase 0 記錄的 5 key 之一），
  不是抽取器漏掃。
- **衍生型 upstream 首次進 manifest**：`gasCoverageAll` / `evIsland` 帶
  `derivedFromLayers` ＋ `derivationType` ＋ `processing`，manifest **照抄整包**；
  只抄 status/datasets 會靜默丟掉「本站自己從別的 layer 算出來的」這件事。
- **能源 C 層的 `fallbackUrl` 是第三種形狀**：一律 `./geo/_empty.geojson`（空殼）。
  對照批 7 農業 C 層是「真檔但刻意不上傳」。三種都不是部署缺口，觸點 #20 的機械斷言
  未來要能區分：① 真檔會部署 ② 真檔刻意不部署（owner-only RPC）③ 檔本身是空殼。
- `powerLinesGlow` 走純 Mapbox 4-pass line-blur 而非 Three.js 是**硬限制**：
  App.tsx 已為 `OsmPowerLinesGlowScene` 掛了一個 `THREE.WebGLRenderer`，
  同一個 Mapbox gl context 塞第二個會狀態互污。

### ⚠️ 觸點 #20 逐檔比對：第三個「兩條路都不通」

| 目錄 | 檔 | git/dist | S3 upload | nginx | 結論 |
|---|---|---|---|---|---|
| `/coverage/` | `aviation_airspace.pmtiles`（1.3MB）、`drone_restricted_zones.pmtiles`（11.7MB） | ✅ git | ❌ | root ＋ dist fallback | ✅ 走 dist |
| `/coverage/` | `taiwan_*_nearest.pmtiles` ×5（覆蓋分析） | ✅ git | ❌（**刻意**，gitignore 註解「gas coverage 小檔仍進 git/dist」） | 同上 | ✅ 走 dist |
| `/coverage/` | **`power_poles.pmtiles`（26MB）** | ❌ **gitignore L82** | ❌ **不在 upload glob** | 同上 | ❌ **兩條路都不通** |
| `/road/` | `road_congestion_highway.pmtiles`（3.1MB） | ❌ gitignore L97 | ✅ `public/road/*.pmtiles` glob | root（純 S3） | ✅ |
| `/base_map/` | `osm_expressway.pmtiles` | ❌ gitignore L96 | ✅ `public/base_map/*.pmtiles` glob | root（純 S3） | ✅ |
| `/geo/` | 批 8 的 11 個 geojson ＋ 3 個 pmtiles | 混合 | 逐檔清單 ＋ pmtiles glob | root ＋ dist fallback | ✅ |

**`power_poles.pmtiles` 是批 5 `base_map/hillshade.png`、批 7
`fishery/aquaculture_integrated.pmtiles` 之後的第三個。**這個特別值得記，因為
**兩處註解自相矛盾**：`.gitignore` 第 81-82 行寫「走 S3 deploy-assets/coverage/」，
但 `upload-deploy-assets.sh` 第 353 行的 coverage 迴圈是 `public/coverage/real_estate_*`
且註解明寫「只上傳 `real_estate_*`」。本地 `public/coverage/` 也沒有這個檔。
`powerPoles` 這層的 `source.note` 指過去會 404。

修法一行：把 coverage 迴圈改成也涵蓋 `power_poles.pmtiles`（或加進逐檔清單）。
⚠️ 同批 7 的提醒：pull 端對 `/coverage/` 是整夾 `aws s3 sync`，
若 prod 曾**手動**傳進該前綴就會流下來 —— 腳本清單漏列不必然等於線上壞掉，待 owner 確認。

另記一筆（非缺口）：`public/coverage/taiwan_other_nearest.pmtiles` 在 git 裡，
但 348 個 key 沒有任何一個引用它（`gasStationOther` 有、`gasCoverageOther` **沒有**）
—— 是 POC 時期的遺留檔。

⚠️ **本批只核對記錄，未改任何部署檔。**

### ⚠️ 數字更正（本段所有分佈數字改由腳本統計，不再人工重數）

批 8 收工當下的散文分佈數字是**人工重數**的，事後用一支「逐 entry 解析 manifest
原始碼、按子群 key 清單 tally `dataClass` / `legend`」的腳本核對，發現四處錯：

| 位置 | 原寫 | 實際 |
|---|---|---|
| 能源 41 層體質 | C 26 / D 10 / B 5 | **A 1 / B 5 / C 30 / D 5** |
| 交通批 8 內 31 層 | A 11 / B 4 / C 2 / D 14 | **A 13 / B 4 / C 2 / D 12** |
| orphan 非 null legend | 6 | **7** |
| 批 8-3 段頭（`layerManifest.ts`） | C 9 ／ D 6、「5 個 Bloom/Glow」 | **C 10 ／ D 5、4 個 Bloom/Glow**（第 5 個 D 是 `powerPoles`；`powerPlants` 是 legacy orphan 不是視覺實驗層） |
| 批 8-1 段頭（`layerManifest.ts`） | A 6 ／ B 1 ／ D 11 | **A 8 ／ B 1 ／ D 9** |

**這推翻了下方 backlog 對批 8「預估錯的三處」中的兩處** —— 原預估
「能源 30 層是 C 體質」**是對的**（恰好 30），「交通 13 層 D」也**是對的**
（批 8 內 12 ＋ 試點 `rail` = 13）。真正預估錯的只有「orphan 不等於死碼」那條。
backlog 批 8 欄已同步改寫。

⚠️ **commit message 裡的分佈數字（`385abae` / `3eedab8` / `705cf06`）未修**
—— 那些 hash 已被本檔與 backlog / README 引用，rebase 會讓引用全斷。
**以本檔的數字為準，commit message 的分佈句子作廢。**

教訓：`final_audit.py` 當時只驗了「身分／覆蓋／殘留」（348 三方相等、手寫表歸零），
**沒有驗分佈**，所以散文數字漂了也全綠。分佈是「宣告的一部分」，
下一批（Phase 3）的驗收腳本要一併 tally，不要留給人腦。

## 2026-08-11 — 護欄平反 ＋ 上游改名吸收（rebase 到 master `c016f15`）

### 起因：一則「黃金快照有盲區」的指控

現場觀察到三件事，被組合成「批 7 搬移失真 ＋ 抽取器對 upstream datasetId 是盲的」：

1. master 手寫 `upstreamRegistry.ts` 的 `aquacultureWaterUnion` datasetId 是
   `aquaculture_water_sat_union`
2. 分支 manifest 同一個 key 寫的是 `aquaculture_water_satellite_union`
3. 黃金快照**全程綠**，卻是主樹的 cross-repo `upstreamRegistry.test.ts` 抓到差異

### 結論：三個觀察都屬實，但推論是錯的 —— 批 7 零失真、抽取器零盲區

**(a) 抽取器本來就記整包。** `layerGoldenExtract.ts` 的 upstream section 是
`sanitize(Object.fromEntries(keys.map((k) => [k, UPSTREAM_REGISTRY[k]])))`
—— 整個 `UpstreamRef` 物件，不是挑欄位。fixture 裡 `datasetId` 逐字存在。
本次改掉 manifest 的 datasetId，fixture 立刻跟著變 —— 直接反證「盲」。

**(b) 差異不是失真，是分支還沒吸收 master 的新 commit。** 分歧點：
`git merge-base` = `889cf96`，master 上多出 `c016f15`（2026-08-11 14:39，B170：
上游 analytics 當天改了 3 個 fishery dataset_id）。在 `889cf96` 上，手寫
`upstreamRegistry.ts` 第 547 行寫的**正是** `aquaculture_water_satellite_union`
—— 批 7 的註解「照現況登記不夾帶改名」是**準確**的，它忠實登記了當下的值。
`c016f15` 的 commit message 自己也寫明「feat/layer-manifest 分支 merge 時需自行
rebase 這個改名」。

**(c) 快照綠是正確行為，不是失靈。** fixture 由分支自身狀態產生，分支內部自洽 →
本來就該綠。會紅的是 cross-repo 那條（比對 analytics catalog 的**當前**內容），
它紅得完全正確。**護欄沒有漏接，是兩把尺量的東西不同。**

### 全欄位對帳（拋棄式腳本，逐 key 深度比對）

把手寫 `UPSTREAM_REGISTRY` 字面 eval 出來，與分支 runtime（= fixture 的 upstream
section）348 key × 全欄位 canonical 比對：

| 比對對象 | 差異 |
|---|---|
| merge-base `889cf96` 手寫 vs 分支 runtime（rebase 前） | **0 筆** ← 批 7 零失真的證明 |
| master `c016f15` 手寫 vs 分支 runtime（rebase 前） | 1 筆（僅 `aquacultureWaterUnion`）|
| master `c016f15` 手寫 vs 分支 runtime（**本次修正後**）| **0 筆** ← 收斂證明 |

欄位覆蓋兩端一致，無欄位在搬移中被吃掉：
top = `status` `datasets` `derivedFromLayers` `derivedFromDatasets` `derivationType`
`processing` `note`；`datasets[]` = `datasetId` `confidence`。

### 動作：rebase ＋ 改名同步

`git rebase master`（47 commit 重放到 `c016f15`）。兩處衝突都在
`upstreamRegistry.ts`，都是「master 仍手寫 vs 分支已刪除搬進 manifest」，
一律**以分支的刪除為準**（值已活在 manifest）：

- 批 7 `7e6e0a1`（rebase 後 `c36f719`）—— 農業區塊含被改名的那行
- 批 8-6 `462c05a`（rebase 後 `04d059a`）—— `HANDWRITTEN_UPSTREAM` 清空

⚠️ **本檔與 backlog / README 引用的分支 commit hash 全部因這次 rebase 失效**
（47 個 commit 都被重寫）。上方批 8 段落當時已預告「rebase 會讓引用全斷」，
現在成真了。本段只補了衝突相關的兩筆新舊對照；其餘引用是否要整批補 mapping，
留給 owner 決定 —— 反正 merge 進 master 前還可能再 rebase 一次。

改名同步進 manifest（`97a793b`）：`upstream.datasetId` 與 `source.url` 改新名；
`source.sourceId` 與 `source.sourceLayer` **刻意保留舊名** —— MVT 內部層名烙在
2026-07 版 pmtiles 二進位裡（`tippecanoe --layer aquaculture_water_satellite_union`），
要等上游重產 pmtiles 才會變（依 `c016f15` 於 `overlayRegistry.ts` 的註記）。

另兩筆改名（`fishery_port_zones_class1` / `aquaculture_release_survey_g70`）
全 repo grep 只命中 `public/fishery/` 的檔案本身，**無任何程式引用** → 不進 manifest。

### fixture 變動 —— 合法變動第一例

`layer-golden.json` 自 Phase 0 凍結以來**第一次**變更，diff 恰為 2 個值：

| section | 欄位 | 誰改的 |
|---|---|---|
| `upstream` | `aquacultureWaterUnion.datasets[0].datasetId` | 本次 manifest 同步 |
| `overlays` | 對應 entry 的 `sourceUrl` | `c016f15` 改 `overlayRegistry.ts`，rebase 帶進來 |

依據 = 上游 B170 改名（`c016f15`），非搬移失真。同 entry 的 `sourceId` /
`sourceLayer` 在 fixture 中維持舊名 —— 「刻意不改」這件事有被凍結保護住。

⚠️ 這次的合法性建立在**先對帳、後重生**：先證明「除該筆上游改名外，分支 runtime
與 master 手寫逐位元相同」，才動 fixture。順序反過來（先重生再說服自己）
等於把護欄拆掉。

### 副產品：`layerManifest.test.ts` 當場證明自己有用

rebase 完成、manifest 還沒同步的那個中間狀態，`source + dataClass 宣告 =
OVERLAY_REGISTRY 的實際形狀` 這條**立刻紅**，訊息直接指出
`'./fishery/aquaculture_water_sat_union…' vs './fishery/aquaculture_water_satellite…'`
—— manifest 與 overlayRegistry 的一致性契約確實擋得住「上游改名只改了一半」。

### 驗收

`npx tsc -b` 0 error；`npx vitest run` 39 檔 507 passed / 1 skipped。
skipped 的是 cross-repo `upstreamRegistry.test.ts`（worktree 沒有 sibling
`taipei-gis-analytics` 會自動跳過）—— 在主樹跑該測試，預期只剩
`fireHydrants → fire_hydrants` 一筆紅，那是 catalog 端缺口，**pre-existing 且屬另案**。

---

## 2026-08-11 — Phase 3 第一棒（P3-1）：params 通用 store ＋ 渲染器 ＋ 11 層試點

`43386d6` `feat(params): 通用 param store + 宣告式規格（AR-22 P3-1 第 1 步）`
`96db21d` `feat(params): 通用 getControls 渲染器 + useTransportParams 雙軌接線`
`1343ae9` `refactor(params): 試點遷移 11 key（宗教 6 ＋ 殯葬 5）出 useTransportParams`
`6fff4e3` `test(params): 補渲染器行為測試（黃金快照的結構性盲區）`

開始退役 `useTransportParams`（3,160 行單檔／645 個 `useState`／539 項手寫 deps ——
本專案唯一認定的大型結構債）。本棒做地基與試點，不做全量。

### ⚠️ Phase 編號與本檔先前排程不同

README 原本寫「Phase 3 = legend/popup 派生、Phase 4 = params 派生」。
本次任務書把 params 排成 **Phase 3 第一棒（P3-1）**，legend/popup 順延。
下方一律以任務書的編號為準，README 的表已同步。

### ⚠️ 拍板：完整規格**不進 manifest**，另立 `layerParamsSpec.ts` 並用測試焊回

任務書寫「初始值來自 manifest params spec 的 default」—— **那個欄位不存在**。
manifest 的 `params` 是 Phase 1 定的佔位 `{ count, kinds }`，只記形狀不記內容：
沒有 default / min / max / step / label / options。

而把完整規格塞進 manifest 會直接撞上它自己寫在檔頭的 import 鐵則
（「只能 import `../types`、lucide-react，以及**零 import 的純色票常數檔**」）：
select 的 options 來自 `pollutionTypes`（自帶函式）／`cropSuitabilityCrops`（132 筆）／
`fireIsochroneCounties`／`agriSoilFertilityMetrics` 等一二十個資料模組，
全量遷移時會把它們整批拉進 manifest —— 製造 cycle，也讓一個 9,330 行的檔繼續膨脹。

所以：**形狀的 SSOT 仍是 manifest，內容的 SSOT 是 `src/data/layerParamsSpec.ts`**，
兩者由 `layerParamsStore.test.ts` 的第一條斷言焊死 ——
「spec 派生的 count / kinds ＝ manifest 宣告的 count / kinds」，對不上就紅。
本棒因此**一行都沒動 `layerManifest.ts`**。

### 三個檔的分工（相依單向，不回頭）

| 檔 | 職責 | 不知道的事 |
|---|---|---|
| `src/data/layerParamsSpec.ts` | 規格 SSOT：label 模板 ＋ toFixed 位數 ／ default ／ min-max-step ／ select options ＋ `encode` ＋ overlayParams `out` key | React、store、`ParamControl` |
| `src/state/layerParamsStore.ts` | **值**：get/set/subscribe/reset ＋ `useLayerParams` ＋ `encodeParamsToOverlay` | UI 型別 `ParamControl` |
| `src/state/layerParamsControls.ts` | spec ＋ 值 → `ParamControl[]`（未遷移回 `null`） | — |

store 模式完全比照 AR-21 的 `layerVisibilityStore`（再往上是 `timeStore`）：
模組級 state ＋ subscribe，同值不通知；**per-key 內層物件 identity 只在該 key
真的變動時才換新**（`useSyncExternalStore` 的硬性要求，回新物件會無限迴圈）。
未遷移 key 的 `getParams` 回**同一個 frozen 空物件**，同理由。

### 雙軌只有兩處分岔

```
getControls(layer)  → buildParamControls(layer, snapshot[layer]) ?? 既有 switch
overlayParams       → { …既有 500+ 行字面, ...migratedOverlayParams }   ← spread 放最末
```

deps 陣列對未遷移 key 一項未動；遷移的 27 項整組收斂成首項 `migratedOverlayParams`。

spread 刻意放**最末**：遷移途中若某 key 的手寫字面還沒刪，以規格派生為準。
`96db21d` 就是這個中間狀態 —— 11 個 case 已成死碼但尚未刪除，黃金快照全綠，
等於在「還能一鍵回退」的狀態下先證明渲染器與手寫 case 逐位等價。

### ⚠️ 那一行 `useSyncExternalStore` 是行為等價的關鍵（黃金快照的結構性盲區）

快照凍結的是「**預設值下跑一次** `getControls` 得到什麼」。
它驗不到「拖了之後畫面有沒有更新」——
手寫 case 的 onChange 是 `setXxx`（React state，會觸發本 hook 重跑），
遷移後是 `store.setParam`（本 hook 預設不知情）。少了 hook 內那一行訂閱，
slider 拖動時 store 有變、`overlayParams` 不重算 → **畫面毫無反應，
且無錯誤、無警告、快照全綠**。

因此另立 `layerParamsControls.test.ts` 5 條補這個盲區（onChange 回寫 ／
label 依 toFixed 位數重算 ／ select 連動 overlayParams 的 Idx ／
傳入快照優先於 store 現值）。

### 三個「編得過但值悄悄不一樣」的陷阱（都被快照擋在第一次）

1. **slider 不帶 `type` 欄位** —— `SliderConfig.type` 是選填，330 個手寫 case
   一律省略。渲染器若補一個 `type: "slider"`，tsc 全綠、畫面照跑，只有快照會紅。
2. **label 是模板不是字面**，且位數逐控件不同：`透明度 ${v.toFixed(2)}` ／
   `大小 ${v.toFixed(1)}`。規格因此拆成 `labelPrefix` ＋ `digits`。
3. **`religionAncestralHalls` 的顯示表與編碼表不是同一張**：
   options 用 `REGISTRY_MODES_ANCESTRAL`（false 是「文資祠堂」不是 OSM），
   但 overlayParams 的 `.indexOf` 用的是 `REGISTRY_MODES`。
   兩張 value 序列碰巧相同、只有 label 不同 —— 寫成同一個現在不會紅，
   將來任一張改動就靜默錯位。規格把 `options` 與 `encode` 分成兩欄正是為此。

另有一個非陷阱但要照抄的：`funeralOperators` 的 default 是 `"active"` 不是 `"all"`
（不濾會多畫 1,664 個已失效業者）。

### 兩條 ratchet 需要就地調整 —— 都是「參數的家從一處變成兩處」

兩者原本都以「原始碼含 `case "key"`」當作「這層有參數」的**唯一**判準：

| 檔 | 改法 | 不改的後果 |
|---|---|---|
| `layerGoldenExtract.paramsCaseKeys()` | `all` 改成 case ∪ `MIGRATED_PARAMS_KEYS` | 已遷移 key 變成「抽到控件卻查無來源」的幽靈，反向斷言誤報 |
| `layerConsistency` 的 `hasParamsCase` | `\|\| isMigratedParamsKey(key)` | 每遷一批就有一批被誤判成「漏接透明度 slider」 |

兩處都是**擴大真值來源**而非放寬判準 —— 被擋的行為一項未減。
反向斷言（「抽到控件的 key 一定查得到宣告來源」）要保留，它擋的是「控件憑空出現」。

`overlayParamsDeps.test.ts` **不需要改**：它只驗「進了 overlayParams 物件的 state
有沒有進 deps」，而宣告與引用是一起刪的 → 539 → 512，自動收斂。

### 試點 11 key（宗教 6 ＋ 殯葬 5）與挑選理由

`religionTemples` `religionChurches` `religionAncestralHalls` `religionFoundations`
`religionOtherWorship` `religionTop100` ／ `funeralFacilities` `funeralOperators`
`funeralOperatorDensity` `cemeteryOsm` `cemeteryZoning`

控件單純（opacity / size slider ＋ select），但**三種 select 形狀齊全**：
`OPTIONS` 直用（`REGISTRY_MODES`）／`["all", ...OPTIONS.map(v)]` prepend
（`DEITY_FAMILIES`・`FUNERAL_FACILITY_TYPES`）／顯示表 ≠ 編碼表（宗祠）。
且 27 個 state 的引用點恰好只有四處（宣告／memo 字面／deps／case），
沒有外溢到 ref 或其他回傳物件 —— 刪得乾淨，適合當第一棒。

### 驗收（硬證據）

| 項 | 結果 |
|---|---|
| `layer-golden.json` | **零 diff** —— 348 key 的 `params` section 與 `overlays` 的 paint 求值（吃 overlayParams 全集）逐位元不變 |
| `npx tsc -b` | 0 error |
| `npx vitest run` | 40 檔 **518 passed / 1 skipped**（507 基準 ＋ 11 store 契約；`layerParamsControls` 的 5 條在下一 commit 為 523） |
| `useTransportParams.ts` | 3,160 → **3,085** 行；`useState` 645 → 619；`case` 341 → 330 |
| overlayParams deps | 539 → **512** |

fixture 零 diff 是本棒唯一算數的等價證明 —— 它同時涵蓋控件（params section）
與編碼（overlays section 的 paint 是拿 overlayParams 求值出來的）。

### 給 P3-2 的分批盤點（機械統計，非目測）

剩下 330 個 case，扣掉 6 個 `emptyByDesign`（`windPlan` `submarineCables`
`landingStations` `activeFaults` `aqiStations` `pollutionSite`）後：

| 桶 | 數量 | 說明 |
|---|---|---|
| **A 純 slider** | 240 | 現行 schema 直接吃得下，可大批走 |
| **B select/toggle 但形狀規則** | 51 | 同試點的三種 select 形狀；toggle 的 0/1 中介已在 `encodeParamValue` 實作但**尚未有真實使用者** |
| **C 形狀例外** | 18 | 需要 schema 擴充，見下 |
| **D state 外溢** | 15 | 值不只餵 overlayParams，換軌要連帶處理 |

**C 形狀例外（18）**：
- 條件式 label：`earthquakes`（`eqShowHistory ? "history" : "timeline"` —— boolean 存
  state、select 顯示）、`powerPoles` `osmRoadDrive`（`x === 0 ? "關" : x.toFixed(2)`）
- 局部常數 ＋ 多語句 onChange：`indicators` `socioeconomic` `spatialEconomy`
  （category → metric 級聯，改 category 要同步重設 metric）、`pollutionPenaltyMobile`
  （另有 `pollutionPenaltyPlaying` 播放狀態）、`wdBattery`
- helper 產生器：`agriCropSuitability`（`buildCropSelector`，132 選項且 label 隨當前值變）
- 條件式 label ＋ 共用選項表：`livestockFarm{Pig,Chicken,Cattle,Duck,Goose,Sheep,Other}` 7 層
- `SelectConfig.disabled`：`propertyValueGrid`（人均模式在 150m 尺度不可選，
  label 自帶原因）—— **全 repo 唯一用到 `disabled` 的地方**，規格需要 options 動態求值

**D state 外溢（15）**：`flights` `ships` `rail` `busLive` `busIntercityLive`
`touristShuttleLive` `lighthouses` `stations{THSR,TRA,Metro}` `ports` `airports`
`fireStations` `temperatureWave` `eduRemoteSchools` `wasteSchedule`。
這些是 Three.js／CustomLayer 層：值透過 `xxxRef.current = xxx`（全檔 46 處）
餵 scene，或進 `h3Params` / `popCountParams` / `indicatorsParams` / `socioParams` /
`spatialParams` / `youbikeParams` 六個獨立回傳物件，**不走 overlayParams**。
`busLive` / `wasteSchedule` 另有 `Record<BusGroup, boolean>` 這種**跨 key 共用的
group checkbox state**（`busGroups` 同時餵 `enabledBusCities` memo），
換軌時 store 的 value 型別要能裝巢狀物件，或改成把每個 group 拆成獨立 boolean 參數。

**建議批次順序**（每批一個主題、跑完必驗 fixture 零 diff）：
1. **批 A1-A4**｜240 個純 slider 依主題切 4 批（每批 50-70 層）。零 schema 變動，
   純搬。先做這批的收益最大：`useTransportParams` 會掉一半以上行數。
2. **批 B**｜51 個規則 select/toggle。此批會出現第一個真實 toggle → 順手驗證
   `encodeParamValue` 的 0/1 分支（現行 28 個 `? 1 : 0` 都在這桶與 D 桶）。
3. **批 C1**｜條件式 label（`labelPrefix` 擴充成 `label(value)` 函式或加 `zeroLabel` 欄）
   ＋ helper 產生器。⚠️ 若改成函式，快照仍逐位比對輸出字串，等價證明不受影響。
4. **批 C2**｜`disabled` ＋ 級聯 onChange（`indicators` 三兄弟）。
   級聯是**寫入時的副作用**，規格要新增「set 這個參數時連帶重設哪些」的宣告。
5. **批 D**｜最後做。它要的不是 params schema 擴充，而是**第二條輸出通道**
   （ref / 子物件），與 overlayParams 分屬兩種消費者，設計上宜獨立一棒。

⚠️ **不建議**在 A 批之前先啃 C/D —— 那會讓 schema 為了 18 個例外提早複雜化，
而 240 個 easy case 用不到那些欄位。先把量體搬完，例外的形狀也會更清楚。

---

## 2026-08-11 — Phase 3 第二棒（P3-2A）：純 slider 桶 161 key 出 useTransportParams

`403a583` `refactor(params): P3-2A 群1 遷移 33 key（交通・醫療・公共設施・教育）`
`7e81ac9` `refactor(params): P3-2A 群2 遷移 39 key（天災・水利・農業・運動生態）`
`0f9fdcf` `refactor(params): P3-2A 群3 遷移 52 key（森林山域・能源電力航空）`
`5804cdb` `refactor(params): P3-2A 群4 遷移 37 key（邊界地形・執法治安・養殖・觀光）`

A 桶量體棒。**零 schema 變動** —— 161 個 key／278 個參數全部吃得下 P3-1 定的
`SliderParamSpec`，其中 131 個透明度滑桿與 55 個大小滑桿直接複用
`opacitySlider` / `scaleSlider` 建構子，其餘 92 個寫成字面物件。

### 驗收（每群都跑，不是只跑最後一次）

| 項 | 結果 |
|---|---|
| `layer-golden.json` | 四群**全部零 diff**；sha256 `07972fce…` 從 `eabd1ef` 到 `5804cdb` 一位元未變 |
| `npx tsc -b` | 0 error（每群） |
| `npx vitest run` | 41 檔 **523 passed / 1 skipped**（每群，與基準完全相同） |
| `useTransportParams.ts` | 3,085 → **1,959** 行（−1,126，−36.5%） |
| `useState` | 619 → **341**（−278） |
| `case` | 330 → **169**（−161） |
| overlayParams deps | 512 → **235**（−277） |
| `LAYER_PARAMS_SPEC` | 11 → **172** key |

### ⚠️ A 桶實際是 161 key，不是盤點寫的 240

P3-1 的分批盤點用目測量級估 240，實跑機械判準後有 **79 個 key 不合格**。
判準是「能不能用現行 schema 逐字派生出**同一個字串**」，五條全過才算 A：

1. return array 每個元素都是純 slider 字面（無 `type` 欄、欄位恰好 6 個）
2. label 形如 `` `前綴 ${VAR.toFixed(D)}` `` —— 前綴以**單一空白**結尾、運算式後**無後綴**
3. `const [VAR, setVAR] = useState(數值字面)`
4. VAR 的引用點只有四處：宣告／overlayParams 純 shorthand／deps／本 case
5. VAR 不被任何其他 key 共用

### ⚠️ 第 5 條抓到一個盤點沒列、四道護欄全看不見的形狀

`case "a": case "b": return [...]` 這種 **fall-through 共用 state**。
跨 case 共用（`stationScale` 三連、`medIsochroneOpacity` 兩連）盤點有記，
但**同一個 group 內**共用的變體沒有 —— 而它一樣搬不得：

per-key spec 會讓兩個 key 各自宣告同名 `out`，`encodeParamsToOverlay`
後者覆蓋前者，store 卻各存一份值 → **拖一邊，paint 不動、另一邊面板也不動**。

危險在於**沒有任何一道閘會紅**：快照比的是預設值（兩邊由建構上就相等）、
tsc 全綠、`layerParamsControls.test.ts` 只覆蓋 P3-1 的 key。
只搬其中一個 key 也一樣壞（trailing spread 會讓 store 值蓋掉倖存的 useState）。
本棒因此把 `len(keys) > 1` 的 group 一律退回，實際命中 2 組 5 key。

### 退回清單（按機制分類，交給後棒）

⚠️ 本表是**剩餘 169 key 的全集盤點**，與上一節「79 個不合格」不是同一個母體
（那是 240 估值減 161 實績的差額）。兩個數字不必也不該對得起來。

| 機制 | key 數 | 去向 |
|---|---|---|
| 含 select / toggle | 65 | B |
| label 有後綴（`Z 漂浮 ${x.toFixed(0)}px` 等 11 層）| 11 | C（加 `labelSuffix` 欄即可，是 C 桶最便宜的一項）|
| label 前綴無空白（`Alt ×`／`大廠（即時）`）或條件式 | 4 | C（`flights` `facPrimary` `osmRoadDrive` `powerPoles`）|
| label 無 `toFixed`（整數內插 `${x} min`）| 2 | C（`lightning` `lightningCwa`）|
| label 含運算式（`${(x * 100000).toFixed(1)}`）| 1 | C（`ships`）|
| spread / helper 產生器 | 2 | C（`agriCropSuitability` `busLive`）|
| 共用 state（跨 case）| 5 | 需第二種表達（`stationsTHSR/TRA/Metro`・`medIsochrone/medDesert`）|
| 共用 state（fall-through group，**本棒新發現**）| 5 | 同上（`busStationsCity/Intercity`・`eduKindergarten/AfterschoolCare/MutualCare`）|
| 值不進 overlayParams（進 `h3Params` 等獨立回傳物件）| 9 | D |
| 值從 hook return 外溢 | 3 | D（`hillshade` `slopeVector` `aspectVector`）|
| **fall-through group（未做形狀分析）** | 38 | **B/C/D 混雜，後棒需自行分桶** |
| `emptyByDesign` ＋ block-form case（`indicators` 三兄弟・廢棄物 13 層等）| 24 | C/D／不需遷移 |
| **合計** | **169** | ＝ 330 − 161 已遷移 |

⚠️ 那 38 個 fall-through key 在本棒的分類器裡**在形狀分析之前**就因
`len(keys) > 1` 被攔掉，所以它們沒有被歸進上面任何一個機制列。
P3-2B 若照本表估工，會**少算 38 個 key** —— 它們實際上分散在 B/C/D 三桶。

另：盤點把 `pollutionSite` 記在 6 個 `emptyByDesign` 裡，**現況它有真 case**
（opacity ＋ scale ＋ 一個 toggle）→ 屬 B 桶。`emptyByDesign` 實際是 5 個。

### 給 P3-2B 的三件事

1. **`labelSuffix` 是 C 桶投報率最高的一刀** —— 11 個 key 只差這一欄，
   且它是純字串串接、不需要 `label(value)` 函式化，快照照樣逐位比對。
2. **共用 state 的 10 個 key 要先決定表達方式再動手**，不要放進任何「量體批」——
   它們是唯一「四道閘全綠但畫面壞掉」的形狀，只能靠人工判斷擋。
   可行方向：spec 支援 `sharedWith`，或把共用參數提成 layer 無關的 group 級 store。
3. **遷移一律走腳本、不要手改** —— 本棒 161 key × 5 個觸點約 800 處刪改，
   手改必漏。腳本另外做了一件人工容易忘的事：**孤兒區塊註解**
   （`// Bike`、`// 醫療基礎點位 5 類` 這種標示宣告群的註解，
   在它標示的宣告全被刪光時一起刪）—— 判定要用**刪除前**的原文，
   刪完再回推「這註解還有沒有主人」會誤判多行註解區塊。
