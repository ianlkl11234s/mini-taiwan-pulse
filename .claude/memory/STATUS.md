# Status

**最後更新**：2026-11-16 v2.37.1 發版準備（`release/v2.37.1` 直接 PR 到 master，待主 agent 合併）。前一次：2026-11-16 v2.37.0 已發布（發版 PR #1054，master `3629f1b5`）與正式站目視（11 項 9 通過、2 部分通過）。再前一次：2026-11-13 v2.36.2 發布（分享網址預設篩選、統計說明框錯位修正 #1025；選舉活動同地點各場展開 #1024）。前一日：2026-11-12 v2.36.1／v2.36.0

> 本檔只留**最近一次發版**的 checkpoint；發下一版時整段換掉，舊段移到 `docs/archive/<日期>/STATUS-history.md`。最近的歷史：[`docs/archive/2026-11-08/STATUS-history.md`](../../docs/archive/2026-11-08/STATUS-history.md)（10-28～11-16）、[`docs/archive/2026-10-27/STATUS-history.md`](../../docs/archive/2026-10-27/STATUS-history.md)。
> 現況入口是 [`docs/PROJECTS.md`](../../docs/PROJECTS.md)；單一任務看 [`BACKLOG.md`](./BACKLOG.md) 對應主題群。

## 2026-11-16：v2.37.1（發版準備）

| 項目 | 現況 |
|---|---|
| 正式版號 | **v2.37.0**；v2.37.1 發版準備中：分支 `release/v2.37.1`（從 develop `d963d2b4` 切）直接 PR 到 master，發版後由主 agent 打 tag、建 Release，並開 master→develop 回合併 PR。內容見 `CHANGELOG.md`。 |
| 本版範圍 | 個資清理第二批：台灣 7 層 `_v2`（#1044，發版前以管理員權限合併 `d963d2b4`）、英愛 3 層 `_v2`（#1048，develop `06a17f4a`，3 檔已上 S3）、lock 移除愛爾蘭 AED 舊檔（#1055）；正式站目視修正：Gaza 國碼 PS（#1056）、7 層 popup 出處與網格低縮放首載空白（#1058）；文件 #1057、#1059、#1060、#1061。不需 migration／Worker 設定／env。 |
| 已知紅燈 | 發版 PR 的 `assets`／`ci-ok` 紅：#1044 新引用的 `_v2` 檔要等發到 master 後由同步補到 R2；站主同意以管理員權限合併。流程問題登記 CI-10。 |

- 發版後驗收：PROJECTS「有期限的事」v2.37.1 發版後那列（10 個 `_v2` 檔 200／206、各層畫面與說明框、h3Population／popCount 首載、Gaza 顯示 PS、assets 轉綠）。結果待主 agent 補。
- 同日後端（不隨前端版號）：data-collectors `efd4c2d6`（#206 剛果誤定位修正、#205 城市聲景即時管線開關全關）部署 pulse-host，容器 healthy、log 顯示聲景已停用（VPB-18 verifying、VPB-27 blocked）。之後站主同意開聲景每日 dry-run（`SOUND_ATLAS_DAILY_ENABLED=true`，UPLOAD 仍關；SND-1 已完成），當天 collector 容器共重建 3 次；城市聲景後續 SND-2～5（SND-2 11-17）。
- 收尾註記（2026-11-16 三個 session 收尾）：待清理的已合併 worktree：mini `.worktrees/{fix-fire-isochrone-asset,release-v2.37.0,fix-v2370-visual,memory-v2370-results,wrapup-20261116}`、data-collectors `.worktrees/{fix-monitor-false-alarms,fix-ge-congo-ambiguity}`；保留不清：mini `.worktrees/sound-atlas`（未 push 分支，dev server port 3745 站主在看）、data-collectors `.worktrees/sound-atlas-live`。
- 下一步：PROJECTS「有期限的事」11-17～11-20 各項；PII-2 刪舊檔；REL-NEXT 再下一版。
- 接手：從 origin/develop 開分支；進度文件用 `git show origin/develop:<path>` 讀。
