# 圖層面板統一（layer-panel-unify，R8）

> **狀態**：shipped（CHANGELOG v2.3.0：「所有圖層面板改用共用的列元件，圖層名稱改為結構化中英雙語，日本、統計、世界加上大分組」，R8，#509、#511、#513、#514）

## 一句話說明

台灣、日本、統計、世界四個入口，加上手機版、資料來源、Agent 結果、衛星、我的，所有圖層清單與設定面板統一成同一套精簡列＋展開區。

## 主要程式與規格

- 共用列：`src/components/sidebar/LayerRow.tsx`、`layerRow.css`
- 面板／控制項：`src/components/sidebar/LayersPanel.tsx`、`LayerParamControls.tsx`
- 名稱結構化：manifest `name: { zh, alt?, qualifier? }`
- 設計規格：`docs/design-system/spec.md` §5.37（連動下拉）

## 驗收

各階段附前後對照頁（phase-a／b／c、followups、macro-groups）；細節見 PLAN。

## 資料夾內文件

- [AUDIT.md](./AUDIT.md)：使用者 2026-10-03 的 P1–P9 決定與稽核
- [PLAN.md](./PLAN.md)：分段實作計畫（含與 #498 R5、R7 配色的先後）
- [names-review.md](./names-review.md)：圖層名稱結構化的人工檢查清單（352 自動／173 人工）
- [picks.html](./picks.html)、[macro-groups-picks.html](./macro-groups-picks.html)：選擇頁
- [phase-a-compare.html](./phase-a-compare.html)、[phase-b-compare.html](./phase-b-compare.html)、[phase-c-compare.html](./phase-c-compare.html)、[followups-compare.html](./followups-compare.html)、[macro-groups-result.html](./macro-groups-result.html)：各階段前後對照

配色功能見 [layer-color-picker](../layer-color-picker/README.md)。
