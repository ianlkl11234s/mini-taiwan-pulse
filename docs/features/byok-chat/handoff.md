# Handoff — byok-chat（下游視角）

> **無上游新契約**：本 feature 純前端，消費既有資產，無 taipei-gis-analytics handoff。
> 規劃 SSOT：`docs/proposal/member-byok-chat-plan.md`。

## 消費的既有資產

| 類型 | 內容 | 契約點 |
|---|---|---|
| 靜態 geojson | `DATASET_WHITELIST` 13 個（police_stations / fire_stations / schools / wasteStopsStatic…） | URL 沿用 overlayRegistry sourceUrl；`police_stations_20260626` 帶日期戳（BC-5） |
| H3 人口 | `public/h3/h3_population_res7.json`（8345 格，d/n 欄位） | resolution 從 metadata 動態取 |
| anon RPC | `RPC_WHITELIST` 10 支（data_catalog×2 / fire×2 / h3×2 / source_health / news_trending / waste_counts×2） | 參數名對齊 migration 簽名；pooler 2min timeout 適用 |
| 外部 API | api.anthropic.com / api.openai.com / generativelanguage.googleapis.com | 瀏覽器直連（CORS）；Anthropic 需 dangerous-direct-browser-access header |

## 下游（未來 P0/P3）依賴本 feature 的點

- `chat_logs`（P3）將記錄 question / tool_calls / usage —— schema 見 plan §6.2
- 會員收藏的 state_snapshot 與 chat 的 `MapBridge.getVisibleLayerKeys()` 共用圖層 key 語彙
