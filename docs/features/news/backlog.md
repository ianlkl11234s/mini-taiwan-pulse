# Backlog — news

> 2026-08-19 整理。本檔只保留 current residual；Phase 1/A/B/v2 的完成證據留在 [changelog.md](./changelog.md)。

## Data quality / verifying

- [ ] **NEWS-1 · `verifying`**：確認自由時報 RSS 在 production 是否仍被 Zeabur cloud IP 403。
  - Outcome：知道是現行來源事故還是歷史觀察，避免為 stale 403 先改 collector。
  - Next action：查最近 7 天 production collector/feed success log，對照本地與 cloud response；若仍持續，再評估 UA 或 Google News 間接來源。Acceptance：有時間範圍、feed success rate 與處置決定。

## Product enhancement

- [ ] **NEWS-2**：接 PTT 地方板 Atom feed。
  - Outcome：補足地方新聞來源，沿用既有 LLM/GIS 管線。
  - Next action：先驗 feed license、穩定性與去重成本，再開 collector change。
- [ ] **NEWS-3**：Threads keyword search（需 app review）。
  - Outcome：增加社群訊號，但不把未核准 API 當成 committed scope。
  - Next action：取得 app review／API 權限後再做 POC。
- [ ] **NEWS-4**：sidebar「臺灣即時新聞」清單區塊。
  - Outcome：讓使用者不開地圖 layer 也能快速瀏覽事件。
  - Next action：先定義排序、數量與 loading/empty state，再接既有 clustered RPC。
- [ ] **NEWS-5**：timeline 整合 `get_news_event_dates`。
  - Outcome：時間軸只導向有資料日期，降低盲撥空白日期的誤解。
  - Next action：以 browser 跨日與無資料日驗收，維持 `subscribeDate` 契約。
- [ ] **NEWS-6**：POI 級精度（北科大、台大醫院等）。
  - Outcome：從鄉鎮代表點提升到具體場所，改善事件位置可讀性。
  - Next action：先完成路線 A/B decision log，再另開上游／DB 契約工作。

## Decision / conditional

- [ ] **NEWS-7**：補建上游 `docs/handoff/news.md`，合併目前散落在 collector、migrations 與本 repo 的契約。
  - Trigger：下一次 news schema/RSS 變更前。
  - Outcome：三 repo 有單一契約 SSOT，降低 RPC 欄位或分類漂移。
  - Acceptance：handoff 覆蓋 RPC、更新頻率、欄位、來源與回填策略，且 README 相對連結有效。

## 已完成（歷史，不列入 active）

- [x] collector、migration 162–165、分類／聚合／4 級篩選與 production baseline — 見 [changelog.md](./changelog.md)。
