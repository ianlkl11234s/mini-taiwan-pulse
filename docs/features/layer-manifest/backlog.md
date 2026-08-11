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
| **4** | 執法治安(20) 醫療(8) 房地產(7) 人口社經(6) 全球氣候(5) | 46 | ⚠️ **`propertyValueGrid` 有 3 個 OVERLAY_REGISTRY config**（同 key 多 entry）→ 現行 `LayerSource` 是單數形，**必須先擴充成陣列或 union**，否則 `layerManifest.test.ts` 的 `toHaveLength(1)` 會擋下來。執法治安 20 層 popup 100% 覆蓋。人口社經/全球氣候全 D 體質（H3 factory / 氣候 frame）。 |
| **5** | 底圖(剩 12) 災害(12) 太空(16) | 40 | 底圖 10 層 PMTiles → dataClass B 連帶 nginx + deploy 腳本清單（PT-1 曾因漏此步 13 層全站 404）。太空 16 層全 D（satellite.js 算軌道，無 overlay entry），`source.kind: "custom"` 的 note 要寫得有資訊量。災害 3 層 C + 7 層 D 混合。 |
| **6** | 環境氣候(剩 19) 水資源(23) | 42 | ⚠️ `waterRivers` / `waterReservoirs` 各有 2 個 config（同批 4 的問題）。環境污染剩下 4 層與已搬的 `pollutionFacility` 共用 `pollutionTypes` 的表達式常數 → 驗證 legend id 共用規約。水資源 12 層 D 體質。 |
| **7** | 廢棄物(18) 農業(29) | 47 | 廢棄物 14 層有 `labelMobile`、**0 層有 legend**（全部 `legend: null`，別誤填）、17 層 D 體質；`wasteRoute`/`wasteStop` 是 orphan（不在 THEMES，由 wasteTruck 子 UI 控制）→ 見批 8 的 `section` 問題。農業 8 層 C + 9 層 B，6 個子群最多。 |
| **8** | 交通(剩 31) 能源(41) + 10 個 orphan key | 82 | 最重的一批，**可再拆 3 個 sub-batch**。能源 30 層是 C 體質（Supabase 動態）→ 每層都要確認 loadingRegistry 契約。交通 13 層 D（Three.js）且 `busLive` 有 11 個控件（8 個 toggle）。⚠️ **10 個 orphan key 不在 THEMES**（`facOffshore` `islandPowerGrid` `medICUBeds` `osmPowerPlantsStatic` `osmSolarFarms` `powerPlants` `powerRegionDemand` `powerStatusHud` `wasteRoute` `wasteStop`）→ `section` 欄位**必須先允許 null**，且 `layerManifest.test.ts` 的 section 斷言要放行。 |

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
2. **`LayerSource` 支援同 key 多 config**（批 4 卡住）：4 個 key 受影響
   （`stationsTRA`×2 `waterRivers`×2 `waterReservoirs`×2 `propertyValueGrid`×3）。
   批 1 的 25 層全是單 config，未觸及。
3. **`section` 允許 null**（批 8 卡住）：10 個 orphan key。批 1 的 25 層全在 THEMES 內。
4. ✅ **legend id 命名規約**（批 1 已落地）：拍板**取 LEGEND_REGISTRY entry 的首個 key**。
   三種形狀都已實測：獨佔（退化成同名）／家族共用／**與自身 key 完全無關**
   （`civilDefenseShelter` → `policeStation`）。批 4 執法治安 20 層是同一組 id。

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
