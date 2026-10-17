# 地圖圖層規格套用（map-layer-restyle，R1–R6）

> **狀態**：active（R1–R5 已上線；R6 段 1–3 已隨 v2.8.0 上正式站，待目視 BACKLOG `R6-V`；R6 段 4 使用者 2026-10-12 決定暫不碰，BACKLOG `R6-4`，該段為 paused）

## 一句話說明

把 `docs/design-system/map-layers.md` 拍板的圖層視覺規格分輪套到全站圖層：R1–R4 為點／線面／圖例，R5 熱區，R6 讓 Three.js 立體圖層加「平面點線面」模式。

## 進度

- R1（#391）、R2（#392、#393、#396、#398、#401）、R3a（#461）、R4（#465，加油站品牌色 #468）、R3b（#475）：見 PLAN
- R6 段 1（#547）、段 2（#572）、段 3（#573，另 #578）：CHANGELOG 記載；預設規則「移動物件預設立體，其他預設平面」
- 規格 SSOT：`docs/design-system/map-layers.md`；盤點：`docs/design-system/layer-style-inventory.json`（`npm run design:audit-layers`）

## 驗收

各輪附對照頁（r*-compare／tiers.html）；R6 段 1–3 的正式站目視清單在 BACKLOG `R6-V`。

## 資料夾內文件

- [PLAN.md](./PLAN.md)：R1–R6 套用計畫與範圍數字
- [handoff-r2-hooks.md](./handoff-r2-hooks.md)、[handoff-r2-hooks-fix.md](./handoff-r2-hooks-fix.md)：R2 後半（hook 點圖層）及 PR #396 修正交接
- [handoff-r3b.md](./handoff-r3b.md)、[R3b-report.md](./R3b-report.md)：R3b 交接與驗收報告
- [handoff-r4-legend.md](./handoff-r4-legend.md)、[R4-report.md](./R4-report.md)：R4 圖例對齊交接與驗收
- [R6-inventory.md](./R6-inventory.md)：Three.js／CustomLayer 圖層盤點
- [R6-PROPOSAL.md](./R6-PROPOSAL.md)：R6 使用者決定與分段
- [handoff-r6.md](./handoff-r6.md)：R6 交接（2026-10-04 版，狀態行 2026-10-17 已更新）
- 對照頁：[r2-tiers.html](./r2-tiers.html)、[r3-tiers.html](./r3-tiers.html)、[r3b-tiers.html](./r3b-tiers.html)、[r3b-compare.html](./r3b-compare.html)、[r4-legend-after.html](./r4-legend-after.html)、[r5-compare.html](./r5-compare.html)、[r5-all.html](./r5-all.html)、[r6-picks.html](./r6-picks.html)、[r6-s1-compare.html](./r6-s1-compare.html)、[r6-s2-compare.html](./r6-s2-compare.html)、[r6-s3-compare.html](./r6-s3-compare.html)
