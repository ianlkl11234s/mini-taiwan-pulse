# Layer Manifest（AR-22）

> **Slug**：`layer-manifest`
> **狀態**：dev（Phase 0-2 完成 —— **348/348 全部登記進 manifest**，Phase 3 待派工）
> **相關 PR**：待開
> **地基**：AR-21 visibility store（PR #129，`src/state/layerVisibilityStore.ts`）

## 一句話說明

把 348 個 layer 散在 5、6 張登記簿裡的**同一份事實**（叫什麼、什麼顏色、哪顆 icon、
資料從哪來、屬於哪個主題）收成單一 manifest，讓「新增一層要碰 14 檔約 21 處」裡的
登記簿類觸點全部由 manifest 派生。

## 為什麼要做

`docs/development-rules.md` §4 的完整觸點表列了 20 個觸點。2026-08-10 稽核用 3 個真實
commit 實測（落雷單層 11 檔 29 hunk／殯葬 5 層 14 檔／教育 16 層同 14 檔），發現舊版
「7 步」漏了 7 個觸點——**新人照舊表做必漏**。

其中約一半是純登記：同一份事實被抄進多張表，抄漏就漂移。而且危險的不是「編不過」
（tsc 會擋），是**編得過但值悄悄不一樣**——少一個 `labelMobile`、icon 換了一顆、
popup 的 layerType 跟 key 不同名沒對上。這些不報錯，只在瀏覽器上「看起來怪怪的」。

## Phase 一覽（0 → 5，Phase 4 於 2026-08-12 拆成 4a／4b）

| Phase | 內容 | 狀態 |
|---|---|---|
| **0** | 黃金快照護欄：348 key × 12 張登記簿凍結成 committed fixture ＋ 突變自測 | ✅ `8abbd97` |
| **1** | manifest schema（`LayerManifestEntry`）＋ 5 試點層搬移 ＋ 4 張表雙軌派生 | ✅ `574c3a6` `5dc9230` |
| **2** | 批次搬移剩下 343 層（8 批，見 [backlog.md](./backlog.md)） | ✅ **全量完成 348/348**（`462c05a`）。批 1（25 層）`cc64857`…`1aa3d6b`；批 2（28 層）`5d33117`…`b292d21`；批 3（33 層）`b506144` `97b6d62`；批 4（46 層 ＋ 拍板② schema）`15b9756`…`e73f677`；批 5（40 層 ＋ popup 陣列 schema）`410cac7`…`61eb3e9`；批 6（42 層 ＋ source 混合 kind schema）`45faee8`…`d39edf1`；批 7（47 層 ＋ 第四支 popup 解析器）`a1d7e3b`…`7e6e0a1`；批 8（82 層 ＋ 拍板③ section null schema）`1eb4911`…`462c05a` |
| **3** | **params 派生化**（退役 `useTransportParams`）| ✅ **完成**。348 key 中 336 個進 `LAYER_PARAMS_SPEC`、剩 12 個在 manifest 宣告 `params: null`（P3 當時是「7 個 baseline ＋ 5 個 `emptyByDesign` 分支」兩處分記，4a 已收斂成單一表達）；`useState` 645 → **0**；hook 3,160 → 539 行並更名 `useLayerParamsRuntime`。P3-1 `43386d6`…`6fff4e3`（store ＋ 渲染器 ＋ 雙軌 ＋ 11 層試點）／P3-2A `403a583`…`5804cdb`（A 桶 161）／P3-2B `fc30c83`…`89ba510`（共用 slot ＋ B 桶 58）／P3-2C `aa84bc3`…`1f360a7`（C 桶 32）／P3-2D `3c99ea9`…`5e73915`（hook return 等值閘 ＋ D 桶 74）／**P3-3 `852dbc7`…`4b2a1e5`（型別搬家 ＋ 改名 ＋ TRANSPORT_LABELS 收編 ＋ 切檔判定 ＋ 規則同步）**。⚠️ 「整支退役」（消費端改吃 `useLayerParams(key)`）**不在 Phase 3 範圍**：那不是等價重構，見 [changelog](./changelog.md) 末節 |
| **4a** | **護欄永久化 ＋ 紅燈演練** | ✅ **完成**（`1b282b5`…`07101ea`）。`layerConsistency` 從「掃原始碼字面 ＋ 3 份 `BASELINE_*`」改成 **manifest 完整性驗證**（9 條：key 空間完整 ／ 必要欄有真值 ／ 四份豁免 ledger 雙向凍結 ／ 鐵則 4 閾值同步 ／ DEFAULT_ON）；`emptyByDesign` 根治（5 個空 case ＋ `paramsCaseKeys()` 退役，語意事實搬回 manifest 的 `params: null`）；黃金快照縮編 12 → 3 section。**紅燈演練 4/4 會叫、還原後全綠**（逐場輸出見 [changelog](./changelog.md)）|
| **4b** | legend / popup 接線**派生化**（觸點 #13 #15 #16）| ✅ **完成（2026-08-12 改案版，owner 拍板）**。`LEGEND_REGISTRY` 的 keys 由 manifest **真派生**（`legendGroups.ts` 反查全 348 key 含 orphan，手寫 keys 全刪）；`GIS_LAYERS` **不從 manifest 產生、不加 `clickPriority`**，改為升級成模組級 `map/gisClickRegistry.ts` ＋ runtime 雙向驗證，`extractGisLayers`／`extractGisConstRefTypes` 兩支文字解析器退役。改案理由（layers 陣列是實作細節不進 manifest＝`GATED_LAYERS` 先例；powerPlant 8 row 多對多無法從 popup 產生）記在 `gisClickRegistry.ts` 檔頭。跨 key 全域順序仍由註冊表本身＋黃金快照 `gisLayers` section 守（fixture 合法重生 +2 筆常數引用 row）。詳見 [backlog](./backlog.md)、[changelog](./changelog.md) 收尾棒 |
| **5** | `/new-layer` 產骨架流程改版 | ✅ **完成**（`8dbfc6e`）。新三步「manifest 一筆 ＋ spec 一筆 ＋ 實質邏輯檔」。⚠️ 不只是文件過期 —— `layer-creator` agent 的舊第 7/9 步（手寫 `LAYER_COLORS`／手改 `DEFAULT_ON`）**照做會被 4a 的完整性閘擋下來**，四個檔（command／agent／`layer-onboarding` skill／`CLAUDE.md`）一起改 |

⚠️ **Phase 3/4 的內容與本表原始版本對調**（2026-08-11 任務書拍板）：
原排程是「3 = legend/popup、4 = params」，改成 params 先做。
本檔與 [backlog.md](./backlog.md) 已同步；changelog 裡批 1-8 時期寫的
「Phase 3 派生 GIS_LAYERS」等敘述指的是**現在的 4b**。

⚠️ **Phase 4 於 2026-08-12 拆成 4a / 4b**：最終棒的任務書只涵蓋
「護欄永久化 ＋ 紅燈演練」，legend/popup 的**派生化**從未執行 ——
拆開記錄是為了不讓一個 ✅ 蓋掉沒做的那半。

現況：新增一層的登記工作 = **manifest 一筆 ＋ `layerParamsSpec` 一筆**
（原本預期的「只改 manifest 一處」沒有完全兌現 —— 完整參數規格刻意不進 manifest，
理由見下方「Phase 3 的檔案」）；其餘觸點都是實質邏輯
（loader / hook / paint / legend 元件 / popup 元件）。

**AR-22 的終點仍未動**：消費端還是拿 `useLayerParamsRuntime` 組出來的整包，
要改吃 `useLayerParams(key)` 才會兌現「一個 slider 動、只 render 該層控件」——
**那不是等價重構**，等值閘會擋（那是對的），要另立驗收標準。
完整未竟清單見 [changelog](./changelog.md) 末節「終章」。

### Phase 3 的檔案（params）

| 用途 | 路徑 |
|---|---|
| 控件規格 SSOT（內容）| `src/data/layerParamsSpec.ts` |
| 參數值 store ＋ overlayParams 編碼 | `src/state/layerParamsStore.ts` |
| spec → `ParamControl[]` 渲染器 | `src/state/layerParamsControls.ts` |

形狀的 SSOT 仍是 manifest 的 `params: { count, kinds }`，由
`src/state/__tests__/layerParamsStore.test.ts` 焊死（對不上就紅）。
**完整規格刻意不進 manifest** —— manifest 的 import 鐵則只允許 types / lucide /
零 import 色票檔，而 select 的 options 來自一二十個自帶相依的資料模組。

## 關鍵檔案

| 用途 | 路徑 |
|---|---|
| Manifest SSOT | `src/data/layerManifest.ts` |
| 黃金快照抽取器（測試 + dump 腳本共用） | `src/data/__tests__/layerGoldenExtract.ts` |
| 黃金快照護欄（15 tests，Phase 4 縮編後） | `src/data/__tests__/layerGoldenSnapshot.test.ts` |
| 黃金 fixture（1.09 MB，只凍 3 個 section） | `src/data/__tests__/__fixtures__/layer-golden.json` |
| Manifest 契約測試（13 tests，宣告 ⇔ 現況逐欄對帳） | `src/data/__tests__/layerManifest.test.ts` |
| **Manifest 完整性閘（9 tests，含四份豁免 ledger）** | `src/components/sidebar/__tests__/layerConsistency.test.ts` |
| hook return 等值閘 A/B（12 tests） | `src/hooks/__tests__/useLayerParamsRuntimeReturn.test.ts` |
| 共用 slot ／ switch 清空閘 | `src/state/__tests__/layerParamsSharedState.test.ts` |
| 重新產生 fixture | `scripts/preprocess/dump-layer-golden.ts` |

派生接線落在：`src/components/sidebar/layerCatalog.ts`（colors + THEMES + TRANSPORT_LABELS）、
`src/components/IconRailSidebar.tsx`（icons）、`src/data/upstreamRegistry.ts`（upstream）。

### 兩份測試的分工（不重複）

| 檔 | 守什麼 |
|---|---|
| `layerManifest.test.ts` | 「manifest **宣告** vs **現況**」逐欄對帳（section ⇔ THEMES、source ⇔ OVERLAY_REGISTRY、legend ⇔ LEGEND_REGISTRY、popup ⇔ GIS_LAYERS、params ⇔ 實際控件）。宣告錯 = 紅 |
| `layerConsistency.test.ts` | 「manifest 本身完不完整、豁免是不是有意識的決定」。不碰任何下游登記簿的值 |

兩者合起來才擋得住「新層漏接線」：對帳擋「宣告與現況不符」，
完整性擋「**根本沒宣告**」與「**用 `null` 靜默豁免**」。

### popup 宣告的四個真值來源（批 7 起）

`GIS_LAYERS` 一張表**不足以**判斷一層有沒有 popup，抽取器因此有四支：

| 解析器 | 涵蓋 | 為什麼需要 |
|---|---|---|
| `extractGisLayers` | 字面 `{ layers: [...], type }` | 主要來源（也進 fixture） |
| `extractGisConstRefTypes` | layer id 寫成常數引用那幾筆 | regex 要求字面陣列，抓不到（批 1） |
| `extractNonGisFeatureTypes` | `useMapInteraction.ts` 內**不經 GIS_LAYERS** 的 `setFeatureInfo` | `climateField` 是「沒命中任何 feature」的 fallback，不對應任何 layer id（批 4） |
| `extractCustomHandlerFeatureTypes` | **連 `useMapInteraction` 都不進**：圖層模組自己 `map.on("click", layerId, …)`（wasteMapboxLayers 8 個 circle 子層）／`App.tsx` 對 customLayer 的 raycast | 廢棄物 13 層的接線全在別處，前三支一個都抓不到（批 7） |

**「查不到 → 填 null」是錯的捷徑**：四者聯集才是「這個 layerType 真的有接線」。
dataClass D 的層更要逐層打開 hook / factory 看它 `addLayer` 了什麼 id。

⚠️ 第四支的 regex 刻意**不做整行掃描**：`wasteMapboxLayers` 的 layerType 是三元運算，
整行掃 `"..."` 會把 `props["kind"] === "facility"` 的字串一起收進來。
它的「有沒有抓到」也是**逐檔**判 —— 三支來源檔都產出 `"wasteFacility"`，
用聯集大小判會誤報。

⚠️ **反方向的兩個陷阱**：
- `HEADER_LABELS` 有條目**不代表**有 popup（批 5）—— 那張表是 BYOK chat bridge 能標的
  layerType 全集，`hillshade` 在裡面卻沒有任何 `GIS_LAYERS` 條目。
- **有點選互動也不代表有 popup**（批 7）—— `wasteSchedule` 的 `pickRoute` 命中後走
  `setWasteScheduleTooltipInfo`（獨立 tooltip 狀態，同列車／公車），不是 `setFeatureInfo`。

四個方向都只能靠「讀 hook / handler 實際 addLayer 與 set 了什麼」。

`popup` 欄位也支援**一個 key 對多個 layerType**（陣列，批 5 為 `earthquakeReplay`
擴充、批 6 `waterReservoirs` 是第二例）—— 同一個 toggle 建出的多個 layer 各自有
panel 時用它，順序＝GIS_LAYERS 出現序，但**不取代** Phase 3 要加的 `clickPriority`
（兩者相隔可能很遠）。

⚠️ **第三個方向的反例（批 6）**：`waterDam` 曾被記載成「不經 GIS_LAYERS」
（批 4 收進 `extractNonGisFeatureTypes` 時的說法），實際上它**同時有** GIS_LAYERS
字面條目 —— Three.js scene 的 raycast 是**並存的第二條路徑**。
三支解析器是聯集不是分割，一個 layerType 可以同時被兩支抓到。

### legend id 規約是逐 registry entry 判、不是逐子群判（批 6）

拍板④的例外條款「家族已有 manifest 成員 → 沿用既有 id」load-bearing 的性質是
**共用元件 ⇔ 共用 id**。批 6 的環境污染子群橫跨**兩筆** `LEGEND_REGISTRY` entry
（`PollutionSeverityLegend` 與裁處圖例）→ 只有 `pollutionSite` 沿用試點的
`"pollution"`，裁處 3 層照機械規則取自家首 key。
**同一個 sidebar 子群不蘊含同一個圖例**，全填同一個 id 會被契約測試擋下。

### `source` 陣列的 kind 不保證同質（批 6）

`waterReservoirs` = pmtiles 水庫面 + geojson 壩體點。`dataClass` 只有一個值，
混合時取**上線路徑最重**的 kind：`pmtiles(B) ＞ supabase(C) ＞ geojson(A)`。

## Phase 2 收工狀態（批 8 之後）

三張手寫表（`HANDWRITTEN_LAYER_COLORS` / `HANDWRITTEN_LAYER_ICONS` /
`HANDWRITTEN_UPSTREAM`）**表內非註解行皆為 0**，`THEMES` 的 338 個 LayerDef
**全部**走 `fromManifest(...)`、字面殘留 0。

`ManifestKey` 現已涵蓋全部 348 key → `Omit<Record<全集>, ManifestKey>` 退化成 `{}`。
**空物件字面合法**（實測 tsc 0 error），護欄語意不變：從 manifest 刪任何 key 會讓
合成的 `Record` 缺屬性而報錯。三張表**保留不刪** —— 新 key 若一時無法進 manifest
（例如 `section` 未定）那裡是唯一合法暫放處。

⚠️ **唯一的手寫殘留是 `TRANSPORT_LABELS`**（`layerCatalog.ts`，6 筆，值與 manifest 的
`label` 逐字重複）。它**不在派生的四張表裡** —— key 空間是 `TransportType` 不是
`keyof LayerVisibility`，硬套 `Omit<…, ManifestKey>` 會弄壞型別意義。已就地註記，
留給 Phase 3。處置同 `GATED_LAYERS`（批 7 記載，另一張 runtime 表）。

### orphan key（`section: null`）—— 拍板③ 與它的必要延伸

10 個 key 在 `LayerVisibility` 有、三張 348-key 全量表也有，但 **THEMES 沒有**。
schema 因此改成以 `section` 為判別欄位的**聯集**：`section: LayerSection` 那支帶
`label` / `labelMobile` / `expandable` / `gated`；`section: null` 那支把這四欄宣告成
`?: never`。

**為什麼 label 不能是「選填」而要是 `never`**：orphan 的 label 沒有任何真值來源
（`LAYER_LABELS` 由 THEMES 派生），填一個「看起來合理」的等於在 SSOT 裡發明一個
沒人能驗證的事實。而單純省略欄位擋不住 —— union 的 excess property check 取
**所有成員屬性的聯集**，`label` 存在於另一支就不算 excess。只有 `never` 會紅。

⚠️ **「orphan」只描述「不在 THEMES」，不等於死碼**：5 個有 registry entry 且
App.tsx 照樣在餵（被 SSOT 取代後移出 sidebar）、2 個是 monitor 面板的 HUD/3D bars
（`UPSTREAM_REGISTRY` 標的 "stale/unused" 是過時的）、只有 3 個真的沒有渲染。

⚠️ **legend 家族跨越「在不在 THEMES」這條線，而且是雙向的**：orphan 沿用 THEMES
成員的 id（`islandPowerGrid` → `offshoreWindZones`），也有 THEMES 成員沿用 orphan 的
id（`powerGenerationUnit` → `powerPlants`）。Phase 3 依 legend 分組派生
`LEGEND_REGISTRY` 時**不能只掃有 section 的 entry**。

## 雙軌派生機制

手寫表改成 `Omit<Record<keyof LayerVisibility, T>, ManifestKey>`，再與 manifest 分片
spread merge 成完整的 `Record<keyof LayerVisibility, T>`。tsc 三個方向都擋：

- 漏掉任一「還沒搬」的 key → TS2739 缺屬性
- 已搬進 manifest 的 key 還留在手寫表 → excess property 報錯
- manifest 刪 entry → 合成表缺 key 報錯

**刻意不用「全量手寫表被 merge 蓋過」**——那樣測試也會綠，但登記沒真搬走，會留下
「改 manifest 畫面沒反應」的暗雷。

`LAYER_MANIFEST` 用 `satisfies` 而非型別標註：標註會丟掉 key 的 literal 型別，
`ManifestKey` 退化成 348 key 全集，上面三道護欄整個失效。

## 5 試點層與挑選理由

刻意挑**體質各異**的 5 層，讓派生機制先撞過所有形狀，Phase 2 批次搬移才不會每批返工。

| key | dataClass | 為什麼挑它 |
|---|---|---|
| `cctv` | A 靜態 GeoJSON | 最單純基準：legend 獨佔、popup 與 key 同名、無 labelMobile |
| `newsEvents` | C 動態 | `dynamicData: true`；popup layerType `newsEvent` **與 key 不同名**，正是要收編的漂移點 |
| `urbanZoningTaipei` | B PMTiles | polygon 切片；有 `labelMobile`；legend 與 `urbanZoningNewTaipei` **共用**一個元件 |
| `rail` | D 前端自繪 | Three.js，**沒有 OVERLAY_REGISTRY entry**、沒有 popup → 逼 `source` 欄位處理 `kind: "custom"` |
| `pollutionFacility` | B PMTiles | 控件密度最高（8 個，slider/select/toggle 三型齊）＋ `upstream.processing` 欄位 |

## 等價證明

Phase 1 的硬驗收：搬移後**黃金快照 fixture 一位元未動**、23 條測試全綠 = 5 層零失真。
同一把尺一路用到 Phase 3 收官 —— P3-3 五個 commit 的 sha256 `07972fce…` 逐位元未變。

**Phase 4 現況**：`npx tsc -b` 0 error｜`npx vitest run` 43 檔 **564 passed / 1 skipped**。
`1 skipped` 是跨 repo 的 `upstreamRegistry.test.ts`（worktree 沒有 sibling
`taipei-gis-analytics` 時整支自動跳過）。⚠️ 在**主樹**跑它，預期只剩
`fireHydrants → fire_hydrants` 一筆紅 —— 那是 catalog 端缺口、pre-existing、屬另案，
**不要靠改 manifest 讓它變綠**（缺的是上游的 dataset 文件）。

fixture 於 4a 縮編成 3 個 section（`overlays` / `params` / `gisLayers`）——
另外 9 個已被 `layerManifest.test.ts` 逐 key 雙向焊死，凍第二份只是 churn。
判準寫在 `src/data/__tests__/layerGoldenExtract.ts` 的 `FIXTURE_SECTIONS`。

## 相關 backlog / 歷次改動 / 資料契約

[backlog.md](./backlog.md)｜[changelog.md](./changelog.md)｜[handoff.md](./handoff.md)
