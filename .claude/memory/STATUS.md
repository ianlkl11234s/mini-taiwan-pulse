# Status

**最後更新**：2026-11-16 v2.37.0 發版準備（release PR base develop；菲律賓第 0–2 波、越南 12 層、目視包第二批、個資止血第一批）。前一次：2026-11-13 v2.36.2 發布（分享網址預設篩選、統計說明框錯位修正 #1025；選舉活動同地點各場展開 #1024）。前一日：2026-11-12 v2.36.1／v2.36.0

> 本檔只留**最近一次發版**的 checkpoint；發下一版時整段換掉，舊段移到 `docs/archive/<日期>/STATUS-history.md`。最近的歷史：[`docs/archive/2026-11-08/STATUS-history.md`](../../docs/archive/2026-11-08/STATUS-history.md)（10-28～11-13）、[`docs/archive/2026-10-27/STATUS-history.md`](../../docs/archive/2026-10-27/STATUS-history.md)。
> 現況入口是 [`docs/PROJECTS.md`](../../docs/PROJECTS.md)；單一任務看 [`BACKLOG.md`](./BACKLOG.md) 對應主題群。

## 2026-11-16：v2.37.0

| 項目 | 現況 |
|---|---|
| 正式版號 | **v2.37.0**（發版準備 PR base develop；合併 develop→master 後才上線）。內容見 `CHANGELOG.md`。 |
| 本版重點 | 菲律賓第 0–2 波（#1033、#1047、#1049）、越南第 0–1 波 12 層（#1038）；正式站目視修正第二批：衛星切底圖消失、日本醫療圈 popup、小格網鄰格、全球情勢國碼、手機衛星百科（#1036）與 VPB-3～6（#1034）；日本事故口徑（#1040）；選舉活動圓點（#1030）；個資止血第一批：愛爾蘭 AED `_v2`（#1043）、站主限定長照來源（#1046）；救援等時圈改由 lock 同步 R2（#1052）。新資產 30 個（PH 13、VN 15、`fire_isochrone_coverage`、`ie_defibrillators_v2`），發版前已確認 S3 deploy-assets 都在、大小與 lock 一致，發版同步後才會在公開網域 200。不需 migration／Worker 設定／env。 |

- 卡點：個資止血只到 #1043、#1046；#1044（台灣 7 層 `_v2`）與 #1048（英愛 3 層）未進本版，需再發一版（PII-1）。
- 下一步：發版後依 PROJECTS「有期限的事」的「v2.37.0 發版後」列做正式站確認；PHW-0／VNW-0／JPACC-1／VPB-7～14 正式站目視。
- 同日後端（不隨前端版號）：data-collectors `3e801d63`（#203）部署 pulse-host，新版 `vm_buffer.py` 部署 HiCloud VM（COL-ZERO-1／COL-GE-2）；gis-platform 與 analytics 主 checkout 快轉（SBE-6）。
- 接手：從 origin/develop 開分支；進度文件用 `git show origin/develop:<path>` 讀。
