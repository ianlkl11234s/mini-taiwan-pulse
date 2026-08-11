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
