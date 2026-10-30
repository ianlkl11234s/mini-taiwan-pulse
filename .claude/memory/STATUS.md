# Status

**最後更新**：2026-10-29 台灣新圖層第一批隨 v2.17.0 上線（不含英國）；2026-10-29 多國化議題 2（MCP 跨國比較）P0–P5 上線

> 本檔只重寫當前 checkpoint；舊段落在 [`docs/archive/2026-10-27/STATUS-history.md`](../../docs/archive/2026-10-27/STATUS-history.md)。
> 本檔只放這次碰到的範圍、上線狀態、卡點和下一步。完整計畫與數字看 [`PLAN-prod-connect-20261003.md`](../../docs/features/general-analysis/PLAN-prod-connect-20261003.md)，契約看 [`SPEC-prod-connect-p1-p3.md`](../../docs/features/general-analysis/SPEC-prod-connect-p1-p3.md)，操作看 [`PROD-HOME.md`](../../docs/features/general-analysis/PROD-HOME.md)，決策看 ADR-0017。

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
