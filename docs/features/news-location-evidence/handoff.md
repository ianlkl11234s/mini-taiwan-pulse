# Handoff — 新聞地點證據與事件關聯 POC

> **Collector**：`data-collectors/collectors/news_events.py`
> **DB SSOT**：`gis-platform/migrations/414_news_location_evidence_poc.sql`
> **狀態**：shadow POC；尚未套用 production

## 資料流

```text
RSS article/version
  -> location evidence candidates
  -> resolved or abstained location
  -> canonical event membership
  -> event relations
  -> precise map points / scope lists
```

## RPC

`public.get_news_articles_poc(p_day, p_bucket, p_limit, p_before_published_ts)`

- `p_bucket`：`all | unlocated | national | foreign`
- `p_limit`：server 端限制 `1..100`
- `unlocated`：`accepted_location_count = 0`；不是 scope 值，也可和其他分類重疊
- `national`：`article_scope IN ('taiwan_national', 'taiwan_multi')`
- `foreign`：`article_scope = 'foreign'`，無論是否有合法國外地點
- pagination：`published_ts` keyset；相同時間以 `article_id` 維持 deterministic order（正式 RPC 若需完整 cursor，另加 compound cursor）

## 硬依賴欄位

### Article

- `article_id`、`source_name`、`source_article_id`、`canonical_url`、`title`
- `published_at`、`published_day`、`fetched_at`
- `article_scope`：`taiwan_local | taiwan_multi | taiwan_national | foreign | unknown`
- `article_location_status`：文章層級的判讀狀態；清單是否未定位仍以 `accepted_location_count` 為準
- `event_occurred_from`、`event_occurred_to`、`event_time_precision`

### Location candidate

- `location_status`：`accepted | ambiguous | unresolved | rejected`
- `location_scope`：目前顯示候選的 scope，不可拿來取代 `article_scope` 做清單分類
- `location_precision`：`address | poi | intersection | road_segment | village | township | county | country | none`
- `location_role`：`event_site | affected_area | reporting_location | organization_location | background`
- `evidence_text`、`evidence_field`
- `place_name`、`county`、`township`、`admin_code`
- `geometry_kind`、`geometry`
- `resolver`、`method_version`、`review_status`
- `location_candidate_count`、`accepted_location_count`

### Relations

- article：`same_story_candidate`
- article -> event：`primary_report | follow_up | supporting`
- event -> event：`follow_up | causal | nearby_possible`
- `nearby_possible` 只代表指定時距內相鄰，不表示同一事件或因果。

## Geometry eligibility

| precision / geometry | 地圖行為 |
|---|---|
| address / POI / intersection + accepted Point | 可顯示事件點 |
| road_segment | 顯示線段或明示近似範圍；不可假裝精確點 |
| village / township / county | 顯示行政區範圍或只留清單 |
| national / multi / foreign / unknown | 進對應清單；是否畫圖由獨立 geometry eligibility 決定 |

## 相容性

- 既有 `live.news_events` 與 `get_news_events_day_clustered_v2` 在 POC 期間不變。
- POC 元件預設不接 production UI。
- Migration 不 backfill；測試資料只能進 shadow tables。
