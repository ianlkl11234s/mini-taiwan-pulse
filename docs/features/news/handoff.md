# Handoff — news（下游視角）

> **上游 SSOT**：`../../../taipei-gis-analytics/docs/handoff/news.md`（尚未建，待補）
> 三 repo 契約散在：`data-collectors/collectors/news_events.py` + `gis-platform` migration 162~165 + 本 repo
>
> 契約細節看上游，本檔只放前端接線簡表。

## 上游摘要

- 產物：Supabase RPC
  - `get_news_events_day(p_day)`（migration 162，v1）
  - `get_news_events_day_clustered(p_day)`（migration 163，v1 cluster）
  - `get_news_events_day_clustered(p_day, min_gis_relevance, require_event, min_severity)`（migration 165，v2 篩選）
  - `get_news_event_dates()`
- 更新頻率：collector 10 分鐘一輪；pg_cron job 55 每 20 分（14,34,54 分）refresh `news_events_daily`
- 座標：WGS84（geom 由 DB trigger 從 `admin_code` 解析）
- 資料量：穩態每日約數百則，$1.5–3/月 Gemini
- 費用目標：$1–5/月

## 前端接線位置

- Loader：`src/data/newsEventsLoader.ts`（withLoading + cachedByKey）
- Hook：`src/hooks/useNewsEventsLayer.ts`（`subscribeDate` 跨日重載）
- Overlay：`OverlayConfig.dynamicData`（source 空 FC 起手）
- Types SSOT：`src/data/newsEventTypes.ts`（7 類：accident/crime/disaster/traffic/health/policy/other）
- Legend：`LegendPanel.tsx` → `NewsEventsLegend`
- Popup：`NewsEventPanel`（單則 vs cluster 兩版型）
- Timeline / ripple / popup 舊組件：**零改動**（RPC rows 組回舊 GeoJSON properties 形狀）

## 硬依賴欄位（改一定爆）

RPC 回傳每筆 event 必含：

- `category` — 7 類 match expression 上色 & legend & popup
- `gis_relevance` (0-3) — 4 級 filter dropdown
- `severity` (0-3) — circle 半徑加乘（3 ×1.6 / 2 ×1.3）、critical-halo、ripple 加成
- `is_event` — filter dropdown 條件
- `admin_code` — DB trigger 解析出 geom（前端不直接讀，但 collector 必寫）
- `url_norm` — upsert dedupe key

Cluster RPC 每筆額外含：`event_count` / `latest_category` / `events`（jsonb）— popup 可滾動清單依賴。

## 上游改動 → 下游要跟改的觸發點

| 上游改動 | 下游動作 |
|---|---|
| 加新 category（7 → N） | `newsEventTypes.ts` 加對照 + NewsEventsLegend + circle-color match |
| 改 `gis_relevance` / `severity` 尺度 | Filter dropdown 4 級門檻 + circle 半徑加乘表 |
| 改 RPC 簽名 | Loader `get_news_events_day_clustered` 呼叫 |
| 加新 RSS 來源 | 前端無感（只影響量）；若語言/地區擴充要更新 gazetteer |
| gazetteer 更新（368 鄉鎮 → N） | Collector system prompt 改動；DB trigger `township_boundaries` 對照 |

## 已知不對稱

- 上游 `docs/handoff/news.md` **尚未建** — 三 repo 契約散在 collector code / migrations / 本 changelog
- Zeabur env 狀態：memory 說已設，MEMORY.md 說「待設」— 待確認
- 自由時報 RSS 在 Zeabur 雲端 IP 被 403（本地正常）— 若持續，改 UA 偽裝或走 Google News 間接
- LLM 大規模失敗回收：url_norm 去重會讓「LLM 失敗的 URL 永遠不被重處理」— 6/12 已踩過（`google-genai` 沒裝），修法是 TRUNCATE 重跑；日後應寫 backfill

## TBD

- 上游 handoff SSOT 何時建（三 repo 契約合流）
- POI 級精度（北科大/台大醫院）路線 A+B 詳細規劃 — 參 session 紀錄
