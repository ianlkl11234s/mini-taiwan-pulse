# Status

**最後更新**：2026-11-17 v2.38.0 發版準備（準備 commit 進 develop 後開發版 PR develop → master，合併待站主拍板）。前一次：2026-11-16 v2.37.1 已發布（發版 PR #1062，master `8f0cdd39`）與正式站目視 A–E 全過。再前一次：2026-11-16 v2.37.0 已發布（發版 PR #1054，master `3629f1b5`）。更早：2026-11-13 v2.36.2 發布（分享網址預設篩選、統計說明框錯位修正 #1025；選舉活動同地點各場展開 #1024）。前一日：2026-11-12 v2.36.1／v2.36.0

> 本檔只留**最近一次發版**的 checkpoint；發下一版時整段換掉，舊段移到 `docs/archive/<日期>/STATUS-history.md`。最近的歷史：[`docs/archive/2026-11-08/STATUS-history.md`](../../docs/archive/2026-11-08/STATUS-history.md)（10-28～11-16，含 v2.37.1）、[`docs/archive/2026-10-27/STATUS-history.md`](../../docs/archive/2026-10-27/STATUS-history.md)。
> 現況入口是 [`docs/PROJECTS.md`](../../docs/PROJECTS.md)；單一任務看 [`BACKLOG.md`](./BACKLOG.md) 對應主題群。

## 2026-11-17：v2.38.0（發版準備）

| 項目 | 現況 |
|---|---|
| 正式版號 | 仍為 **v2.37.1**；v2.38.0 發版準備中：發版 PR（develop → master）合併、打 tag、建 Release 待站主拍板。版號 MINOR：新增圖層。 |
| 本版範圍 | 南韓第 10 波 10 層（#1042）、首爾用途地域站主限定（#1050）、英國 OSM 4 層＋主要路網 B 級（#1039，pulse-data #109）、即時 119 案件與警廣路況站主限定（#1069）、coral-private 私有檔按需 Range 讀（#1073）、資產測試清單 `_v2`（#1064）、文件 #1065、#1067、#1068、#1070、#1072。#1037 中國、analytics #392 不在本版。 |
| 資產 | lock 新增 16 個公開檔（英國 5、南韓 10、路段線段 `base_map/road_lines_20261116.pmtiles`）皆在 S3 deploy-assets，大小與 sha256 與 lock 一致（路段線段 11-17 補傳並回讀）；R2 等發版後同步。首爾用途地域私有圖磚已在私有 bucket（checksum 一致）。英國 5 包、南韓 10 包倉庫資料包已發 R2（pulse-data #109、#114）；倉庫未重組（WHREORG-1）。 |
| 發版結果（2026-11-17） | **已發布**：發版 PR #1076 合 master `7d9787dc`；CI、deploy-workers、publish-coral-private 全綠（master assets 檢查轉綠，CI-10 解）；tag `v2.38.0`、GitHub Release 已建；正式站 `main-*.js` 為 2.38.0；`base_map/road_lines_20261116.pmtiles` 正式網域 206。pulse-host `coral-private` 已 pull 新映像（建於 11-17 03:45Z）並重建，healthy、記憶體約 33 MiB；匿名打 `/api/private-research/owner-data/kr-seoul-zoning` 回 401、未知 key 404。剩：站主登入目視首爾用途地域、119／警廣（路段高亮），英國 4 層、南韓 10 層目視；倉庫重組 WHREORG-1（需 R2 讀取金鑰，待站主決定執行方式與是否先做 PII-3）。 |

- 接手：從 origin/develop 開分支；進度文件用 `git show origin/develop:<path>` 讀。
