# Global Events 完整情勢接線

上游 SSOT：`taipei-gis-analytics/docs/handoff/global-events-situation.md`；ADR：`docs/adr/0002-global-event-candidate-visibility.md`。

## 硬相依

- 既有 `get_global_event_places_current` / `get_global_event_places_window` 不用來假裝AI候選歷史。
- 新 `get_global_event_candidates_window` 必須先部署；所有decision均可讀，unknown geometry仍有列。
- 每頁以candidate ID分頁後保留全部地點；讀到最後一頁才稱完整。已載入部分或API失敗必須顯示狀態。
- `observed_at` / `assessed_at` / `available_at` 分開，不把收集時間假裝發生時間。
- 已發布版本依 explicit candidate reference 與candidate去重，不靠模糊標題猜事件。
- 代表點與原始geometry在避讓時不變；弧線沒有移動、因果或先後語意。

## Release

實作基線：frontend e16dc2354c74d7563d6b7525120c935f43e64f2b；platform 1f4f7e352ef4292ce1615474cf400716dffb4ba3；collector 48250361d1d459d1590d1f228f2e4cd4e51390fc。

新增commit／PR／migration readback／browser驗收：待完成，不能以此文件代表已上線。
