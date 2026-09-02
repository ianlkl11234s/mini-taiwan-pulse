# Handoff — 日本遞延圖層（鐵道 / 學校 / 人口網格）給下個 session

> **狀態**：Batch 1（日本 tab + 縣界/市界/車站/機場 + 宗教搬入 + 車站雙上色 + 機場點位切換）**已 merge 進 master**（PR #199，merge commit `632a7d2`，保留 4 commit）。
> 本檔是**下一批**：把 handoff 6 個新層裡剩下的 3 個接上——鐵道 / 學校 / 人口網格。
> **上游資料 SSOT**：`../../../taipei-gis-analytics/docs/handoff/jp-core-layers.md`（9 層速覽、tippecanoe 配方、S3 路由、20 觸點指路，動工前讀）。
> **前端 20 觸點 SSOT**：`../../development-rules.md` §4。

---

## 0. 開工前（環境）

1. **開自己的 worktree + 分支**（此工作區長期有平行 session，別在正站著的分支動）：
   `EnterWorktree` 或 `git switch -c feat/jp-deferred-layers`。
2. **worktree 缺 `.env` → app 會崩**（Mapbox token 缺 → `new Map()` throw → 整個 App 白/黑畫面；這就是上次 headless 全黑的真因）。
   從主樹複製（只 cp 不讀內容，兩者 gitignored）：
   `cp <主樹>/.env <worktree>/.env` ＋ `cp <主樹>/.env.local <worktree>/.env.local`
3. **P0**：任何 layer 接線先跑 `layer-onboarding` skill。
4. **merge 策略**：這個 repo 一律用 `gh pr merge --merge`（**不要 squash**，owner 要保留完整 commit）。

---

## 1. Batch 1 已建好的機制（新層照抄，不用重造）

日本三主題結構已在 `layerCatalog.ts`：**行政區 / 交通 / 宗教**（各自獨立 theme，tab 抬頭 `JAPAN_THEME_TITLE = "日本 Japan"`；`JAPAN_TAB_THEME_TITLES = ["行政區","交通","宗教"]`）。新層要新增 **教育 / 人口** 兩個 theme。

**新增一個日本層 = 照這套觸點（Batch 1 每層都這樣）**：
- `src/types/index.ts`：`LayerVisibility` 加 key；可 popup 再加 `FeatureInfo["layerType"]`。
- `src/data/layerManifest.ts`：一筆 entry（派生 color/icon/label/upstream）。`section: { theme, group }`。單色 → `legend: null` + 加進 `layerConsistency.test.ts` 的 `NO_LEGEND_LEDGER`；有分色 → `legend: "<key>"`。`params: { count, kinds }` 要跟 spec 一致。
- `src/data/layerParamsSpec.ts`：一筆 `key: [ opacitySlider(...), ... ]`（點層加 `scaleSlider`；要模式切換用 select，格式抄 `jpStations` / `urbanHeat`）。
- `src/data/xxxLoader.ts`（GeoJSON）或 hook 自建 PMTiles source。
- `src/hooks/useJpXxxLayer.ts`：clone 現成——PMTiles polygon → `useJpAdminLayers.ts`；PMTiles/GeoJSON 點 → `useJpStationsLayer.ts`；GeoJSON polygon → `useJpAirportsLayer.ts`。
- `src/layers/hosts/japanHosts.tsx`：加一個 Host（clone `JpStationsHost`），讀 `useKeyOverlayParams(key)`。
- `src/layers/layerHookRegistry.tsx`：加一筆 `{ id, keys, Host }`。
- `src/components/sidebar/layerCatalog.ts`：`JAPAN_TAB_THEME_TITLES` 加新 theme 名 + `THEME_MACRO_GROUPS` 該 theme → `"world"` + THEME_CATALOG 加 theme（`fromManifest`）。
- `src/map/gisClickRegistry.ts`：可點就加 `{ layers:[...], type }`（**點層在前、面層在後**，見下 gotcha）。
- popup：`src/components/featureInfo/japanPanels.tsx` 加 panel + `featureInfo/registry.tsx` 的 `PANEL_REGISTRY` + `HEADER_LABELS`。
- 分色圖例：`src/components/LegendPanel.tsx` sub-component + `LEGEND_REGISTRY`（隨模式切換讀 `overlayParams.<xxxModeIdx>`，抄 `agriSoilFertility`）。
- 色票/級距/表達式 SSOT：學校要開 `src/data/jpSchoolTypes.ts`（抄 `jpStationTypes.ts`：match/step 表達式 + classify + 色票，三邊共用）。

**資料檔契約**：小檔 git-track 進 `public/world/`（nginx `/world/` 已有 `root /data; try_files $uri @dist` dist fallback → 免 S3、免觸點 #20，比照 jp_religion_*）；>25MB 走 S3（觸點 #20）。前端 fetch 用**不帶日期戳**檔名（cp 後 rename）。

---

## 2. 三個遞延層

上游成品在 `../../../taipei-gis-analytics/data/processed/world/jp_*/`。

### 2a. 鐵道 jpRailways（最單純）
- 資料：`jp_railways/jp_railways_20260831.geojson`，**13.9MB**，21,933 條 LineString。properties：路線名 / 事業者種別 / 運營會社。
- **為何遞延**：14MB 落在 git-track 灰帶。
- **步驟**：
  1. 建議先轉 PMTiles 縮到 <5MB（線資料 tippecanoe，`-l jp_railways`）→ 逐 zoom 稽核；或直接 git-track 14MB（灰帶，可接受但偏大）。
  2. 若走 PMTiles：hook clone `useJpAdminLayers` 的 PMTiles source 建法，但 layer type = `line`（非 fill）。source-layer 名 = tippecanoe `-l` 值（＝ `jp_railways`），min/maxzoom 用 `pmtiles show` 確認。
  3. section `{ theme: "交通", group: "線" }`（交通 theme 目前只有「點位」群組，加一個「線」群組）。
  4. 單色即可（免圖例）；或按事業者種別分色（則配圖例 + `jpRailwayTypes.ts`）。popup：路線名/會社。
  5. UX baseline（線層）：width z6=1 / z14=3、opacity 0.9（主要路網）。

### 2b. 學校 jpSchools（要轉檔 + 可分類上色）
- 資料：`jp_schools/jp_schools_20260831.geojson`，**28MB**，56,807 點。**⚠️ 上游還沒轉 PMTiles**（目錄下只有 geojson）。properties：`school_class`（13 類）/ 名稱 / 所在地。
- **為何遞延**：28MB 不宜直接 git-track，需一道資料工序。
- **步驟**：
  1. **先轉點 PMTiles**（上游 handoff §3.1 有配方）：`tippecanoe -o jp_schools.pmtiles -l jp_schools -r1 -pf -pk -Z4 -z14 --no-tile-size-limit <geojson>`；產後跑逐 zoom 稽核（`pmtiles_zoom_audit.py`）確認低 zoom 沒掏空（`reference_tippecanoe_drop_densest_trap`）。
     - ⚠️ `keep_attrs` 要含 popup + 分色要用的欄位（尤其 `school_class`），否則前端拿到 undefined。
  2. cp `jp_schools.pmtiles` 進 `public/world/`（git-track，<11MB 應該 OK；若仍 >25MB 才走 S3）。
  3. hook clone `useJpReligionLayers.ts` 的 `useGsiLayer`（PMTiles 點 circle）。source-layer = `jp_schools`。
  4. **13 類 school_class 分類分色**（小學/國中/高中/大學/特教…）→ 開 `src/data/jpSchoolTypes.ts`（抄 `jpStationTypes.ts` 的 match 表達式 + classify + 色票）+ 寫 `JpSchoolsLegend`（`LEGEND_REGISTRY`）。manifest `legend: "jpSchools"`。
     - 若走 PMTiles，分色欄位是 vector-tile 屬性（`["get","school_class"]`），確認 keep_attrs 有帶。
  5. section `{ theme: "教育", group: "點位" }`（**新增「教育」theme**：`JAPAN_TAB_THEME_TITLES` 加 "教育"、`THEME_MACRO_GROUPS["教育"]="world"`、THEME_CATALOG 加）。
  6. popup：名稱 / school_class / 所在地。UX：56,807 點屬 >10k → radius 小（z6=2/z12=5）、opacity 0.75。

### 2c. 人口網格 jpPopulationMesh1km（最重，S3 + deploy 需拍板）
- 資料：`jp_population_mesh_1km/jp_population_mesh_1km.pmtiles`，**48.6MB**，176,896 格 Polygon。properties：`pop_{2020..2070}` / `ratio65_{2030..2070}`。
- **為何遞延**：>25MB **一定走 S3**（觸點 #20）+ deploy 需 owner 拍板。
- **步驟**：
  1. **S3 上傳**：把 `jp_population_mesh_1km.pmtiles` 加進 `scripts/deploy/upload-deploy-assets.sh` 的清單 + `scripts/deploy/pull-deploy-assets.sh` 同步；nginx `/world/` 已有 location（免加）。現成範例：`power_poles.pmtiles`（26MB 走 S3）。**實際 aws s3 upload + deploy 要 owner 拍板**（🔴 部署鐵則）。
     - `deployContract.test.ts` 會驗供應鏈：走 S3 的檔**別** git-track（gitignore），靠 upload 清單 + nginx `@dist`/`/data` 供應。
  2. hook clone `useJpAdminLayers`（PMTiles polygon fill+line）；source-layer 用 `pmtiles show` 確認（應為 `jp_population_mesh_1km`）。
  3. section `{ theme: "人口", group: "面" }`（**新增「人口」theme**，同 2b step 5 的三處登記）。
  4. **數值分級著色**（pop 或 ratio65）→ step 表達式 + 圖例（choropleth）。可做 select 切「哪一年 / pop vs ratio65」（模式切換抄 `jpStations` 的 select + 隨模式切圖例）。
  5. **時間維度**：pop_2020..2070 是時序，可考慮 timeline slider（進階，非必須；若做，走 timeStore 訂閱不要把時間放 deps，見 development-rules §8）。
  6. popup：該格 pop / ratio65。UX：面層 fill-opacity 0.55、outline 0。

---

## 3. Gotchas（Batch 1 踩過 / 確認過）

1. **gisClickRegistry first-hit-wins**：點層排在面層**之前**，否則覆蓋全區的面（如人口網格）會吃掉點擊。測試不擋順序，靠 golden fixture `gisLayers` 凍結。
2. **golden fixture**：加層後 `npx vite-node scripts/preprocess/dump-layer-golden.ts` regen，`git diff` 確認**只有新 key + keyCount** 變動，既有層零 diff。
3. **THEME_MACRO_GROUPS 漏加新 theme → `themeMacroGroup()` throw**；**MAIN_THEMES 已用 `JAPAN_TAB_THEME_TITLES` 排除**，新 theme 名記得加進 `JAPAN_TAB_THEME_TITLES` 這個陣列（桌機主 panel 才不會重複渲染、日本 tab 才顯示）。
4. **Mapbox 表達式 key 不了陣列屬性** → 若分色欄位在原始資料是陣列（如車站 operator_types），在 loader 補算純量欄位再 `["get", 純量]`（見 `jpStationsLoader` 的 jp_type/jp_pax）。
5. **popup 陣列欄位**經 vt-pbf 會 JSON.stringify → panel 用 `parseStringArray` 兩種來源都接（見 `japanPanels.tsx`）。
6. **驗收**：`npx tsc -b` + `npx vitest run` 全綠；瀏覽器 All Off → 單開新層 → 看渲染/popup/圖例/切換。⚠️ headless 對此 app 的多步互動 @ref 不穩、eval 被 worktree 守衛擋 → 視覺驗收多半得人工在真瀏覽器（記得先補 .env）。

---

## 4. 跨 repo 同步（若動到資料契約 / 產物）
- 轉檔（schools PMTiles）產物：回存 `taipei-gis-analytics/data/processed/world/jp_schools/` + 更新上游 handoff / manifest（上游先動、下游後動）。
- mesh S3：deploy 相關改動在本 repo（nginx/scripts）。
- 完工更新 `docs/features/jp-core-layers/{changelog,backlog}.md`，PR 走 `gh pr create`（模板）+ `gh pr merge --merge`。

## 5. 指標
- 上游資料 handoff（含 tippecanoe 配方 / S3 路由完整版）：`../../../taipei-gis-analytics/docs/handoff/jp-core-layers.md`
- 本 feature：`README.md` / `handoff.md` / `changelog.md` / `backlog.md`（同資料夾）
- 20 觸點：`../../development-rules.md` §4；四鐵則 §4a
- Batch 1 可抄的範本檔：`jpStationTypes.ts`、`useJpStationsLayer.ts` / `useJpAdminLayers.ts` / `useJpAirportsLayer.ts`、`japanHosts.tsx`、`japanPanels.tsx`
