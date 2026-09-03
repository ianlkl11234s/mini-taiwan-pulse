# Global Events 完整情勢接線

上游 SSOT：`taipei-gis-analytics/docs/handoff/global-events-situation.md`；ADR：`docs/adr/0002-global-event-candidate-visibility.md`。

## 硬相依

- 既有 `get_global_event_places_current` / `get_global_event_places_window` 不用來假裝AI候選歷史。
- 新 `get_global_event_candidates_window` 必須先部署；所有decision均可讀，unknown geometry仍有列。
- 每頁以candidate ID分頁後保留全部地點；讀到最後一頁才稱完整。已載入部分或API失敗必須顯示狀態。
- `observed_at` / `assessed_at` / `available_at` 分開，不把收集時間假裝發生時間。
- 已發布版本依 explicit candidate reference 與candidate去重，不靠模糊標題猜事件。
- 代表點與原始geometry在避讓時不變；弧線沒有移動、因果或先後語意。
- 國家／城市可採來源地理提及或固定版本 gazetteer 的概略代表點，不要求精確發生地；Popup 需標示概略位置，Qwen 信心不代表定位精度。
- 單日回放的候選查詢向前擴七天，再依實際 available_at 過濾；不修改正式事件窗口，不倒灌回填前的歷史。

## Release

實作基線：frontend e16dc2354c74d7563d6b7525120c935f43e64f2b；platform 1f4f7e352ef4292ce1615474cf400716dffb4ba3；collector 48250361d1d459d1590d1f228f2e4cd4e51390fc。

Platform [PR #90](https://github.com/ianlkl11234s/gis-platform/pull/90) 已合併（0c7d752），397/398 已套用。Anon/auth readback：3 件正式事件、5 個可畫點、1 個未知位置；105 舊候選初次回填完整保留 core10/watch20/drop75，無定位者仍保留列表。

Workbench [PR #29](https://github.com/ianlkl11234s/pulse-intel-workbench/pull/29) 已合併（412e20f），保留兩層判斷與原 frozen artifacts。Collector [PR #79](https://github.com/ianlkl11234s/gis-data-collectors/pull/79) 已合併（a284253），另接續來源地理提及的概略定位放寬。

Frontend [PR #205](https://github.com/ianlkl11234s/mini-taiwan-pulse/pull/205) 包含本次實作；tsc-b 與 1027 tests（1 skipped）通過。正式部署 commit／最後 production browser 證據記錄於該 PR 與上游 handoff；不能只以 CI 成功代替 production 驗收。
