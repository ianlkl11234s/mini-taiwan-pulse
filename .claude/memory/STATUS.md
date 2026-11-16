# Status

**最後更新**：2026-11-16 v2.37.0 已發布（發版 PR #1054，master `3629f1b5`）與正式站目視（11 項 9 通過、2 部分通過）。前一次：2026-11-13 v2.36.2 發布（分享網址預設篩選、統計說明框錯位修正 #1025；選舉活動同地點各場展開 #1024）。前一日：2026-11-12 v2.36.1／v2.36.0

> 本檔只留**最近一次發版**的 checkpoint；發下一版時整段換掉，舊段移到 `docs/archive/<日期>/STATUS-history.md`。最近的歷史：[`docs/archive/2026-11-08/STATUS-history.md`](../../docs/archive/2026-11-08/STATUS-history.md)（10-28～11-13）、[`docs/archive/2026-10-27/STATUS-history.md`](../../docs/archive/2026-10-27/STATUS-history.md)。
> 現況入口是 [`docs/PROJECTS.md`](../../docs/PROJECTS.md)；單一任務看 [`BACKLOG.md`](./BACKLOG.md) 對應主題群。

## 2026-11-16：v2.37.0

| 項目 | 現況 |
|---|---|
| 正式版號 | **v2.37.0**（2026-11-16 發布：發版 PR #1054 合 master `3629f1b5`，tag `v2.37.0`、GitHub Release 已建，部署與 CI 綠，正式站版號已是 2.37.0）。內容見 `CHANGELOG.md`。 |
| 本版範圍 | 19 個 PR：#1028–#1036、#1038、#1040、#1041、#1043、#1045、#1046、#1047、#1049、#1051、#1052。重點：菲律賓第 0–2 波（#1033、#1047、#1049）、越南第 0–1 波 12 層（#1038）；正式站目視修正第二批（#1036）與 VPB-3～6（#1034）；日本事故口徑（#1040）；選舉活動圓點（#1030）；個資止血第一批：愛爾蘭 AED `_v2`（#1043）、站主限定長照來源（#1046）；救援等時圈（#1052：根因是同步腳本對照表沒這個檔，補 lock 一筆與 S3 鏡像 key，舊的扁平 key 保留）。lock 新增 30 個資產（菲 13、越 15、救援等時圈、愛爾蘭 AED `_v2`）在正式網域都取得到。不需 migration／Worker 設定／env。 |
| 正式站目視 | 匿名、唯讀，11 項：9 通過、2 部分通過、0 失敗；截圖 `.gis-agent-system/projects/2026-11-13-vis-pack-batch2/shots-v2370/`。部分通過：INTEL 國碼 Gaza 仍顯示 GZ（VPB-17）、分享網址只帶 `?c=ie` 開在台灣（VPB-19），兩項修正中。新問題 VPB-18、VPB-20～22、VNW-1；VPB-8 補版面。 |

- 卡點：#1044（台灣 7 層 `_v2`；CI 要 R2 先有檔、發版同步只帶 master 已引用的檔，卡循環，等站主在另一視窗決定）與 #1048（英愛 3 層）未進本版，正式站個資尚未完全處理，需再發一版（REL-NEXT／PII-1）。
- 同日後端（不隨前端版號）：data-collectors #203（`3e801d63`）部署 pulse-host（容器 11-15 18:06 UTC 重建），HiCloud VM 四個 app 換新版 `vm_buffer.py`（COL-ZERO-1／COL-GE-2）；#204 合 main `e4135c40`、**未部署，等站主同意**（COL-STAG-1）。gis-platform、analytics 主 checkout 已 pull 到最新；兩個擋路的未追蹤 manifest 移到 `GIS/_worktree-backups/2026-11-16/analytics-untracked-manifests/`。
- 唯讀調查結論：HOST-1 記憶體先不調上限、#204 部署後再量；對帳 critical=2 是颱風收集器沒颱風時的誤報（#204 修）；S3 週增 +101% 含舊版本，12-10 回看（ST-3）。
- 下一步：PROJECTS「有期限的事」11-17～11-20 各項；SR-1 改期 11-20（11-15 那輪沒做）。
- 接手：從 origin/develop 開分支；進度文件用 `git show origin/develop:<path>` 讀。
