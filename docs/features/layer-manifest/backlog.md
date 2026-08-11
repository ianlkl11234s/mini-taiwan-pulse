# Layer Manifest — Backlog

## Phase 2 分批搬移提案（343 層待搬）

每批的驗收條件相同、不可省：**黃金快照 fixture 一位元未動 + `npx tsc -b` 0 error +
`npx vitest run` 全綠**。fixture 一旦需要重跑 dump，代表搬移改到了值 → 先確認是不是搬壞了。

批次順序 = 簡單到複雜。前面的批次先把 schema 的形狀撞出來，後面的大批才不會返工。

八批層數：25 + 28 + 33 + 46 + 40 + 42 + 47 + 82 = **343**（348 − 5 試點）。
各主題已扣掉 Phase 1 搬走的層（情勢 −1 底圖 −1 環境 −1 交通 −2）。
⚠️ THEMES 實際是 **27 主題 338 層 + 10 個不在 THEMES 的 orphan key**
（`layerCatalog.ts` 檔頭註解寫「22 主題」已過時）。

| 批 | 主題 | 層數 | 預估難點 |
|---|---|---|---|
| **1** ✅ | 暖身微型 + 同構家族：都市分析(1) 民防避難(1) 世界(1) 情勢(1 剩) 宗教(6) 殯葬(5) 文化(5) 消防(5) | 25 | 已完成（`cc64857`…`1aa3d6b`，見 changelog）。拍板①④落地；額外撞到：消防 4/5 層 `key ≠ popup layerType` 且 fireEvents/fireLatest 多對一（原以為批 3 才會遇到）；`plaActivity` 在 GIS_LAYERS 是**常數引用**，需前置補 `extractGisConstRefTypes` 才驗得出 popup 宣告為真（批 5 `disasterAlert` 同形狀）；D 體質實際 6 層而非 3 層，定義已澄清為「無 OVERLAY_REGISTRY entry」與資料長相無關。 |
| **2** ✅ | 純靜態 POI：基礎建設(11) 運動休閒(6) 觀光(11) | 28 | 已完成（`5d33117` `40f038e` `b292d21`，見 changelog）。預估全對：28/28 都是 dataClass A、觀光 11 層全有 `labelMobile` 且全有 popup、基礎建設 7 層合法無 legend（全批 14 層 `legend: null`）。**機械化流程已驗證**：除 `description` / `topics` 兩個人讀欄位外，其餘 12 欄可由既有登記簿逐 key 機械讀出（判準寫在 changelog）。額外撞到：基礎建設 popup **11/11 全是 key 的單數形**（比批 1 消防 4/5 更整齊也更難用肉眼看出）；運動場館 5 層 **5 → 1** 共用 popup `sportsVenue` 且共用 `sourceId`（⚠️ 與批 4/6 的「同 key 多 config」是不同問題，契約測試按 `id` 過濾不受影響）；`tourRestaurants` 在 UPSTREAM_REGISTRY 不在觀光區塊。 |
| **3** ✅ | 教育(17) 林業(16) | 33 | 已完成（`b506144` `97b6d62`，見 changelog）。預估全對：教育 17/17 有 `labelMobile`、`eduDistrictK12` 多對一、林業 5 層 PMTiles 已核對 deploy 清單。**拍板①的刪 spread 那一步首次實際執行**（`...EDUCATION_LAYER_COLORS` 整行 + 孤兒 import，grep 限行首驗證 0）。額外撞到：popup 多對一規模創新高（`school` **1 對 7**，另 `eduCampus` / `eduDistrictK12` 各對 2）；林業 popup 是**依幾何型別分類**的泛型 layerType（`forestryPolygon`/`forestryPOI`/`forestryLine` 吃掉 12 層，⚠️ 用子群名猜會猜錯 —— `forestFlatParks` 在「分區」子群卻走 POI）；`canopyHeight` 是 raster → 唯一 `popup: null` 且**唯一沒有 `sourceLayer` 的 pmtiles**；共用 sourceId 規模 ×7（`edu-schools`）超越批 2 的 ×5；`schools` 三張表都不在教育區塊裡（批 2 `tourRestaurants` 的鏡像）。 |
| **4** ✅ | 執法治安(20) 醫療(8) 房地產(7) 人口社經(6) 全球氣候(5) | 46 | 已完成（`15b9756` schema＋`7bf9b82` `59dcf46` `64cf237` `22b451e` `e73f677`，見 changelog）。**拍板②落地**：`source` 擴成 `LayerSource \| LayerSource[]`（陣列比 `kind:"multi"` 侵入小，91 筆既有 entry 零改動），契約測試改逐位對齊、順帶把 config 順序釘住。預估全對：propertyValueGrid×3、執法 popup 100% 覆蓋、人口社經／全球氣候全 D。額外撞到：**批 2 的 popup 機械判準只對 A/B/C 成立** —— D 體質三種例外（`medIsochrone`/`medDesert` 有 popup、`earthquakesGlobal`→`earthquakeGlobal` 單數形、`windField`/`oceanCurrents`→`climateField` **完全不經 GIS_LAYERS**，為此新增 `extractNonGisFeatureTypes`）；新增第三種共用形狀「**兩個 key 一個 layer**」（medIsochrone/medDesert 共用 `medical-isochrone-fill`）；醫療一個主題撞完四種 dataClass；區塊註解不可信的第三種（註解涵蓋範圍從一開始就對不上）。 |
| **5** ✅ | 底圖(剩 12) 災害(12) 太空(16) | 40 | 已完成（`410cac7` schema＋`529c828` `fc762a5` `61eb3e9`，見 changelog）。**代拍板⑤候補（待 owner 追認）**：`popup` 擴成 `T \| T[] \| null` —— `earthquakeReplay` 一個 toggle 建 5 層，其中測站點與鄉鎮面**各自有 GIS_LAYERS 條目與 panel**，只宣告一個等於已知為假。預估部分對：太空 16 全 D 且 legend/popup 雙雙 16→1（本工程最大共用）、`earthquakes` 與 `earthquakeGlobal` 已用帶冒號的精確錨定隔離。預估錯的：**底圖不是「10 層 PMTiles → 全 B」**（實際 B 9 / D 3，其中 slope/aspect 是 PMTiles 卻無 registry entry → D；hillshade 是單張 PNG），**災害不是「3 C + 7 D」**（實際 7 D / 4 C / 1 A）。額外撞到：popup 判準第四層修正「**HEADER_LABELS 有條目 ≠ 有 popup**」（`hillshade`，批 8 `osmExpressway` 同款）；拍板④精煉「**legend 家族已有 manifest 成員 → 沿用其既有 id**」（`urbanZoningNewTaipei` → `"urbanZoning"`，批 6 pollution 同款）；`SATELLITE_COLORS` 是拍板①判準遇過最像該引用卻不該引用的一組（16 個 hex 逐一撞色仍不引用）。⚠️ **觸點 #20 逐檔比對發現一個真缺口**：`base_map/hillshade.png` git 管理但 nginx `/base_map/` 沒有 dist fallback、upload/pull 只處理 `*.pmtiles` → 兩條路都不通（未改部署檔，見 changelog 末節兩條修法）。 |
| **6** ✅ | 環境氣候(剩 19) 水資源(23) | 42 | 已完成（`45faee8` schema＋`49ff8b8` `d39edf1`，見 changelog）。**代拍板⑥候補（待 owner 追認）**：source 陣列**允許混合 `kind`** —— `waterReservoirs` 是 pmtiles 水庫面 + geojson 壩體點，證偽了拍板②留下的「陣列各元素 kind 同質」；`dataClass` 改由 kind 集合按「上線路徑最重」precedence 決定（pmtiles ＞ supabase ＞ geojson）。預估對的：`waterRivers`×2 同質陣列、水資源 12 層 D。預估錯的三處：(a) **`waterDam` 的 popup 有 GIS_LAYERS 字面條目**（Three.js raycast 是並存的第二條路徑，不是唯一路徑），無需特殊處理；(b) **「環境污染 4 層沿用 `"pollution"`」只對一半** —— 該子群橫跨兩筆 LEGEND_REGISTRY entry / 兩個元件，只有 `pollutionSite` 與試點同 entry 適用，裁處 3 層照機械規則取 `"pollutionPenaltyCritical"`（4 層全填會被「同 id 必落同一筆 entry」測試擋下）；(c) `waterReservoirs` 不只是「2 個 config」而是**混合 kind**。額外撞到：雙生字密度創新高且 `groundwater`／`groundwaterWells` 是**真的會判錯**的一組（同 loader 不同 RPC，只有前者擁有 GIS_LAYERS 條目）；`floodSensorIsochrone` 是 D 卻自建 PmTilesSource（同批 5 slopeVector）。⚠️ 觸點 #20 逐檔比對：五個目錄無新 404 缺口，但 `/flood/` 是批 5 `hillshade.png` 的**鏡像不一致** —— git/dist 那條通、S3 那條死（upload/pull 推到 `/data/flood/`，nginx 沒有該 location）。 |
| **7** ✅ | 廢棄物(18) 農業(29) | 47 | 已完成（`a1d7e3b` 前置解析器＋`6489881` `7e6e0a1`，見 changelog）。**本批無 schema 改動**（拍板②⑤⑥三種擴充都夠用，47 層全在 THEMES 內）。預估全對：廢棄物 14 層 labelMobile、**legend 18/18 全 null**（規約遇過最極端的一次）、17 層 D；農業 8 C + 9 B（A 5 / D 7 未預估，農業是第三個四種 dataClass 全到齊的主題）。額外撞到：**新增第四種 popup 真值來源** `extractCustomHandlerFeatureTypes`（廢棄物 13 層的接線完全不在 useMapInteraction —— wasteMapboxLayers 8 個 circle 子層各自 `map.on("click", …)`、App.tsx 對 3D scene raycast；⚠️ layerType 是**三元運算**，整行掃字串會收進 noise）；**popup 判準第五層修正「有 click handler ≠ 有 popup」**（`wasteSchedule` 走 setWasteScheduleTooltipInfo 這個獨立 tooltip 狀態，不是 setFeatureInfo）；`wfMonitoring` 是唯一**兩套渲染路徑並存**（3D scene ＋ Mapbox circle）；農業 D 7 層全走 `agricultureLayerFactory` 的 PMTiles factory（掃 dataClass B 對部署清單會全漏）；農業 C 8 層的 `fallbackUrl` **刻意不部署**（owner-only RPC，不是缺口）；飼養場 7 層在 `GATED_LAYERS` 但 THEMES LayerDef 沒有 `gated` → manifest 照 LayerDef 不填；區塊註解不可信第七、八種（orphan `wasteRoute`/`wasteStop` 夾在廢棄物區塊正中間、農業在三張表各自分成兩段）。⚠️ **觸點 #20 逐檔比對抓到第二個「兩條路都不通」**：`public/fishery/aquaculture_integrated.pmtiles` 被 gitignore L126 排除且不在 `FISHERY_FILES` → git/dist 與 S3 皆無（未修，見 changelog 末節）。 |
| **8** | 交通(剩 31) 能源(41) + 10 個 orphan key | 82 | 最重的一批，**可再拆 3 個 sub-batch**。能源 30 層是 C 體質（Supabase 動態）→ 每層都要確認 loadingRegistry 契約。交通 13 層 D（Three.js）且 `busLive` 有 11 個控件（8 個 toggle）。⚠️ `stationsTRA` 有 2 個 config → 照批 4 的陣列寫法。`ships` 的 popup 是**不經 GIS_LAYERS 的 setFeatureInfo**（`ship`，scene raycast），批 4 的 `extractNonGisFeatureTypes` 已涵蓋。⚠️ **10 個 orphan key 不在 THEMES**（`facOffshore` `islandPowerGrid` `medICUBeds` `osmPowerPlantsStatic` `osmSolarFarms` `powerPlants` `powerRegionDemand` `powerStatusHud` `wasteRoute` `wasteStop`）→ `section` 欄位**必須先允許 null**，且 `layerManifest.test.ts` 的 section 斷言要放行。 |

### 開始 Phase 2 之前必須先拍板的 4 件事

1. ✅ **`color` 欄位對外部常數的處理**（批 1 已落地、批 3 完成刪 spread）：
   拍板**引用常數**不複製字面。manifest 的 import 白名單放寬到「零 import 的純色票
   常數檔」。宗教／殯葬／教育三組皆已搬完，`HANDWRITTEN_LAYER_COLORS` 現在**一個
   `...*_LAYER_COLORS` spread 都不剩**；搬走後**務必整行刪掉手寫表的 spread**
   —— spread 不觸發 excess property check，留著會全綠但沒真搬（見 changelog 批 1 末節）。
   驗證要用 `grep -nE '^\s*\.\.\.'` 限行首（說明註解裡也會出現該字串，`grep -c` 會誤判）。
   ⚠️ 批 2 補充了反向判準：適用條件是「**該常數有在餵 `LAYER_COLORS`**」，
   不是「該主題有色票檔」。`tourTypes` / `sportsTypes` 匯出的是 category-keyed
   分色資料、`LAYER_COLORS` 從未 import → 不引用，寫字面 hex（hex 撞色是巧合）。
2. ✅ **`LayerSource` 支援同 key 多 config**（批 4 已落地）：拍板
   **`source: LayerSource | LayerSource[]`**（不新增 `kind:"multi"` 變體 ——
   陣列讓 91 筆既有 entry 零改動、`satisfies` 推導不受影響）。
   契約測試改成「`Array.isArray` 正規化 → 筆數比對 → **逐位對齊**逐欄比」，
   ⚠️ index 配對同時把 config 順序釘住（順序決定 layer 疊放，Phase 3 派生
   `GIS_LAYERS` 又是 first-hit-wins）。`kind:"custom"` 只能單數形。
   4 個受影響 key 中 `propertyValueGrid`×3 / `waterRivers`×2 / `waterReservoirs`×2
   已搬完；**剩 `stationsTRA`×2（批 8）照樣寫即可**。
   ⚠️ 別跟「多個 key 共用同一個 `sourceId`」（教育 ×7、運動場館 ×5、房地產 Grid ×3）
   混為一談 —— 那個仍寫單數形，契約測試按 `id` 過濾不受影響。
   ⚠️ 批 6 撤銷本項原本附帶的「陣列各元素 kind 同質」假設 → 見拍板⑥。
3. **`section` 允許 null**（批 8 卡住）：10 個 orphan key。批 1 的 25 層全在 THEMES 內。
4. ✅ **legend id 命名規約**（批 1 已落地，批 5 精煉）：拍板**取 LEGEND_REGISTRY entry
   的首個 key**。三種形狀都已實測：獨佔（退化成同名）／家族共用／**與自身 key 完全無關**
   （`civilDefenseShelter` → `policeStation`）。批 4 執法治安 20 層是同一組 id。
   ⚠️ 批 5 補了例外條款：**加入的 legend 家族若已有 manifest 成員 → 沿用其既有 id**
   （不套機械規則），因為規則背後 load-bearing 的性質是「共用元件 ⇔ 共用 id」。
   目前僅兩個非首 key 的 id，都是 Phase 1 試點留下的 pre-拍板④ freeform：
   `urbanZoning`（批 5 `urbanZoningNewTaipei` 已沿用）與
   `pollution`（批 6 **只有 `pollutionSite`** 沿用）。
   ⚠️ 批 6 證明例外條款是**逐 LEGEND_REGISTRY entry** 判、不是逐 sidebar 子群判：
   環境污染子群橫跨兩筆 entry / 兩個元件，裁處 3 層不屬於 pollution 家族，
   照機械規則取自家首 key。全填同一個 id 會被「同 id 必落同一筆 entry」測試擋下。

5. ⚠️ **`popup` 支援一 key 對多 layerType**（批 5 **代拍，待 owner 追認**）：
   `popup: T | T[] | null`，形狀同拍板②。觸發者是 `earthquakeReplay`
   （測站點 + 鄉鎮面各自有 GIS_LAYERS 條目與 panel）。契約測試比對筆數 + 去重 +
   **順序**（＝GIS_LAYERS 出現序）。批 6 新增第二個：`waterReservoirs`
   （`waterDam` 壩體點 + `waterReservoirPoly` 水庫面）。

6. ⚠️ **source 陣列允許混合 `kind`**（批 6 **代拍，待 owner 追認**）：
   撤銷拍板②附帶的「陣列各元素 kind 同質」。型別不用改（`LayerSource[]` 本來
   就容得下），改的是 `dataClass` 的判準 —— 取**上線路徑最重**的那個 kind：
   `pmtiles(B) ＞ supabase(C) ＞ geojson(A)`（B 背著 nginx location + deploy 清單
   的義務，A 只是一支 fetch）。用 precedence 不用「首元素的 kind」：precedence
   與陣列順序無關，順序服務的是疊放語意，不該連帶決定體質。
   觸發者 `waterReservoirs`（pmtiles 水庫面 + geojson 壩體點）目前是唯一一個。
   契約測試把 `dataClass` 斷言移出 per-element 迴圈；**同質 entry 的期望值與
   改寫前逐字相同**，強度零損失。

## Phase 3-5 展望

- **Phase 3**｜legend / popup 派生：`LEGEND_REGISTRY` 的 `keys` 由 manifest 反查產生；
  `GIS_LAYERS`（觸點 #16）由 manifest 的 `popup` + `source.sourceId` 組出來。
  ⚠️ `GIS_LAYERS` 是 **first-hit-wins**（細節豐富的小範圍在前、大面積背景在後）——
  派生時**必須保序**，manifest 需要一個顯式的 `clickPriority` 欄位，不能靠陣列順序。
- **Phase 4**｜params 派生：`useTransportParams` 的 `case` 由 manifest 的 params spec
  產生。難點是控件的 `onChange` 綁的是 hook 內的 setState，manifest 只能宣告 spec，
  state 仍得留在 hook → 需要一層 spec→控件的組裝器。
- **Phase 5**｜`/new-layer` 改成只寫 manifest；`docs/development-rules.md` §4 觸點表
  改寫（登記簿類觸點併成 1 行）。

## 護欄本身的待辦

- [ ] fixture 1.35 MB / 57,589 行 —— 目前可接受，但若 Phase 3 把 legend/popup 的展開
      也納入快照會再膨脹。屆時考慮把 `overlays` section 拆成獨立 fixture 檔。
- [ ] `PENALTY_YEAR_MAX` 一旦被調高到未來年份，`pollutionPenaltyYear` 的預設值會隨
      系統時間漂移 → 已有 guard 斷言會先紅，屆時去 `layerGoldenExtract` 的 sanitize 補正規化。
- [ ] `GIS_LAYERS` 目前是原始碼文字解析（函式內區域常數，runtime 取不到）。Phase 3
      把它提升成模組級 export 後，抽取器可改成 runtime 真值，精度提升。
- [ ] **觸點 #20 機械斷言**（批 5 的證據）：「manifest 的靜態檔路徑 ↔ nginx location ↔
      deploy 腳本清單」值得做成測試。⚠️ **光掃 `dataClass === "B"` 不夠** ——
      批 5 的 `slopeVector` / `aspectVector` 是 D 卻是 PMTiles、`hillshade` 是 D 卻有
      8.7MB PNG，批 6 的 `floodSensorIsochrone` 是 D 卻自建 PmTilesSource，
      批 7 農業 **7 個 D 全是 `agricultureLayerFactory` 的 PMTiles**，
      路徑都藏在 `source.note` 裡。已抓到的不一致（**全部未修**）：

      | 批 | 檔 | 症狀 |
      |---|---|---|
      | 5 | `base_map/hillshade.png` | **兩條路都不通**（nginx `/base_map/` 無 dist fallback ＋ upload 只處理 `*.pmtiles`）|
      | 6 | `/flood/uswg_isochrone_3min.pmtiles` | 鏡像 —— git/dist 通、S3 死（nginx 無 `location /flood/`）|
      | 7 | **`fishery/aquaculture_integrated.pmtiles`** | **兩條路都不通**（gitignore L126 ＋ 不在 `FISHERY_FILES`）|
      | 7 | `fishery/aquaculture_water_satellite_{moa,union}.pmtiles` | 批 6 的鏡像 —— git/dist 通、S3 那半空轉 |

      ⚠️ 斷言要**雙向**：不只「宣告的檔有沒有路可走」，也要「deploy 腳本推上去的
      檔 nginx 讀不讀得到」—— 批 6 的 `/flood/` 只有後者會紅。
      ⚠️ 還要能區分「缺口」與「**刻意不部署**」：批 7 農業 C 層的 `fallbackUrl`
      （`livestock_farms.geojson` / `slaughterhouses.geojson`）改走 owner-only RPC 後
      刻意不上傳、pull 端還 `rm -f` —— 機械斷言若一律報紅就會被無視。
