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

Frontend [PR #205](https://github.com/ianlkl11234s/mini-taiwan-pulse/pull/205) merge ab813b0；tsc-b 與 1027 tests（1 skipped）通過。[PR #206](https://github.com/ianlkl11234s/mini-taiwan-pulse/pull/206) 修正pulse負opacity，merge def3dc662b645696824e61451416288b496219cb；11 focused／tsc／CI通過。Zeabur deployment 6a994975c3fffb61baebd2b3 RUNNING，新JS main-Bblqfkou.js 已由正式browser確認。

Production browser：最近七天、AI off僅3正式事件／1未知、Nigeria drop_noise／none國家代表點popup、同位置7件群組展開、跨國線ON/OFF與opacity0均通過。歷史9/2無導入資料→0，9/3讀出實際available版本；新版scrub無consoleerror。驗收時163顯示事件／58待定位是Qwen74候選補正前快照，不應當作永久總量。

Platform #91／migration399與45舊候選概略位置enrichment已上線；Collector #80來源地理提及fallback、#81相容性修正已上線（43b5665）。首輪74候選已用原cache補正為74有效／0待判斷，未重跑Qwen。Workbench #30／#31已合併，舊partial與新repair紀錄均保留，open PR=[]。

18:29台北最終anon讀回179候選，110有位置／69unknown、199代表點，所有core34／watch39／drop106保留。正式browser合併重複報導後155件／58待定位（97件有位置），待判斷標籤0。來源仍落後約14小時，不宣稱近七天已完整；Publisher始終0。不同筆數分母與完整證據以上游handoff及PR #205發布紀錄為準。

正式網址：https://mini-taiwan-pulse.itsmigu.com/?v=1&lng=10&lat=25&z=1.8&layers=globalEvents&style=dark 。圖層會啟用，World側欄需自行展開。
