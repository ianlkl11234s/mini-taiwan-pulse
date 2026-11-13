# Status

**最後更新**：2026-11-13 v2.36.2 發布（分享網址預設篩選、統計說明框錯位修正 #1025；選舉活動同地點各場展開 #1024）。前一日：2026-11-12 v2.36.1 發布（選舉活動同地點多場合成，#1020）。同日稍早：v2.36.0 發布（統計圖層呈現方式：比例圓、點密度、多年份並排、左右比較）。前一次：2026-11-10 v2.35.0

> 本檔只留**最近一次發版**的 checkpoint；發下一版時整段換掉，舊段移到 `docs/archive/<日期>/STATUS-history.md`。最近的歷史：[`docs/archive/2026-11-08/STATUS-history.md`](../../docs/archive/2026-11-08/STATUS-history.md)（10-28～11-08）、[`docs/archive/2026-10-27/STATUS-history.md`](../../docs/archive/2026-10-27/STATUS-history.md)。
> 現況入口是 [`docs/PROJECTS.md`](../../docs/PROJECTS.md)；單一任務看 [`BACKLOG.md`](./BACKLOG.md) 對應主題群。

## 2026-11-12：v2.36.0

| 項目 | 現況 |
|---|---|
| 正式版號 | **v2.36.2**（v2.36.1 加兩個修正 #1025 與選舉活動同地點各場展開 #1024；v2.36.1＝v2.36.0 加 #1020）。內容見 `CHANGELOG.md`。 |
| 本版重點 | 統計圖層呈現方式：比例圓 #1008、點密度 #1016、多年份並排 #1011、左右比較 P1 #1012；暗底配色第一／二段 #998、#1002；review 修正 #1005、#1006。不需 migration／R2 發布／Worker 設定／env。 |

- 卡點：無。
- 下一步：依 PROJECTS「現在最該注意」；VIZ-1／VIZ-2 正式站目視；v2.36.2 上線後正式站複驗 R5-2／VPB-1／VPB-2。
- 同日後端（不隨前端版號）：gis-platform mig 552／553 已套用（SEC-5）；data-collectors #200 已部署 pulse-host 與 HiCloud VM（BKP-4／VMH-1）。
- 接手：從 origin/develop 開分支；進度文件用 `git show origin/develop:<path>` 讀。
