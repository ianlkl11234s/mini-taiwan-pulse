# Status

**最後更新**：2026-11-06 v2.22.0～v2.24.0 已 tag 但正式站 Zeabur 停在 v2.21.0（不再自動部署）；review 修正輪進行中。前一次：2026-11-03 v2.21.0 上線（地圖導航控制、量測與右鍵選單、政治主題站主限定）

> 本檔只重寫當前 checkpoint；舊段落在 [`docs/archive/2026-10-27/STATUS-history.md`](../../docs/archive/2026-10-27/STATUS-history.md)。
> 本檔只放這次碰到的範圍、上線狀態、卡點和下一步。完整計畫與數字看 [`PLAN-prod-connect-20261003.md`](../../docs/features/general-analysis/PLAN-prod-connect-20261003.md)，契約看 [`SPEC-prod-connect-p1-p3.md`](../../docs/features/general-analysis/SPEC-prod-connect-p1-p3.md)，操作看 [`PROD-HOME.md`](../../docs/features/general-analysis/PROD-HOME.md)，決策看 ADR-0017。

## 2026-11-04～11-06：v2.22.0～v2.24.0 發版；正式站部署停擺；review 修正輪進行中

| repo / system | 現況 |
|---|---|
| **mini-taiwan-pulse** | v2.22.0（2026-11-04）：#810 雙北大眾運輸可及性、#811 議員選區與投開票所熱區、#812／#813 加拿大第 1–2 批與統計、#814 國道逐車模擬與時間軸慢速、#816 歷屆選舉統計、#808 版面修正；v2.22.1：部署同步規則修正（fire 只收根層 pmtiles）；v2.23.0（11-06）：30 天地圖挑戰 Day 4／Day 5、站主限定古地圖（#823）；v2.24.0（11-06）：南韓第 6 波（#830）、日本第二輪（#831）、加拿大第 3 波（#832）、英格蘭 EA 污染站主限定（#834）、站主限定統一呈現（#836）。 |
| **gis-platform** | mig 499（EA 匯入）、500（gated_layers 59 列）於 2026-11-06 已套用；mig 496／497 是否套用：**未確認**；mig 501（EA coord_source，#203）已套用；mig 502（收回 `cloud_agent_ro` 對 EA 名錄讀取，#202／#204 已合 main）**未套用、待使用者拍板**（BACKLOG GP-502）。 |
| **data-collectors** | #172 修正 PR 進行中（COL-F010 相關）。 |

- 正式站：2026-11-06 實測 `main-CX09PLB2.js` 仍含 2.21.0；Zeabur 自 v2.22.0 起不觸發部署（redeploy 504／INTERNAL_SERVER_ERROR／GITHUB_SOURCE_UNAVAILABLE），使用者決定不再處理、優先搬家；最新版只在 Cloudflare 測試站。搬到新環境前不可部署 v2.22.0（舊 fire 同步會灌滿磁碟）。
- review 修正輪（2026-11-06）：mini #844（資料 32 項＋TWL-3 測速照相 popup 標題）、#845（互動 34 項）已合 develop；gis-platform #202／#204、collectors #172 已合 main；F088（登出關閉站主圖層）進行中。正本 `.gis-agent-system/reports/code-review/`；後續 BACKLOG GP-502、GP-296、COL-F010、RV-F039／F045／F068、RV-CA-DERIVED。
- 下一步：Zeabur 搬遷（MC-4、§5a）；搬完後驗收 v2.22.0～v2.24.0 的正式站畫面（含 GUI-2）；專案總覽見 [`docs/PROJECTS.md`](../../docs/PROJECTS.md)。

## 2026-11-03：地圖基礎 GIS 元件 → v2.21.0 上線；#808 修正待發版

| repo / system | 現況 |
|---|---|
| **mini-taiwan-pulse** | #803 導航控制（右下指北針／縮放／定位，比例尺為右側停靠欄最底列，spec §5.43 N-1，§5.17 T2 例外）；#804 游標座標（HUD 第二行）、右鍵選單（WGS84／TWD97 複製、從這裡量測、分享位置）、距離／面積量測（上方工具列＋尺規鈕，spec §5.44）；#805 版號；#806 develop→master；#808 leftDockTop 60→80＋`rightDockTop` 60、比例尺標籤不疊字、右鍵選單 264px（develop `19ba3754`）。 |

| 上線項目 | build | contract/wire | stage | upload | readback | pull | deploy | HTTP | browser |
|---|---|---|---|---|---|---|---|---|---|
| v2.21.0（#802、#803、#804） | done：#806 CI 綠 | done：golden 未變、i18n parity | done：develop `d7f0c32a` | N/A | N/A | N/A | done：master `83578964`，tag＋GitHub Release | done：`main-CX09PLB2.js` 含 "2.21.0" | done：正式站右鍵選單、距離量測 3 段、HUD 游標行、控制柱，console 無新錯誤；not run：#802 站主登入、手機實機 |
| #808 修正 | done：CI 綠 | done：scaleBarMath 測試 | done：develop `19ba3754` | N/A | N/A | N/A | not run：使用者選先不發（#807 未驗收） | not run | done：本機 dev（面板空白、5 個縮放比例尺、英文選單單行） |

- 下一步：**GUI-1**（#807 驗收後與 #808 一起發 v2.22.0）、**GUI-2** 未驗項、**GUI-3** 地址搜尋待選地理編碼服務、**GUI-4** 其餘候選元件待排序。
- 接手：從 origin/develop 開分支；改地圖畫面先做 artifact 設計稿多版給使用者選，驗收附與 develop 並排截圖（popup＋圖例、多層圖例、短視窗、分屏）。

## 2026-10-31：圖層可見性整修（四國共用原則）→ v2.19.0 上線（2026-11-01）

| repo / system | 現況 |
|---|---|
| **mini-taiwan-pulse** | #779 原則 map-layers §3.8 V-1～V-7＋熱區預設色依主題＋V-2／V-4 契約（`visibilityAudit.ts`）；#780 南韓 32 層；#783 右上視野提示卡擴充（spec §5.42.1，`layerCoverage.ts` 49 層局部範圍）；#784 英國（點面切換、拆高爾夫、22 層類別篩選、globe raster 修正、JamCams 內嵌影像）；#782／#785 台日類別篩選；#786 第二輪重切接線；#787 台日點面切換 67 層；#788 最後一輪。develop `b285be8f`。 |
| **taipei-gis-analytics** | #270／#271／#272 重切與代表點腳本（`pipelines/world/kr/retile_visibility.py`、`pipelines/base_map/gb/retile_visibility{,2}.py`、`pipelines/shared/vis_retile_tw_jp.py`、`vis_reppoint_tw_jp.py`）。 |

- 2026-11-01 發 **v2.19.0**（#790 版號、#792 develop→master merge `3110ba9c`，tag＋GitHub Release 已建；S3 deploy-assets 256 檔已上傳）。正式站驗收：`main-*.js` 含 2.19.0；8 支大檔 Range 206；四國全國視角截圖都有畫面；右上提示卡（英國 JamCams「前往倫敦」、台灣 `buildingsGba`「放大到 z8」）、點面切換（`gbCemeteries`）、類別篩選（`gbSchools`、`speedCamera`）、消防栓 `fireHydrants` 彈窗都實測通過；console 無新錯誤。
- 下一步：**VIS-1～6**（待使用者決定或補驗）。
- 盤點表與原則草稿：本 session scratchpad（已併入規範，不需保留）。

## 2026-10-31：南韓第 0–5 波＋統計 → v2.19.0 上線（2026-11-01）

| repo / system | 現況 |
|---|---|
| **mini-taiwan-pulse** | #769 國家選單 KR＋行政區界三層（第 0 波）、#773 國土基礎交通 6＋能源 7 層（第 1 波）、#774 第 3–5 波 18 層（水系統與海洋、公共運輸與道路設施、自然保護與林業）、#775 統計面板支援南韓（道級／市郡區 33 層）；都已合 develop（最後 `1d5f6bb8`，CI 綠）。 |
| **taipei-gis-analytics** | #258 盤點、#259 波次計畫、#260–#268 各波資料；進度表 `docs/topic-research/south_korea_opendata/waves/PLAN.md` §3（#269）。 |
| **gis-platform** | #193 mig 492（`kr_sido`／`kr_sigungu` level）已套用正式庫；統計 33 release／5,088 值；R2 PUBLIC_VERIFIED。 |

| 上線項目 | build | contract/wire | stage | upload | readback | pull | deploy | HTTP | browser |
|---|---|---|---|---|---|---|---|---|---|
| 南韓 #769、#773、#774、#775 | done：各 PR CI 綠 | done：golden、inventory | done：develop `1d5f6bb8` | done：3 支大檔 2026-11-01 上傳 S3 | done：Range 206 | done | done：v2.19.0 `3110ba9c` | done | done：正式站南韓 z6 截圖（電廠、橋梁、行道樹） |

- 下一步：HOLD **KRH-1**（淨水場、生態自然圖）；**KRUX-1** 公車站全國視角太淡；**KRI18N-1** 英日文逐層驗；**KRW-6** 第 6–10 波；MCP 加 KR 另案。
- 接手：從 origin/develop 開分支；先讀 analytics `south_korea_opendata/waves/PLAN.md` §3 與 `AGENT_BRIEF.md`。

## 2026-10-30：英國圖層上線 → v2.18.0

| repo / system | 現況 |
|---|---|
| **mini-taiwan-pulse** | 驗收小修 #759、全英低縮放可見 #760（<1 萬點 z5 畫點、7 層 R5 熱區、再生能源容量分級＝P-4 例外）、能源彈窗 #761、綠地三層代表點熱區＋高爾夫全英畫點 #763 → #764／#765 發 **v2.18.0**（tag 在 master `995e172b`，GitHub Release 已建）。之後 #766（日文英國主題名、變電所類型三語）已合 develop `76cf045a`，未發版。 |
| **taipei-gis-analytics** | #254 `pipelines/urban_open_space/gb/greenspace/08_points.py`（綠地代表點 PMTiles 16.3MB，mini 已 git-track）；波次進度 `docs/topic-research/united_kingdom_opendata/waves/PLAN.md` §3。 |
| **S3 deploy-assets** | `world/` 新增英國 14 支大檔（約 859MB，metadata 帶 sha256）。 |

| 上線項目 | build | contract/wire | stage | upload | readback | pull | deploy | HTTP | browser |
|---|---|---|---|---|---|---|---|---|---|
| v2.18.0（英國 #733、#738、#739、#741–#744、#746、#749、#753–#761、#763） | done：#765 CI 綠 | done：golden、inventory、r5 契約 | done：develop `f52d2558` | done：14 支 gb_*.pmtiles 上傳（SHA 守門） | done：正式站 14 支 Range 回 206 | done：部署後約 6 分鐘同步完成 | done：master `995e172b` | done：`main-Dh5k0GD3.js` 含 "2.18.0"；EA 污染檔 404（未上線） | done：8 項（大檔圖層、popup、圖例、三語、英國統計、台灣回歸），頁面錯誤 0 |
| #766 | done：CI 綠 | done：themeIdentity 測試 | done：develop `76cf045a` | N/A | N/A | N/A | not run：等整批發版 | not run | done：本機日文介面目視 |

- 下一步：英國剩 **UKD-1**（待拍板清單）、**UKOSM-1**（Overpass）、**UKLZ-1～3**、**UKREL-1**；台灣第二批 **TWL-5**。
- 接手：從 origin/develop 開分支；英國先讀 analytics `waves/PLAN.md` §3。主 checkout 的 `public/world/gb_pollution_inventory.pmtiles` 是英格蘭 EA 資料，授權未定，不可 commit 或上傳。

## 2026-10-29：台灣新圖層第一批（roadmap G29–G34）→ v2.17.0

| repo / system | 現況 |
|---|---|
| **mini-taiwan-pulse** | #737 淹水潛勢 10 情境切換（一情境一支 PMTiles、`sourceUrlByParam`；「管制區」改名、北市下水道水位來源更正、離島深度級距正規化）、#734 急救責任醫院分級 252 家、#735 海域野生動物保護區與棲息環境 6 面＋全海域生態系調查點位 54 點、#736 測速照相換 2026-08-24 版 2,805 點，都已合 develop（最後 `6078db66`，CI 綠）；#745 BACKLOG 新增 TWL-1～7。 |
| **.gis-agent-system** | scout 方法加軌 1b（新上架差集）與軌 4（現象驅動六層缺口）；`scout/2026-10-28/` 第二輪盤點；深挖 G29–G34，狀態已更新（master `d73e782`）。 |

| 上線項目 | build | contract/wire | stage | upload | readback | pull | deploy | HTTP | browser |
|---|---|---|---|---|---|---|---|---|---|
| v2.17.0（#737、#740、#734、#735、#736 cherry-pick，不含英國） | done：#750 CI 綠；本機 `npm run check` 通過 | done：golden 1333、inventory 重產 | done：`release/v2.17.0-tw` 從 master 開 | done：S3 `deploy-assets/geo/water_flood_*.pmtiles` 10 支＋`police_justice/speed_cameras/speed_cameras_20260824.geojson` | done：`aws s3 ls` 大小與本機一致 | done：部署後約 8 分鐘 10 支 206、測速 200 | done：master `53e0f77b`，tag v2.17.0 | done：`main-Cw2QJhf-.js` 含 "2.17.0" | done：正式站淹水、急救醫院＋海洋、測速三張截圖，頁面無英國 |

- 發版方式：develop 上有未驗收的英國 PR，使用者要求不含英國，所以從 master cherry-pick 台灣 PR 發 v2.17.0（#750），再把 master 合回 develop（#751）。英國條目仍在 Unreleased。
- 卡點：主 checkout 停在舊 develop，`git pull` 被未追蹤的 `public/world/gb_admin_lad.pmtiles`（英國 session 的檔，hash 與 develop 相同）擋住，需使用者同意才移開。gitignored 發版資產已複製到主 checkout `public/`。
- 下一步：第二批三個 PR（**TWL-5**：災害暴露 G32＋G30、科技執法 G34、水 G31＋G29），同時最多 3 個 worktree；小修 TWL-2～4、統計層 TWL-7；第三批 TWL-6 等 Zeabur 搬遷。
- 接手：從 origin/develop 開分支；各項細節看 `.gis-agent-system/roadmap/candidates/G29`～`G34`。

## 2026-10-29：多國化議題 2（MCP 跨國比較）P0–P5 上線

| repo / system | 現況 |
|---|---|
| **mini-pulse-gis-mcp** | #85–#94 全部合併：geom_3826 只給台灣、registry country 骨幹、跨國行政區／人口／鄰接表、工具收 country＋admin_level（跨國並列不混算、缺資料回「未涵蓋＋缺什麼」）、H3（GHSL 2020）、pulse-conductor 多國回答格式；題庫 N05–N11 加多國樣板。 |
| **pulse-data** | #44、#46、#48、#49、#50：673 份 registry 加 country、新國家接入文件 `docs/new-country-onboarding.md`、Ookla 台灣表、H3 兩表。 |
| **taipei-gis-analytics** | #236（Ookla 拆表、日本水道轉 CSV）、#242（GHSL→H3 pipeline）。 |
| **mini-taiwan-pulse** | #740 台灣 Ookla 兩圖層 datasetId 改 `network_performance_grid_tw`，已合 develop `cf00ccca`，未發版。 |
| **.gis-agent-system** | 計畫與逐段上線紀錄：`projects/2026-10-multi-country/PLAN-topic2-mcp.md` §5（#28–#33）。 |

| 上線項目 | build | contract/wire | stage | upload | readback | pull | deploy | HTTP | browser |
|---|---|---|---|---|---|---|---|---|---|
| MCP（analysis-prod） | done：main `e731b3a` CI 綠 | done：台灣 16 組舊呼叫輸出逐字相同 | N/A | N/A | N/A | done：checkout `e731b3a`＋`npm run build` | done：2026-10-29 主 session 讀 checkout 確認 | N/A | done：live map eval 最後一輪 11/11（#94） |
| 分析倉庫 | done：duckdb 1.5.3 組裝 | done：對前版 11 項預期差異 | N/A | done：R2 `pulse-warehouse` | done：463 檔 sha 與本機組裝一致 | N/A | done：latest `20261029T052843Z` | N/A | done：主 session `/mcp` 重連後查 boundaries_admin TW 22／368／7,973、JP 47／1,898；H3 人口 TW 23,820,675、JP 125,244,811 |
| mini #740 | done：CI 綠 | done：capability-audit 補新 id | done：develop `cf00ccca` | N/A | N/A | N/A | not run：等整批發版 | not run | not run |

- 下一步：議題 3 主站遷移（**MC-4**）；多國遺留 **MC-6**～**MC-8**；#740 隨下次整批發版。
- 接手：MCP 部署照 `.gis-agent-system/roadmap/status/agent-analysis-runbook.md`，一律先換 MCP 再切倉庫；部署後使用者要 `/mcp` 重連。

## 2026-10-28：國家主體化（v2.16.0＋v2.16.1）

| repo / system | 現況 |
|---|---|
| **mini-taiwan-pulse** | #721 國家設定與 `c=`、#722 圖層入口＋國家選單＋通訊主題、#723 manifest `country`＋map_context、#724 視野提示、#726 選單與全部關閉同列＋台灣飛全台 → #727／#728 發 v2.16.0；#729 飛行中不閃舊提示 → #730／#731 發 v2.16.1。tag 與 GitHub Release 都已建。 |
| **.gis-agent-system** | 計畫與研究：`projects/2026-10-multi-country/`（README、PLAN-topic1-website §9 有完成紀錄）。 |

| 上線項目 | build | contract/wire | stage | upload | readback | pull | deploy | HTTP | browser |
|---|---|---|---|---|---|---|---|---|---|
| v2.16.0 | done：#728 CI 綠 | done：CI（layerConsistency、golden、inventory） | done：develop `7c6b44f4` | N/A：無新資產 | N/A | N/A | done：master `e0a4474d` | done：`main-Bg1eBBYX.js` 含 "2.16.0" | done：選單同列、切法國（只剩通訊）、切回全台；not run：見 **MC-3** |
| v2.16.1 | done：#731 CI 綠 | done：CI | done：develop `ebebbd1b` | N/A | N/A | N/A | done：master `301557e7` | done：`main-BFfdCd84.js` 含 "2.16.1" | done：切法國後 14 秒取樣 0/19 出現舊提示 |

- 下一步：補目視（**MC-3**）；同名主題前先拆識別名（**MC-1**）；議題 3 等使用者討論（**MC-4**）。
- 接手：從 origin/develop 開分支；多國化脈絡先讀 `.gis-agent-system/projects/2026-10-multi-country/README.md`。
