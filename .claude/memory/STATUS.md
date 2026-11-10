# Status

**最後更新**：2026-11-10 v2.35.0 發布（台灣圖層待辦池第二＋三批、南韓第 8–9 波、愛爾蘭第 11 波、日本市町村道、人口細網格補齊）。前一次：2026-11-09 v2.34.0

> 本檔只留**最近一次發版**的 checkpoint；發下一版時整段換掉，舊段移到 `docs/archive/<日期>/STATUS-history.md`。最近的歷史：[`docs/archive/2026-11-08/STATUS-history.md`](../../docs/archive/2026-11-08/STATUS-history.md)（10-28～11-08）、[`docs/archive/2026-10-27/STATUS-history.md`](../../docs/archive/2026-10-27/STATUS-history.md)。
> 現況入口是 [`docs/PROJECTS.md`](../../docs/PROJECTS.md)；單一任務看 [`BACKLOG.md`](./BACKLOG.md) 對應主題群。

## 2026-11-10：v2.35.0

| 項目 | 現況 |
|---|---|
| 正式版號 | **v2.35.0**（release PR #993）。內容見 `CHANGELOG.md`。 |
| AI 倉庫 | latest `20261110T001615Z`，611 表（南韓 52、愛爾蘭 6、英國 LAD 新入倉）；入倉守門 #975、圖層總表 #976。 |
| 乙組搬遷 | #980 震度圖讀 R2、#981 地層下陷、#990 H3 讀靜態快照隨本版上線；發版後依序：正式站目視震度圖→套 gis-platform #233；滿 24h 無呼叫→刪 land_subsidence_readings（#234）、h3_demographics_yearly、stat_values。 |

- 卡點：無。
- 下一步：依 PROJECTS「現在最該注意」；當晚 23:00 前後 mig 546／547 刪表（讀者 24h 檢查）。
- 接手：從 origin/develop 開分支；進度文件用 `git show origin/develop:<path>` 讀。
