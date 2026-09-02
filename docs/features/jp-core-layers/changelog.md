# Changelog — jp-core-layers

## 2026-09-02 — Batch 2：遞延三層（鐵道／學校／人口網格）

分支 `feat/jp-deferred-layers`（worktree），四個 commit：
`72c626a` 鐵道 → `d662840` 學校 → `3f6609b` 人口網格＋S3 供應鏈 → `7a7a878` 點擊順序修正＋鐵道 popup 去重。
交辦來源見 [deferred-handoff.md](./deferred-handoff.md)（PR #201，merge `5e36006`）；Batch 1 已於 PR #199（merge `632a7d2`）進 master。

**驗收**：`npx tsc -b` 綠；`npx vitest run` = 98 檔 / 990 passed / 1 skipped；`deployContract.test.ts` 17 tests 綠。
golden fixture keyCount ratchet 392 → 393（鐵道）→ 394（學校）→ 395（人口網格）；`7a7a878` 只動 `gisLayers` 順序、keyCount 維持 395。
瀏覽器實測（dev server :3799，agent-browser + WebGL args，2026-09-02）：日本面板五主題齊全
——**行政區 / 交通（含新的「線」群組）/ 教育 / 人口 / 宗教**。

### 鐵道 jpRailways（`72c626a`）

- 資料 `public/world/jp_railways.pmtiles` **4.86MB（5,093,949 B）**，21,933 段，z4–12，source-layer `jp_railways`，**git-track**（走 nginx `/world/` dist fallback，免 S3）。
  轉檔配方 `tippecanoe -l jp_railways -Z4 -z12 -pf -pk --no-tile-size-limit`（源自 `jp_railways_20260831.geojson` 13.9MB）。
  → backlog 的「14MB git-track 灰帶」用轉 PMTiles 解掉，未採「直接 git-track 14MB」那條退路。
- 交通 theme 新增 **「線」群組**（原本只有「點位」）。
- 事業者種別 5 色 SSOT `src/data/jpRailwayTypes.ts`：新幹線 / JR在来線 / 民営鉄道 / 第三セクター / 公営鉄道，
  與 `jpStationTypes.ts` 同名類別**共用同一 hex**（車站與路線在地圖上同色系）。
  `operator_type` 在 PMTiles 已是**純量字串**（不像車站 `operator_types` 是陣列）→ 直接 `["get","operator_type"]` 進 match，免 loader 先 classify。
- UX：line-width z6=1 → z14=3、opacity 0.9（線層 baseline）；圖例 5 色塊；popup 路線名（標題）/ 運営会社 / 事業者種別 / 鉄道区分。
- gisClickRegistry 置於**所有點層之後、所有面層之前**（線是細目標，面層搶先會吃掉線上的點擊）。
- 瀏覽器實測（z4.7 全日本）：渲染 17,069 條線、5 類齊全
  （JR在来線 8,766 / 民営鉄道 5,174 / 第三セクター 2,037 / 公営鉄道 846 / 新幹線 246）；popup 命中「池袋線 / 西武鉄道 / 民営鉄道 / 普通鉄道」。
  ⚠️ 17,069 是 z4.7 的**瀏覽器端渲染計數**，**不等於**資料總量 21,933；差額成因**未驗證**（配方未下 `-r1`）。
  同理 `jpRailwayTypes.ts` 註記的「JR在来線 10,517 段（48%）」是**原始資料**基準，與上面的 z4.7 渲染數不同基準。

### 學校 jpSchools（`d662840`）— ⚠️ 配方與上游 handoff §3.1 不同

- **上游原配方 `-Z4 -z14` 保留全部 15 屬性 → 產出 54MB**，超過 25MB 門檻不能 git-track（照那條走就得多開一條 S3 供應鏈）。
  本批改用精簡配方重出，落到 **16.5MB（17,303,011 B）** 仍可 git-track：

  ```
  tippecanoe -l jp_schools -r1 -pf -pk -Z4 -z11 --no-tile-size-limit \
    -x school_code -x admin_code_region -x school_class_code -x administrator_code \
    -x closed_status_code -x campus_code -x campus_note -x latitude -x longitude
  ```

  保留 6 屬性：`id / name / address / school_class / administrator / closed_status`。
  🔴 **前端不可引用已剔除的 9 個欄位**（`*_code` 冗餘代碼、`campus_note`、`latitude`/`longitude`）——PMTiles 裡不存在，會拿到 undefined。
- 抽稀稽核：z4 / z5 / z6 各為 **56,807 筆 unique id**，低 zoom 未被抽稀（`-r1` 已關掉 drop-densest）。
- `MAXZOOM = 11`（**非**宗教層那個 14）：source 寫 11、**圖層本身不設 maxzoom** 讓 z12+ overzoom z11 磚。
  照抄宗教層寫 14 會讓 Mapbox 去要不存在的磚 → z11 以上整層消失。
- 新增 **「教育」theme**（`JAPAN_TAB_THEME_TITLES` / `THEME_MACRO_GROUPS` / `THEME_CATALOG` 三處登記）；section `{ theme: "教育", group: "點位" }`。
- 13 類 `school_class` 分色 SSOT `src/data/jpSchoolTypes.ts`：按**學制階梯**排序（幼兒粉黃 → 初等暖橘 → 中等藍 → 高等紫 → 特殊與其他綠灰），
  同階梯用相近色階，13 列圖例掃過去能一眼分群。
- UX：circle-radius z6=2 → z12=5 ×「大小」滑桿、opacity 0.75（>10k 點密度 baseline）；圖例 13 類兩欄排版；
  popup 校名（標題，標題色跟該校分類）/ 学校分類 / 設置者 / 休校区分 / 所在地。
- gisClickRegistry 置於宗教三源之後（同為點層互不遮蔽，僅維持「點層群組」末位）。
- 瀏覽器實測（z4.7 全日本）：渲染 55,679 點、**13 類全部出現**；popup 命中
  「十文字女子大附属幼稚園 / 幼稚園 / 民間 / 調査なし / 埼玉県新座市菅沢2-1-28」。
  ⚠️ 55,679 同樣是 z4.7 渲染計數，總量以上面的 unique id 稽核 56,807 為準。

### 人口網格 jpPopulationMesh1km（`3f6609b`）— 走 S3

- 資料 `jp_population_mesh_1km.pmtiles` **48.6MB（50,998,171 B）**，176,896 格，z4–11，source-layer `jp_population_mesh_1km`。
  >25MB → **走 S3**（觸點 #20），供應鏈三段：
  - `.gitignore` 加**單一檔名**（刻意不寫 `public/world/*.pmtiles` glob——同夾 `jp_admin_boundaries*` / `jp_religion_gsi` / `jp_railways` / `jp_schools` 都 git-track，glob 會把它們一起 un-track）。
  - `scripts/deploy/upload-deploy-assets.sh` **新開**「🌍 世界 World 大檔」區塊（檔名字面 for 迴圈，非 glob）；
    原本這支腳本沒有 world 區塊，不是「加進既有清單」。
  - pull 端與 nginx **免改**：`pull-deploy-assets.sh` 早有 `aws s3 sync "$S3/world/"`（第 134–136 行）、nginx `location /world/` 也已存在。
- 新增 **「人口」theme**；section `{ theme: "人口", group: "面" }`。
- **9 種指標／年份攤平成單一 select**（不做「指標 × 年份」兩層相依 select）：
  `pop_` 5 年（2020 / 2030 / 2040 / 2050 / 2070，**無 2060**）＋ `ratio65_` 4 年（2030 / 2040 / 2050 / 2070，**無 2020**，基準年官方未釋出年齡細分）。
  切換走 `setPaintProperty("fill-color", …)` 重設表達式，**不重建 source**。
- 色階 SSOT `src/data/jpPopulationMeshModes.ts`（hook / 圖例 / paramsSpec 三邊共用）：
  - 人口 7 級 ColorBrewer YlOrRd，斷點 0/50/200/500/1000/2000/5000 **跨年份固定**，不逐年重算分位數
    （逐年重算會讓顏色語意漂移、無法比較世代間的人口消退）。
  - 高齡比 6 級 BuPu。⚠️ `ratio65_*` 值域是 **0~1 比例不是百分比** → step 的 stop 用 0.2/0.3/0.4/0.5/0.6，顯示時才 ×100。
- 🔴 **`ratio65 = 0` 是官方對極小人口格的隱私遮罩，不是真的 0%**：實測 `pop_2030 > 0` 但 `ratio65_2030 = 0` 有 **5,224 筆，人口中位數僅 3 人**。
  塗成最低比例色等於把「查無資料」畫成「最年輕」，語意反過來 → 用 `case` 先攔 0 塗遮罩灰 `#6b7280`、圖例多一列「未公開（遮罩）」、popup 顯示「未公開（遮罩）」。
  `pop = 0` 則是**真的無人居住**（非遮罩），落最低級即可，不需 case 分流。
- UX：fill-opacity 0.55、**只加 fill 不加 line**（outline 0——17 萬格畫框線會糊成一片灰、吃掉 choropleth 辨識度）。
- popup 一次列出 5 個年份的總人口與 4 個年份的高齡比（popup 本身就是一條時間序列，不必反覆切 select 才看得到同一格的世代變化）。
  數值需先擋 `null` / `""` / `"null"`：vt-pbf 會把 null 寫成字串 `"null"`，且 `Number(null) === 0` 是 finite（同 `JpStationsPanel` 的運量坑）。
- 瀏覽器實測（z4.7 全日本）：渲染 174,677 格；9 個 select 選項齊全；
  切「高齡比 2050」時 paint 表達式實測為 `["case",["==",["get","ratio65_2050"],0],"#6b7280",["step",…0.2/0.3/0.4/0.5/0.6…]]`（遮罩生效），圖例同步切換並多一列「未公開（遮罩）」；
  popup 命中「網格 53394603 / 人口 2020 18,008 人 …… 高齡比 2070 35.3%」。

### 修正（`7a7a878`）

- **gisClickRegistry 點擊順序**：人口網格原排在所有日本層最後（含市界／縣界之後）。
  縣界 fill 在 tab 開啟時預設開、且與網格同樣**無縫鋪滿全日本** → first-hit-wins 會讓網格 popup 永遠打不開。
  依該檔既有「小面 → 大面」原則，把 1km 網格移到市界／縣界**之前**。
  已實測：開啟日本都道府県界後在同一像素再點，仍正確回傳人口網格 popup。
- **`JpRailwaysPanel` 去重**：標題已是路線名 → 移除重複的「路線名」列；標題色改跟事業者種別走（與地圖線色一致，比照 `JpSchoolsPanel`）。
- golden fixture 重生：僅 `gisLayers` 順序變動，keyCount 395 不變。

### 待辦（🔴 = 擋合併）

- 🔴 **人口網格 pmtiles 尚未上傳 S3**，需 owner 執行 `aws s3 cp`（指令見 [backlog.md](./backlog.md)）；否則上線後該層 tile 404。
  `deployContract` 對 `/world/` 的判準是「upload 清單**或** git-track 其一即可」（nginx 有 dist fallback）→ **不會**機械擋住漏上傳。
- 上游 `taipei-gis-analytics` 兩支 `_manifest.json` 已就地改好但**未提交**（主樹停在別人的分支）；上游 handoff §3.1 的 `-z14` 配方待更正。
- 本批 PR 待開。

## 2026-09-01 — jpAirports 樣式切換：點位（預設）／面（用戶回饋）

機場 footprint polygon 在國家級 zoom 看不到 → 加「樣式」切換，預設點位。tsc + 963 測試綠（視覺待人工確認）。

- hook `useJpAirportsLayer` 加 `displayMode: "point" | "polygon"`：
  - 新增 `jp-airports-pt` point source（由 polygon feature 的 `longitude`/`latitude` 派生，`toPointFeatureCollection`）+ `jp-airports-circle` circle layer（#a78bfa，z6=4→z12=8）。
  - 依模式切 fill/line（面）vs circle（點位）可見性；opacity 同步套兩者。
- `JpAirportsHost` 讀 `overlayParams.jpAirportsDisplayModeIdx`（1=面/其餘=點位）。
- layerParamsSpec `jpAirports` 加 select（樣式：點位/面，button row，預設 point）；manifest params 1→2。
- gisClickRegistry jpAirports → `["jp-airports-circle","jp-airports-fill"]`（兩模式都可點 popup）。
- legend 維持 null（顯示樣式非分色，不需圖例）。

## 2026-09-01 — jpStations 雙上色模式：種類（預設）／運量（用戶回饋）

tsc -b + 963 測試綠。⚠️ 視覺（點色/圖例切換）尚待瀏覽器人工確認（headless @ref 不穩、eval 被 worktree 守衛擋，未能自驗）。

- 新增 `src/data/jpStationTypes.ts`（SSOT）：種類色票（operator_types 5 類 + その他）、
  運量級距（5 級 + 無資料灰）、`match`/`step` 表達式、`classifyJpStationType` 優先序、
  `jpStationPax` 逐年 fallback、`JP_STATION_COLOR_MODES`。
- loader 補算純量欄位 `jp_type` / `jp_pax`（供 Mapbox 表達式，避開陣列屬性限制）。
- hook `useJpStationsLayer` 加 `colorMode` 參數，circle-color 依模式套表達式。
- `JpStationsHost` 從 `overlayParams.jpStationsColorModeIdx` 換算模式（0=種類/1=運量）。
- layerParamsSpec `jpStations` 加第三個 select 控件（2 選項 → button row）；
  manifest `params` 2→3、`legend: null` → `"jpStations"`。
- `LegendPanel` 加 `JpStationsLegend`（隨 modeIdx 切種類/運量圖例）+ LEGEND_REGISTRY 一筆；
  `NO_LEGEND_LEDGER` 移除 jpStations。
- 種類用 **operator_types**（JR在来線/民営/第三セクター/公営/新幹線）而非 railway_categories
  （後者偏軌道型式；operator_types 5 類更符合「種類」語意且乾淨）。

## 2026-09-01 — UX 修正：攤平主題結構 + 日本地圖 icon（用戶回饋）

tsc -b + 963 測試綠；瀏覽器複驗結構與 icon。

- **攤平主題結構**：原本是「單一『日本 Japan』主題 → 展開才見 行政區/交通/宗教 三 group」。
  tab 抬頭已是「日本 Japan」，多包一層冗餘 → 改成 **行政區 / 交通 / 宗教 三個獨立主題直接並列**
  （比照世界 tab 多主題），各帶一個子群（行政區→面、交通/宗教→點位），預設展開。
  - manifest 7 層 section 改為 `{ theme: 行政區|交通|宗教, group: 面|點位 }`
  - `JAPAN_TAB_THEME_TITLES = ["行政區","交通","宗教"]`（全域唯一字串，與台灣「交通 Move」「宗教 Religion」不同）
  - THEME_MACRO_GROUPS 三主題皆 map 到 `"world"`；`JAPAN_THEME_TITLE` 保留為 tab 抬頭名
  - 未動 LayersPanel 渲染（子群標籤靠既有 theme→group→layer 結構自然呈現）
- **rail icon 換掉紅色日之丸**（看起來像未讀通知）→ twemoji 🗾 日本剪影
  （© Twitter/jdecked，CC-BY 4.0；去藍底、改 currentColor 隨 active/dim 變色）。

## 2026-09-01 — Batch 1：日本 tab 外殼 + flyTo + 宗教搬移 + 4 小層（前端接線）

分支 `worktree-japan-tab`（PR 前改 `feat/jp-core-layers`）。tsc -b + 全套 98 檔 963 測試綠。

**外殼 + auto-flyTo（Commit 1 範圍，曾單獨跑綠）**
- 新增「日本 Japan」rail tab（clone 世界 tab）：`JAPAN_THEME_TITLE` / `JAPAN_TAB_THEME_TITLES` / `JAPAN_THEME`（layerCatalog.ts）、PanelId `"japan"` + `JapanGlyph` 按鈕 + LayersPanel 渲染區塊（IconRailSidebar.tsx）
- `THEME_MACRO_GROUPS` 登記「日本 Japan」→ `"world"`（避免 `themeMacroGroup()` throw）
- `MAIN_THEMES` 排除 `JAPAN_TAB_THEME_TITLES`（避免主 Layers panel 重複渲染）
- auto-flyTo：`JAPAN_CAMERA`（cameraPresets.ts，`[137.5,37.5]` z4.7）+ `onJapanOpen`（App.tsx，flyTo + 自動開縣界底圖）
- 宗教三層（jpReligionGsi/Osm/Wikidata）`section.theme` 從「世界 World」改「日本 Japan」，group 從 WORLD_THEME 搬進 JAPAN_THEME
  - 實測**不需 regen golden fixture**（AR-22 P4 後 fixture 只凍 overlays/params/gisLayers；section⇔THEMES 由 layerManifest.test.ts 逐 key 焊死並通過）→ 上游 handoff 踩雷 #3「搬宗教要 regen fixture」已過時

**4 小層（Commit 2 範圍）**
- jpAdminPrefecture / jpAdminBoundaries（PMTiles polygon fill+line）、jpStations（circle）、jpAirports（GeoJSON polygon）
- 每層一筆 manifest entry（派生 colors/icons/labels/upstream）+ layerParamsSpec（opacity；車站另加 scale）+ loader/hook + japanPanels popup + registry + host + layerHookRegistry
- 4 層單色 → `legend: null` + NO_LEGEND_LEDGER
- 資料檔 git-track 進 `public/world/`（走 nginx dist fallback，免 S3/#20）；deployContract.test.ts 走 gitTracked 路徑
- 車站運量 popup 逐年 fallback（passengers_latest 為 null 時 2024→2023→2022）

**修正**
- gisClickRegistry first-hit-wins 順序 bug：縣界/市界 fill（覆蓋全日本、tab 開啟預設開）原排在宗教/車站點層之前 → 會吃掉所有點擊。改為點層（車站 + 宗教）在前、面層（機場→市界→縣界）在後。

**待辦**：瀏覽器目視驗收（headless SwiftShader 全黑 + eval 守衛擋，改人工）、PR、上游反向引用。
