# Status

**最後更新**：2026-11-18 v2.40.1 發版準備（南韓配色 B、加拿大英日文圖例與養殖光暈、野火 OGL-Canada、Day 17 資料來源、越南舊檔移出 lock）。前一次：2026-11-18 v2.40.0 發版準備（加拿大第 3–8 波 36 層、南韓 KRH-1 2 層、Day 17 光與暗、事故脈動）。前一次：2026-11-17 v2.39.0 發版準備（菲律賓 49 層、越南 35 層、中國第 0–5 波 24 層站主限定）。前一次：2026-11-17 v2.38.0 發版準備（準備 commit 進 develop 後開發版 PR develop → master，合併待站主拍板）。前一次：2026-11-16 v2.37.1 已發布（發版 PR #1062，master `8f0cdd39`）與正式站目視 A–E 全過。再前一次：2026-11-16 v2.37.0 已發布（發版 PR #1054，master `3629f1b5`）。更早：2026-11-13 v2.36.2 發布（分享網址預設篩選、統計說明框錯位修正 #1025；選舉活動同地點各場展開 #1024）。前一日：2026-11-12 v2.36.1／v2.36.0

> 本檔只留**最近一次發版**的 checkpoint；發下一版時整段換掉，舊段移到 `docs/archive/<日期>/STATUS-history.md`。最近的歷史：[`docs/archive/2026-11-08/STATUS-history.md`](../../docs/archive/2026-11-08/STATUS-history.md)（10-28～11-16，含 v2.37.1）、[`docs/archive/2026-10-27/STATUS-history.md`](../../docs/archive/2026-10-27/STATUS-history.md)。
> 現況入口是 [`docs/PROJECTS.md`](../../docs/PROJECTS.md)；單一任務看 [`BACKLOG.md`](./BACKLOG.md) 對應主題群。

## 2026-11-18：v2.40.1（發版準備）

| 項目 | 現況 |
|---|---|
| 正式版號 | v2.40.0 已發布（#1090，master `59ca49d6`）；v2.40.1 發版 PR 待合併（站主 11-18「發」）。PATCH：配色、圖例、資料來源修正。 |
| 範圍 | #1091（越南舊示範檔移出 lock，S3 舊檔已刪、R2 副本保留）、#1092、#1093（Day 17 目錄）、#1094（南韓生態自然圖配色 B、NS 養殖光暈、加拿大英日文圖例、野火 OGL-Canada）；新增 BACKLOG I18N-2、I18N-3 |
| 主機 | pulse-host coral-private mem_limit 已改 512m 並重建（11-18） |

## 2026-11-18：v2.40.0（發版準備，已發布）

| 項目 | 現況 |
|---|---|
| 正式版號 | v2.39.0 已發布；v2.40.0 發版 PR 待合併（站主 11-17「發，請開始做南韓的部分，等南韓做完再一起進 prod」、11-18「好，請發版」）。版號 MINOR：新增圖層。 |
| 範圍 | #1085 加拿大第 3–8 波 36 層（analytics #402、pulse-data #122，倉庫 20261117T101553Z 已含）、#1088 南韓生態自然圖與垃圾排出規則（analytics #404、pulse-data #124，DISPLAY_ONLY）、#1086 Day 17 光與暗、#1087 船舶地球儀對齊、#1083 即時路況事故脈動；文件 #1081、#1082、#1084 |
| 資產 | 加拿大 36、南韓 19 個公開檔已在 S3 deploy-assets，大小與 sha256 與 lock 一致；R2 等發版後同步 |

## 2026-11-17：v2.39.0（發版準備，已發布）

| 項目 | 現況 |
|---|---|
| 正式版號 | v2.38.0 已發布；v2.39.0 發版 PR 待合併。版號 MINOR：新增菲越中圖層。 |
| 範圍 | #1037、#1066（中國，站主限定，私有圖磚走 coral-private 按需讀）、#1071（菲律賓）、#1074（越南）；倉庫 20261117T052230Z（724 表）已含菲越 |
| 發版後 | pulse-host 重建 coral-private、mem_limit 768m→512m；刪舊 `vn_angiang_demo.pmtiles` 與越南養殖 `_v2` 孤兒檔（驗證後） |

## 2026-11-17：v2.38.0（發版準備，已發布）

| 項目 | 現況 |
|---|---|
| 正式版號 | 仍為 **v2.37.1**；v2.38.0 發版準備中：發版 PR（develop → master）合併、打 tag、建 Release 待站主拍板。版號 MINOR：新增圖層。 |
| 本版範圍 | 南韓第 10 波 10 層（#1042）、首爾用途地域站主限定（#1050）、英國 OSM 4 層＋主要路網 B 級（#1039，pulse-data #109）、即時 119 案件與警廣路況站主限定（#1069）、coral-private 私有檔按需 Range 讀（#1073）、資產測試清單 `_v2`（#1064）、文件 #1065、#1067、#1068、#1070、#1072。#1037 中國、analytics #392 不在本版。 |
| 資產 | lock 新增 16 個公開檔（英國 5、南韓 10、路段線段 `base_map/road_lines_20261116.pmtiles`）皆在 S3 deploy-assets，大小與 sha256 與 lock 一致（路段線段 11-17 補傳並回讀）；R2 等發版後同步。首爾用途地域私有圖磚已在私有 bucket（checksum 一致）。英國 5 包、南韓 10 包倉庫資料包已發 R2（pulse-data #109、#114）；倉庫未重組（WHREORG-1）。 |
| 發版結果（2026-11-17） | **已發布**：發版 PR #1076 合 master `7d9787dc`；CI、deploy-workers、publish-coral-private 全綠（master assets 檢查轉綠，CI-10 解）；tag `v2.38.0`、GitHub Release 已建；正式站 `main-*.js` 為 2.38.0；`base_map/road_lines_20261116.pmtiles` 正式網域 206。pulse-host `coral-private` 已 pull 新映像（建於 11-17 03:45Z）並重建，healthy、記憶體約 33 MiB；匿名打 `/api/private-research/owner-data/kr-seoul-zoning` 回 401、未知 key 404。剩：站主登入目視首爾用途地域、119／警廣（路段高亮），英國 4 層、南韓 10 層目視；倉庫重組 WHREORG-1（需 R2 讀取金鑰，待站主決定執行方式與是否先做 PII-3）。 |

- 接手：從 origin/develop 開分支；進度文件用 `git show origin/develop:<path>` 讀。
