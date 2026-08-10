# Backlog — 監看模式靜態網格（MG 系列）

> 本 feature 的待辦。與全站 `.claude/memory/BACKLOG.md` 的索引行對應。
> 排版機制與高度政策見 [README](./README.md)，換版 SOP 見 `.claude/memory/PLAYBOOKS.md` PB-30。

## 待辦

| ID | 優先級 | 項目 |
|---|---|---|
| MG-1 | P3 | **沙盒不模擬流式高度**。九版起 `fit: "content"` 的 widget 實機高度跟內容走，沙盒只在標題與抽屜掛 `AUTO` 徽章提示「這裡的縱向尺寸只是排序佔位」。目前 fit 佔 16 個裡的 11 個，沙盒的**高度**參考價值已經不高（x/w 與順序仍準確）。要補得在沙盒實作同一套 `monitorPacking` + 各 widget 的估算高度 —— 但那等於維護第二份實作，**漂移風險可能大於收益**，先觀察需求再決定 |
| MG-2 | P3 | 兩個既有的微幅溢出（八版前就有，非流式排版造成）：`alertBoard` 內容比格高多 5px（固定高 widget，永遠有一條幾乎看不見的捲軸）；`situationOverview` 內容比容器多 11px（fit widget，`overflow:visible` 所以只是畫到邊框外 11px，畫面上無感）。兩者都不影響閱讀，要清得逐一追內部元素 |
| MG-3 | P3 | **測試 flake 未結案**：2026-08-10 `npx vitest run` 出現一次 `1 failed | 440 passed`，但輸出被 `tail` 掉、根因未確認；之後三輪全綠。該次總時長 23.5s（平常 9s）且 headless 瀏覽器同時在跑，疑為資源競爭造成的逾時（`staticDataContract` 讀全部靜態 GeoJSON）。再現時要留完整輸出查 |

## 已完成（近期）

- [x] **八版**：TAIEX 拆出獨立 widget `taiex`；PLA 趨勢圖 54→190px、空域方位／侵擾方式改單欄；食品價格走勢圖加高；沙盒原始碼進 repo — PR #121, 2026-08-10
- [x] **九版**：`monitorPacking.ts` 欄／列拆解 + `fit?: "content"` 高度政策 — PR #121, 2026-08-10
- [x] **PLA 趨勢圖區間 pills**（120D/90D/30D/7D，只換顯示區間不動分級基準） — PR #121, 2026-08-10
- [x] `erCongestion` 格內捲 423px —— 原本要考慮把 `h` 拉到 24，**九版的 fit 機制直接解掉**（1163px 完整展開），不需要再決定
