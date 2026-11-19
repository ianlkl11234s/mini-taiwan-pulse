# 專案追蹤總表

> **現況入口（單一入口）**：開場先讀本檔上半部（現在最該注意＋進行中／待拍板），需要細節再查 BACKLOG 對應主題群。一列一專案，只放指標，不重抄細節。
> 最後盤點：2026-11-18 v2.40.1 發版準備（#1091、#1092、#1093、#1094；新增 I18N-2／I18N-3）。前一次：2026-11-18 v2.40.0 發版準備（加拿大 #1085、南韓 KRH-1 #1088、Day 17 #1086／#1087、事故脈動 #1083；倉庫 20261117T101553Z 已含加拿大 36 表）。前一次：2026-11-17 v2.39.0 發版準備（菲律賓 #1071、越南 #1074、中國 #1037／#1066；倉庫 20261117T052230Z 已含菲越；中國第 2–5 波私有圖磚已上傳、mig 556／557 已套正式庫；發版後 pulse-host 重建 coral-private、mem_limit 512m）。前一次：2026-11-17 v2.38.0 發版準備（release 準備 PR 進 develop 後開發版 PR develop → master，合併待站主拍板），範圍 #1039、#1042、#1050、#1064、#1065、#1067–#1070、#1072、#1073；lock 新增 16 個公開資產皆已在 S3（本次補傳 `road_lines_20261116.pmtiles`），首爾用途地域私有圖磚已在私有 bucket；#1037 中國不在本版。前一次：2026-11-16 第四輪：v2.37.1 已發布（發版 PR #1062，master `8f0cdd39`，站主同意管理員合併；回合併 #1064）與正式站目視 A–E 全過；PII-1、VPB-17／20／21 關閉，新開 VPB-28／29。同日第三輪：v2.37.1 發版準備（`release/v2.37.1` 直接 PR 到 master，帶 #1044、#1048、#1055、#1056、#1058）；data-collectors `efd4c2d6`（#205、#206）部署 pulse-host；新增城市聲景 SND-1～5（SND-1 同日完成）、CI-10；三個 session 收尾。同日稍早：v2.37.0 已發布（發版 PR #1054，master `3629f1b5`，19 個 PR）與正式站目視（11 項 9 通過、2 部分通過）；collectors #204 已合並於同日部署 pulse-host（站主同意）；HOST-1、對帳、S3 用量唯讀調查結論回寫。同日第二輪：PII-1 部分完成、PII-2／PII-3 查證結果、新增 PII-6／PII-7、REL-NEXT 下一版範圍。同日稍早：v2.37.0 發版準備；多國圖層與個資清理收尾登記（PII-1～5、REL-NEXT、WHREORG-1；各 PR 狀態以 gh 查證）。前一次：2026-11-14 多國進度補記（菲律賓、中國、越南、南韓第 10 波、英國 OSM、加拿大 LODE、日本事故口徑，各 repo origin 實況查證）。再前一次：2026-11-13 v2.36.2 發布（分享網址預設篩選、統計說明框錯位修正；選舉活動同地點各場展開，#1024／#1025）。前一日：2026-11-12 v2.36.1 發布（選舉活動同地點多場合成，#1020）。同日稍早：v2.36.0 發布（統計圖層呈現方式：比例圓、點密度、多年份並排、左右比較；暗底配色第一／二段；review 修正）。之前：2026-11-10 差異檢核收尾（當天完成並登記：MCP 發版關卡與倉庫 1.5.3 重發、四個守門排程、Dependabot 與 required `ci-ok`、開場提示與瘦身第一輪、配色第一／二段；之前：對 11-08 健檢逐項比對：PROJECTS 引用已關閉 ID、過期期限、封存連結全數修正，新增 `npm run check:entry-docs` 自動檢查；使用者同日拍板的決定登記進 BACKLOG，決策清單 https://claude.ai/artifact/5jeCEF7zwwCWbgAWveLtWd ）。同日稍早：v2.35.0 發布（台灣圖層待辦池第二＋三批、南韓第 8–9 波、愛爾蘭第 11 波、日本市町村道、人口細網格補齊；AI 倉庫 611 表）。
> 自動檢查：`npm run check:entry-docs`（規則與標記寫法見 [memory README](../.claude/memory/README.md)「入口文件自動檢查」）；期限過了要寫〔結果 YYYY-MM-DD：…〕或刪列（過期只警告、不讓 CI 紅；開場 hook 會提醒）。

與其他文件的分工（mini-taiwan-pulse 是整個 Pulse 生態系的總 PM）：

- **本檔**＝專案層總覽，回答「有哪些專案做到一半、卡在哪」。
- **BACKLOG**（[`.claude/memory/BACKLOG.md`](../.claude/memory/BACKLOG.md)）＝任務層，一列一個可關閉的 ID，依主題群分段（A 正式站目視包 VIS-PACK … N 模擬實驗）。
- **STATUS**（[`.claude/memory/STATUS.md`](../.claude/memory/STATUS.md)）＝只留最近一次發版 checkpoint。
- **`.gis-agent-system`**＝只放 ADR（`decisions/`）與跨 repo 計畫書（`projects/<slug>/`）；roadmap `candidates/` 放資料／圖層候選。SESSION_BOARD、OPEN_QUESTIONS、roadmap `status/` 的 release-queue／backlog／ai-mcp 已停更，見 [memory README](../.claude/memory/README.md)。

狀態圖例：🟢 已上線待收尾｜🟡 進行中｜⏸️ 暫停（含保留中的實驗）｜🔵 待拍板｜⚪ 構想／研究完成未動工

Tier（與 BACKLOG 相同）：`底線:<資安|授權|資料正確|期限|花費|備份>`、`北極星:<效率|兼容|視覺|好用|AI|開發系統>`、`內容:<部落格|挑戰日|研究專題>`、`待討論`。北極星＝效率高、兼容性高、視覺化好、好用的 GIS 資料＋倉儲系統，AI 分析為核心。

## 現在最該注意

**正式站個資止血已完成（PII-1 已關閉，v2.37.1 正式站目視通過；剩舊檔刪除 PII-2）**——愛爾蘭 AED、台灣山崩照片／AED／舊衣回收箱／觀光、長照圖磚、實價登錄備註等公開檔含個資（只記筆數，細節見 BACKLOG D 群 PII-1）。清理 pipeline 已合；清理後檔案未上傳；改讀 `_v2` 的 mini #1043、#1046 已隨 v2.37.0 上線；#1044、#1048 隨 v2.37.1 上線（11-16 正式站目視：10 層改讀 `_v2`、身分證與 email 0 筆、手機格式只在官方電話欄）。後續：PII-2 刪舊檔、PII-3 倉庫重發、PII-4 S3 實價登錄封存重做、PII-5 站主清空垃圾桶。

**2026-11-16 更新**：v2.37.0 已發布（只帶 #1043、#1046；正式站目視 AED `_v2` 與舊衣回收箱快照的手機格式都是 0 筆）；#1044（台灣 7 層，CI 要 R2 先有檔、發版同步只帶 master 已引用的檔，卡循環，等站主在另一視窗決定）、#1048 未進，正式站個資仍未完全解決，需再發一版。**第二輪（11-16）**：已止血＝愛爾蘭 AED、舊衣回收箱（DB、S3 快照、R2 皆已換新）；8 個公開 `_v2` 檔已上 S3。未止血＝台灣 7 層（#1044，7 檔已在 S3、CI 與同步互卡，待站主同意發版前用管理員權限合併）、英愛 3 層（#1048，3 檔未上傳）。另 PII-2 愛爾蘭 AED 舊檔刪除清單已備妥（要等 #1055 進 master，需站主執行或授權）；PII-3 現行倉庫 AED 表仍含 11 筆電話；PII-6 站主限定長照未上雲；PII-7 日本 `raw_record` 欄待決；analytics #392 待審。

**第三輪（11-16）**：#1048 已合 develop `06a17f4a`（3 檔已上 S3）；#1044 以管理員權限合併（`d963d2b4`）；v2.37.1 發版 PR（`release/v2.37.1` → master）已開，`assets`／`ci-ok` 紅是預期（R2 尚未有 `_v2` 檔，CI-10），站主同意以管理員權限合併。

**第四輪（11-16）**：v2.37.1 已發布（#1062 merge `8f0cdd39`，tag／Release 已建，deploy 與 sync-assets 成功）；回合併 #1064 合 develop `67a08418`。master 的 CI 在 `8f0cdd39` 上 assets 仍紅（修正只在 develop，下次發版後轉綠，正式站不受影響，CI-10）。

**下次接手入口（2026-11-16 第四輪）**：PII-2 依序刪 S3、R2 舊檔（愛爾蘭 AED 先，需站主執行或授權）。驗收＝正式站 `main-*.js` 為新版號、各 `_v2` 檔回 200、圖層正常顯示；清理報告 analytics `output/tw_pii_scrub_20261114/REPORT-round5.md`。

**有期限的事（日期排序）**

> 跨時間才能確認的事（隔天重跑 migration 測試、等 cron 首輪、部署後看日報、N 天後查 pg_stat_statements）一律在這裡加一列，**不要只寫在對話、PR 或 BACKLOG 的 blocker 裡**。過期未處理時，開場 hook 會提醒；處理完寫〔結果 YYYY-MM-DD：…〕或刪列。

| 期限 | 事項 | 誰 | BACKLOG |
|---|---|---|---|
| 2026-11-14 | 兩項部署的隔日確認：03:39 備份 reconcile 的 warn 由 31 降到接近 0（collectors #200）；08:00 日報的 VM 區段三支收集器成功數仍正確（07:00 排程自己跑的快照）；同一份日報不再把事件型表（災害示警、落雷）標 DEAD，落雷與災害示警收集器連續錯誤維持 0（collectors #201，11-13 13:56 部署）〔結果 2026-11-16：對帳 warn 11-13、11-14 兩天都是 0；11-15 日報 0 DEAD（11-14 那份仍列災害示警）；落雷與災害示警連續錯誤 0，每天仍有 1–3 次零星錯誤；VM 區段成功數正常。另：針對 11-14 的對帳出現 critical=2，調查中〕〔結果 2026-11-16：critical=2 是兩支颱風收集器在沒颱風時的歸檔落後誤報，由 collectors #204 修（11-16 10:50 已部署，COL-STAG-1）；`pla_tracks_vectorize` 時間差誤報另登記 COL-PLA-1〕 | Claude | BKP-4／VMH-1／COL-ZERO-1 |
| 2026-11-15 | `live.iot_wra_measurements` 確認已降到 30 天內（11-12 約 307 萬列超期、11-13 早上剩約 125 萬列，每晚清 200 萬列）〔結果 2026-11-16：observed_at 超過 31 天的只剩 529 列，都是來源帶舊觀測時間、每輪會再抓進來的資料；collected_at 超期 0 列〕 | Claude | WA-3 |
| ~2026-11-16 | pulse-host 記憶體峰值檢視（collector-mem 觀察中）後決定 mem_limit〔2026-11-16：collector-mem 的 peak 每次重啟後數小時內就到約 2,800 MB（容器上限 2.734 GiB），平常約 1.7 GB；是否為檔案快取調查中〕〔結果 2026-11-16：peak 含檔案快取（上限 2,800M）；扣快取仍到 2.1–2.5 GB；開機以來沒有 OOM；16 支每小時收集器擠在整點後 5 分鐘，嫌疑 `jma_raster`、`global_events`、`cems_stack_monitoring`；主機實體約 3.9 GB、各容器上限已超賣。建議先不調上限，#204 錯開首輪部署後再量〕 | Claude | HOST-1 |
| 2026-11-17 | 菜價指數與選舉活動匯入改固定形狀 SQL 後的首輪確認：菜價指數 06:00 排程 log 第一次用新寫法是否成功、下一次選舉活動每日更新是否通過，之後回看 pgss 沒有超過 100 KB 的查詢文字（gp #242、analytics #372；gis-platform 與 analytics 主 checkout 已於 2026-11-16 快轉，使用者同意） | Claude | SBE-6 |
| 2026-11-17 | data-collectors `3e801d63` 已於 2026-11-16 部署 pulse-host（COL-ZERO-1 尾段：19 支收集器「0 筆且來源拋例外」改記失敗；VM 補寫隔離同日部署到 HiCloud VM 四個 app）。看 11-17 08:00 日報 #203 揪出的失敗收集器並逐支分類（這份日報同時反映 #203 與 #204 兩版，分辨失敗來源時留意）；HiCloud VM 的 waste-positions 首輪寫入正常（ship-ais、isohe 首輪 11-16 已正常） 〔2026-11-16 補：當天 collector 容器重建過 3 次（#204、#206＋#205、聲景開每日 dry-run），記憶體基準從最後一次重建起算；02:40 起多一支聲景每日重建（約 180 MB、88 秒），看 HOST-1 尖峰時要算進去〕 | Claude | COL-ZERO-1／COL-GE-2 |
| 2026-11-17 | collectors #204（11-16 10:50 部署 pulse-host）首輪確認：03:30 對帳 critical 是否歸 0；`tra_static` 的 10-24 舊 error 是否清掉；整點記憶體尖峰是否下降（比對部署前後的記憶體記錄） 〔2026-11-16 補：當天 collector 容器重建過 3 次（#204、#206＋#205、聲景開每日 dry-run），記憶體基準從最後一次重建起算；02:40 起多一支聲景每日重建（約 180 MB、88 秒），看 HOST-1 尖峰時要算進去〕 | Claude | COL-STAG-1／HOST-1 |
| 2026-11-17 | correctional VM 版與 S3 不同，會觸發滯留告警，VM 版另存 `.vm.tar.gz` | Claude | ZB-2 |
| 2026-11-17 | SND-2：核對 pulse-host 02:40 產出的 11-16 聲景每日檔與 log，沒問題就開 `SOUND_ATLAS_LIVE_ENABLED`＋`SOUND_ATLAS_AVIATION_LIVE_ENABLED` 試跑一天；步驟與現況見 `.gis-agent-system/projects/2026-11-11-city-sound-atlas/PLAN.md` W7 列。開關由站主在聲景 session 視窗確認 | Claude＋使用者 | SND-2 |
| 2026-11-18 | FIRE119-1 剩餘確認（11-17 已驗：VM 17 小時 0 次跳過、可用記憶體最低 329 MB、每輪最長 46 秒；DB 119 共 2,169 件、警廣 1,423 筆；07:00 健康快照有 fire119 區塊 770/770 成功）：(1) 03:33 首次歸檔（本機留 2 天，11-16 的資料 11-18 才上傳）後 S3 有 `fire119/archives/`、`pbs_road_events/archives/`，補 S3 lifecycle（archive-deep-270d）與 AWS_INVENTORY；(2) ~~日報讀表~~ 11-17 已驗：兩表已在 data-collectors `realtime_tables.yaml`，`health_snapshot` 讀得到（max_time 正常）；(4) 站主 `/mcp` 重連後確認倉庫 `20261117T065821Z`：越南監測站地址欄電話／email 0、觀光餐飲手機 0、日本警察無 raw_record；(3) 跑 `setup_cron.sh --no-monitor` 關第一天監測 | Claude | FIRE119-1 |
| 2026-11-19 | HiCloud VM cdc-public-health 週四 11:00 首輪（新版 vm_buffer）log 正常 | Claude | COL-GE-2 |
| 2026-11-20 | 回看 pgss：`get_groundwater_latest`、`get_youbike_h3_snapshots` 套用 mig 552／553 後的平均耗時〔結果 2026-11-16：無法判定——pgss 自 11-09 累計，混了 mig 552／553 前後；`get_groundwater_latest` 平均約 0.8 秒（14 次）、`get_youbike_h3_snapshots` 平均 1.7–2.1 秒（19 次）。要判定需重置統計或另做 EXPLAIN；改期到 11-20 再看一次〕 | Claude | SEC-5 |
| ~2026-11-20 | 舊 static layer RPC 觀察 7 天後撤除（原期限 11-15；11-16 這輪沒做，改期，不是已完成） | 使用者拍板 | SR-1 |
| ~2026-11-20 | 動物收容成果收集器確認有新 run（設計低頻，不是故障） | Claude | COL-ANIMAL-1 |
| 2026-11-23 | 資料來源追蹤（ADR-0024）改比對我方基準後第一次週一偵測：03:00 雲端 routine 與 04:30 VM 都成功；新清單「需要更新」只剩基準後真的變的、「待確認」約 200 照列；環境部 api_key 輪替不再觸發、快照成功率 >90%；collector 子狀態出現（mig 558、collectors #210 部署後）；R2 新紀錄不含金鑰原值。計畫 `.gis-agent-system/projects/2026-11-18-source-tracking-phase2/PLAN.md` | Claude | 資料來源追蹤 |
| 2026-12-10 | S3 用量回看：日報 136 GB、週增 +101% 是含舊版本（`warehouse-archive` 約 56.8 GiB、`r2-mirror` 約 8 GiB）；舊版本 30 天過期後應回到約 95 GiB；`r2-mirror` 用途未查 | Claude | ST-3 |
| v2.37.0 發版後 | 正式站確認：救援等時圈 `/fire/fire_isochrone_coverage.pmtiles` 200 且圖層有畫面；`world/ie_defibrillators_v2.pmtiles` 200、愛爾蘭 AED 圖層正常；舊衣回收箱快照 `get_waste_disposal_points.json` 公開版回讀為 13,751 筆、業者欄手機 0 筆；越南目視清單（mini `.worktrees/vn-w01/.preview-keep/vn_prod_visual_checklist.md`）；#1036 未在瀏覽器驗過的三項（日本醫療圈 popup、小網格點擊、手機衛星百科卡） 〔結果 2026-11-16：v2.37.0 已發布，匿名唯讀目視 11 項：9 通過、2 部分通過、0 失敗（截圖 `.gis-agent-system/projects/2026-11-13-vis-pack-batch2/shots-v2370/`）。通過：衛星切底圖、日本醫療圈 popup（川口＝「南部」）、小格網點擊（台灣 H3 人口數、日本 1 km）、手機衛星百科卡可開可關、救援等時圈三段都在、愛爾蘭 AED 營運者欄電話格式 0 筆、舊衣回收箱快照 13,751 筆且業者／聯絡欄手機格式 0 筆、菲律賓 4 層＋越南 12 層冒煙、首頁無 4xx；歷史模式高縮放退回粗網格不報錯。部分通過：INTEL 國碼（Gaza 仍顯示 GZ，VPB-17，mini #1056 已合 develop、待發版）、分享網址（只帶 `?c=ie` 開在台灣，查明是刻意設計，只更正 CHANGELOG 說明，VPB-19 關閉）。新問題登記 VPB-17、VPB-18（修正中，部署待同意）、VPB-20～22、VNW-1，VPB-8 補版面；VP-2、VPB-3／7／9／10／14／19 關閉〕 | Claude | REL-NEXT／VPB-8／VPB-18／VPB-22 |
| v2.37.1 發版後 | 10 個 `_v2` 檔（台灣 7、愛爾蘭 2、英國 1）公開網域 200／206；山崩照片、AED、長照、海巡、觀光三層、愛爾蘭商業估值與活動地點、英國醫療院所畫面正常且說明框不含電話；`?v=1&lng=121&lat=24&z=9&layers=h3Population` 與 popCount 首次載入有網格（mini #1058）、7 層 popup 來源列不再是 pending；Gaza 卡片顯示 PS；develop／master 的 assets 檢查轉綠 〔結果 2026-11-16：v2.37.1 已發布（#1062，master `8f0cdd39`），匿名唯讀目視 A–E 全過（截圖 `.gis-agent-system/projects/2026-11-13-vis-pack-batch2/shots-v2371/`）：10 個 `_v2` 檔公開網域全 206、10 層都改讀 `_v2`、無 4xx／console error；身分證格式與 email 0 筆，手機格式只在官方電話欄（站主決定保留）；`h3Population` 3,993 格、`popCount` 3,970 格首次載入有網格；三個 popup 來源列正常；Gaza Strip 卡片 4 張皆 PS；伊波拉 1 張 CD、約 10 張 CG（舊資料）。develop assets 已綠（#1064），master 在 `8f0cdd39` 上仍紅、下次發版轉綠（CI-10）。PII-1、VPB-17／20／21 關閉；新問題 VPB-28、VPB-29，觀光三層來源列併入 VPB-23〕 | Claude | CI-10／VPB-18／VPB-28 |
| v2.38.0 發版後 | 打 tag／Release；正式站 `main-*.js` 為 2.38.0；lock 新增 16 檔（英國 5、南韓 10、`base_map/road_lines_20261116.pmtiles`）公開網域 200／206；主機重建 coral-private 後站主登入看首爾用途地域、119／警廣（點開路段高亮）；英國 4 層、南韓 10 層目視；master assets 檢查轉綠（CI-10） | Claude＋使用者 | REL-NEXT／FIRE119-1／KRW-6／UKOSM-1 |
| 2026-11-28 | 選舉投票日：之前每日更新活動地圖；選後匯出最後一版轉站主資料 | Claude＋使用者 | OWD-4 |
| 2026-11-28 後 | 選後一起做：選舉活動兩張表登記保留期限、清 22 筆已刪除表的備份狀態紀錄（使用者 2026-11-13 同意；動手前先給清單） | Claude＋使用者 | ELEC-RET-1 |
| 2026-12-01 前 | 使用者取消 Zeabur 專用主機續約 | 使用者 | ZB-5 |
| 2026-12-03 前 | SEC-6 金鑰輪換（22 把換、9 項刪；Claude 前置 C1–C8） | 使用者＋Claude | SEC-6 |
| 2027-03 前 | intel 三表每月匯出 S3 排程（另一 worker 進行中） | Claude | WA-13 |
| 約 2027-05 | vessel_watch_positions 11 月後資料再匯出 S3（180 天保留開始刪） | Claude | VW-EXP-1 |
| 約 2027-05-15 | 監所人數卡片的 365 天視窗會變空（上游 05-15 停更） | 使用者拍板 | PR-1 |
| 2027-10-29 | 英格蘭 EA 污染名錄授權到期 | 使用者 | EA-1 |
| 約 2027-11 | GHCR classic PAT 到期（pulse-host 拉不到映像），未設提醒 | 使用者 | — |
| 持續留意 | OpenRouter 預付餘額（用完 news_events 停寫；collector 用的那把歸 SEC-6，MCP 搜尋 11-10 已換專用新 key）；Cloudflare Workers 免費額度每日 10 萬請求（決定不升級；6 成告警 11-10 已上線，當日實測 12,307，幾乎都來自名為 `mini-taiwan-pulse-staging` 的 Worker）；Access service token 與 CI 的 Cloudflare API token 效期❓未實測 | 使用者 | SEC-6 |

**本週進行中**

- 發版：v2.37.0 已於 11-16 發布（發版 PR #1054，master `3629f1b5`，tag／Release 已建，19 個 PR：#1028–#1036、#1038、#1040、#1041、#1043、#1045–#1047、#1049、#1051、#1052）；lock 新增 30 個資產在正式網域都取得到。v2.37.1 已於 11-16 發布（#1062，master `8f0cdd39`，帶 #1044、#1048、#1055、#1056、#1058 與文件 #1057、#1059–#1061；站主同意管理員合併；回合併 #1064）。v2.38.0 發版準備中（11-17）：帶 #1039＋pulse-data #109、#1042、#1050、#1069（即時 119／警廣，站主限定）、#1073 與文件；#1037 中國、analytics #392 不在本版。
- Zeabur 收尾與金鑰：最後兩個專案使用者 11-13 回報已刪（ZB-1）；剩 ZB-5 停約、SEC-6（BACKLOG B 群）；ZB-4 網域與 ZB-6 主體 11-09 完成。
- 告警分級 11-09 完成（GitHub 排程、主機看門狗、collector、healthchecks 3 個死人開關皆已設）；剩 aisstream／VM 接告警（G 群 ALERT-1）。
- Supabase 效率大掃除 11-09 主體完成（R1–R5、mig 518–533、sql-lint、每週體檢）；11-09 晚第一批權限（gp #227 mig 536–539）與 VM 固定形狀寫入（collectors #194）也完成；11-10 驗證與慢查詢清單 11-12 完成（R5 升為必須；SEC-5 的優化等使用者拍板）；剩預算表（SBE-5）、軌跡改讀每日檔方案（TRAIL-1）、新發現的 RLS／權限（SEC-11／SEC-12／HERMES-2）。
- 站主資料第 3 批（EA、Coillte、water1944）與撤舊 RPC（F 群 OWD-4、SR-1／SR-2）。
- 資料保留期限：第 2 批 11-09 完成（gp #228／#229 mig 540–543、ADR-0026 #57），剩項目在 WA-3；靜態表搬遷乙組（WA-14，動前端前先給使用者看方案）；R2 獨有資料補 S3（ST-2）。
- 2026 選舉活動地圖每日更新（到 11-28）。
- 30 天地圖挑戰：Day 9 城鄉圖層 mapchallengeDay09UrbanRural（#972）、Day 8 文章（#957）與 10 篇舊文補資料來源（#959）已合 develop、待發版；Day 6 正式站重拍（HIST-4）。
- 正式站目視包：11-12 第一批（v2.36.1）通過 8 項已關閉；發現的兩個 bug 已隨 v2.36.2 修正並於 11-13 正式站複驗通過，低嚴重度問題記在 VPB-3～VPB-6（11-13 mini #1034 已修大部分、已合 develop 未發版）；11-13 第二批（v2.36.2）關閉 VP-13～VP-17，新問題開 VPB-7～VPB-13（衛星切底圖消失 VPB-7 最嚴重；mini #1036 修 VPB-7／9／10／14，隨 v2.37.0）；11-16 v2.37.0 正式站目視 9 通過、2 部分通過，關閉 VP-2、VPB-3／7／9／10／14，新問題開 VPB-17～22（GZ 國碼 VPB-17 已由 #1056 修、待發版；分享網址 VPB-19 是刻意設計、已關閉；剛果卡片國碼 VPB-18 修正中、部署待同意）；mini #1058（develop `814d365e`）修 VPB-20 出處 7 層與 VPB-21 網格首次載入空白，待發版；新開 VPB-23～26（VPB-26 出處措辭站主同日確認、已關閉）。⚠️ #1058 加了來源列覆蓋測試，其他開著的新圖層 PR 要先合 develop 再重跑 CI，可能被擋；剩 VP-10～VP-12 等（BACKLOG A 群）。
- 配色與可見性：第一、二段隨 v2.36.0 上線（#998、#1002）；第三階段待做（VIZ-3）；視覺化提案 11-11 已拍板；比例圓 #1008、多年份並排 #1011、左右比較 P1 #1012、點密度 #1016 隨 v2.36.0 上線（VIZ-5／VIZ-8／VIZ-9／VIZ-6）；等值帶使用者決定先不做（VIZ-7）。
- MCP 與倉庫：#107 已部署並冒煙通過；發版關卡（MCP #108～#111）上線；72 表以 DuckDB 1.5.3 重發為 `20261110T084641Z`（pulse-data #104），S3 歸檔與 R2 舊版清理等使用者驗收（WHDB-2）。

## 進行中與待拍板

### 情報、選舉與會員

| 專案 | 狀態 | Tier | 做到哪 | 下一步 | 正本 | 最後進展 |
|---|---|---|---|---|---|---|
| 2026 地方選舉活動地圖（electionEvents2026） | 🟡 | 北極星:好用 | 站主限定圖層隨 v2.21.0 上線（mini #802、analytics #274、gp #194 mig 493/494）；每日資料由使用者叫跑 run_daily.sh（analytics #304 已於 11-08 合併）；位置精度標示隨 v2.31.0 上線（#929，gp mig 514／515） | 投票日 11-28 前每日更新；選後轉站主私人檔（OWD-4）；要開放只改 gated_layers 一列（待決定） | `../taipei-gis-analytics/docs/topic-research/election_events_2026/`；BACKLOG OWD-4 | 2026-11-08 |
| Live wall 影片失效自動切換 | 🔵 | 北極星:好用 | YouTube「無法播放」格子會卡住 | LW-1：先審 onError 切換設計 | BACKLOG LW-1 | 2026-10-16 |
| Google OAuth 品牌驗證 | 🔵 | 底線:資安 | 10-23～24 以「發現的問題有誤」送人工審查 | 等 Google 回覆；被退再考慮 Supabase 自訂網域（付費） | 個人記憶 ctx-handoff（OAuth 段） | 2026-10-24 |
| 主站 CSP 改 enforcing | 🔵 | 底線:資安 | 主站仍 Report-Only（11-08 實測，server=cloudflare），/privacy 已 enforcing | BC-4b：搬 Cloudflare 後實作位置改在 Worker／`_headers`；allowlist 補 gsi.go.jp、jma.go.jp、gis.sinica.edu.tw、NRCan 等，收集違規後再切 | BACKLOG BC-4b | 2026-11-08 |

### AI 與分析

| 專案 | 狀態 | Tier | 做到哪 | 下一步 | 正本 | 最後進展 |
|---|---|---|---|---|---|---|
| Agent 分析能力（ADR-0022 A→B→C） | 🟡 | 北極星:AI | A（空間統計）10-21、B 10-23 上線；多國議題 2 P0–P5 10-29 上線；framingCheck（#881）隨 v2.27.0 上線；11-10：MCP #107 部署、發版關卡（#108～#111）、入倉守門接 CI（#999）、DuckDB 1.5.3 重發（pulse-data #104） | 倉庫重組已完成：倉庫 `20261117T052230Z`（11-17） 上線（新增菲 55／越 43／韓 10／英 5 表、個資表重發、MC-KRIE 與 AGQ-1 生效；殘留題見 WHREORG-2）；WHDB-2 舊版清理（等使用者驗收，重組時不碰 S3 舊版歸檔）；MCPD-2 wh-N 重連後覆寫；DOCWH-1 analytics skill 舊參數；AG-15 外國入倉基礎（英國已完成，剩英國第 1 層與加拿大）；MC-KRIE（MCP #113）與 AGQ-1 兩批（pulse-data #106、#112；KR 20／52、IE 24／70）已合，已隨倉庫 `20261117T052230Z` 生效（11-17）；FR-WH ANFR 表國別；OWNV-1 開放他人使用前的條件；AG-12 排 gateway 部署；C（p-median）未動工。（倉庫 20261110T084641Z 已含愛爾蘭 70、南韓 52、英國 1 張表與四國統計；圖層總表涵蓋全部國家已隨 v2.35.0 上線（#976）；搜尋排序 key 11-10 換新已恢復） | ADR-0022；`../.gis-agent-system/roadmap/status/agent-analysis-runbook.md`；BACKLOG I 群 | 2026-11-16 |
| BYOK 對話預設模型 | 🔵 | 北極星:AI | — | 決定預設是否改中階檔（原 BC-3） | BACKLOG FB-023；[`features/byok-chat/`](./features/byok-chat/) | 2026-10-16 |

### 視覺

| 專案 | 狀態 | Tier | 做到哪 | 下一步 | 正本 | 最後進展 |
|---|---|---|---|---|---|---|
| 圖層配色與可見性 | 🟡 | 北極星:視覺 | 11-10 根因分析後，第一段（#998）、第二段（#1002）隨 v2.36.0 上線；截圖只驗過 4 層 | VIZ-1／VIZ-2 發版後正式站目視；VIZ-3 第三階段（15 面、2 點、約 24 支 hook 寫死暗色、手寫圖例、淡底圖 44 共用色層、約 73 自繪點層）；VIZ-32 點層分類圖例也顯示熱度 Low–High 色條（共用元件、約 62 處），全站設計題待決定 | BACKLOG VIZ-1～VIZ-3 | 2026-11-14 |
| 視覺化功能設計提案 | 🟡 | 北極星:視覺 | 提案 https://claude.ai/artifact/G7qsxVy7Cy3qA1BfZqNs6y ；11-11 Q-A～Q-G 已拍板（VIZ-4 關閉）；統計比例圓 #1008、多年份並排 #1011、左右比較 P1 #1012、點密度 #1016（42 層；敏感指標 8 層不提供；點大小隨縮放列為設計規範例外，使用者 11-12 決定）隨 v2.36.0 上線（比較模式 P0 試驗 draft #1010 不合併、留作紀錄）；等值帶（含氣溫）使用者 11-11 決定先不做 | VIZ-5／VIZ-6／VIZ-8／VIZ-9 發版後正式站目視；多年份並排後續 VIZ-12～VIZ-17、比較模式後續 VIZ-18～VIZ-26、點密度後續 VIZ-27～VIZ-31；VIZ-7 等值帶暫緩（使用者決定）；VIZ-10 可信度紋理只登記；待使用者：VIZ-11 構想待表態 | BACKLOG VIZ-5～VIZ-31 | 2026-11-12 |

### 資料新鮮度、collector 與平台維運

| 專案 | 狀態 | Tier | 做到哪 | 下一步 | 正本 | 最後進展 |
|---|---|---|---|---|---|---|
| Zeabur 停止營運搬遷收尾 | 🟡 | 底線:花費 | **搬遷全部完成**（11-09 已刪 13 個靜態站、不搬服務與 11 個空專案，只剩 mini-tw-pulse、data-collectors-gomn 兩專案留作回滾）：靜態站 10-29；主站、research-gateway、Valhalla 11-06（Cloudflare Worker＋Linode pulse-host）；collector 已搬 pulse-host（collectors #170／#171／#175–#180），correctional 移 HiCloud VM；Zeabur 26 服務已 suspend、變數已刪；zeabur README 11-08 已更新、flight-arc-graph #24 已合併 | ZB-1 刪最後兩個回滾專案（~11-14，須使用者同意）→ ZB-5 停約（12/1）→ SEC-6（12/3）；ZB-6 Zeabur 殘留根治剩餘項；ZB-7 uk-trip DNS（主站網域改 Worker 已於 11-09 完成） | BACKLOG B 群；`../.gis-agent-system/projects/2026-10-zeabur-migration/`；ADR-0026 | 2026-11-09 |
| collector 健康修正（data-collectors #203／#204） | 🟡 | 底線:資料正確 | #203（`3e801d63`）11-16 部署 pulse-host，HiCloud VM 四個 app 換新版 `vm_buffer.py`；#204 合 main `e4135c40`（首輪錯開 15 分、颱風閒置不檢查歸檔、補心跳、0 筆帶錯誤改記失敗、S3 用量改比 7／30 天前），站主同意後 11-16 10:50（台北）部署 pulse-host，容器 healthy、版本回讀一致；同日再部署 `efd4c2d6`（#206 剛果誤定位修正、#205 城市聲景即時管線開關全關），容器 healthy | COL-STAG-1 11-17 驗證（對帳 critical、`tra_static`、記憶體尖峰）；VPB-18 驗收新進伊波拉候選顯示 CD（VPB-27 blocked）；COL-ZERO-2、COL-TYPHOON-1、COL-PLA-1 剩餘項；HOST-1 #204 部署後重量記憶體 | BACKLOG E 群 COL-STAG-1 | 2026-11-16 |
| 資安稽核後續 | 🟡 | 底線:資安 | 10-17 稽核、多項 migration 已套（含 mig 502）；gp #170 已於 10-17 合併；11-09 第一批權限（gp #227 mig 536）與 iCHEF 客戶編號檔移出完成 | SEC-6 擴大版（12/3 前，計畫書 `.gis-agent-system/projects/2026-10-zeabur-migration/healthcheck-20261108/SEC-6-rotation-plan.md`）；SEC-7 只剩在 pulse-host 設 `PULSE_RESEARCH_TRUSTED_PROXY_IPS` 並驗證；SEC-4、SEC-5、SEC-9；SEC-11／SEC-12 | `../gis-platform/docs/research/2026-10-17-security-audit.md`；BACKLOG D 群 | 2026-11-08 |
| 正式站個資清理 | 🟡 | 底線:資安 | 11-14 掃描發現公開檔含個資；清理 pipeline 已合（analytics #381、#384、#385、#386、#388；mini #1045）；前端改讀 `_v2`：#1043、#1046 隨 v2.37.0 上線（11-16 正式站目視：AED 與舊衣回收箱手機格式 0 筆）；#1044、#1048 隨 v2.37.1 上線，11-16 正式站目視通過（PII-1 關閉） | PII-2 刪舊檔（愛爾蘭 AED 先；其餘 10 個舊檔清單未做）；倉庫個資重發與日本警察 raw_record 移除已隨倉庫 `20261117T052230Z`（11-17）完成；PII-4、PII-5 | BACKLOG PII-2、PII-4、PII-5；analytics `output/tw_pii_scrub_20261114/REPORT-round5.md` | 2026-11-16 |
| 資料保留期限（Supabase／R2／collector 最長 6 個月） | 🟡 | 底線:期限 | 使用者 2026-11-07 拍板；gp #208／#212 mig 505–510 已於 **11-07 晚套用**（510 drop 20 張冷存表，約少 3.77 GiB；冷存檔在 S3 `supabase-export/`） | 清理首跑 11-12 已驗（5 晚無失敗），iot_wra 約 11-14 追平；第 2 群約 21＋22 張表（WA-3）；DB-1 晚間補表大小 | BACKLOG WA-3；ADR-0026 | 2026-11-08 |
| R2 獨有資料補回 S3 | 🟡 | 底線:備份 | warehouse packages 約 6 GB、pulse-staging `_detect` 約 1.09 GB、`sim/v1` 只在 R2；補傳進行中 | ST-2：補完後在產生流程尾端加上傳 S3；ADR-1 補正 ADR-0026；還原演練 BKP-1（Supabase 還原到新專案，需使用者操作）、BKP-2（pulse-host 從零重建）、BKP-3（`auth.users` 進 S3 備份） | BACKLOG ST-2／ADR-1／BKP-1～3 | 2026-11-10 |
| 站主資料改存法（owner-data） | 🟡 | 底線:授權 | 第 1 批畜牧（v2.28.0）、第 2 批能源與石化（v2.29.0）上線並經使用者驗收；mig 514／515 撤 14 支 RPC | OWD-4 第 3 批（EA、Coillte、water1944；選舉活動 11-28 後）；SR-1 撤 static RPC（~11-20，原 11-15 未做）、SR-2 | `../.gis-agent-system/projects/2026-10-zeabur-migration/owner-only-storage-plan.md`；BACKLOG F 群 | 2026-11-08 |
| 開發系統與告警整併 | 🔵 | 北極星:開發系統 | 健檢完成（自動化清單 A1–A15）；11-09 branch protection、hook 修復；11-10：入口文件檢查（#997）、開場落後提示（#1003）、required `ci-ok`、7 repo Dependabot alerts、四個守門排程（#999）、pulse-data／MCP 補 CI、sql-lint L3（gp #238）、開場瘦身第一輪（52.9K→31.3K 字，模擬值） | ALERT-1 剩 aisstream／VM 接告警；CI-8 Dependabot 已回讀（analytics 0、gis-platform 1 low），`dependabot.yml` 待決；DEV-4 瘦身剩項；DEV-5 個人全域 CLAUDE.md 待決；DEV-7～12、CI-6、MCP-3；ASSET-1 215 檔補進 lock；SQLL-2 文件補寫 L3；DISK-1 package-cache 整併 | BACKLOG G 群 | 2026-11-10 |
| 資料來源追蹤一條龍（ADR-0018／0024） | 🟡 | 底線:資料正確 | pulse-data #45：606 筆偵測清單，`_detect/changes/` 開始累積；週一 03:00 routine＋VM 04:30 | Phase 2 等 2–4 週數據；61 筆 draft 欄位待補；確認 11/2 起 VM 每週自動清單有在跑（`update_list.py --pull`）；collector run receipt 未做 | `../.gis-agent-system/decisions/0024-source-tracking-and-change-log.md` | 2026-10-29 |

### 多國圖層

| 專案 | 狀態 | Tier | 做到哪 | 下一步 | 正本 | 最後進展 |
|---|---|---|---|---|---|---|
| 南韓後續 | 🟡 | 北極星:好用 | 第 0–7 波＋統計已上線；第 8 波 8 層（#983）、第 9 波 3 層（#987）、每萬人火災／交通事故（#978）隨 v2.35.0 上線；第 0–9 波 52 層已在倉庫 20261110T084641Z；第 10 波 11 層資料與 registry 已合（analytics #371、#373、#374、#380；pulse-data #111），前端 mini #1042、首爾用途地域站主限定 #1050 已合 develop（10 個圖磚已上 S3、10 包已發 R2 pulse-data #114、私有圖磚已在私有 bucket），隨 v2.38.0 發版；站主已決定名稱、過期許可、偏移座標照現況保留並加註 | KRW-6：v2.38.0 發版後正式站目視、第 10 波已入倉（11-17）；第 11 波等 data.go.kr key；KRH-1、C086 尚無實作 PR | BACKLOG KRW-6／KRH-1；`../.gis-agent-system/projects/2026-11-multi-country-night/PLAN.md` | 2026-11-16 |
| 日本後續 | 🔵 | 北極星:好用 | P1 第 1–4 波隨 v2.15.0；第二輪隨 v2.24.0；交通事故 2025、DID z5 隨 v2.25.0；市町村道 jpMunicipalRoads（#988，6 地區分檔）、事故期間口徑改字（#986）隨 v2.35.0 上線；11-14 JPACC-1 查證：本票＝當年計入統計口徑（與警察庁年度件數一致），圖例改字 mini #1040 隨 v2.37.0 發版（待正式站驗證） | JPACC-1 v2.37.0 上線後正式站目視再結案；JPW4-1 等填 WAM NET 表單；第二輪重掃待選落地波次 | BACKLOG JPACC-1／JPW4-1；`../taipei-gis-analytics/docs/topic-research/japan_opendata/_status.md` | 2026-11-16 |
| 英國後續 | 🔵 | 北極星:好用 | 第 0–12 波隨 v2.18.0；UKLZ-1／2 熱區實為 #784 隨 v2.19.0；11-10 夜 UKD-1 各項結案（analytics #339）、補測試 #979；高爾夫點蓋熱區使用者 11-10 決定維持現狀；11-13～14 UKOSM-1 資料（analytics #378、#379，PBF 快照 2026-11-13）已合 | UKOSM-1：mini #1039、pulse-data #109 已合（5 個圖磚已上 S3、5 包已發 R2），隨 v2.38.0 發版，發版後正式站目視；B 級線寬站主選 C（z10 1.5px／z14 2.5px）；UKFLOOD-1 擴英國時做；UKW13-1 第 13 波四把 key（使用者申請）；AG-15 國家面板 64 層尚未入倉；EA-1 授權 2027-10-29 到期 | BACKLOG UKFLOOD-1／UKOSM-1／EA-1 | 2026-11-16 |
| 中國 | 🟡 | 北極星:好用 | 11-10 跨夜盤點：系統盤點排進第 0–7 波 33 層、暫緩 90；第 0–1 波資料端已合（analytics #370、#377；pulse-data #107、#108）；gis-platform #243 mig 554 已套用正式站（`gated_layers` 10 列＝9 個 cn key＋krSeoulZoning）；9 個私有圖磚上傳狀態未查證（兩份紀錄矛盾，下次接手先唯讀確認） | CNW-0：mini #1037（與 develop 衝突）解衝突、站主本機截圖檢查後合 → 發版（重建 coral-private 映像）→ pulse-host 重建容器並調 `mem_limit`（現 768m，建議 1024m，站主未定 1GB 或 1.5GB；Access token 過期需站主登入）→ 站主開 9 層＋珊瑚／日本水／BSS 確認；不含台港澳、爭議區不畫、不入倉 | BACKLOG CNW-0／HKMO-0；`../taipei-gis-analytics/docs/topic-research/china_opendata/waves/PLAN.md` | 2026-11-16 |
| 菲律賓 | 🟡 | 北極星:好用 | 11-10 跨夜盤點＋系統盤點 → P1 22、排進第 0–11 波 70 層；第 0–1 波 10 層（mini #1033、analytics #369、pulse-data #105、MCP #112）與第 2 波（analytics #387／#390／#391／#393、pulse-data #113、mini #1047、#1049）已合 develop，隨 v2.37.0 上線，11-16 正式站冒煙 4 層通過；5 個圖磚與 3 個資料包已上 R2；phStations 476 站（未通車 37 站已排除） | 已入倉（11-17）；analytics `layer-mapping/outcomes.csv` 補第 2 波；C117、C123 等使用者填表（PHGEO-1） | BACKLOG PHW-0／PHGEO-1；`../taipei-gis-analytics/docs/topic-research/philippines_opendata/waves/PLAN.md` | 2026-11-16 |
| 越南 | 🟡 | 北極星:好用 | 11-10 跨夜盤點＋系統盤點：分母新制 34 省／3,321 社；排進第 0–8 波 50 層、暫緩 76；第 0–1 波 12 層隨 v2.37.0 上線，11-16 正式站冒煙通過（analytics #375、#382／#383／#389；pulse-data #110；MCP #114；mini #1038）；12 個資料包＋圖磚已上 R2（6 個為 `_v2`） | VPB-22 清單外兩項（切回台灣不殘留、375 寬）未驗；VNW-1 兩筆監測站地址與位置不符；已入倉（11-17）；主權爭議改做全球版 WDISP-1 | BACKLOG VNW-0／VNW-1／WDISP-1；`../taipei-gis-analytics/docs/topic-research/vietnam_opendata/waves/PLAN.md` | 2026-11-16 |

### 台灣圖層

| 專案 | 狀態 | Tier | 做到哪 | 下一步 | 正本 | 最後進展 |
|---|---|---|---|---|---|---|
| 古地圖（臺灣百年歷史地圖） | 🟡 | 底線:授權 | 11-06 改公開（v2.26.0）；#882 拆成歷史底圖 6 層隨 v2.27.0 上線（85 張，CC BY-NC）；11-12 正式站目視通過（v2.36.1） | 主站 CSP enforcing 時補 gis.sinica.edu.tw；HIST-1 授權信：**使用者 2026-11-08 決定暫不寄，不要再催**（研究成果搬進 git 已於 11-09 完成） | BACKLOG HIST-1；`src/data/historicalMapSinica.ts` | 2026-11-10 |
| 30 天地圖挑戰（#30DayMapChallenge） | 🟡 | 內容:挑戰日 | Day 4–6、Day 8 圖層已公開；Day 7、Day 8 獨立站（mapchallenge-mrt／mapchallenge-utopia.itsmigu.com）；部落格總覽頁與 Day 3–7 文章已上線；Day 8 圖層隨 v2.32.0（河濱口徑）、Day 8 文章 #957、Day 9 城鄉圖層 #972（下拉切 10 指標，素材 analytics docs/topic-research/mapchallenge_2026_day09_urban_rural/）已合 develop 待發版；所有文章文末有資料來源（#959）；analytics #330 已合 | 發版後正式站目視 Day 8 文章與 Day 9 圖層（圖例、popup、指標切換）；HIST-4 Day 6 正式站重拍；D8-1 分享網址記方案（FE-01 已併入）；GBA-1 | CHANGELOG v2.23.0～v2.32.0；`src/blog/mapChallenge.ts`；`docs/features/blog/article-plan.md` | 2026-11-09 |
| G27 臺北市局處公務統計 | 🟡 | 北極星:好用 | 部分隨 v2.13.0 上線 | BLOG-V 目視；PDF 獨有表 | candidates/G27；BACKLOG BLOG-V | 2026-10-24 |
| G32 熱島與高溫曝露 | 🟡 | 北極星:好用 | queued；涼適點、熱傷害排進 TWL-5 第二批 | TWL-5 災害暴露組（使用者說晚點再處理） | candidates/G32；BACKLOG TWL-5 | 2026-10-29 |

### 模擬實驗

| 專案 | 狀態 | Tier | 做到哪 | 下一步 | 正本 | 最後進展 |
|---|---|---|---|---|---|---|
| City Sound Atlas 城市聲景（實驗） | 🟡 | 內容:研究專題 | 前端在本機分支 `feat/city-sound-atlas-mvp`（未 push）；即時管線 data-collectors #205 已合併、已隨 `efd4c2d6` 部署；11-16 開每日 dry-run（`SOUND_ATLAS_DAILY_ENABLED`，只寫主機本機），其餘開關仍關 | 每日 dry-run 已開（11-16，UPLOAD 仍關）；SND-2～SND-4 依序開即時 dry-run → 上傳 → 前端接線（每步站主在該 session 視窗確認）；SND-5 站主待決 | `../.gis-agent-system/projects/2026-11-11-city-sound-atlas/PLAN.md`；設計 data-collectors `docs/sound-atlas-live/DESIGN.md`；BACKLOG SND-2～5 | 2026-11-16 |
| 雙北大眾運輸可及性（含臺中、臺南、高雄） | 🟡 | 北極星:AI | 雙北 #810 上正式站；三市 11-04 算完、analytics #323 已合；雙北重算 P1 完成、P2／P3 未跑；11-12 正式站目視通過（v2.36.1） | TA-3 三市上網站形式（待決定）；TA-2 雙北雲端重算（TA-6 已併入，待使用者說跑） | `../taipei-gis-analytics/docs/topic-research/transit_access/_status.md`；BACKLOG N 群 | 2026-11-06 |

## 已上線待收尾、暫停、構想

<details>
<summary>🟢 已上線待收尾（多數只剩正式站目視，集中在 BACKLOG A 群）</summary>

| 專案 | 狀態 | Tier | 做到哪 | 下一步 | 正本 | 最後進展 |
|---|---|---|---|---|---|---|
| 國內新聞圖層維運 | 🟢 | 底線:資料正確 | 2026-06 已上線 | NEWS-1：在 pulse-host（Linode 東京 IP）驗自由時報 RSS 是否可抓 | BACKLOG NEWS-1；[`features/news/`](./features/news/) | 2026-11-10 |
| 衛星主控台改版收尾（#533） | 🟢 | 北極星:視覺 | 最早含在 v2.5.0；正式站目視 11-13 暗／淡主題通過、11-16 v2.37.0 切底圖與手機百科卡通過（VP-2 關閉） | VPB-8 手機主控台入口與百科卡版面（待使用者決定） | [`features/satellite-console-restyle/README.md`](./features/satellite-console-restyle/README.md) | 2026-11-16 |
| 選舉圖層第二批（投開票所、2026 議員選區、歷屆統計） | 🟢 | 北極星:好用 | mini #807／#811／#816 隨 v2.22.0；gp #197 mig 496／498 已套用；11-12 正式站目視通過（v2.36.1） | — | CHANGELOG v2.22.0 | 2026-11-04 |
| 會員區 v1（Google 登入、配額） | 🟢 | 北極星:好用 | 前端 #220、gp #98（mig 408）；v2.12.0 可自行刪帳號 | VP-11 真實 Google 登入／多裝置；BC-2 收藏＋chat_logs 未動工 | [`features/member-area/`](./features/member-area/) | 2026-10-23 |
| 愛爾蘭 | 🟢 | 北極星:AI | 第 0–10 波＋統計＋Coillte 隨 v2.26.0／v2.27.0；70 表入倉（倉庫 20261110T084641Z）、IEADD 6 層（#985）隨 v2.35.0 上線、統計 5 筆已進倉 | MC-KRIE（MCP #113）、AGQ-1 兩批已隨倉庫 `20261117T052230Z`（11-17）生效；IECOI-1 站主目視；Limerick 淹水分區憑證修好後重試 | analytics `ireland_opendata/waves/PLAN.md`；BACKLOG H2 群 | 2026-11-13 |
| 加拿大第 0–3 波＋統計 | 🟢 | 北極星:好用 | 第 0–3 波＋統計＋即時地震隨 v2.22.0～v2.26.0；review 兩項（縮放範圍、衍生標示）11-10 查證後不用改；11-12 正式站目視通過（v2.36.1）（抽樣，第 0 波未抽）；11-13 CALODE-1 上圖前查核完成（analytics #376） | CALODE-1：7 筆執業者姓名改成機構類型、9 點白名單，改 pipeline 後接前端（尚未開工）；第 2 波建物 HOLD；CAC002-1 海域來源二選一（等使用者）；行政界未入倉（AG-15） | analytics `canada_opendata/waves/PLAN.md` §4–5 | 2026-11-16 |
| 多國化議題 1 收尾 | 🟢 | 北極星:兼容 | 國家主體化隨 v2.16.0；主題識別名拆分查證已由 #733 完成（11-10 關閉） | MC-3 目視 | BACKLOG MC-3 | 2026-11-10 |
| 多國化議題 2 收尾（MCP 跨國） | 🟢 | 北極星:AI | P0–P5 10-29 上線；countries.json 11-07 補 KR／CA／IE（MCP #98） | MC-6 補 name_en；MC-7 拆 airspace／coral 表；MC-8 觀察 eval 不穩點 | `../.gis-agent-system/projects/2026-10-multi-country/PLAN-topic2-mcp.md` §5 | 2026-11-07 |
| 主題分類統一（TWL-12） | 🟢 | 北極星:好用 | 6 題全部完成：#910（v2.28.0）、#912（v2.29.0）、MCP #100 | STAT-SYNC-1 稽核 parser 待選來源 | BACKLOG STAT-SYNC-1 | 2026-11-08 |
| G10／G16／G20／G23（金融、國營事業、健康行為、文化幣） | 🟢 | 北極星:開發系統 | #688–#690 merge commit 均在 v2.14.0（健檢 git tag --contains）；roadmap frontmatter 仍寫 in_progress | 改 frontmatter 為 live 或寫剩餘項 | roadmap `candidates/G10`、`G16`、`G20`、`G23` | 2026-11-08 |
| G33 海洋保育補接 | 🟢 | 北極星:好用 | #735 已於 10-29 合併並隨 v2.18.0 上線（舊表誤寫「沒有圖層接」） | roadmap frontmatter 改 live | candidates/G33 | 2026-11-08 |
| G29 淹水即時與情境（含多情境） | 🟢 | 北極星:好用 | 方向 A：10 情境切換（#737）已上線 | TWL-5 雨水下水道；TWL-7 縣市×情境統計層；TWL-6 即時降雨 collector（可排） | candidates/G29；BACKLOG TWL-5／6／7 | 2026-10-29 |
| G34 治安與交通執法 | 🟢 | 北極星:好用 | 測速照相換新版（#736）；TWL-3 popup 標題已修（89571efc） | TWL-5 各縣市科技執法 | candidates/G34；BACKLOG TWL-5 | 2026-11-08 |
| G35–G37 第二輪補強 | 🟢 | 北極星:好用 | TWL-8／9／10 隨 v2.19.0 上線 | TWL-15 只剩 (3) 村里教育程度統計、(4) 地質敏感區／暴潮線；frontmatter 改 live | BACKLOG TWL-15 | 2026-11-01 |
| 土壤液化（站主限定） | 🟢 | 底線:授權 | #407、#408 上線（09-29） | VP-10 站主目視；MCP 題庫 PR #27 保留（draft） | [`features/soil-liquefaction/handoff.md`](./features/soil-liquefaction/handoff.md) | 2026-09-29 |
| 靜態資產版本化（R2 layers/v1） | 🟢 | 北極星:效率 | 讀取端 #700 隨 v2.14.0；試點 immigration_offices、dui_crash_points v1 | VPB-11 讀取端備援；批 2 起遷移（DESIGN §4）；與 public 資料檔移出 git（已完成）的 R2 正本是否合流待決定 | `../.gis-agent-system/projects/2026-10-static-asset-versioning/` | 2026-10-25 |
| 國道逐車模擬（G39） | 🟢 | 北極星:視覺 | #814 隨 v2.22.0；MCP #95 已部署；11-12 正式站目視通過（v2.36.1） | 跟車減速 wip 暫停中（決定續或封存） | `../taipei-gis-analytics/docs/topic-research/freeway_tdcs/_status.md` | 2026-11-04 |
| 全台交通可及性 | 🟢 | 北極星:視覺 | v2.20.0 上線（#801），使用者確認效果 OK | 兩層同開時點擊只跳網格 popup（已知問題）；色階細分、雙北尺度方向未選 | `../taipei-gis-analytics/docs/topic-research/transit_reach/_status.md` | 2026-11-02 |
| 公車擁擠模擬 | 🟢 | 北極星:AI | #701 隨 v2.14.0 上線（站主限定） | VP-10 站主目視 | `../taipei-gis-analytics/docs/topic-research/bus_crowding/` | 2026-10-25 |
| AWS 雲端運算工具 cloud_run | 🟢 | 北極星:開發系統 | analytics `tools/cloud_run/`＋skill `cloud-run`；11-06 smoke 兩項通過；隨 analytics #323 合併 | TA-4 測 Spot 中斷接續（S3 測試檔去留已決定不追蹤） | analytics `tools/cloud_run/README.md` | 2026-11-10 |
| 地圖圖層改版 R6 | 🟢 | 北極星:視覺 | 段 1–3 隨 v2.8.0 上線 | R6-V 目視；段 4 R6-4 暫不碰 | [`features/map-layer-restyle/R6-PROPOSAL.md`](./features/map-layer-restyle/R6-PROPOSAL.md) | 2026-10-15 |
| 地圖基礎 GIS 元件（指北針、量測、右鍵） | 🟢 | 北極星:好用 | #803／#804 隨 v2.21.0；#808 隨 v2.22.0 | GUI-2：手機實機觸控、真實定位、實體雙擊；GUI-3／4 待決 | BACKLOG GUI-2～4 | 2026-11-04 |
| 地圖可見性整修 | 🟢 | 北極星:視覺 | v2.19.0；#795 隨 v2.20.0 | VIS-3 剩餘目視 | [`design-system/map-layers.md`](./design-system/map-layers.md) §3.8 | 2026-11-01 |
| 多語系 i18n | 🟢 | 北極星:兼容 | P0–P5 隨 v2.9.0 | P4-C（Agent 依網頁語言回答）、I18N-1 統計說明段落英日文（未開工；南韓圖層英日文逐層驗是另一項，已由 #986 完成） | [`features/i18n/ROADMAP.md`](./features/i18n/ROADMAP.md) | 2026-11-13 |

</details>

<details>
<summary>⏸️ 暫停（含保留中的實驗：POC 草稿 PR、未合併 worktree 一律留存不關）</summary>

| 專案 | 狀態 | Tier | 做到哪 | 下一步 | 正本 | 最後進展 |
|---|---|---|---|---|---|---|
| 新聞地點證據 shadow 面板（POC） | ⏸️ 保留 | 待討論 | draft：mini #427、gp #128（migration 須重編號）、collectors #117；mini #425 已於 10-17 合併 | 使用者決定全部留存（2026-11-08）；要重啟再看 CL-3 | BACKLOG CL-3 | 2026-10-03 |
| 國際媒體台灣情資 feed（GDELT，POC） | ⏸️ 保留 | 待討論 | draft：mini #426、gp #127、collectors #116 | 同上 | BACKLOG CL-3 | 2026-10-03 |
| Monitor 可拖曳版面 | ⏸️ 保留 | 待討論 | 本機分支 feat/monitor-grid-layout、feat/monitor-widgets-batch1 已於 10-18 依使用者「2甲」刪除，bundle 備份在 `GIS/_worktree-backups/2026-10-18/` | 要重啟時從 bundle 還原 | BACKLOG 已關閉 G015（實驗留在 bundle）<!-- entry-docs-ignore closed-id: 刻意註明已關閉、實驗留在備份 --> | 2026-10-18 |
| gis-platform portal（Next.js 個人管理介面） | ⏸️ 停用 | 待討論 | 9 月後未更新；main 上 build／lint 失敗、CI 不建置、原部署在 Zeabur；Dependabot 漏洞已清到剩 1 個 low（gp #239） | 使用者 11-10 決定標記停用、不要移除；不修建置、不封存 | `../gis-platform/` portal 目錄 | 2026-11-10 |
| 情報牆（mini-taiwan-intel） | ⏸️ | 待討論 | 資安稽核 C1 完成（mig 477、站主登入才可寫） | W30 計畫 §3、§6 待拍板項；W2：「否決關聯」改標 rejected | `../.gis-agent-system/projects/2026-W30-intel-wall/` | 2026-10-17 |
| Monitor 四域子指數／壓力指數重建 | ⏸️ | 待討論 | 規格 §5.35 I2 已有，無觸發 | MON-P6：決定重啟後先寫公開權重與基期提案 | BACKLOG MON-P6 | 2026-10-16 |
| 衛星主控台歷史模式機動清單 | ⏸️ 保留 | 待討論 | 2026-10-04 擱置；gp 分支 `feat/satellite-maneuvers-anchor` 本機 commit 未 push | SAT-Z3：解除擱置後先過三項核准 | BACKLOG SAT-Z3 | 2026-10-16 |
| 站主限定圖層機制（owner-gated） | ⏸️ | 北極星:好用 | 機制已上；UI 鎖類型尚無實際圖層 | 目前無待辦：原「有第一個 ui 鎖圖層時驗完整鏈」在 11-09 封存清單判定過時關閉；真的出現 ui 鎖圖層時另開列 | [`features/owner-gated-layers/`](./features/owner-gated-layers/) | 2026-11-10 |
| 移民署金門／連江座標錯 | ⏸️ | 底線:資料正確 | 上游資料兩點座標是台北 | 等上游修正後發 v2 | 個人記憶 ctx-handoff | 2026-10-25 |
| 閃電快照遺失／縣市彙總 | ⏸️ | 底線:資料正確 | DS-01 等改 env 拍板（collector 已在 pulse-host）、DS-04 ready | DS-04：mig 505–510 後重查縣市面表 | BACKLOG DS-01／DS-04 | 2026-10-05 |
| A1 事故 feed | ⏸️ | 底線:資料正確 | 上游凍結在 2026-06 | 另找資源或標示非即時 | BACKLOG DS-02 | 2026-10-05 |
| 交通 feed 假健康 | ⏸️ | 底線:資料正確 | 10-05 調查後未重驗 | BL-25：搬 pulse-host 後重跑一次健康調查再拆小項 | BACKLOG BL-25 | 2026-10-05 |
| G38 全國都市計畫區邊界 | ⏸️ | 底線:授權 | 授權不明 | TWL-13：寄信問國土署／國土測繪中心 | BACKLOG TWL-13 | 2026-10-31 |
| 情境推演／數位雙生（G28） | ⏸️ | 北極星:AI | P1 靜態鏈已合 analytics #225，主站沒接 | P2 八仙回測或封存（待拍板） | candidates/G28；`../taipei-gis-analytics/docs/topic-research/digital_twin/REPORT.md` | 2026-10-26 |
| 橋梁韌性 | ⏸️ | 內容:研究專題 | 全臺 v5 上線；雙北 73 座，其中 47 座待複核 | 複核 47 座或封存 | `../taipei-gis-analytics/pipelines/analysis/bridge_resilience/README.md` §0 | 2026-10-24 |
| GIS 圖台 plugin（gis-map-kit） | ⏸️ | 待討論 | 課程版、公開版皆已發布 | 處理 inventory/_OPEN_QUESTIONS.md 未決項 | `../gis-map-kit/` | 2026-10-31 |
| CCTV×YOLO 機車微調 | ⏸️ 保留 | 待討論 | 10-02 資料全失、10-07 重建 worktree；10-21 收集結束；r2 標註批次已備好 | 決定本機訓練或封存（worktree 留存） | 個人記憶 cctv-finetune-status-ref | 2026-10-21 |
| CCTV 鏡頭朝向 | ⏸️ 保留 | 待討論 | 判完 537／4,697 支；兩個分支未 push | 先 push 分支保全成果；等 Codex 額度接續（Claude 模型驗證不過，不可投票） | analytics worktree `cctv-url-fix-20261002` 的 `cctv_heading/STATUS.md` | 2026-10-17 |
| Pulse 筆記 /blog | ⏸️ | 內容:部落格 | v2.13.0 上線；一般長文暫停，只照 30 天地圖挑戰產文 | BLOG-1 conditional；BLOG-V 目視；SEO-5 看 Search Console | [`features/blog/article-plan.md`](./features/blog/article-plan.md) | 2026-11-07 |
| mini-taiwan-stories | ⏸️ | 內容:研究專題 | 08-23 開 repo，第一篇台鐵 | 內容重心已轉到 /blog；是否封存待確認 | 個人記憶 mini-taiwan-stories-status-ref | 2026-08-23 |

</details>

<details>
<summary>⚪ 構想／研究完成未動工</summary>

| 專案 | 狀態 | Tier | 做到哪 | 下一步 | 正本 | 最後進展 |
|---|---|---|---|---|---|---|
| SEO／AEO 實質內容頁 | ⚪ | 內容:部落格 | 11-08 實測 GPTBot 取首頁回 200（舊表寫 403 已不成立；搬 Cloudflare 後需再看 AI Crawl 設定） | SEO-6 等 SEO-5 收錄結果；SEO-4 補 og:image | BACKLOG SEO-4～6 | 2026-11-08 |
| Intel 面板三個計數不一致 | ⚪ | 北極星:好用 | 已定位：標頭只算新聞、「全部」含警報、AlertSummaryBar 沒套 RANGE | IN-1：統一計數口徑後修 | BACKLOG IN-1 | 2026-10-16 |
| Monitor 小項（警報序列增量、TRA 格座標、匯率卡、聊天釘選） | ⚪ | 待討論 | 只有定位，未動工（OG-5 已決定維持現狀） | G025、TD-3（匯率卡、聊天釘選已於 11-08 決定不做、關閉） | BACKLOG 同 ID | 2026-11-10 |
| 分析倉庫收尾小項 | ⚪ | 北極星:AI | — | AG-2、AG-11、RV27-2（layer-status 差約 159 層）、TWL-4、JMA 入倉延後；MCP #27 土壤液化題庫 draft 保留 | BACKLOG I 群 | 2026-10-29 |
| 靜態 LST 更新 | ⚪ | 底線:資料正確 | 已過 10-01 門檻，可做 | 重跑 LST pipeline | BACKLOG MC-5 | 2026-10-05 |
| 法國 | ⚪ | 待討論 | 國家選單已有 FR（v2.16.0），圖層只有 ANFR 無線站點；MCP 缺邊界與人口 | 決定要不要開 `france_opendata`；最低門檻：countries 一筆＋admin1 邊界＋人口分母 | `../pulse-data/docs/new-country-onboarding.md` §4 | 2026-11-07 |
| G30 災情、避難與民防 | ⚪ | 北極星:好用 | 研究完成；避難容量衍生層排在 TWL-5 | B 部分需 collector（TWL-6，可排） | candidates/G30 | 2026-11-08 |
| G31 飲用水源與污染 | ⚪ | 北極星:好用 | queued | 照 G31「下一步」 | candidates/G31 | 未查證 |
| 次優先候選（TWL-14）＋ researched 群 | ⚪ | 北極星:好用 | researched：G01／03／05／06／07／09／11–15／18／21／22／24–26；TWL-14 是多縣市拼接清單（與 roadmap 重複，BACKLOG 列已於 11-08 關閉，留 roadmap） | 有空時挑一群排批次 | candidates/_index.md | 2026-10-31 |
| OSINT 研究體系擴充 | ⚪ | 待討論 | 研究結論只在記憶裡 | 等決定是否做；建議先做以統一編號為核心的法人實體表（FtM 格式） | 個人記憶 ctx-handoff（2026-10-30） | 2026-10-30 |

</details>

## 其他／衍生專案

| 專案 | 狀態 | Tier | 做到哪 | 下一步 | 正本 | 最後進展 |
|---|---|---|---|---|---|---|
| Flight Arc（plan-art） | ⏸️ | 內容:研究專題 | FR24 Top-1000 抓到 28.6%；作品連結 flight-arc-graph #24 已於 11-08 合併 | 見 plan-art memory 的 11 步流程 | 個人記憶 flight-arc-campaign-pointer；`../plan-art/` | 2026-11-08 |
| Codex special-event-scenarios（F1 cargo Gantt） | ⏸️ 保留 | 待討論 | `~/.codex/worktrees/special-event-scenarios`，分支未 push | 使用者決定留存；有遺失風險，要不要先 push 待問 | — | 2026-10-05 |
| pulse-api（FastAPI＋DuckDB 備援） | 停用 | 待討論 | 使用者 2026-11-08 列為停用專案（ship、airspace Arrow IPC 備援；主站資料走 Supabase／R2） | 不封存，只記錄於此 | `../pulse-api` | — |

## 發現的不一致（待清理）

2026-11-10 差異檢核後重寫（舊 5 條：停更檔封存標記、HANDOFF 註記、個人記憶 status-ref、FP-1 前提衝突已處理或已拍板，不再列）。

- roadmap candidates frontmatter 仍寫 `in_progress`、與本表狀態不符的剩 3 個：G28（本表 ⏸️）、G30（⚪）、G34（🟢）；在 `.gis-agent-system` 改，本 repo 不改。
- `.gis-agent-system` 本機 checkout 與 origin 分叉（落後 61、領先 10，其中 5 個 commit 只在本機，含 `roadmap/candidates/G52-realtime-119-cases.md`）；ADR-0026 只在 origin。要 push 或丟棄待使用者決定（開場提示見 DEV-6）。
- 本表與 BACKLOG 的引用一致性改由 `npm run check:entry-docs` 自動檢查，不再手動列在這裡。

## 怎麼維護

- 專案完成或狀態改變時，改該列的狀態與「最後進展」；新專案加一列，並填 Tier。
- 🟡／🔵 放上半部「進行中與待拍板」；🟢／⏸️／⚪ 放下方摺疊區。狀態改變就搬區。
- 「現在最該注意」只放有期限的事（日期排序）與本週進行中；過期或完成就刪。
- 收尾（wrap-up）與發版後順手更新本檔與「最後盤點」日期（`docsFreshness` 測試會檢查）。
- 改完跑 `npm run check:entry-docs`：下一步／正本／BACKLOG 欄不可引用已關閉或不存在的 ID、「正本」不可指向 `docs/archive/`（CI 也會跑，違規會紅）；期限過了要寫〔結果 YYYY-MM-DD：…〕或刪列（只警告）。
- 結案的列從表中移到檔尾「已結案」，一行帶過。
- 每列「正本」要能找到：repo 內用相對連結，跨 repo 用 `../<repo>/…` 文字路徑；BACKLOG 項寫 ID 或主題群。
- 只放指標與一兩句現況，細節留在正本。

## 已結案

- Supabase Disk IO 複量：2026-11-08 使用者同意結案（DIO-1／DIO-11 關閉；基準被 mig 505–510 打亂，要量另開）。
- 舊檔去留（public/fishery）：2026-11-08 結案（TWL-2 關閉；CI-4 已把資料檔移出 git）。

回顧影片 v5.4（2026-10-05 發布封存）、隱私說明頁（v2.12.0）、多國議題 2 主體（2026-10-29）；roadmap G02、G08、G17、G19 已上線；TWL-8~12、TWL-16、KRREL-1、UKREL-1、IEREL-1、VIS-1／2／4／5／6 已結案；多國化議題 3 主站遷移（MC-4，2026-11-06 隨 Zeabur 搬家完成）；2026-11-06 review 修正輪（mini #844／#845／#850、gp #202／#204 mig 502 已套用、collectors #172）；G04 parked；**public/ 資料檔移出 git（CI-4，v2.31.2／v2.31.3）**；CI 加速（CI-1～3，#899／#904）；站主資料第 1、2 批與撤 RPC（OWD-1～3）；sync-rotating 修復（#945／#946）。

## 不確定項

- 國道逐車 wip 的細節以 analytics `freeway_tdcs/_status.md` 為準，本表未再核對。
- G27／31 的實際進度只看了 roadmap frontmatter status，沒讀內文。
- 情報牆 W30 計畫的待拍板項是否已在別處處理：未查證（目錄最後 commit 07-29）。
- 新鮮度 VM 11/2 首次自動執行結果：未查證。
- Supabase 表大小與 `cron.job` 清單：健檢避開餐期未查（DB-1）。
- Cloudflare Access service token 與 CI 用 Cloudflare API token 的效期：未實測。
- 「最後進展」多半取記憶或 BACKLOG 日期，沒逐一對照 git log。
