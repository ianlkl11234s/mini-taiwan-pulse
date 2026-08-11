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
