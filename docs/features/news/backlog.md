# Backlog — news

> memory 時點 2026-06-13。Phase 1 + 階段 A/B + v2 完成。Phase 2 為擴充題。

## 進行中

- [ ] **NEWS-liberty-403-obs**：⚠️ 觀察項 — 自由時報 RSS 在 Zeabur 雲端 IP 被 403（本地正常）。單 feed 失敗不影響其他 feed；若持續 → 改 UA 偽裝或走 Google News 間接（UDN/TVBS 模式）

## Phase 2+ 待辦（memory 明列）

- [ ] **NEWS-ptt**：PTT 地方板（Atom feed 共用同條 LLM 管線）
- [ ] **NEWS-threads**：Threads keyword search（需 app review）
- [ ] **NEWS-sidebar-list**：sidebar「臺灣即時新聞」清單區塊
- [ ] **NEWS-timeline-dates**：timeline 整合 `get_news_event_dates`
- [ ] **NEWS-poi-precision**：POI 級精度（北科大、台大醫院等具體場所）— 路線 A+B 規劃見 session 紀錄

## 已完成（近期）

### v2 GIS 相關性 + 4 級篩選（2026-06-13）
- [x] **NEWS-mig-164**：migration 164 — news_events + daily 加 3 欄（gis_relevance / severity / is_event），cron 改 10 分鐘
- [x] **NEWS-mig-165**：migration 165 — clustered RPC v2 加 `(min_gis_relevance, require_event, min_severity)` 參數
- [x] **NEWS-collector-v2**：commit `9fc0c60` SYSTEM_PROMPT_HEADER 加 3 條規則，LLM 多判 gis_relevance(0-3) / severity(0-3) / is_event；LLM_BATCH_SIZE 20→15、interval 20→10 分鐘；全進不篩前端做顯示篩選；實測品質佳（gis_relevance=3 正確抓新竹氣爆/新莊命案/高雄岡山火警）
- [x] **NEWS-frontend-v2**：commit `292b884` — 4 級 filter dropdown（critical 3/true/2 / important 2/true/0 預設 / local 1/false/0 / all）；circle 半徑加 severity 加乘（sev 3 ×1.6 / 2 ×1.3）；critical-halo layer（白色光暈）；ripple 對 critical 加成（紅色、半徑×1.6、持續延長至 60min）

### 階段 B 同鄉鎮聚合（2026-06-13）
- [x] **NEWS-mig-163-cluster**：migration 163 新 RPC `get_news_events_day_clustered(p_day)` — 按 (lon,lat) GROUP BY，回 event_count + latest_category + events jsonb
- [x] **NEWS-frontend-cluster**：commit `295ca15` loader 切 clustered RPC；overlayRegistry 半徑依 count 放大、≥2 顯示 symbol 數字；popup 多則 cluster 改「📰 鄉鎮 · N 則」+ 可滾動清單；單則維持舊版型
- [x] **NEWS-cluster-verify**：實測 6/13 — 100 cluster / 370 events，max 51（臺北）

### 階段 A 分類上色（2026-06-13, commit `b50f6ba`）
- [x] **NEWS-types-ssot**：新檔 `src/data/newsEventTypes.ts`（7 類定義 + match expression + helper）
- [x] **NEWS-color-match**：overlayRegistry circle-color 從 is_primary 改 category match；other 類降透明度
- [x] **NEWS-legend-popup**：LegendPanel 新增 NewsEventsLegend；NewsEventPanel popup 中文分類 + 對應色

### 主功能上線（2026-06-12）
- [x] **NEWS-collector**：data-collectors `209bde8` `collectors/news_events.py` — RSS ×29（CNA×3/自由×3/ETtoday/Google News geo ×22，feed 間 2.5s）→ URL 正規化 + simhash 去重 → Gemini Flash-Lite（`gemini-3.1-flash-lite-preview`，20 則/batch，368 鄉鎮 gazetteer 進 system prompt 觸發 implicit cache）→ `realtime.news_events` upsert by url_norm；20 分鐘一輪
- [x] **NEWS-mig-162**：gis-platform migration 162 — 表 + BEFORE INSERT trigger（admin_code → township_boundaries ST_PointOnSurface；5 碼縣市降級用 ST_Union 代表點）+ `news_events_daily` per-day refresh + pg_cron job 55（14,34,54 分）+ `get_news_events_day(p_day)` / `get_news_event_dates()`
- [x] **NEWS-frontend**：mini-taiwan-pulse `7909b25` newsEventsLoader（withLoading + cachedByKey）+ useNewsEventsLayer（subscribeDate 跨日重載）+ OverlayConfig.dynamicData（空 FC 起手）；useNewsTimeline/ripple/popup **零改動**
- [x] **NEWS-baseline-verify**：首輪 434 則入庫、278 有地點（123 鄉鎮級）、22 LLM batch 零失敗、cache 命中 47%、$0.028/冷啟動輪；穩態估 $1.5–3/月（在 $1–5 目標內）；瀏覽器驗收 PASS 204 則/today
- [x] **NEWS-prod-deploy**：2026-06-13 凌晨 Zeabur gis-data-collectors（service `69a654b207e6de1869bf57b5`）已設 `NEWS_EVENTS_ENABLED=true` + `GEMINI_API_KEY`；生產首輪 00:14 28/29 feeds、29 則入庫（21 geom）、2 LLM batch、$0.0023/輪；pg_cron job 55 自動聚合確認

## 已放棄 / 延後

- 暫無

## 已記錄的坑

- **`google-genai` 套件首跑沒裝** → 432 則以無地點入庫，且 url_norm 去重會讓它們**永遠不被重處理** → 已 TRUNCATE 重跑。日後 LLM 大規模失敗，記得清掉該批或寫 backfill
- **homebrew Python 3.14 PEP 668**：裝套件要 `pip3 install --break-system-packages`
- **Google News 2026 新格式 redirect**（`AU_yqL…`）解不出真實 URL → fallback 用 `articles/<id>` 當 url_norm，跨媒體重複由 simhash 層攔
- **LLM 不吐座標的原則**：collector 只寫 admin_code，geom 全由 DB trigger 解析

## TBD

- Zeabur env 是否已設完（memory 說已設 `NEWS_EVENTS_ENABLED` + `GEMINI_API_KEY`，但 MEMORY.md 提「Zeabur env 待設」— 兩處不一致，待用戶確認）
