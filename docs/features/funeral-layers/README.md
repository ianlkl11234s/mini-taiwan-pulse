# 殯葬 Funeral

> **Slug**：`funeral-layers`
> **狀態**：dev
> **Owner**：migu
> **上線日期**：（待 PR merge）
> **相關 PR**：#（待補）
> **上游契約 SSOT**：[`../../../taipei-gis-analytics/docs/handoff/funeral-layers.md`](../../../taipei-gis-analytics/docs/handoff/funeral-layers.md)

## 一句話說明

全站第 37 個主題群：把台灣的殯葬地景接上地圖 —— 官方名冊的 **3,707 個設施**與
**6,233 家禮儀業者**、OSM 標註的 **3,229 個墓區**、都市計畫劃設的 **114 塊法定墓葬用地**。

刻意**不整合**三個來源。使用者同時打開 OSM 墓區與都計用地時看到的落差
（實際使用 vs 法定劃設），本身就是這組圖層要講的事。

## 圖層 / 元件

| 名稱（layer key） | 源 | 類型 | 資料源 | 特色 |
|---|:---:|---|---|---|
| `funeralFacilities` | A | point (3,707) | GeoJSON `public/funeral/funeral_facilities.geojson` | `facility_type` 6 類分色 + 類型/精度雙 filter |
| `funeralOperators` | A | point (6,233) | GeoJSON `public/funeral/funeral_operators.geojson` | `entity_type` 2 類分色；**預設只畫仍營業的 4,569** |
| `funeralOperatorDensity` | A | fill (325 區) | JSON `public/funeral/funeral_operators_density.json` × 鄉鎮界 PMTiles | **無幾何**，feature-state join |
| `cemeteryOsm` | B | fill+line (3,229) | PMTiles `public/funeral/cemetery_osm.pmtiles` | **ODbL，圖例＋popup 都標示** |
| `cemeteryZoning` | C | fill+line (114) | GeoJSON `public/funeral/cemetery_zoning.geojson` | `zone_label` 9 值歸 3 群；**僅臺北＋新北** |

合計 5.77 MB，全部進 git（走 dist 供檔，`/data/funeral/` 保留同構以備日後大檔）。

## 三個設計重點

### 1. A／B／C 三源分開，前端不合併不去重

2026-08-05 用戶拍板。三源的幾何型態、覆蓋範圍、授權、語意都不同：

| 源 | 是什麼 | 幾何 | 覆蓋 | 授權 |
|:---:|---|---|---|---|
| A | 官方名冊（內政部＋經濟部） | 點 | 全台 22 縣市 | OGDL |
| B | OpenStreetMap 墓區 | 面 | 全台 22 縣市 | **ODbL** |
| C | 都市計畫墓葬類法定用地 | 面（有法定效力） | **僅臺北＋新北** | OGDL |

同一座公墓可能三個來源都有（點 + OSM 面 + 都計面），這是**刻意保留的重複**。
圖例在兩層同開時會加一句「綠＝OSM 標註的實際墓區、棕＝都市計畫法定用地」。

### 2. `precision` 誠實標記：42% 的設施點不是實際位置

點位是四段 fallback 拼出來的，精度差很多：

| precision | 設施 | 業者 | 實際意義 |
|---|---:|---:|---|
| `source` | 241 | — | 官方原生座標 |
| `exact` | 418 | 3,100 | 門牌級 |
| `cached` | 257 | 1,238 | TGOS cache 門牌級 |
| `tgos` | 767 | 1,861 | TGOS 官方比對 |
| `interpolated` | 19 | 18 | 同路段內插 |
| **`parcel_centroid`** | **1,576** | — | **地籍 bbox 中心，誤差 1.4–126 m** |
| **`approximate`** | **429** | 16 | **鄉鎮／路段中心，可能差數百公尺** |

前端兩道處理（**不是**默默全畫）：

1. **popup 加註**：概略座標的點顯示「⚠️ 位置為概略值：地籍範圍中心（誤差 1.4–126 m），非實際入口座標」
2. **可切換 filter**：「定位精度」select 三態（全部／僅精確定位／僅概略座標）——
   要做「最近的火化場」這類距離分析前，先切「僅精確定位」

純密度／分布展示用全部無妨，這也是預設值。

### 3. 密度圖層無幾何：5.1 KB 換掉 48.9 MB

上游原本可以直接出「附鄉鎮面的密度 GeoJSON」，那是 48.9 MB。改成純數值表
（`TOWNCODE → 家數`）只有 5.1 KB，前端 join pulse 已有的
`public/base_map/township_boundary.pmtiles`。

join 走 Mapbox feature-state（`promoteId: TOWNCODE`），一次寫完 325 區不看視窗 ——
Mapbox 會依 source/sourceLayer/id 快取，套到後續載入的任何 tile。
**通用 overlayRegistry 路徑不支援 promoteId**，故這層走專屬 hook
`src/hooks/useFuneralDensityLayer.ts`（同 `useRoadCongestionLayer` 慣例）。

⚠️ 語意是業者「**登記地**」家數，**不是服務涵蓋率** —— 禮儀業者常跨區服務，
不可當可及性指標。popup 與圖例都寫了這句。

## 接線位置（新 layer 五處 SOP + 本主題的額外幾處）

| 檔案 | 改了什麼 |
|---|---|
| `src/data/funeralTypes.ts` | **新檔**：分類/配色/表達式 SSOT |
| `src/data/funeralDensityLoader.ts` | **新檔**：密度 JSON 載入（含 loadingRegistry） |
| `src/hooks/useFuneralDensityLayer.ts` | **新檔**：PMTiles + feature-state join 專屬 hook |
| `src/components/featureInfo/funeralPanels.tsx` | **新檔**：5 個 popup panel |
| `src/types/index.ts` | LayerVisibility 5 key + FeatureInfo layerType 5 個 |
| `src/map/overlayRegistry.ts` | 4 個 overlay config（density 不在此） |
| `src/components/sidebar/layerCatalog.ts` | LAYER_COLORS + 新主題（點位／墓區範圍／分析 3 子群） |
| `src/hooks/useTransportParams.ts` | 5 層的 opacity/size slider + 3 個 select |
| `src/components/IconRailSidebar.tsx` | 5 個 icon |
| `src/components/LegendPanel.tsx` | `FuneralLegend`（含 ODbL） |
| `src/components/featureInfo/registry.tsx` | panel + 中文 label |
| `src/hooks/useMapInteraction.ts` | 點擊層 + density 的 feature-state 併入白名單 |
| `src/data/upstreamRegistry.ts` | 5 筆 catalog dataset 對應 |
| `src/App.tsx` | `useFuneralDensityLayer` 接線 |
| `nginx.conf` / `scripts/deploy/*.sh` | `/funeral/` location + pull/upload |
| `src/data/__tests__/staticDataContract.test.ts` | 3 檔的硬依賴欄位契約 |
| `src/data/__tests__/classificationCoverage.test.ts` | `facility_type` / `zone_label` 分類覆蓋 ratchet |

`/embed` 自動涵蓋 4 個 registry 層（靜態、非 gated）；density 不在 registry 故不可嵌入。
Embed 的 ODbL 標示由共用 LegendPanel ＋ 右下不可關閉的 OSM attribution 兩層保證。

## 已知限制

- **C 源只有北北**：其他 20 縣市完全沒有 polygon，**不是資料壞掉**。都市計畫分區目前只做了
  這兩市，且只含都市土地 —— 山區大型公墓在非都市土地的「墳墓用地」編定，那份資料尚未取得。
- **B 源 65.5% 沒有 name**：popup 標題用「未命名墓區」+ osm_id 兜底，不做以名稱為主的搜尋。
- **設施 438 筆無座標**（母體 4,145 → 已定位 3,707，89.4%）：地號兩源皆查無 364 ＋ 原始無地址 73 ＋ partial 1。
- **臺北在國家母體裡最弱**：7052 北市僅 42 筆、其中 29 筆無地址。
- 上游重跑後**檔名不變但內容會變**；`facility_uid` 是穩定的，可安全當前端 key。

## 驗收紀錄（2026-08-05，agent-browser localhost:3721）

- 5 層皆渲染：facilities 319 / operators 878 / cemetery-osm 482 / cemetery-zoning 47 / density 75（台北 z11 視野內）
- `is_active` 預設過濾：`{true: 878}`，零筆 false；切「全部 (6,233)」後才出現 388 筆已歇業 ✅
- 精度 filter：切「僅精確定位」後 `parcel_centroid` / `approximate` 歸零 ✅
- density join：視野內 69/71 鄉鎮有 feature-state；缺的石碇區、平溪區經對照確為 0 家（正確落最淺色）✅
- popup 4 種皆通過，含概略座標警示、ODbL 標示、「登記地不是服務涵蓋率」註記 ✅
- 圖例含 6 類設施 / 2 類業者 / 3 群都計用地 / 7 級密度 + ODbL ✅

## 驗收紀錄（2026-08-06 `is_active` 修正後，agent-browser localhost:6002）

全台 z8 視野，只開 `funeralOperators`：

- 渲染 2,744 點，`by_is_active` 全數 `true`（零筆 false）✅
- **「遷他縣市」在圖上 = 0 筆** —— 26 個幽靈點確認消失 ✅
- 「申覆（辯）期」3 筆仍在圖上（全台 4 筆，視野內 3）—— 符合上游「未確定廢止故保留 active」✅
- 圖例文案：「預設只畫仍營業的 4,569 家（另有 1,664 家已失效——含歇業、撤銷、解散、遷他縣市）」✅
- 其餘 4 個資料檔 byte 相同（density / facilities / cemetery ×2），不需回歸

## 相關

- [backlog.md](./backlog.md) · [changelog.md](./changelog.md) · [handoff.md](./handoff.md)
- 上游 pipeline：`taipei-gis-analytics/pipelines/funeral/`
- 資料目錄：`taipei-gis-analytics/docs/data-catalog/funeral/`
- Migration（**未 apply**，前端不依賴）：`gis-platform/migrations/335_funeral.sql`
