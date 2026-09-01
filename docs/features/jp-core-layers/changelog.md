# Changelog — jp-core-layers

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
