# Changelog — jp-core-layers

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
