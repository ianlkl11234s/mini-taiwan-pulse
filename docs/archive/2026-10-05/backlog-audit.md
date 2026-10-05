# BACKLOG 盤點 — 2026-10-05

對象：`.claude/memory/BACKLOG.md`（從 origin/develop `dcd09427` 開分支 `memory/backlog-audit-20261005`）。依據：任務檔 `_codex-handoffs/20261005/07-backlog-memory-audit.md`。

## 結論

- 核對 122 列非 done（含原標成 done 的 7 列：AG-1／5／8／9／12／13、ST-2）。AU-1 依指示不動，所以不在統計內。
- 已完成 17 列、被取代 6 列，共 23 列從表格移除。仍有效且已更新 94 列，其中 8 列改成 in_progress（PR 已開）。無法判斷 5 列。
- 修改後 State 只剩規則允許的值：ready 47、blocked 20、conditional 10、in_progress 8、waiting_external 8、verifying 7。原本標成 `idea`／`decision` 的列一律改成 `blocked`，並在 blocker 欄寫上 owner decision。
- 今天其他 PR 的對應：
  - mini #539 → GD-1、AU-3。
  - `fix/small-bugs-20261005`（PR 尚未開出）→ R5-1、R5-2、R8-2、AG-6、G005、FE-01。
  - mini #540（倉庫覆蓋率）在 BACKLOG 沒有對應列，所以沒有新增。
  - mini #541：不動 AU-1／DS-COLOR。
  - gis-platform #138 → WA-4。
  - gis-agent-system #2（`REPO_HYGIENE.md`）→ WA-5、WA-7、WA-8、WA-9、G027。
- **新發現**：
  - `pg_postmaster_start_time()` 為 2026-10-01 18:14 UTC，資料庫在 09-04 之後又重啟過。DIO-1 驗收不通過，已改寫。
  - WA-9 抽樣到的 `jp-heights/building_grid.pmtiles` 回 404，是設計如此，不是缺檔。runtime 只讀 `catalog.json` 裡 content-addressed 的 `assets/<sha>.pmtiles`，見 `src/map/__tests__/deployContract.test.ts:256-261`。實測 catalog 回 200、資產回 206，所以是 `gen_repo_hygiene.py` 誤報，沒有另外開列。

## 方法（下次照做）

1. 每一列都對照三個來源：git log、5 個 repo 的 merged PR（`gh pr list -R ianlkl11234s/<repo> --state all`，先匯出成 tsv 再用 rg 搜）、origin/develop 的程式碼現況。
2. 驗收條件屬於 runtime 的列，加查正式 DB 或正式站。DB 只做唯讀 SELECT 加 LIMIT，避開 10:00–20:00；正式站用 HTTP HEAD 或 Range。
3. repo、分支、worktree、資產的數字一律重跑 `.gis-agent-system/scripts/gen_repo_hygiene.py` 取得。
4. 判定分四類：已完成、被取代（這兩類從表格移除，證據留在本報告）／仍有效（改寫成現況）／無法判斷（保留，並寫明怎樣才能判定）。
5. 本次分 3 組 worker 平行查證，主 agent 負責統一改 BACKLOG、整合證據和抽查。每組合計正式 DB 唯讀查詢 ≤8 句。
6. 「最後核對日期」寫在表頭的一句話裡，不逐列加欄位。

## 已關閉／被取代（從表格移除）

| ID | 判定 | 證據 | 查證者 |
|---|---|---|---|
| BR-2 | 已完成 | 正式站 HTTP probe（2026-10-05）：前端引用的 18 個 `business_registry/*` 資產全部 200/206（PMTiles 回 206 Range，非 SPA html；不存在的檔案對照回 404）。從正式站整檔下載 handoff.md:12-19 與 :50-52 的 9 個資產（6 個 r2 含 overview＋filters，3 個 demographics），**bytes 與 SHA-256 全部和 handoff 一致**；另 6 個 density PMTiles 的 Content-Length 與 `evidence/20260918-publication.json` 一致（只比大小）。原列寫的「12 個」沒有清單可以逐一對照，這次實際驗到的是：9 個 size＋sha 相符、6 個 size 相符、3 個 allzoom_b8 只有 206。analytics `docs/topic-research/business_registry/_status.md` 也記錄 W34（08-21）週報已驗證線上資產都不是 404。舊版 `*_allzoom.pmtiles`（非 b8）現在回 404，但前端已改用 `_allzoom_b8`（#467／analytics #124），兩者之間沒有衝突 | A |
| DS-03 | 已完成 | 台電落雷 endpoint 已經不是空的：同 DS-01 的 SQL，source=taipower 從 09/27 起每天都有事件，10/03 有 703 筆，近 3 天共 1,479 筆。原本「回報上游端點空回」的問題已經消失，後續只剩 DS-01 要把頻率調回來 | A |
| MAR-1 | 被取代 | 舊的 371 `gfw_vessel_presence` 合約已被 hourly publisher 取代：collector-health 報告第 20 行寫「4 legacy 表皆空；manifest 明示 intentionally disabled/replaced → 沿用 verified hourly publisher health；不要啟用權利受限 archive」。SQL：`live.gfw_hourly_publish_runs` 近 7 天 succeeded 5 次（最新 completed 10/05 02:03 UTC，latest_complete_date 2026-09-30）、failed 2 次。取代者：gis-platform #67／#68（375–377）＋ collectors #59／#61／#91 的 daily/hourly release，以及 v4 POC（collectors #120、platform #126，仍 OPEN）。附註：授權／商用條款的 gate 在 global-maritime backlog「Regional production」還沒勾，如果要追，應掛在那裡，不是本列 | A |
| BR-7 | 已完成 | 202609 存量快照已保存：analytics `docs/topic-research/business_registry/monthly-update-202609.md`（origin/master）記錄 118 檔／3,394,747 raw 列、656,713 公司、SHA `f05b67ec…`、`.source.json` provenance。本機 `data/intermediate/business_registry/monthly_runs/202609_r1/acceptance.json` 為 `"status":"PASS"`，含 122 個 raw hash、座標有效性、stock count balance。`data/processed/.../snapshots/202609_r1/` 和 `202609_r2_tgos_p01p02/` 都有 `_manifest.json`＋CSV；commit `690be1bd`／PR #118。注意：成品只在本機，沒有上雲 | A |
| G009 | 被取代 | AR-03（PR #48）之後加了 ratchet 測試 `src/data/__tests__/loadingRegistryContract.test.ts`：掃每個 `src/data/*Loader.ts` 的 rpc，必須在 ±10 行內有 withLoading，否則要列進含理由的豁免名單（20 項，例如 popup sparkline、monitor 背景輪詢）。聚焦盤點：188 個 `.rpc(` 呼叫中，沒包 withLoading 的都在豁免名單、或由外層包住（例如 fetchBusTrailsForCity → busLoader:202），或位於非圖層載入的 lib（adminApi、sessionTracker、layerGates）與 research adapter。沒有找到證實的殘留缺口。 | B |
| PL-1 | 被取代 | 舊計畫是 2026-08-02 BACKLOG 的 PL-1（A 建 `spatial.pla_tracks` 到 D 瀏覽器驗收）。`docs/features/pla-activity/README.md` 已標「✅ shipped（2026-08-02 A~D 期完成）」，`layerManifest.ts:2362` 有 plaActivity。剩餘工作都在該 feature backlog 的 PA-1~4。 | B |
| PA-1 | 被取代 | 全 repo 用 rg 搜 `DS-05` 是 0 命中，只剩 `docs/features/pla-activity/backlog.md` 的 PA-1（588 天全量向量化，含 outcome 與 next action），已是唯一紀錄。主表不必再保留這列衝突檢查。 | B |
| GC-7 | 已完成 | `docs/features/global-climate/backlog.md` 已拆好：GC-7（海流）[x] 與 GC-7b（CAMS，conditional）。data-collectors `cmems.py:57` 的 bbox 是 90–180E × -15–55N，`cams.py:38` 仍是 100–145E × 5–50N。 | B |
| G024 | 已完成 | 2026-10-05 打正式站：`/tourism/attractions_national.geojson`、`hotels_national`、`restaurants_national` 都回 200；`/forestry/canopy_height_rgb_taiwan.pmtiles`（manifest 現用 URL）Range 請求回 206，type 為 application/vnd.pmtiles。舊的 `canopy_height_taiwan.pmtiles` 回 404，但 `upload-deploy-assets.sh:362` 已註明它退役。 | B |
| WA-6 | 已完成 | commit abb8582f「archive completed plans and move status docs into feature homes」隨 PR #527 merge。`docs/NEWS_MAP_PLAN.md` 等已移到 `docs/archive/2026-10-04/`。docs 頂層剩 13 檔，只有 `layer-ux-policy.md` 沒有被引用，但它最後修改是 2026-08-29，未滿 60 天。 | C |
| AG-1 | 已完成 | 列內自述 done：mini #512/#517/#519、MCP #37/#38 | 主 |
| AG-8 | 已完成 | 列內自述 done：MCP #40/#41、mini #522、analytics #138 | 主 |
| AG-9 | 已完成 | 列內自述 done：analytics #139 | 主 |
| AG-12 | 已完成 | 列內自述 done：analytics #139、MCP #43 | 主 |
| AG-13 | 已完成 | 列內自述 done：MCP #43/#44 | 主 |
| GD-2 | 已完成 | collectors #127 merged；`docs/investigations/2026-10-05-gd2-mojibake-storage-guard.md` | 主 |
| BL-7 | 已完成 | collectors #126 調查：`live.reservoir_daily_ops` observed_at 10-03、collected_at 10-04 15:28 UTC，status run 322／error 0；刪除（4/23 停止原因無法重建；latent 風險 `water_reservoir_daily_ops.py:67-71` 寫進報告） | 主 |
| DIO-7 | 已完成 | `pg_stat_user_tables`（10-01 重啟後約 4 天）：class-B `*_current` HOT 比例 bus 99.5%、road_sections 99.9%、youbike 100%、parking_lots 99.0%、freeway 92.0%、road_events 97.8%、tourist_shuttle 99.5%、weather 99.8%，皆 >85%；尺寸 0.7–47 MB | 主 |
| WA-9 | 已完成 | REPO_HYGIENE §5：`geo/cctv.geojson`、`welfare/nursing_homes_national.geojson` 皆「可快取」，20 筆抽樣 BYPASS 0；刪除。新抽到的 `jp-heights/building_grid.pmtiles` 404 是設計如此：`src/map/__tests__/deployContract.test.ts:256-261` 註明 runtime 不抓這三個模板名，改由 `jp-heights/catalog.json`（200）列的 content-addressed `jp-heights/assets/<sha>.pmtiles`（實測 206）；屬盤點腳本誤報，不另開列 | 主 |
| ST-3 | 已完成 | 本分支改 `CLAUDE.md:30` 與 `docs/development-rules.md:26` 的 `realtime.*` → `live.*` | 主 |
| WA-2 | 被取代 | 併入 DS-02：collectors #126 調查 §WA-2 證實 collector 正常、上游是 1–6 月固定年度檔（115/06/22 提供），問題就是「A1 來源不可信」＝DS-02 | 主 |
| ST-2 | 被取代 | 列內自述已被 migration 402（gis-platform #94）取代 | 主 |
| Legacy-ID-migration | 已完成 | `rg '\b(G011\|G012\|G020\|DS-05)\b\|\bMS-[123]\b' docs .claude`：DS-05 0 命中；仍指向舊號的 3 處（PRINCIPLES.md:1225、INCIDENTS.md:1690、PLAYBOOKS.md:1124）本分支已補新編號；其餘為歷史紀錄或 monitor-split 自己的 MS-*。對照表：G011(ship LOD)→G022、G011(wall pause)→G023、G012(tourism/canopy)→G024（已結）、G012(alertSeries)→G025、G020→G017、mountain-safety MS-1~3→MTS-1~3、DS-05→PA-1（已併入 feature backlog） | 主 |

## 無法判斷（保留）

| ID | 判定 | 證據 | 查證者 |
|---|---|---|---|
| G018 | 無法判斷 | docs、.claude 都沒有寄給上游或上游回覆的紀錄。 | B |
| G019 | 無法判斷 | 找不到「83 條未使用軌道」的盤點或決定紀錄。 | B |
| WA-11 | 無法判斷 | 沒有 S3 憑證：REPO_HYGIENE:20／:516 記錄「aws CLI 存在，但沒有可用憑證」。 | C |
| WA-12 | 無法判斷 | 沒有 S3 憑證，無法列出 bucket 和 lifecycle rule。程式端：data-collectors origin/main 的 `collectors/global_climate/climate_bake.py` 只有 `FRAME_PAST_DAYS = 14` 這個讀取窗，找不到 S3 刪除／prune 邏輯。上游 retention 判斷為未實作，但 S3 lifecycle 是否存在無法確認。 | C |
| WA-13 | 無法判斷 | 需要到 Cloudflare dashboard 查 R2 token 權限，本機沒有 R2／S3 憑證可以驗證。 | C |

## 仍有效（已改寫或確認，State 依規則正規化）

| ID | 判定 | 證據 | 查證者 |
|---|---|---|---|
| BR-3 | 仍有效 | BR-2 前置條件已解除（見上）。analytics `_status.md` 寫明「唯一未做＝browser render smoke」；`docs/features/business-registry-company-layers/backlog.md` 的 BR-C-BROWSER 仍未勾選。找不到正式站 All Off 瀏覽器驗收紀錄 | A |
| Release-assets | 仍有效 | 2026-10-05 用 Range probe 掃 `layerManifest.ts` 裡全部 231 個 `url: "./…"`：129 個 200、99 個 206、3 個 404。3 個 404 都是 `jp-heights/*.pmtiles` placeholder，實際由 `jp-heights/catalog.json` 間接指到 `assets/<sha>.pmtiles`（catalog 回 200，#323 有正式站驗收），屬設計如此。列出的 12 個 feature（含 `urban_heat_lst_taiwan.pmtiles`、zoning、property、tree）HTTP 都正常；瀏覽器驗收仍需逐 feature 補 | A |
| G013 | 仍有效 | SQL：`live.border_airport_snapshot` 取最新 20,000 列（order by id desc）依 airport 分組 → 只有 TPE 18,836／TSA 721／RMQ 443，**沒有 KHH**，最新 collected_at 是 10/05 13:07 UTC。表已從 `realtime.` 改到 `live.` schema。限制：沒量這 2 萬列涵蓋多長時間，所以只能說「最近一段時間沒有 KHH 列」 | A |
| MAR-2 | 仍有效 | jp-religion backlog 只有本機瀏覽器驗收（JPR-1，08-24）。global-maritime backlog 寫「push/deploy/browser 驗收仍未完成」「production 真實 release 的線上 CDN/browser 驗收」都還沒勾。找不到正式站瀏覽器驗收紀錄。master 已發布 v2.5.0（`dcd09427`）；manifest 靜態資產 HTTP 正常 | A |
| PH-2 | 仍有效 | 2026-10-05 實測：`od.cdc.gov.tw/eic/Weekly_Age_County_Gender_061.csv` 回 404，`data.cdc.gov.tw/dataset/aagstable-weekly-dengue` 回 404。CKAN `package_search` 用 q=dengue 和 q=登革熱 都只回 1 筆 `dengue_ns1_clinics`（NS1 快篩診所，不是病例週資料）。卡片目前是否空白、DB 的 dengue 列是否還在推進，**沒查**（DB 預算用完）；collector-health 只說 `cdc_public_health_weekly` 整體最新寫到 10/01。od.cdc 的 TLS 憑證鏈本機驗不過，要加 -k 才連得上 | A |
| PR-1 | 仍有效 | SQL：`live.prison_population_daily` max(observed_date)=**2026-05-15**，max(collected_at)=2026-10-05 07:02 UTC，共 2,501 列（collector 仍在跑，上游仍停在 5/15）。gis-platform origin/main 沒有 anchor migration（只有 258／264），`.PENDING.sql` 仍未套用。表現在在 `live.` schema | A |
| DS-01 | 仍有效 | SQL：`live.lightning_events` source=taipower 近 20 天每日 distinct collected_at：09/27–09/30 每天 1–2 次，10/01 18、10/02 38、10/03 27、10/04 31、10/05 20 次；最新 observed 10/05 12:57 UTC。**上游已恢復**，但每天不同 collected_at ≤38 次，符合 30 分鐘間隔（1 分鐘間隔上限約 1,440），推定 `LIGHTNING_EVENTS_INTERVAL` 還沒改回 1（沒讀 Zeabur 變數，屬推論） | A |
| DS-02 | 仍有效 | 直接引用 data-collectors `origin/main:docs/investigations/2026-10-05-collector-health.md` 的 WA-2：上游 HTTP 200，1,717 records，資料提供日期 115/06/22，事故日期到 2026-06-15；DB occurred_at 最新是台灣 6/15。根因是固定舊資源加上 hash 去重；collector 心跳 10/05 成功（run 282／err 2），但不代表資料是新的 | A |
| DS-04 | 仍有效 | SQL：`analytics.lightning_daily_summary` 近 10 天（09/26–10/04）每天 county_rows=0、null_rows=1–2（兩個 source 各一列全國總和）。仍然只有全國列；但 `public.taiwan_counties_simplified` 等 polygon 表在正式庫是否存在**沒查**（DB 預算）——如果表存在，問題就在 refresh function，不是缺資料 | A |
| WF-2 | 仍有效 | 2026-10-05 實抓 `ltcpap.mohw.gov.tw/publish/abc.csv`：共 26,060 列，O_ABC 分布 B 24,650／A 836／C **572**（08-11 是 560，原本是 4,232）。上游沒有回補，縮量原因仍未說明 | A |
| MAR-3 | 仍有效 | 在 develop 的 docs／.claude 用 rg 搜 `994163329` 只命中 BACKLOG 本列，找不到分類結果 | A |
| IN-1 | 仍有效 | `src/components/intel/IntelPanel.tsx:375-377` 的 `alertTally` 仍取自 `alertSummaryQuery`，沒有套 RANGE；`:499` 傳 `alertCount={… alertTally.total}`；header 的 `totalCount={flatEvents.length}` 仍只算新聞。09-27 之後這三個檔只有 UI 改版 commit（55de2c1d、85e22e54），口徑沒改 | A |
| MON-P6 | 仍有效 | 10-03 才擱置（#507）；develop 的 src 搜不到子指數實作，gis-platform 也沒有相關 migration | A |
| SAT-Z3 | 仍有效 | gis-platform 本機分支 `feat/satellite-maneuvers-anchor` = `a0bc247`，還沒 push（沒有 remote branch）；origin/main 最新 migration 是 425，426 號目前還空著。`docs/handoff/satellite-maneuvers-at.md` 只在該分支，不在 main。worktree `.worktrees/sat-maneuver-anchor` 還在 | A |
| LW-1 | 仍有效 | `src/components/intel/monitor/LiveWall.tsx` 搜不到 `onError`／`無法嵌入`，表示還沒動工，仍在等 owner 決定 | A |
| JM-1 | 仍有效 | 2026-10-05 GET 正式站 `jp-medical/current.json` 仍是 `"status":"LOCAL_READY_NOT_DEPLOYED"`，version `eed57ed3…`。`scripts/deploy/publish-jp-medical-assets.py:93` 會**要求** catalog status 等於 `LOCAL_READY_NOT_DEPLOYED` 才發布，所以這個欄位是發布前提條件，發布時原樣帶上去，沒有改寫。前端 `src/data/jpMedicalLoader.ts` 會讀 current.json（有沒有讀 status 欄位沒查） | A |
| D3 | 仍有效 | 找不到 Exposed schemas 已縮減的紀錄；`docs/launch/08_POST_LAUNCH_HARDENING.md` 還停在操作說明（:69、:89）。沒做 REST 探測（需要 anon key，依規則不讀） | A |
| BC-4 | 仍有效 | 2026-10-05 正式站首頁 response header：`content-security-policy: frame-ancestors *`＋`content-security-policy-report-only: default-src 'self'; script-src … 'unsafe-inline' 'unsafe-eval' …`，主要策略仍是 Report-Only。OAuth 設定沒辦法從這裡驗證 | A |
| OG-1 | 仍有效 | 找不到 Spend Cap 的設定紀錄。這是 dashboard 操作，沒辦法用唯讀方式驗證 | A |
| G016 | 仍有效 | `git grep weather_change origin/main` 在 data-collectors 沒有命中，程式端看起來已清乾淨（`.env` 依規則沒讀）。AWS 停用 key 要管理者操作，找不到 STS 失敗的紀錄 | A |
| JP-1 | 仍有效 | gis-platform origin/main 的 docs 找不到 religion／374 view 的 PostgREST 寫入嘗試紀錄 | A |
| BR-5 | 仍有效 | analytics `_status.md:90`：A2 園區 polygon「v1 不含科學園區 polygon」；也找不到新增科學園區 polygon 的 commit | A |
| BR-6 | 仍有效 | 定位來源已經選定 TGOS，分批回填中：analytics `690be1bd`（10-04，在 origin/master）提交了 TGOS p01／p02 回填工具與 `202609_r2_tgos_p01p02`；202609 未定位從 2,600（r1 acceptance.json）降到 2,421，分母 656,713 不變，ambiguous 也保留。但只在本機，沒有發布；前端仍用 202608_r2 | A |
| WF-4 | 仍有效 | welfare backlog:34-38 仍寫「owner 先選立案機構或特約單位」 | A |
| MC-5 | 仍有效 | 時間閘門已過，但沒有重跑：analytics `data/processed/environment/urban_heat_lst*` 最新產物仍是 `*_20260729.tif`；origin/master 在 2026-09-01 之後沒有 urban_heat／LST commit。正式站 `environment/urban_heat_lst_taiwan.pmtiles` 回 206（7 月版） | A |
| EM-30 | 仍有效 | `src/embed/railReplayData.ts:57-66` 的 legacy fallback（`RAIL_GEOMETRY_LEGACY_URL`）和 TODO 都還在；正式站 `embed-rail/rail-manifest.json` 回 200，指向 `rail_slim.4e0dc14093.json.gz`（08-09 產生）。觀察結束日還沒設定 | A |
| CAT-1 | 仍有效 | `src/data/layerManifest.ts:1656-1793`：aisstreamVessels、gfwVesselPresence、gfwHourlyGrid、gfwHourlyTracks、**gfwFishingEffort**、gfwDarkVessels 共 **6** 層仍是 `status: "catalog_missing", datasets: []`（原列寫 5 層，漏了 gfwFishingEffort）。analytics `docs/data-registry.yaml` 搜不到 gfw／aisstream | A |
| AG-5 | 仍有效 | 自動量測已在 2026-10-04 完成（release-pr-index #521）；STATUS.md:69 與 general-analysis/STATUS.md:18 都還列「手動待驗：正式站重整還原、面板撤銷 token」，查無完成紀錄。原列 State=done 但驗收還沒做完，所以改成 verifying。 | B |
| AG-7 | 仍有效 | `mcp/eval/agent-regression/run.mts:163-176` 的 `runResetCommand` 只執行使用者給的 shell 指令，之後由 `waitForWaitingTab` 等分頁上線，中間沒有關閉圖層或清 scene 的步驟。 | B |
| AG-10 | 仍有效 | develop 的 src 用 rg 搜「有新版本／version.json／buildId／checkForUpdate」都是 0 命中，pulse PR tsv 也沒有相關 PR。原 State=idea，改成 blocked（owner decision）。 | B |
| AG-11 | 仍有效 | 新倉庫 20261005T051814Z 的 `wh_catalog` 中，`ds_transportation_bus` 標題仍是「公車即時位置與站點（全台 22 縣市）」。來源是 analytics `docs/data-registry.yaml:188` 的 registry title（bus `_manifest.json` 沒有 title），MCP `datasetLabelOverrides.json` 也沒有 bus 項。 | B |
| AG-2 | 仍有效（blocker 改變） | 倉庫已重建：本機 cache `latest.json` = 20261005T051814Z，manifest `source: update_store.py`，previousVersion 20261005T051239Z。但這版 `core/wh_catalog.parquet` 的 `ds_agriculture_livestock_ranch` 標題仍是「肉品拍賣/批發市場（屠宰+拍賣合一，全國 21 家）」。上游已修：analytics #134 merged，`livestock_ranch/_manifest.json` title 已改；`build_warehouse.py:229-232` 與 `:942` 也已改成優先用 manifest title。推測 update_store 增量更新沒有重建這筆 catalog，尚未驗證。overrides 的牧場 title 仍在。 | B |
| AG-3 | 仍有效 | 沒有決定紀錄。`useEarthquakesGlobalLayer` 最近的 commit 是 Three.js 漣漪（379ba049）與 AG-1 摘要，跟暫停行為無關。 | B |
| AG-4 | 仍有效 | `eval/agent-regression/questions.json:301`（A10-taipei-quality-index）還沒寫明可接受口徑。2026-10-02 的 run 是 FAIL，09-29 recheck 是 PASS，判分仍不穩定。 | B |
| AR-11e | 仍有效（blocker 已解除） | 2026-10-05 實測 `https://data.itsmigu.com/imagery/cwa/O-C0042-004/20261005/131000.jpg`：帶 Origin 的 GET 回 200，有 `access-control-allow-origin: *`；OPTIONS 回 204，有 allow-methods GET, HEAD。所以 HTTP 層的 CORS 已可用。PR #428（chore/ar11e-legacy-rpc-retire）仍 OPEN。 | B |
| AR-12/13 | 仍有效 | data-collectors origin/main 沒有 `snapshot_writer`，pulse src 沒有 `snapshotLoader`（只有 embed-snapshots）。architecture-overhaul-plan.md:86-90 的 AR-12、AR-13a~d 全是 ☐。 | B |
| AR-14/15 | 仍有效 | plan:99 的 AR-15 仍是 ☐。src 只有 `./flight-trails/manifest.json`（AR-16 航班），沒有 ship/bus 的 trail CDN 成品。 | B |
| AR-31~36 | 仍有效（範圍縮小） | AR-31 已由 perf-audit #464／#476 完成：動態 CustomLayer 改 `subscribeTimeRepaint`，見 `docs/perf-audit-2026-09-30.md` §2.2。AR-36 還在：`FireStationScene.ts:180` 每次 tick 仍 `new THREE.Matrix4()`。AR-32~35 沒有進展。 | B |
| AU-4 | 仍有效 | 現在有 4 個 Three scene 直接呼叫 `MercatorCoordinate.fromLngLat`：RealEstatePointsScene:203、TemperatureWaveScene:100/111、OsmPowerLinesGlowScene:156、GfwV4TrackScene:169/192/231/255。原稽核 D-6 時是 3 個，GfwV4 是新增的。 | B |
| AU-8 | 仍有效 | `docs/features/` 沒有 food-price 目錄。相關文件只在 `docs/proposal/monitor-tweaks-2026-08-21/food-price-stale-recovery.md`。 | B |
| G004 | 仍有效（範圍縮小） | perf-audit PF-12/PF-14（f8743742、6bfa58a0，隨 #477）已把被取代的大檔排除在 image 外。但 `public/base_map/hillshade.png`（8.7 MB）和 `public/climate/` 6 檔仍被 git 追蹤、會烤進 image。nginx 的 `location /base_map/` 與 `^~ /climate/` 都只用 `root /data`、沒有 dist fallback，所以這些檔案永遠不會被讀到（原稽核 B-2 的剩餘部分）。 | B |
| G017 | 仍有效 | `scripts/deploy/purge-cloudflare-cache.sh` 仍只會 `purge_everything`。`.env` 裡沒有 `CF_ZONE_ID`／`CF_API_TOKEN` 這兩個 key（只算 key 數，結果 0，沒讀值）。 | B |
| G022 | 仍有效 | `ShipScene.ts` 沒有 LOD 或簡化邏輯，perf-audit 也沒有處理 trail LOD。 | B |
| G023 | 仍有效（未被 perf-audit 取代） | perf-audit #464 處理的是隱藏或關閉的圖層，不涵蓋「Wall 模式蓋住地圖時，可見圖層的引擎仍在跑」。src 沒有 `setActive(` 呼叫。這仍是產品決策。 | B |
| G025 | 仍有效 | `useMonitorDashboardData.ts:23` 每 60 s 輪詢，`alertsLoader.ts:262-283` 每次都整包呼叫 `get_alert_series_24h`（cachedOnce TTL），還不是增量抓取。 | B |
| FP-1 | 仍有效（數字更新） | 2026-10-05 SQL：`live.food_price_daily` 範圍 2026-07-27~2026-10-05，共 71 天（原列寫約 24 天），仍遠低於 1095 天。`analytics.food_price_index_daily` 最新到 2026-10-03，表示 Mac launchd 仍在產出。data-collectors 只有 raw collector `food_prices.py`，沒有指數 collector。 | B |
| FP-2 | 仍有效 | `analytics.food_price_index_daily` 的欄位是 trade_date, indicator, index_val, index_sa, coverage, n_items, z_score, dev_pct, light，沒有 timestamptz 欄位。`realtime_tables.yaml:159` 只監看 `live.food_price_daily`。 | B |
| with-conn-timeout | 仍有效 | `storage/db.py:48-52` 自己寫明：pooler 會丟掉 startup options，要在交易內 `SET LOCAL statement_timeout`。`satellite_passes_daily.py:64` 仍只靠 `connect_supabase(statement_timeout_ms=300_000)`，沒有 SET LOCAL。`waste_match.py:182` 是裸 `psycopg2.connect`，完全沒設 timeout。 | B |
| Unrouted-platform-programs | 仍有效（連結錯誤） | 列出的 canonical plan 大多找不到對應 ID：`energy-v2-plan.md` 沒有任何 BL-*；`monitor-mode.md` 沒有 MO-*，MO-4/7/8/12/14 實際在 `docs/proposal/monitor-v2-plan.md`；`bus-layer-design.md` 沒有 CV-*，全 repo 也找不到 CV-* 和 MC-1~4。`satellite-console.md` 只有 SAT-3/7/8A。water BL-6/8–23 在 develop 上找不到 canonical 出處（現存 BL-15~23 都是 waste 命名空間）。 | B |
| TD-4 | 仍有效（數字更新） | 2026-10-05 SQL：`analytics.tra_train_delay_daily` 總計 177 MB、197,653 列、219 天（2026-02-28~10-04）；`delay_trajectory` 的 pg_column_size 加總 128 MB，約 72%。 | B |
| MO-6 | 仍有效 | src 和 data-collectors origin/main 都沒有匯率（exchange rate／央行）來源或卡片。 | B |
| G003 | 仍有效 | `public/three-showcase.html` 仍被追蹤（最後改動 136d9f52，2026-05-24），three-3d-component skill 也引用它。沒有決定紀錄。 | B |
| G015 | 仍有效 | 本機分支 `feat/monitor-grid-layout`（領先 develop 15 個 commit，07-09）與 `feat/monitor-widgets-batch1`（領先 11 個，07-08）都還在，且沒有 upstream（REPO_HYGIENE.md:123-124）。目前排版已改用 monitorPacking／split。 | B |
| G021 | 仍有效 | gis-platform origin/main 的 `wiki` submodule 指向 `ad6fa4d`，最後一次更新是 930d242（2026-08-02）。gis-wiki origin/main 是 `6b9fbe0`（2026-09-05），`ad6fa4d` 是它的祖先，落後 5 個 commit。兩邊都是本機 remote ref，沒有 fetch。 | B |
| TD-2 | 仍有效 | 2026-10-05 SQL：`tra_train_delay_daily` 最早的日期是 2026-02-28，表示沒有回補。 | B |
| TD-3 | 仍有效（座標更新） | 寬版 `monitorLayout.ts:178` 現在是 `traDelay x0,y75,w5,h5`，註解 :113-114 仍寫「接線時暫定、非沙盒匯出」。split 版 `monitorSplitLayout.ts:134` 是 `x0,y122,w12,h8`。git log -S 顯示 traDelay 座標只在 2ef41f9f 被手動加入，之後只有手動位移。 | B |
| G008 | 仍有效（數字更新） | 2026-10-05 量測：layerManifest.ts 12,109 行、overlayRegistry.ts 11,318、LegendPanel.tsx 6,503、layerParamsSpec.ts 3,990、App.tsx 3,078；`useTransportParams.ts` 已不存在。目前沒有具體痛點紀錄。 | B |
| AR-41~44 | 仍有效（改寫） | AR-41 未完成：2026-10-05 查 `authenticator` 的 `pgrst.db_schemas`，除 public 和 graphql_public 外還開放 reference, spatial, metadata, opendata, fire, maritime, rail, safety, demographics, intel 共 10 個 schema。AR-42 的「偏好＝manifest keys 序列化」沒有實作（src 沒有 user_profiles／preferences 程式碼），AR-21 manifest 地基已完成。AR-43 的「manifest 生成 tool schema」路線實際上已改由 pulse-research MCP／分析倉庫（AG 系列）承接。AR-44 沒有進展。 | B |
| ST-1 | 仍有效 | 2026-10-05 SQL `pg_total_relation_size(to_regclass(...))`：`live.aqi_imagery_frames` 總 294 MB，但 heap 只有 488 kB、index 2.5 MB（多出來的幾乎都在 TOAST）；`live.groundwater_level_readings` 總 1754 MB，其中 index 1444 MB、heap 309 MB；`live.rain_gauge_readings` 總 2725 MB，其中 index 1807 MB、heap 918 MB。沒有回收紀錄，index 膨脹仍然存在。 | C |
| DIO-2 | 仍有效 | 在 gis-platform origin/main 用 `git grep refresh_bus_trails_daily -- migrations`，命中的最新檔是 316（search_path pin），沒有任何增量 migration。正式 DB 的 `pg_get_functiondef(refresh_bus_trails_daily(date))` 不含 `IS DISTINCT FROM`，也不含 `last_collected_at`／watermark。cron 為 `refresh-bus-trails 1,31 * * * *`，加上 `refresh-bus-trails-yesterday 0 17 * * *`。 | C |
| DIO-3 | 仍有效 | 在 worktree 的 docs 和 memory 都找不到 keep-or-reduce 的決定（rg `DIO-3` 只命中 BACKLOG 本身）。State 依規則從 decision 改成 blocked。 | C |
| DIO-8 | 仍有效 | 2026-10-05 查 `pg_stat_user_indexes`：`idx_animal_adoption_current_last_seen` 的 idx_scan=0，`idx_animal_adoption_current_listed_dims` 的 idx_scan 也是 0，pkey 為 76,519。`pg_stat_user_tables` 顯示 n_tup_upd=76,752、n_tup_hot_upd=0（HOT 0%），n_live_tup 10,669。pg_stat_database 的 stats_reset 是 NULL，代表從統計起算點至今都沒有掃描過這個 index。 | C |
| CL-1 | 仍有效 | `docs/features/jp-water/README.md:3` 仍寫「正式站站主目視待驗」。之後只有 #499（jp-water alert scope）和 #511 merged，沒有站主目視紀錄。 | C |
| CL-4 | 仍有效 | 已在 `.worktrees/analysis-prod/mcp` 查到 PR #45（HEAD 146804c）。`src/warehouse/engine.ts` 的 `locationPrecisionsFor` 現在會把 grid／isochrone／region_rank 標成 `derived`，但 SQL 結果仍沿用 lineage 中最差的 catalog class。註解原文：「SQL can also compute new geometry (centroids, buffers); that stays a known gap」。 | C |
| CL-5 | 仍有效 | `GIS/_worktree-backups/2026-09-29` 還在，`du` 為 6.0 GB；另外多了 `2026-10-04/` 資料夾。REPO_HYGIENE:556 列出 `_worktree-backups` 6113 MB，待確認。 | C |
| CL-8 | 仍有效（A47 疑已解） | A32：`RankBars.tsx:68` 仍是 `Math.max(0, item.value)`，`CompareTable.tsx:43` 也 clamp 0，負值仍畫成 0 寬。A37：`App.tsx` 的 `{!captureMode && <LoadingStatus…>}` 仍在拍攝模式下卸載。A39：`MobileMoreMenu.tsx:61` 用 `Z_INDEX.popover`（30），但它位於 toolbar（25）的堆疊內，`MobileBottomSheet.tsx:58` 是 zIndex 40，選單仍會被蓋住。A40：`layer-dataset-aliases.json:22` 的 `osm_power` 仍把 8 表一起對應。A42：`analysisResultOverlay.ts:1224-1226` 的 isochrone／flow outline 與 endpoint 用純 opacity，沒有套 `dimmable`；`:1016` 的 extrusion 也排除在 dim 之外。A46：`viewportFit.ts:29` 的 `CAMERA_MAX_ZOOM_CEILING = 16` 還在。A47：MCP commit 313a9a4 已把 recipe 改成「內部檢查」，對使用者「最多挑一句『小提醒』」，原本的矛盾大致消失；但 `nearby-profile.md:9` 的內部檢查仍寫「caveats 原樣帶上」，需要 owner 確認是否結案。 | C |
| PF-3 | 仍有效 | `docs/perf-audit-2026-09-30.md:129` 記錄「使用者決定暫緩」，之後沒有新的決定，`src` 也沒有 `_v3` 公車檔。 | C |
| PF-5 | 仍有效 | `perf-audit-2026-09-30.md:130` 寫「待決定」。目前 node_modules 的 mapbox-gl 為 3.18.1；`src` 只有 bench／spike 會讀 devicePixelRatio，沒有覆寫。 | C |
| WA-1 | 仍有效 | `src/data/layerManifest.ts` 的 9195–9339 有 7 處 `./agriculture/livestock_farms.geojson`（livestock 子圖層），9363 有 `./agriculture/slaughterhouses.geojson`。`pull-deploy-assets.sh:67-74` 仍排除並刪除這兩個檔。2026-10-05 對正式站 HEAD：兩個檔都回 404。 | C |
| WA-3 | 仍有效（大幅縮小） | gis-platform PR #113（mig 412，2026-09-18 merged）已登記 iot_wra_measurements（永久保留）、bus_trails_daily（3 天）、ship_trails_daily（7 天）、youbike_h3_daily（7 天）、news_events（HOLD），並新增 yt_live_history（HOLD）。2026-10-05 查 `retention_policies` 確認這 5 列都在，freeway_sections_current 沒有登記。`check_retention_coverage()` 只回 2 列：news_events、yt_live_history（archive/retention decision pending）。freeway 沒有被標，推測目前不到 100 MB（未實測）。 | C |
| WA-10 | 仍有效 | 2026-10-05 SQL：`pg_stat_statements_info.stats_reset` = 2026-10-01 18:14 UTC（又 reset 了一次），dealloc=248。`docs/audit/weekly/` 只有 W34、W38 兩份；`collect_supabase.sh:261-270` 仍然只存 raw snapshot，沒有做差分排名。 | C |
| BL-25 | 仍有效（改寫） | collectors #126 調查 §BL-25：H3 上限已不存在；YouBike MV 停 04-09、flight 09-26 summary／raw 不一致、waste matched=0 仍在 | 主 |
| TD-1 | 仍有效（改 verifying） | collectors #126 已合併 TD-1 patch（`config.py:291`、`supabase_writer.py:885-906`）；runtime interval 覆寫未驗、04-02／06-26 回填待拍板 | 主 |
| DIO-1 | 仍有效（驗收失敗、改寫） | `pg_postmaster_start_time()`=2026-10-01 18:14 UTC（>09-04 04:53）；journal 2026-10-02 04:27 記全表 export 導致重啟，原因未證實 | 主 |
| DIO-4 | 仍有效（改寫） | collectors #126 調查：71 owner 62 FRESH／5 STALE／4 MISSING，9 個 owner 逐一分類，心跳未修 | 主 |
| DIO-5 | 仍有效（改寫） | collectors #126 調查：`realtime_tables.yaml:58` 用 created_at，表只有 uploaded_at／verified_at；設定未改 | 主 |
| DIO-6 | 仍有效（改 blocked） | collectors #126 調查：`wra_drought_alert.py:191-203`＋`supabase_writer.py:185-189` 提前 return；DB 告警只看全體 MAX | 主 |
| WA-4 | 仍有效（改 blocked） | gis-platform #138 merged：87 候選、DROP_SAFE 15 待拍板 | 主 |
| WA-5 | 仍有效（數字更新） | REPO_HYGIENE §4.1：60 個／1,223.3 MB | 主 |
| WA-7 | 仍有效（數字更新） | REPO_HYGIENE §2.1：mini 未 push 12 支，兩支 monitor 分支仍無 upstream | 主 |
| WA-8 | 仍有效（數字更新） | REPO_HYGIENE §4.3 與 `git ls-tree -r -l HEAD`：32 個／363.49 MB | 主 |
| G026 | 仍有效（補第三張表） | SQL `information_schema.tables like '%backup%'`：3 張 live backup 表都在（多一張 `disaster_alerts_daily_mojibake_backup_20260822`）；mini-taiwan-info 備份分支仍在 | 主 |
| G027 | 仍有效（數字更新） | REPO_HYGIENE §1／§3：兩個 worktree 仍在；7 個 repo 有髒檔；`.opendata-memory` 已有 origin（Nami.git）且同步 | 主 |
| CL-3 | 仍有效 | PR tsv：pulse #425–428、collectors #116–121、platform #126–128、mcp #27 全部 OPEN | 主 |
| CL-6 | 仍有效 | `git ls-tree origin/main docs/investigations/` 沒有 gfw-freshness；本機 `git status` 顯示 `?? docs/investigations/2026-09-18-gfw-freshness.md` | 主 |
| CL-7 | 仍有效（改寫） | analytics origin/master 已有兩個 0005（835edf90 2026-09-20、ed3886e0 2026-10-04），最大號 0008 | 主 |
| GD-1 | in_progress | mini PR #539 已開未合 | 主 |
| AU-3 | in_progress | mini PR #539 已開未合 | 主 |
| AG-6 | in_progress | 分支 `fix/small-bugs-20261005`，PR 即將開出 | 主 |
| G005 | in_progress | 分支 `fix/small-bugs-20261005`，PR 即將開出 | 主 |
| FE-01 | in_progress | 分支 `fix/small-bugs-20261005`，PR 即將開出 | 主 |
| R5-1 | in_progress | 分支 `fix/small-bugs-20261005`，PR 即將開出 | 主 |
| R5-2 | in_progress | 分支 `fix/small-bugs-20261005`，PR 即將開出 | 主 |
| R8-2 | in_progress | 分支 `fix/small-bugs-20261005`，PR 即將開出 | 主 |

## 全域記憶索引（MEMORY.md）建議表

範圍：`~/.claude-migu/projects/-Users-migu-...-mini-taiwan-pulse/memory/` 的 status-ref、pointer 和 WIP 檔。**本次沒有修改任何記憶檔**，下表只是建議。索引與檔案一一對應，沒有斷連結；`ctx-handoff.md` 不在索引裡，屬於另一套機制，維持不動。

| 檔案 | 指向 | 2026-10-05 現況（證據） | 建議 |
|---|---|---|---|
| road-events-status.md | mini `feat/fire-rescue`（096c1c5，「未 push 待驗收」） | 本機和 origin 都沒有這個分支；develop 已有 `src/hooks/useRoadEventsLayer.ts`、`src/data/roadEventsLoader.ts`，代表已上線 | 歸檔 `_archive/`。資料踩雷那段（0,0 座標、基隆偏多）若還用得到，搬到 `docs/features/` |
| urban-form-status-ref.md | mini `feat/urban-form` → PR #71 | 檔案內容已寫 SHIPPED（#71 2026-07-16），分支已刪 | 歸檔 |
| monitor-split-status-ref.md | mini #139、gis-platform #51 | 都已 merged；description 還寫「未 push」，與內文矛盾 | 保留（產品決策和踩坑仍有用），只把 description 改成「已上線；保留產品決策與踩坑」 |
| monitor-tweaks-status-ref.md | mini #153/#154、platform #59、collectors #53、analytics #53 | 全部 merged；剩下的三件已由 BACKLOG 追蹤：PH-2（登革熱）、PR-1（migration 369 改錨）、G026（備份表） | 歸檔；索引那行改指 BACKLOG PH-2／PR-1／G026 |
| next-batch-w1-w6-handoff-pointer.md | 6 條未 push 分支＋overnight 報告 | 6 條分支都已刪；develop 有 `Merge pull request #132 from integration/next-batch`（c5405f7f）；報告在 `docs/archive/2026-10-04/proposal/` | 歸檔（內文「一律未 push」已不成立） |
| transport-lite-status-ref.md | mini-taiwan-transport PR #3 | 已 merged（2026-08-05），owner 待決全數關閉；repo 最後 commit 09-29 | 歸檔，或改寫成一句「已交付，進度看該 repo `docs/proposal/transport-lite-progress.md`」 |
| north-frame-status-ref.md | 2026-07-10 轉向紀錄 | 是歷史決策，handoff 已在 `docs/archive/2026-10-04/proposal/transport-lite-handoff.md` | 歸檔 |
| water-resources-status-ref.md | `feat/water-resources`，「前端 Phase 1 尚未開工（04-21）」 | 分支已不存在；status doc 自己寫 04-22 Phase 1＋2 已上線 | 改寫一句：「已上線，status 見 `docs/features/water-resources/water-resources-status.md`」，或歸檔 |
| supabase-disk-io-2026-09-04-status-ref.md | 「09-06 前確認不再重啟」 | `pg_postmaster_start_time()`=2026-10-01 18:14 UTC，之後又重啟過；journal 歸因於全表 export，未證實（BACKLOG DIO-1） | 改寫一句：指向 BACKLOG DIO-1，拿掉「待驗收 09-06」 |
| supabase-storage-audit-status-ref.md | migrations 385-388、collectors #69/#70、platform #82 | 已上線；剩下的追蹤項：WA-3 已縮成 news_events/yt_live_history（platform #113），ST-1 仍開著 | 歸檔（正本在 `docs/proposal/supabase-retention-2026-09-01/`＋BACKLOG） |
| global-layers-timeline-status-ref.md | mini #138、collectors #48 | 都已 merged（08-15）；「回填腳本未執行」本次沒有查證 | 改寫一句（只保留「三個根因別改回去」），或把根因搬到 PRINCIPLES 後歸檔 |
| monitor-restyle-status-ref.md | P1–P6、#486–#507 | P1–P5 都已 merged；P6 由 BACKLOG MON-P6 追蹤 | 歸檔（正本在 `docs/features/monitor-restyle/README.md`） |
| worldmonitor-research-status-ref.md | docs/research 報告，WM-1~18 凍結 | 報告在 develop；仍凍結待拍板 | 保留 |
| waste-status-ref.md | `docs/features/waste-collection/status.md` | 檔案存在 | 保留（BL-25 的 waste matched=0 和它相關） |
| engineering-cycle-2026-10-04-status-ref.md | develop/master 流程、tag | 仍是現行規則；文中列的 `feat/monitor-grid-layout`／`feat/monitor-widgets-batch1` 仍未 push（WA-7／G015） | 保留 |
| ui-design-system-status-ref.md | R6 handoff | worktree `.worktrees/map-restyle-r6` 還在（有未提交改動 24+5） | 保留 |
| pulse-analysis-warehouse-status-ref.md | general-analysis STATUS | 10-04 之後 R2 已切到 20261005T051814Z；AG-6 PR 即將開出 | 改寫一句（補 10-05 倉庫版本，指向 BACKLOG AG-*） |
| satellite-console-restyle-status-ref.md | #533、`feat/satellite-maneuvers-anchor` | #533 merged；#534（wrap-up）仍 OPEN；anchor 分支仍是本機未 push（SAT-Z3） | 保留 |
| bridge-resilience-status-ref.md | `codex/transport-facilities-20260923` | worktree 還在（17+29 未提交），分支有 83 個本機獨有 commit | 保留 |
| soil-liquefaction-status-ref.md | #407/#408 | 都已 merged；「正式站目視、MCP 44c663f」本次沒有查證 | 保留 |
| cctv-finetune-status-ref.md | `codex/cctv-recovery-20260929`、PR #425 | 分支在本機和 origin 都有；#425 仍 OPEN（CL-3） | 保留 |
| cctv-heading-status-ref.md | `fix/cctv-url-normalize`（mini＋analytics） | 兩邊都還是本機未 push（REPO_HYGIENE §2.1） | 保留 |
| repo-cleanup-2026-09-29-backups.md | `_worktree-backups/2026-09-29/` | 資料夾在，6.0 GB（CL-5） | 保留 |
| tra-timetable-station-id-remap-bug.md | PR #57 | 已 merged；文中警告的是 08-22 以前 167 天的資料，仍然適用 | 保留 |
| mini-taiwan-stories-status-ref.md | 另一個 repo | 最後 commit 09-05，有髒檔 1+12 | 保留 |
| flight-arc-campaign-pointer.md、threads-ui-motion、pulse-showreel、shark-tank-mod、disk-cleanup、pulse-api、mini-cctv-tw、feedback_*、工具類 pitfall | 跨專案／個人偏好 | 不屬於本 repo 的狀態 | 保留 |

建議歸檔 9 檔：road-events、urban-form、monitor-tweaks、next-batch-w1-w6、transport-lite、north-frame、supabase-storage-audit、monitor-restyle、（可選）water-resources。建議改寫一句 5 檔：monitor-split、supabase-disk-io、global-layers-timeline、pulse-analysis-warehouse、water-resources（如果不歸檔）。


## 本分支改動

- `.claude/memory/BACKLOG.md`：表頭改日期並加入方法說明；23 列移除；其餘列換成現況；Feature index 的交叉引用同步更新。
- `CLAUDE.md:30`、`docs/development-rules.md:26`：`realtime.*` → `live.*`（ST-3）。
- `.claude/memory/PRINCIPLES.md:1225`、`INCIDENTS.md:1690`、`PLAYBOOKS.md:1124`：舊編號 G020／G011 補上新編號（Legacy-ID-migration 結案）。
- 本報告。

## 驗證

- `git diff --check`：無輸出（通過）。
- BACKLOG 的 State 欄只出現 ready／blocked／conditional／in_progress／waiting_external／verifying。
- 相對連結逐一做 `os.path.exists` 檢查：只有 `../../../data-collectors/...disk-io-bloat-spiral.md` 在 worktree 深度下解析不到。這條原本就存在；從主 checkout 解析時，檔案確實存在。
- 沒有測試或 lint 會讀 BACKLOG.md。只有 weekly-audit skill 會把 WA-* append 進去，「Weekly audit findings」段落的格式沒有改。

## 未解／待使用者拍板

- DIO-1：要到 Supabase dashboard 確認 10-01 重啟的原因。如果是 IO 預算耗盡，DIO-2 要升為 P1。
- 已有草稿、等拍板的事項：
  - WA-4：DROP_SAFE 15 支。
  - PR-1：migration 改錨。
  - TD-1：確認 runtime interval，以及 04-02／06-26 回填。
  - BL-25：三項 materialization／retention／matching 修正。
  - DIO-6：空 snapshot 的處理政策。
  - DS-01：`LIGHTNING_EVENTS_INTERVAL` 改回 1，需改 Zeabur 變數。
  - AR-11e：R2 CORS 已通，可以重啟 #428。
- MAR-1 刪掉之後，GFW 授權／非商用條款審查只剩 global-maritime feature backlog 在追。要不要另開頂層列，請 owner 決定。
- AG-2：倉庫雖然已切到 20261005T051814Z，牧場標題卻還沒修正。推測是 `update_store.py` 增量更新沒有套用 analytics #134，尚未驗證。
- Unrouted-platform-programs：water BL-6/8–23、MC-*、CV-* 在 develop 找不到 canonical 出處，要決定重新安置還是丟棄。
- `gen_repo_hygiene.py` 建議排除 `deployContract.test.ts` 列出的 jp-heights 模板名，避免 CDN 抽樣誤報。
- 附帶發現：UH-2（都市熱島 PMTiles）在正式站已回 206，但 feature backlog 還沒更新。
