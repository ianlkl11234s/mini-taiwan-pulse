# Status

**最後更新**：2026-10-27 v2.15.0（日本圖層四波與主題系統、Codex review 修正）

> 本檔只重寫當前 checkpoint；舊段落在 [`docs/archive/2026-10-27/STATUS-history.md`](../../docs/archive/2026-10-27/STATUS-history.md)。
> 本檔只放這次碰到的範圍、上線狀態、卡點和下一步。完整計畫與數字看 [`PLAN-prod-connect-20261003.md`](../../docs/features/general-analysis/PLAN-prod-connect-20261003.md)，契約看 [`SPEC-prod-connect-p1-p3.md`](../../docs/features/general-analysis/SPEC-prod-connect-p1-p3.md)，操作看 [`PROD-HOME.md`](../../docs/features/general-analysis/PROD-HOME.md)，決策看 ADR-0017。

## 2026-10-27：v2.15.0 日本圖層四波＋Codex review 兩輪修正

| repo / system | 現況 |
|---|---|
| **mini-taiwan-pulse** | review 修正 #707–#711（必要 60 則）、#712–#715（還好 161 則）→ #717 版號 → #718 develop→master；tag `v2.15.0`＋GitHub Release。同包帶上另一 session 的日本 P1 #704–#706、#716（使用者 10-27 確認一起發）。 |
| **gis-platform** | #187–#191 合併；正式庫依序套用 migration 485→487→486、488→489→490，每支後健康檢查無新異常（cron 失敗 0、collector 錯誤維持既有 4 支）。套用紀錄在 #188、#190 PR body。 |
| **gis-data-collectors** | #165–#169 合併即部署；#169 部署 20 分鐘後 93 支中 68 支已有新成功，錯誤只有既有 4 支（上游連線）。 |
| **gis-agent-system** | review 紀錄 #26、#27：`reports/code-review/2026-10-27/`，下一輪起點 `2026-10-26T16:15:33Z`。 |

| 上線項目 | build | contract/wire | stage | upload | readback | pull | deploy | HTTP | browser |
|---|---|---|---|---|---|---|---|---|---|
| Pulse v2.15.0 | done：#717／#718 CI 綠 | done：CI（layerConsistency、golden、inventory） | done：develop `5e7df2e5` | done：日本 7 個大 PMTiles 在 S3 `deploy-assets/world/` | done：S3 大小與本機逐檔一致 | done：正式站 `/world/jp_*.pmtiles` 回 206（部署後頭幾分鐘曾 404） | done：master `bcbba48b` | done：`main-CLhIwdMg.js` 含 "2.15.0"；robots `/api/`、`/embed` no-cache | done：日本 5 層＋popup／圖例、水庫透明度、手機 popup、語言切換；not run：發電機組外圈點擊（站主限定）、popup 捲動（BACKLOG **V215-V**） |
| collectors #169 | done：CI | N/A | N/A | N/A | N/A | N/A | done：main `e0beb720` | N/A | N/A（collector_status 68/93 新成功） |
| migration 485–490 | N/A | done：交易內套用比對＋測試 | N/A | N/A | N/A | N/A | done：正式庫 10-27 | N/A | N/A |

- 下一步：layer-status 用最新倉庫快照重產（**RV27-2**）；review 未修 9 則依 **RV27-1** 觸發；正式站補驗 **V215-V**；DB 憑證輪換併入 **SEC-6**。
- 接手：從 origin/develop 開 worktree；在 worktree 跑 vite-node 腳本找不到套件時，把 node_modules 換成 `cp -Rc` 副本。
