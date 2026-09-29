# AI Agent 資料查詢與分析倉庫入口

**目前施工中：[`PLAN-round3-20260927.md`](./PLAN-round3-20260927.md)**（覆蓋度、問題庫、視覺化、收尾）；題目清單見 [`question-bank-backlog-20260927.md`](./question-bank-backlog-20260927.md)。

現況與下一步規劃看 [`PLAN-warehouse-20260926.md`](./PLAN-warehouse-20260926.md)；架構決策依據是
[ADR-0014](../../../../.gis-agent-system/decisions/0014-pulse-analysis-warehouse.md)
（GIS 工作區 `.gis-agent-system/decisions/0014-pulse-analysis-warehouse.md`）。

## 文件索引（接手先讀順序）

1. [`PLAN-warehouse-20260926.md`](./PLAN-warehouse-20260926.md) — 現況摘要 + 架構全貌（先讀「現況」小節）
2. [`PLAN-round3-20260927.md`](./PLAN-round3-20260927.md) — 詳細進度表 + 下一步建議
3. [`question-bank-backlog-20260927.md`](./question-bank-backlog-20260927.md) — 問題庫題綱與分類
4. [UI 一致性盤點 handoff](../ui-consistency-audit-20260927/handoff.md) — 獨立分案，視覺化函式庫的前置依賴
5. [`PROD-HOME.md`](./PROD-HOME.md) — **本機正式環境的唯一的家**（analysis-prod 的 mini／mcp／gateway／runtime）、更新與啟動方式、全雲端準備清單
6. [視覺化函式庫](../viz-library/README.md) — 地圖樣式、面板小圖表、分析卡、Agent 回歸測試

新圖層：有 manifest 並能自動入分析倉庫即為 L2 可分析。

2026-09-22～26「逐家族（per-family）reader」時期的規劃、驗收、盤點文件已封存於
[`archive/2026-09-pre-warehouse/`](./archive/2026-09-pre-warehouse/README.md)，只作歷史查證，
其中數字（248、778 等）不再是現況，不作施工依據。
