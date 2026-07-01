# News Events（新聞事件）

> **Slug**：`news`
> **狀態**：✅ shipped（2026-06-12 三 repo 全通；6-13 上生產 + 階段 A/B + v2 4 級篩選完成）
> **Owner**：migu
> **上線時分支**：master
> **相關 commits**：data-collectors `209bde8` / gis-platform migration 162~165 / mini-taiwan-pulse `7909b25` + `b50f6ba`（階段 A）+ `295ca15`（階段 B）+ `292b884`（v2 前端）+ 9fc0c60（collector v2）
> **memory 時點**：2026-06-13

## 一句話說明

RSS ×29 → Gemini Flash-Lite 地名抽取 → `realtime.news_events` → 前端按日載入 + 分類上色 + 同鄉鎮聚合 + GIS 相關性 4 級篩選的即時台灣新聞地圖。

## 圖層 / 元件

| 名稱 | 類型 | 資料源 | 狀態 |
|---|---|---|---|
| newsEvents（含 cluster） | point + ripple + critical-halo | Supabase RPC `get_news_events_day_clustered(p_day)` | ✅ v2 |

7 類分類（overlayRegistry circle-color match by category）：accident / crime / disaster / traffic / health / policy / other（other 類降透明度）。

## 關鍵檔案

### 前端（mini-taiwan-pulse）

- Loader：`src/data/newsEventsLoader.ts`（withLoading + cachedByKey）
- Hook：`src/hooks/useNewsEventsLayer.ts`（`subscribeDate` 跨日重載）
- Overlay：`OverlayConfig.dynamicData`（source 空 FC 起手）
- Types SSOT：`src/data/newsEventTypes.ts`（7 類定義 + match expression + helper）
- Legend：`LegendPanel.tsx` → `NewsEventsLegend`
- Popup：`NewsEventPanel`（單則 vs cluster「📰 鄉鎮 · N 則」+ 可滾動清單）
- Timeline / ripple / popup：**零改動**（RPC rows 組回舊 GeoJSON properties 形狀）

### 後端

- data-collectors `collectors/news_events.py`（RSS ×29 / 20 分鐘一輪 / env `NEWS_EVENTS_ENABLED` + `GEMINI_API_KEY`；v2 改 10 分鐘）
- gis-platform migration 162 / 163 / 164 / 165

## 資料契約摘要

看 [handoff.md](./handoff.md)。上游 SSOT：`../../../taipei-gis-analytics/docs/handoff/news.md`（尚未建，待補）。

## 相關 backlog

看 [backlog.md](./backlog.md)。

## 相關文件

- 全站 memory：`~/.claude/projects/.../memory/news-roadmap.md`
- 研究報告：`docs/research/news-layer-revival-2026-06.md`
