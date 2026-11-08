# Status

**最後更新**：2026-11-08 v2.31.3 發布 checkpoint（單一入口整理時重寫）。

> 本檔只留**最近一次發版**的 checkpoint；發下一版時整段換掉，舊段移到 `docs/archive/<日期>/STATUS-history.md`。最近的歷史：[`docs/archive/2026-11-08/STATUS-history.md`](../../docs/archive/2026-11-08/STATUS-history.md)（10-28～11-08）、[`docs/archive/2026-10-27/STATUS-history.md`](../../docs/archive/2026-10-27/STATUS-history.md)。
> 現況入口是 [`docs/PROJECTS.md`](../../docs/PROJECTS.md)；單一任務看 [`BACKLOG.md`](./BACKLOG.md) 對應主題群。

## 2026-11-08：v2.27.0～v2.31.3 同日連發

| 項目 | 現況 |
|---|---|
| 正式版號 | **v2.31.3**（tag 在 master merge `1d24942c`）；正式網域 `main-rhpXabOU.js`（2026-11-08 讀取）。 |
| 本日發布內容 | v2.27.0 愛爾蘭全波次與統計、南韓公共安全統計、歷史底圖六層；v2.28.0 台灣主題重整（#910）、大型圖層檔改 R2、畜牧改 owner-data；v2.29.0 統計分類統一（#912）、能源與石化改 owner-data（#917）、不會變的公開資料改讀 CDN（#918）；v2.30.0 Day 8 烏托邦三層（#919）；v2.31.0 選舉活動位置精度（#929，gp mig 514／515）；v2.31.1 Day 8 配色（#930）；v2.31.2／v2.31.3 CI-4 資料檔移出 git、改由 R2 供應（#935–#940）。細節看 `CHANGELOG.md`。 |
| develop 領先 master | 只有 CI／建置調整：#944（tsc 增量快取、測試分 4 片）、#945／#946（sync-rotating 修復，已補同步成功）。不影響正式站畫面。 |
| 正式站目視 | 本日各版大多未做瀏覽器目視，集中在 BACKLOG **A 群 VIS-PACK**（VP-1～VP-13 與原 ID）。 |
| 站主資料 | 第 1、2 批已上線並經使用者驗收（OWD-1～3 已關）；第 3 批見 OWD-4（EA、Coillte、water1944；選舉活動 11-28 選後）。 |

- 卡點：無發版卡點。
- 下一步：依 PROJECTS「現在最該注意」的期限順序處理（11-09 清理排程首跑驗證 ZB-V1 → ~11-14 刪 Zeabur 前改 DNS ZB-4 → 12/1 停約 ZB-5 → 12/3 前 SEC-6）。
- 接手：從 origin/develop 開分支；主 checkout 常落後，進度文件用 `git show origin/develop:<path>` 讀。
