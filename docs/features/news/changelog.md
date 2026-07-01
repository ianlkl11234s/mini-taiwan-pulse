# Changelog — news

最新在上。三 repo 同步：data-collectors / gis-platform / mini-taiwan-pulse。

---

## 2026-06-13 — v2 GIS 相關性 + 4 級篩選

**DB**：
- migration 164 — news_events + daily 加 3 欄（gis_relevance / severity / is_event），cron 改 10 分鐘
- migration 165 — clustered RPC v2 加 `(min_gis_relevance, require_event, min_severity)` 參數

**Collector**（commit `9fc0c60`）：
- SYSTEM_PROMPT_HEADER 加 3 條規則，LLM 多判 gis_relevance(0-3) / severity(0-3) / is_event
- LLM_BATCH_SIZE 20→15、interval 20→10 分鐘
- 全進不篩，前端做顯示篩選
- 實測品質佳：gis_relevance=3 正確抓出新竹氣爆 / 新莊命案 / 高雄岡山火警

**前端**（commit `292b884`）：
- Filter dropdown 4 級：critical(3/true/2) / important(2/true/0) 預設 / local(1/false/0) / all
- circle 半徑加 severity 加乘（sev 3 ×1.6 / 2 ×1.3）
- 新增 critical-halo layer（白色光暈）
- ripple 對 critical 加成（紅色、半徑 ×1.6、持續延長至 60min）

## 2026-06-13 — 階段 B：同鄉鎮聚合

- **migration 163**：新 RPC `get_news_events_day_clustered(p_day)` — 按 (lon,lat) GROUP BY，回 event_count + latest_category + events jsonb
- **mini-taiwan-pulse `295ca15`**：
  - loader 切到 clustered RPC
  - overlayRegistry 半徑依 count 放大、≥2 顯示 symbol 數字
  - popup 多則 cluster 改「📰 鄉鎮 · N 則」+ 可滾動清單；單則維持舊版型
- 實測 6/13：100 cluster / 370 events，max 51（臺北）

## 2026-06-13 — 階段 A：分類上色（commit `b50f6ba`）

- 新檔 `src/data/newsEventTypes.ts`：7 類定義（accident/crime/disaster/traffic/health/policy/other）+ match expression + helper
- overlayRegistry circle-color 從 is_primary 改 category match；other 類降透明度
- LegendPanel 新增 NewsEventsLegend；NewsEventPanel popup 中文分類 + 對應色

## 2026-06-13 凌晨 — 生產部署

- Zeabur gis-data-collectors（service `69a654b207e6de1869bf57b5`）設 `NEWS_EVENTS_ENABLED=true` + `GEMINI_API_KEY`
- 生產首輪 00:14：28/29 feeds、29 則入庫（21 geom）、2 LLM batch、$0.0023/輪；pg_cron job 55 自動聚合確認
- ⚠️ 觀察：自由時報 RSS 在 Zeabur 雲端 IP 被 403（本地正常）

## 2026-06-12 — 主功能上線（三 repo 同步）

- **data-collectors `209bde8`**：`collectors/news_events.py` — RSS ×29（CNA×3/自由×3/ETtoday/Google News geo ×22，feed 間 2.5s）→ URL 正規化 + simhash 去重 → Gemini Flash-Lite（`gemini-3.1-flash-lite-preview`，20 則/batch，368 鄉鎮 gazetteer 進 system prompt 觸發 implicit cache）→ `realtime.news_events` upsert by url_norm；20 分鐘一輪，env `NEWS_EVENTS_ENABLED` + `GEMINI_API_KEY`
- **gis-platform `e7d18c2`**：migration 162 — 表 + BEFORE INSERT trigger（admin_code → township_boundaries `ST_PointOnSurface` 補 geom；5 碼縣市降級用 `ST_Union` 代表點）+ `news_events_daily` per-day refresh + pg_cron job 55（14,34,54 分）+ `get_news_events_day(p_day)` / `get_news_event_dates()`。**已 apply 至線上**
- **mini-taiwan-pulse `7909b25`**：`newsEventsLoader.ts`（withLoading + cachedByKey）+ `useNewsEventsLayer.ts`（`subscribeDate` 跨日重載）+ `OverlayConfig.dynamicData`（source 空 FC 起手）；`useNewsTimeline` / ripple / popup **零改動**，RPC rows 組回舊 GeoJSON properties 形狀

**實測**：
- 首輪 434 則入庫、278 有地點（123 鄉鎮級）、22 LLM batch 零失敗、cache 命中 47%、$0.028/冷啟動輪
- 穩態估 $1.5–3/月（在 $1–5 目標內）
- 瀏覽器驗收 PASS：204 則/today、ripple + popup 正常
- **LLM 不吐座標的原則落實**：collector 只寫 admin_code，geom 全由 DB trigger 解析
