# Handoff — 房地產總市值 Property Value（下游視角）

> **上游 SSOT**：`../../../taipei-gis-analytics/docs/handoff/property-value.md`（契約細節看那份，本檔不重抄）
> **上游 pipeline**：`taipei-gis-analytics/pipelines/urban_composite/property_value/`
> **接線日**：2026-07-27

本檔只放**前端接線的簡表 + 上游約定的差異點**。

## 成品 → 本 repo 落點

| 上游檔 | 本 repo | 大小 | 進 git？ |
|---|---|---|---|
| `buildings_value_taiwan.pmtiles` | `public/urban/buildings_value_taiwan.pmtiles` | 249MB | ❌（`.gitignore:100 public/urban/*.pmtiles`，走 S3 `deploy-assets/urban/`）|
| `property_value_grid_150m.pmtiles` | 同名（**z4-14 版，2026-07-27 覆蓋舊 z6-14**）| 84.7MB | ❌ 同上 |
| `property_value_grid_450m.pmtiles` | 同名 | 21.5MB | ❌ 同上 |
| `property_value_grid_1500m.pmtiles` | 同名 | 3.4MB | ❌ 同上 |
| `admin_value.json` | `public/urban/property_value_admin.json`（**改名**，扁平命名空間裡太籠統）| 113KB | ✅ 小檔進 git，prod 由 nginx `/urban/` 的 `try_files → @dist` 供檔 |

（`property_value_grid_stats.json` 只是上游的分位數參考，前端不需要，未拷貝。）

部署模式與 `buildings_3d_taiwan.pmtiles` 完全一致：`public/urban/` 整夾被
`scripts/deploy/upload-deploy-assets.sh`（glob `public/urban/*.pmtiles`）上傳、
`pull-deploy-assets.sh`（`aws s3 sync $S3/urban/ /data/urban/`）拉回 Volume，
新增檔案**不需改任何部署腳本**。

## ⚠️ buildingsGba 換磚（欄位改名，破壞性）

`buildingsGba` overlay 的 `sourceUrl` 自 2026-07-27 起由 `buildings_3d_taiwan.pmtiles`
改成 `buildings_value_taiwan.pmtiles`——**單檔取代，不並存**。判斷依據：

- 同一批 152 萬棟、同 `z8-16`、同 source-layer `buildings`、同 tippecanoe 策略
  （`--drop-densest-as-needed --coalesce-smallest-as-needed`，addressed tiles 74,722 → 74,720）
- 新磚屬性是舊磚的**嚴格超集**：`height` → `h` 改名，`src` 不變，另加 `f`/`v`/`ps`/`nm`
- 並存要多付 194MB S3+Volume、把「建物輪廓」拆成兩個看起來一樣的 toggle，
  且 `buildingsNightBloomCustomLayer` 靠 `querySourceFeatures("buildings-gba")` 借用同一份
  source，兩份磚會讓 bloom 不知道該讀哪個

**遺留清理（需 user 拍板）**：`public/urban/buildings_3d_taiwan.pmtiles` 與
S3 `deploy-assets/urban/buildings_3d_taiwan.pmtiles` 已無人引用，可刪（省 194MB）。

## 硬依賴欄位（改一定爆）

**layer `buildings`**（z13+ 逐棟可信，z8-12 為 coalesce 近似）

| 欄位 | 型別 | 前端用途 |
|---|---|---|
| `h` | float m（`-999` = 缺值 sentinel） | 高度分級/3D/夜景三模式染色 + extrusion 高度 + 高度門檻 filter + bloom 篩選 |
| `f` | int | popup「估算樓層」（缺值退回 `round(h/3)`）|
| `v` | int **萬元** | 估值模式（mode 4）染色 + popup |
| `ps` | `g`/`n`/`t`/`c` | popup「價格來源」中文化（誠實度：t/c = 用行政區中位價推的）|
| `nm` | 0/1 | mode 4 灰色「未估值」+ popup；**判斷順序必須在 `v` 之前**（nm=1 的棟在磚裡 `v` 是有值的）|
| `src` | `osm`/`ours2`/`clsm` | 資料來源二色（mode 1）+ popup |

**layer `grid_value_150m`**（z6-14，333,847 格）

| 欄位 | 型別 | 前端用途 |
|---|---|---|
| `v_mkt` | int **萬元** | ⭐ 主數字：9 級 inferno 染色 + 3D 高度 + popup（`0` 的 1,808 格 opacity 淡出）|
| `n_bld` / `gfa` / `ps_dom` / `grid_id` | int / float m² / str / str | popup |
| `v_all` | int 萬元 | **前端不顯示、不相減**（未套 GFA 校正 → 可能 < `v_mkt`）|

**layer `grid_value_450m` / `grid_value_1500m` 追加欄位**（2026-07-29 契約，上游平行處理中）

| 欄位 | 型別 | 前端用途 |
|---|---|---|
| `pop` | int 人（最小統計區**面積加權**；`0` = 無人口資料或無人） | 人均市值模式染色（`v_mkt / pop`，萬元/人）+ popup「人口」「人均市值」兩列；`pop < 10` 視為統計不可靠 → 灰 `#555` 半透明（不隱藏，保留可點查）|

⚠️ **`grid_value_150m` 沒有 `pop`** → 人均模式在 150m 尺度 disabled（select 選項灰掉並註明
「僅 450m / 1.5km 提供」，**不自動跳尺度**；有效模式統一由 `resolvePropertyValueGridMode()`
回退總市值）。上游磚**尚未帶 `pop`** 期間：popup 兩列自動隱藏（`pop` 缺 → NaN 判掉）；
人均模式上色會整片灰半透明（缺欄位 `to-number` 成 0 → 落入不可靠門檻）——誠實呈現「還沒有
人口資料」，磚換新後自動恢復，不需改前端。

**`property_value_admin.json`**：`meta.total_trillion`（headline）/ `meta.limitations`（摺疊必露）/
`meta.license_note` / `county[].value_market_corrected`（⭐ 長條圖主數字，**單位是元不是萬元**）。

## 接線點清單

| 檔 | 內容 |
|---|---|
| `src/data/propertyValueTypes.ts` | 🆕 SSOT：建物估值 7 級 YlOrRd + 網格 9 級 inferno 色票、3D 高度映射、`ps` 中文表、萬→億→兆 formatter、署名 |
| `src/data/buildingsGbaTypes.ts` | `height` → `h`；`BUILDINGS_GBA_MODES` 加 `估值`（idx 4）|
| `src/data/propertyValueAdminLoader.ts` | 🆕 admin json loader（`withLoading` + `cachedOnce` 6h）|
| `src/map/overlayRegistry.ts` | buildingsGba 換磚 + mode 4 染色；🆕 `propertyValueGridOverlay(scale)` factory ×3 尺度（各 fill + fill-extrusion）|
| `src/map/buildingsNightBloomCustomLayer.ts` | `properties.height` → `properties.h` |
| `src/components/LegendPanel.tsx` | BuildingsGbaLegend mode 4 分支；🆕 `PropertyValueGridLegend` |
| `src/components/featureInfo/urbanPanels.tsx` | BuildingsGbaPanel 加估值三列；🆕 `PropertyValueGridPanel` |
| `src/components/PropertyValuePanel.tsx` | 🆕 縣市總市值長條圖面板（IconRail `PiggyBank` 開關）|
| `src/map/overlayManager.ts` | 🆕 `isOverlayVisible()`：toggle × 尺度的可見性解析（多尺度圖層唯一特例）|
| `src/map/MapView.tsx` | 三處可見性計算改走 `isOverlayVisible`；effect deps 收 `propertyValueGridScaleIdx` |
| `src/hooks/useTransportParams.ts` | 🆕 網格大小 select + opacity / 3D / 對比 / 高度 |
| `src/hooks/useMapInteraction.ts` | 🆕 三尺度 ×2 sublayer 共 6 個 layer id → popup（排在 500m 都市紋理前，細者優先）|
| `layerCatalog.ts` / `IconRailSidebar.tsx` / `types/index.ts` / `upstreamRegistry.ts` / `App.tsx` | 新 layer key 標準接線 |

## propertyValueGrid 的網格大小（150m / 450m / 1.5km，**純手動**）

三份巢狀聚合 PMTiles（450m = 3×3 個 150m、1500m = 10×10 個，共用 origin，
三尺度 v_mkt 加總皆 204.105 兆）。**尺度由使用者手動選、不隨 zoom 自動切換** ——
用戶明確要求「想在 z4/z5 也看 150m 細格紋理」。預設 150m。

### 實作方式：三個 config 共用同一個 layer key

| 尺度 | sourceId | source-layer | zoom | 格數 |
|---|---|---|---|---:|
| 150m | `property-value-grid-150` | `grid_value_150m` | z4-14 | 333,847 |
| 450m | `property-value-grid-450` | `grid_value_450m` | z4-13 | 69,172 |
| 1.5km | `property-value-grid-1500` | `grid_value_1500m` | z4-12 | 9,828 |

`OVERLAY_REGISTRY` 裡是**三個 `OverlayConfig`、共用同一個 `id: "propertyValueGrid"`**
（factory `propertyValueGridOverlay(scale)`），因此只有一個 sidebar toggle / 一組參數 /
一個圖例 / 一個 popup type。哪一個真的顯示由 `overlayManager.isOverlayVisible()`
依 `overlayParams.propertyValueGridScaleIdx` 決定。被排除的方案與理由：

- ❌ **單 config 換 `sourceUrl`**：source 在 `addOverlay` 時建立，paint/layout/filter 都改不了它，
  換源要改 overlayManager 架構。
- ❌ **三組 sublayer 塞同一個 config**：sublayer 全綁 `config.sourceId`，做不到。
- ❌ **用 opacity 0 藏未選中的尺度**：opacity 0 的 layer **仍會下載圖磚**（三尺度合計 110MB）。
  用 `layout.visibility: none` 才會讓 Mapbox 完全跳過該 source —— 這也是為什麼
  2D/3D 互斥只能走 opacity（visibility 名額已被尺度切換佔用）。

⚠️ 接線陷阱：可見性 effect 預設只吃 `layerVisibility`，切尺度是 **param** 變動，
所以 `MapView` 的 effect deps 必須額外收 `overlayParams.propertyValueGridScaleIdx`，
否則「選了 450m 但畫面還是 150m」。`OVERLAY_REGISTRY` 出現重複 id 是安全的 ——
全 repo 沒有任何地方假設 id 唯一（都只做 `layerVisibility[config.id]` 查詢）。

### 各尺度自己的斷點（1-3-10 階梯平移）

粗格值域整體右移，**沿用細格斷點會全部爆頂**。三尺度都用同一條設計準則
（中段 1-6 級各 8–25% ＋ 頂兩級合計 0.5–2%），各自實算；實測每個尺度都只有
**唯一一組**階梯同時滿足：

| 尺度 | 斷點（萬元）| 逐級占比 % | 頂兩級 |
|---|---|---|---:|
| 150m | 1,000 / 3,000 / 10,000 / 30,000 / 100,000 / 300,000 / 1,000,000 / 3,000,000 | 17.14 · 15.51 · 21.28 · 18.07 · 14.94 · 8.66 · 3.60 · 0.71 · 0.08 | 0.79% |
| 450m | 3,000 / 10,000 / 30,000 / 100,000 / 300,000 / 1,000,000 / 3,000,000 / 10,000,000 | 15.89 · 14.64 · 18.55 · 20.10 · 13.38 · 10.27 · 5.43 · 1.54 · 0.20 | 1.74% |
| 1.5km | 30,000 / 100,000 / 300,000 / 1,000,000 / 3,000,000 / 10,000,000 / 30,000,000 / 100,000,000 | 26.32 · 14.23 · 17.40 · 17.30 · 10.84 · 9.04 · 3.79 · 0.95 · 0.14 | 1.09% |

**平移量非線性**（450m 只 +1 階、1.5km +3 階，而面積是 9× / 100×）：粗格值由少數密集子格
主導，不隨面積等比放大 → **一定要各尺度實算，不能照面積倍率推**。
1.5km 第 1 級 26.3% 略超 25% 準則：往下移一階會讓頂兩級暴增到 4.87%（亮黃泛濫、
重演封頂觀感），兩害相權保留 —— 第 1 級是「鄉間近乎空格」的背景色，胖一點無妨。

**未採用上游 `property_value_grid_stats.json` 的 breaks**：那組是「均衡版」，頂級開放區間
占 4.4% / 1.7% / 4.9%，會讓亮黃泛濫、與 3D 不封頂的設計對打。

### 3D 高度錨也隨尺度換

`FLOOR` = 該尺度第 1 斷點、`MAX` = 該尺度真實 max（150m 1,873 億 / 450m 6,334 億 /
1.5km 24,089 億），不封頂原則不變。Contrast / Height 滑桿三尺度**共用、切尺度不重置**
（正規化各吃各的錨，所以同一組滑桿值在三尺度的觀感一致：實測三尺度的 max 在
預設 contrast 1.8 / Height 40 下都恰好是 4,000m 滿格）。

### 上游烤磚的兩個 caveat（UI 不提示，知道就好）

1. **150m 在 z4/z5 單 tile 約 3.1MB** —— 手動選細格 + 拉遠景 = 一次 3MB 下載。
   這是「手動不自動」換來的代價，屬預期行為。
2. **z4 的 150m tile 因 `--drop-densest-as-needed` 只留約 47% 的格**（留下來的格屬性正確、
   沒有被合併竄改）。因此**低 zoom 的 150m 只能當視覺紋理，不能拿畫面上的格去加總**；
   要正確總量請切 450m / 1.5km 或看縣市長條圖面板。

## propertyValueGrid 的平面配色（9 級 inferno）

2026-07-27 v2：6 級 BuPu → **9 級 inferno**（用戶要「更多階層 + 科學對比色，對比更明確」）。
inferno 是 perceptually-uniform 色圖、亮度嚴格單調（L\* 0.22 → 0.98），
**深紫沉入深色底圖、亮黃跳出 ——「錢多的地方會發光」，方向性刻意如此**。
也與 buildingsGba 估值模式的 YlOrRd（單棟）明確區隔，兩層同開時分得出誰是誰。

斷點 = **1-3-10 對數階梯**（萬元），實算占比（333,847 格）：

| # | 級距 | 斷點（萬元）| 色 | 格數 | 占比 |
|---:|---|---:|---|---:|---:|
| 1 | < 0.1 億 | < 1,000 | `#1b0c41` | 57,216 | 17.14% |
| 2 | 0.1 – 0.3 億 | 3,000 | `#4a0c6b` | 51,793 | 15.51% |
| 3 | 0.3 – 1 億 | 10,000 | `#781c6d` | 71,032 | 21.28% |
| 4 | 1 – 3 億 | 30,000 | `#a52c60` | 60,341 | 18.07% |
| 5 | 3 – 10 億 | 100,000 | `#cf4446` | 49,883 | 14.94% |
| 6 | 10 – 30 億 | 300,000 | `#ed6925` | 28,908 | 8.66% |
| 7 | 30 – 100 億 | 1,000,000 | `#fb9b06` | 12,032 | 3.60% |
| 8 | 100 – 300 億 | 3,000,000 | `#f7d03c` | 2,375 | 0.71% |
| 9 | > 300 億 | — | `#fcffa4` | 267 | 0.08% |

無空級、無單級 >40%、中段 6 級落在 8.7–21.3%。**頂兩級刻意保留為極稀薄尾巴**
（合計 0.79% = 2,642 格）—— 那正是 3D 高度要刺出來的核心；色階若在此合併，
平面上就會重演一次「平頂高原」。

配色套用在 **fill 與 fill-extrusion 本體色兩處**（同一個 `propertyValueGridColorExpr()`），
3D 立起來吃同一套色。`v_mkt=0` 的 1,808 格仍走 opacity 0.04 淡出，不進色階。
圖例 swatch 由 `UrbanDotRow` 提供 1px 白 60% 細邊框，前兩級深紫在深色 panel 上才不會糊掉。

## propertyValueGrid 的上色模式（總市值 / 人均市值，2026-07-29）

「上色模式」select（照 LASS 微感測 fd6189b 的模式範式）：`propertyValueGridModeIdx`
（0=總市值預設 / 1=人均市值），存在 `useTransportParams` state → 走 `overlayParams` 傳進
paint function，切模式 = param 變動 → `updateOverlayTheme` diff `setPaintProperty`，不重建 layer。

- **有效模式判斷單一入口** `resolvePropertyValueGridMode(scaleIdx, modeIdx)`（SSOT
  `propertyValueTypes.ts`）：人均只在 `hasPop`（450m / 1.5km）尺度生效，150m 選了人均一律
  回退總市值 —— paint / 圖例 / UI disabled 三邊同源，不會出現「圖例說人均、地圖畫總市值」。
- **配色**：8 級 viridis（`PROPERTY_VALUE_VIRIDIS_8`，紫→藍→青→綠→黃），刻意與總市值
  inferno 及 buildingsGba YlOrRd 區分。`pop < 10` → `#555` + opacity ×0.45（不隱藏，可點查）。
- **✅ 斷點已按實算分位數校準（2026-07-29）**：`PROPERTY_VALUE_PER_CAPITA_BREAKS_WAN =
  [100, 250, 550, 1000, 2000, 4000, 10000]`（萬元/人）。依上游 pop>=10 格實算：450m
  p50=549 / p90=3179 / p95=6178；1.5km p50=560 / p90=2373 / p95=4263。中位數落第 4 級、
  頂級 >10000 約 2%（長尾 = 工業區/機場等低人口格）。級距標籤與 expression 都從這一個陣列
  衍生，再校準只改它。兩尺度分佈實算相近 → 共用同一組，不拆 per-scale。
- **3D 高度 = 量體、顏色 = 強度（刻意設計）**：人均模式下 extrusion 高度**維持 `v_mkt` 總量**，
  只有顏色換人均 —— 高黃 = 人少錢多、高紫 = 人多攤薄，兩通道疊出密度語意。灰格（pop<10）照常
  用 v_mkt 立高度（總值本身可信，只是人均不可靠）；`fill-extrusion-opacity` 不支援 data-driven，
  3D 下灰格半透明做不到，僅靠色相標示。
- **人均模式不做 v_mkt=0 淡出**：pop ≥ 10 而 v_mkt=0 是「有人住但格內僅非市場建物」，
  0 萬/人落第 1 級是誠實低值不是缺值。
- **popup 跟尺度走、不跟模式走**：450m/1.5km 一律顯示「人口」「人均市值」兩列
  （總市值模式點查也看得到），150m 不顯示。

## propertyValueGrid 的 3D 高度映射

控件組**照人口網格**（`h3Population` / `popCount`，SSOT `src/map/h3LayerFactory.ts`）：
`Opacity → Contrast → 3D → Height`，`Contrast` 0.5–4 step 0.1 預設 1.8（完全沿用）、
`Height` step 10（滿格公尺數 = ×100），參數命名對齊 `h3Contrast` / `h3Extruded` / `h3ElevationScale`。
三處刻意的差異，都有理由：

1. **高度公式不是人口層的 `log1p(v)/log1p(max)`**——`v_mkt` 偏斜遠比人口嚴重，
   純 log 對 max 正規化會把 p25→p99 壓成只差 2.9 倍（整片一樣高）。改成
   **對數軸下錨在圖例第 1 級斷點、上錨用資料真實最大格**：

   ```
   norm   = max(0, (ln(1+v_mkt) − ln(1+FLOOR)) / (ln(1+MAX) − ln(1+FLOOR)))
   height = norm^contrast × elevationScale × 100     // 公尺
   FLOOR = 1,000 萬元（色階第 1 級上界，≈p18）→ 貼地
   MAX   = 18,730,533 萬元 ≈ 1,873 億（實際最大格）→ 滿格
   ```

   全部走 mapbox expression（`ln`/`^`/`max`），無 per-feature JS（PMTiles 也做不到）。
   ⚠️ `["^", 負數, 小數]` = NaN，冪次前必須 `max 0` 夾住。
   ⚠️ 上方**沒有 clamp**，見下一點。

2. 🔴 **不封頂（2026-07-27 用戶實測後改）**——初版上錨用 `CAP = 100 億`（色階第 6 級下界，
   p99.2）並 `min(v, CAP)` 封頂，結果台北核心 **0.79%（2,642 格）全部撞頂變「平頂高原」**，
   看不出核心裡誰更貴。現在上錨改成資料真實 max 且移除 `min()`：
   **顏色負責呈現分佈（9 級 inferno）、高度負責突出極值**，兩個視覺通道分工。
   上游重跑後若最大值變大，超出上錨的格只是刺出滿格 —— 這正是要的行為，不會壞掉
   （要更精準可回填 `PROPERTY_VALUE_HEIGHT_MAX_WAN`）。

3. **`Height` 上限 400（人口層 200）、預設 40（人口層 50）**——換上錨後對數範圍變寬 42%
   （LN_SPAN 6.907 → 9.837），同 scale 下整體變矮，故拉高上限讓「要誇張可以更誇張」；
   預設 40（滿格 4,000m）讓中段觀感與舊版相當。另本層 cell 150m 見方只有 H3 res8（~460m）
   的 1/3，長寬比也要靠這個預設壓住不變針林。

   **實算表**（mapbox expression 直譯器跑真實分位數；`0` 值格與 FLOOR 以下皆為 0m）：

   | contrast / Height | p25 | p50 | p75 | p90 | p95 | p99 | p99.9 | p99.99 | max |
   |---|---|---|---|---|---|---|---|---|---|
   | **1.8 / 40（預設）** | 26m | **245m** | 659m | 1,150m | 1,446m | 2,040m | 2,703m | 3,296m | **4,000m** |
   | 0.5 / 40（低對比）| 991m | 1,841m | 2,424m | 2,830m | 3,015m | 3,318m | 3,587m | 3,791m | 4,000m |
   | 4 / 40（高對比）| 0m | 8m | 73m | 251m | 417m | 896m | 1,674m | 2,602m | 4,000m |
   | 1.8 / 400（上限）| 263m | 2,450m | 6,594m | 11,504m | 14,462m | 20,397m | 27,026m | 32,960m | 40,000m |

   頂端階差（預設）：p99 2,040m → p99.9 **+663m** → p99.99 3,296m → max 4,000m，
   **max / p99 = 1.96×**——高市值格明顯往上刺，無平頂。

**2D/3D 切換**照 `buildingsGba` 慣例：兩個 sublayer 永遠都在，靠把非當前模式那層的 opacity
壓 0 —— **不可用 `layout.visibility`**，因為 `setOverlayVisible()` 是整個 config 的 sublayer
一起切 visibility，會覆寫掉模式互斥。`fill-extrusion-opacity` 不支援 data-driven，故只給純數字；
`v_mkt=0` 的格 height 恰好是 0（FLOOR 以下被夾成 0）→ 自然貼地，不需另外淡出。

**與 buildingsGba 3D 共存**：不需互斥。兩層都是 mapbox `fill-extrusion`，共用同一組深度緩衝，
遮擋由 GPU depth test 決定而非 layer 順序（＝跟 h3 人口 3D 與建物 3D 同開時的既有行為一致）。
語意上兩者本來就該疊看：建物 3D 是「實體量體」、總市值 3D 是「這格壓了多少錢」。

## 上游改動 → 下游要跟改的觸發點

| 上游改動 | 下游動作 |
|---|---|
| 實價網格新一季重跑（預計每季）| 重跑上游兩支腳本 → `cp` 五個檔 → 跑 `upload-deploy-assets.sh` 上 S3；**前端程式不用改**（斷點/高度錨值會略微失準但不會壞，要精準就回填 `PROPERTY_VALUE_SCALES`）|
| 人口新年度重跑（上游 03 → 重烤 450/1500 磚）| `cp` 兩個 pmtiles → 上 S3；若人均分佈大幅改變再回填 `PROPERTY_VALUE_PER_CAPITA_BREAKS_WAN` 一個陣列（標籤/expression 自動衍生）|
| `h`/`v`/`ps`/`nm`/`v_mkt` 任一改名 | `propertyValueTypes.ts` + `buildingsGbaTypes.ts` + overlayRegistry filter/paint + panels 一起改 |
| `v_mkt` 分佈大幅改變（如改幣別／改單位）| `PROPERTY_VALUE_GRID_BANDS`（9 級斷點）與 `PROPERTY_VALUE_HEIGHT_FLOOR_WAN` / `PROPERTY_VALUE_HEIGHT_MAX_WAN`（3D 上下錨）都要重取；FLOOR 刻意 = 色階第 1 級上界（1,000 萬），改色階時要跟著改 |
| 排除非住宅量體（限制 1 落地，38 兆會下修）| headline 數字自動跟 json 走；`PROPERTY_VALUE_APPROX_NOTE` 與圖例的「≈ 204 兆」文案要跟改 |
| 補外島 / 授權變更 | 圖磚自動涵蓋新範圍；授權改 `PROPERTY_VALUE_ATTRIBUTION` |

## 誠實度硬要求（不可省）

1. `nm=1` 一律灰色「未估值（非市場建物）」，不顯示金額
2. `ps=t`/`c` 必須在 popup 露出「鄉鎮/縣市中位」——該棟所在網格其實沒有成交
3. `meta.limitations` 三條必須在面板內可讀（`<details>` 可摺，但不可只放 tooltip）
4. GBA **CC BY-NC 4.0 禁商用**：圖例 + 面板 `license_note` 都要露出；本層衍生品不得入
   Supabase 對外服務
5. 人均模式 `pop < 10` 一律灰 + 半透明「統計不可靠」，popup 標「樣本不足」，不給人均數字

## Changelog

- **2026-07-29 人均市值模式**（PR #95，squash `3a55e46`；上游 pop 欄 taipei-gis-analytics#30，
  同日並改圖層名為「不動產總市值網格 Value Grid」）：新增第二種上色模式 `propertyValueGridModeIdx`
  （0=總市值 / 1=人均 `v_mkt/pop` 萬元/人，僅 450m/1.5km；150m 無 `pop` → select disabled
  不跳尺度）。8 級 viridis + `pop<10` 灰半透明；3D 高度維持 v_mkt（高度=量體、顏色=強度）；
  popup 450m/1.5km 加「人口」「人均市值」兩列。斷點 `PROPERTY_VALUE_PER_CAPITA_BREAKS_WAN =
  [100, 250, 550, 1000, 2000, 4000, 10000]` 已按上游實算分位數校準。改動：`propertyValueTypes.ts`
  （模式/色票/expression SSOT）、`overlayRegistry.ts`（paint 隨 modeIdx 切）、
  `useTransportParams.ts`（state + 上色模式 select）、`IconRailSidebar.tsx` / `LayerSidebar.tsx`
  （SelectConfig options 新增 `disabled` 支援）、`LegendPanel.tsx`（兩模式圖例）、
  `urbanPanels.tsx`（popup 兩列）。
- **2026-07-27 v2**：150m PMTiles 改 z4-14；6 級 BuPu → 9 級 inferno；3D 不封頂；
  三尺度（150m/450m/1.5km）手動切換上線。
- **2026-07-27 v1**：初版接線（見全文）。
