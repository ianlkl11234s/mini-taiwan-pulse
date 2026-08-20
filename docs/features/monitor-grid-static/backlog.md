# Backlog — 監看模式靜態網格（MG 系列）

> 本 feature 的待辦。與全站 `.claude/memory/BACKLOG.md` 的索引行對應。
> 排版機制與高度政策見 [README](./README.md)，換版 SOP 見 `.claude/memory/PLAYBOOKS.md` PB-30。

## Active work（進行中／待辦）

| ID | 優先級 | 項目 |
|---|---|---|
| MG-1 | P3 | `conditional`：沙盒不模擬流式高度；Trigger：widget 版型頻繁變動或 owner 要求沙盒高度對齊。先保留 AUTO 徽章，不維護第二份 packing 實作。 |
| MG-2 | P3 | `ready`：兩個既有微幅溢出（alertBoard +5px、situationOverview +11px）；Next action：只在影響閱讀時逐一追內部元素。 |
| MG-3 | P3 | `verifying`：2026-08-10 曾出現一次 1 failed/440 passed，後三輪全綠；Next action：重現時保留完整輸出並確認是否資源競爭；Acceptance：連續重跑與 root-cause evidence。 |

## Decision needed

- MG-1 是否值得維護第二份沙盒高度實作；在 owner 決定前維持 AUTO 徽章。

## 已完成（近期）

- [x] **八版**：TAIEX 拆出獨立 widget `taiex`；PLA 趨勢圖 54→190px、空域方位／侵擾方式改單欄；食品價格走勢圖加高；沙盒原始碼進 repo — PR #121, 2026-08-10
- [x] **九版**：`monitorPacking.ts` 欄／列拆解 + `fit?: "content"` 高度政策 — PR #121, 2026-08-10
- [x] **PLA 趨勢圖區間 pills**（120D/90D/30D/7D，只換顯示區間不動分級基準） — PR #121, 2026-08-10
- [x] `erCongestion` 格內捲 423px —— 原本要考慮把 `h` 拉到 24，**九版的 fit 機制直接解掉**（1163px 完整展開），不需要再決定
