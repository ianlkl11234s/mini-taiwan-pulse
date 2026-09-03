# Handoff — jp-core-layers（下游視角）

> **上游 SSOT**：`../../../taipei-gis-analytics/docs/handoff/jp-core-layers.md`（9 層資料速覽、20 觸點、tab 外殼接線點:行號、auto-flyTo 範本、大檔 S3 路由，全在那份）
>
> 本檔只放**前端接線的簡表 + 上游約定的差異點**，不重複契約。

## 上游 handoff 摘要

- 產物路徑：`taipei-gis-analytics/data/processed/world/jp_*/`（小檔 cp 進本 repo `public/world/`）
- 座標系統：WGS84（EPSG:4326；上游自 JGD2011/EPSG:6668 轉出）
- 資料量：縣界 47 / 市界 1,905 / 車站 9,046 / 機場 108（本輪 4 層）
- 授權：CC BY 4.0（機場為舊約款、商用可）
- Supabase `reference.world_jp_*` 七表僅供未來 point-in-polygon 空間查詢，**畫圖不走**

## 前端渲染路徑（Batch 1 = 全部 git-track / dist fallback，免 S3）

> Batch 2 起不再全數 git-track：鐵道／學校仍 git-track，**人口網格 48.6MB 走 S3**（見下方「供應路徑差異」）。

小檔（admin PMTiles 6+1MB、stations 7.2MB、airports 256KB）git-track 進 `public/world/`，
nginx `/world/` location 有 `root /data; try_files $uri @dist`，build 後從 dist 供檔——
**免觸點 #20**（比照既有 jp_religion_*）。deployContract.test.ts 走 `gitTracked` 路徑通過。

## 硬依賴欄位（改一定爆）— Batch 1 四層

> Batch 2 三層（鐵道／學校／人口網格）的硬依賴另立一節，見下方「Batch 2 硬依賴欄位表」。

| 欄位 | 來源 | 用於 |
|---|---|---|
| PMTiles source-layer=`jp_admin_boundaries_prefecture`（z2-9） | 縣界 PMTiles | hook addLayer 的 source-layer；改名 = 空白渲染 |
| PMTiles source-layer=`jp_admin_boundaries`（z4-11） | 市界 PMTiles | 同上 |
| `pref_name` / `pref_code` | 縣界 tile 屬性 | 縣界 popup |
| `admin_code` / `city_name` / `county_name` / `ward_name` / `pref_name` | 市界 tile 屬性 | 市界 popup |
| `name` / `lines` / `operators` / `railway_categories` / `passengers_{2022..2024}` / `passengers_latest*` | 車站 GeoJSON | 車站 popup（運量逐年 fallback）|
| `name` / `category` / `status` / `regular_flight` / `runway_length_m` / `runway_width_m` | 機場 GeoJSON | 機場 popup |

⚠️ 陣列欄位（lines/operators/railway_categories）經 Mapbox vt-pbf 會 JSON.stringify → panel 用 `parseStringArray` 兩種來源都接。

## Batch 2 硬依賴欄位表（鐵道／學校／人口網格，2026-09-02）

三層皆為 **PMTiles、hook 自建 source**（無 loader），故 **source-layer 名與 min/maxzoom 也是硬依賴**——改了不會報錯，只會整層空白。

### jpRailways（`public/world/jp_railways.pmtiles`，git-track）

| 硬依賴 | 值 | 用於 | 改了會怎樣 |
|---|---|---|---|
| source-layer | `jp_railways` | `useJpRailwaysLayer.ts` 的 `SOURCE_LAYER` | 改名 = 空白渲染 |
| min/maxzoom | 4 / 12 | 同檔 `MINZOOM` / `MAXZOOM`（＝ tippecanoe `-Z4 -z12`）| 寫超過 12 → 高 zoom 要不到磚、整層消失 |
| `operator_type` | 純量字串，5 類 | **分色表達式**（`jpRailwayTypes.ts` 的 match）＋ popup ＋ popup 標題色 | 值域變動 → 全落 fallback 灰 `#9ca3af` |
| `line_name` | 字串 | popup **標題** | 空值時退回字面「鉄道路線」 |
| `operator` / `railway_category` | 字串 | popup 列 | 顯示空白 |

⚠️ `operator_type` 是**純量**（不像車站 `operator_types` 是陣列），可直接 `["get","operator_type"]`；上游若改成陣列，就得比照 `jpStationsLoader` 補算純量欄位。

### jpSchools（`public/world/jp_schools.pmtiles`，git-track）

🔴 **PMTiles 只有 6 個屬性**——轉檔時 `-x` 剔除了 9 個，前端引用被剔除的欄位一律拿到 `undefined`。

| 硬依賴 | 值 | 用於 |
|---|---|---|
| source-layer | `jp_schools` | `useJpSchoolsLayer.ts` 的 `SOURCE_LAYER` |
| min/maxzoom | 4 / **11** | source 的 `MAXZOOM = 11`（＝ tippecanoe `-z11`）；**圖層本身刻意不設 maxzoom**，讓 z12+ overzoom z11 磚 |
| `school_class` | 純量字串，13 類 | **分色表達式**（`jpSchoolTypes.ts` 的 match）＋ popup ＋ popup 標題色 |
| `name` | 字串 | popup **標題** |
| `administrator` / `closed_status` / `address` | 字串 | popup 列（設置者／休校区分／所在地）|
| `id` | 字串 | **保留但前端未用**（PMTiles 有帶，保留原因未註記）|

**被剔除、不可引用的 9 個**：`school_code`、`admin_code_region`、`school_class_code`、`administrator_code`、
`closed_status_code`、`campus_code`、`campus_note`、`latitude`、`longitude`。

⚠️ **maxzoom 陷阱**：照宗教層寫 14 → Mapbox 去要不存在的 z12–14 磚 → **z11 以上整層消失**。
配方若日後改回更高 zoom，`MAXZOOM` 要同步；反之亦然。

### jpPopulationMesh1km（`public/world/jp_population_mesh_1km.pmtiles`，🔴 走 S3）

| 硬依賴 | 值 | 用於 |
|---|---|---|
| source-layer | `jp_population_mesh_1km` | `useJpPopulationMeshLayer.ts` 的 `SOURCE_LAYER` |
| min/maxzoom | 4 / **11** | 同上（source 11、圖層不設 maxzoom 走 overzoom）|
| `pop_2020` / `pop_2030` / `pop_2040` / `pop_2050` / `pop_2070` | **Number** | choropleth step 表達式 ＋ popup ＋ select 選項（三邊都來自 `JP_POPULATION_MESH_MODES`）|
| `ratio65_2030` / `ratio65_2040` / `ratio65_2050` / `ratio65_2070` | **Number，0~1 比例** | 同上；顯示才 ×100 |
| `id` | 字串（mesh code）| popup **標題**（`網格 <id>`）|

🔴 **欄位名就是 UI 契約**：`JP_POPULATION_MESH_MODES` 一張表同時餵 **select 選項 / fill-color 表達式 / 圖例**——
改任一個 `pop_*` / `ratio65_*` 欄位名，三處一起壞（不會 throw，但**實際渲染結果未驗證**——`["get", 不存在欄位]` 進 step 會是求值錯誤，Mapbox 退回 paint 預設值而非本層 base 色）。

資料坑（改欄位或換版本時要重驗）：
- **年份不連續**：`pop_` 無 2060；`ratio65_` 無 2020（官方基準年未釋出年齡細分）。加年份要同步改 `JP_POPULATION_MESH_MODES`。
- **`ratio65` 是 0~1 比例不是百分比**：step 的 stop 用 0.2/0.3/0.4/0.5/0.6。
- 🔴 **`ratio65 = 0` 是官方對極小人口格的隱私遮罩，不是真的 0%**（實測 `pop_2030>0` 但 `ratio65_2030=0` 有 5,224 筆，人口中位數僅 3 人）
  → 表達式用 `case` 先攔 0 塗 `#6b7280`、圖例有「未公開（遮罩）」列、popup 顯示「未公開（遮罩）」。
  **`pop = 0` 相反，是真的無人居住**，落最低級即可。
- **null 經 vt-pbf 會變字串 `"null"`，且 `Number(null) === 0` 是 finite** → popup 的 `meshNum()` 先擋 `null`/`""`/`"null"` 再 `Number`，
  否則顯示「0 人」或「NaN」（同 `JpStationsPanel` 的運量坑）。

### 供應路徑差異（Batch 2）

| 層 | 路徑 | 契約 |
|---|---|---|
| jpRailways / jpSchools | **git-track** `public/world/` | nginx `location /world/` 的 `root /data; try_files $uri @dist` → build 後由 dist 供檔，免 S3 |
| jpPopulationMesh1km | **S3** `deploy-assets/world/` | `.gitignore` 單一檔名（不可改 glob，會把同夾 git-track 的小檔一起 un-track）＋ `upload-deploy-assets.sh` 的 world 區塊；pull 端 `aws s3 sync "$S3/world/"` 與 nginx location 早已存在 |

🔴 **`deployContract` 對 `/world/` 的判準是「upload 清單**或** git-track 其一即可」（因為有 dist fallback）**——
漏上傳 S3 **測試不會紅**，上線後才 404。`.gitignore:101` 記錄過 `power_poles.pmtiles` 兩條路都空的靜默退化，同一個坑。

## 跨 repo 反向引用（Batch 2）

上游 repo：`taipei-gis-analytics`（Handoff / catalog SSOT）。

| 項目 | 上游位置 |
|---|---|
| 原始／中繼產物 | `data/processed/world/jp_railways/`、`jp_schools/`、`jp_population_mesh_1km/` |
| 產物登記簿 | 各該目錄的 `_manifest.json`（⚠️ 本批的 pmtiles 產物記錄**已就地改好但未提交**，見 [backlog.md](./backlog.md)）|
| 資料 catalog | `docs/data-catalog/world/jp_railways.md`、`jp_schools.md`、`jp_population_mesh_1km.md` |
| 契約 handoff | `docs/handoff/jp-core-layers.md` ⚠️ **只存在於 `codex/noise-layers-data-ready-20260828` 分支、未進 `origin/master`**；其 §3.1（第 82 行）學校配方 `-Z4 -z14` 會產出 54MB 過大檔，待該分支併回時更正 |

## 上游改動 → 下游要跟改的觸發點

| 上游改動 | 下游動作 |
|---|---|
| PMTiles 重出改 `-l` layer 名 | 改 `useJpAdminLayers.ts` 的 `*_SOURCE_LAYER` 常數 |
| 車站 popup 欄位改名 | 改 `japanPanels.tsx` 的 `JpStationsPanel` |
| 縣界/市界檔名改 | 改 manifest `staticAssets` + hook `file` 常數 + cp 進 public/world/ |
| 鐵道／學校／網格 PMTiles 重出改 `-l` 值 | 改對應 hook 的 `SOURCE_LAYER` 常數 |
| 上述三層 PMTiles 重出改 `-z` 上限 | 改對應 hook 的 `MAXZOOM`（圖層本身仍不設 maxzoom，靠 overzoom）|
| 學校轉檔的 `-x` 剔除清單變動 | 改 `JpSchoolsPanel` 引用欄位；若補回 `school_class` 以外的分色欄位，改 `jpSchoolTypes.ts` |
| 網格新增／改名 `pop_*` / `ratio65_*` | 改 `JP_POPULATION_MESH_MODES`（select／表達式／圖例三處一起吃這張表）|

## 已知不對稱 / 決策

- 本輪 4 層皆**單色**（免圖例）；分類分色（車站按 JR/私鐵、機場按空港種別）遞延，見 backlog。
- 機場為 polygon footprint，國家級 zoom 幾乎看不見是**預期**（放大才顯現）。
- auto-flyTo 座標 `[137.5,37.5]` z4.7 為估算（上游踩雷 #7），可目視微調 `JAPAN_CAMERA`。
- ~~遞延三層（railways/schools/mesh）需資料工序或 S3 deploy，屬另一批。~~ → **2026-09-02 Batch 2 已落地**，見 [changelog.md](./changelog.md)；
  其中人口網格的 S3 上傳仍待 owner 執行（[backlog.md](./backlog.md)）。
