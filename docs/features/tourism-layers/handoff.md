# Handoff — 觀光 Tourism（下游視角）

> **上游 SSOT**：`../../../taipei-gis-analytics/docs/handoff/tourism-layers.md`（詳細契約看那份）
>
> 本檔只放**前端接線的簡表 + 上游約定的差異點**。契約細節不重複寫，只反向引用。

## 上游 handoff 摘要

- 產物路徑：`taipei-gis-analytics/output/tourism/pulse/*.geojson` × 12（快照腳本 `pipelines/tourism/08_pulse_export.py`）
- 部署分流：9 檔 C 類進 git `public/tourism/`；attractions / hotels / restaurants 3 檔 D 類 → S3 `deploy-assets/tourism/` → volume `/data/tourism/`
- 更新頻率：觀光署家族（景點/旅宿/活動/餐飲）上游每日更，本 repo 手動重跑（monthly lifecycle）；其餘 yearly/irregular
- 座標系統：WGS84（geometry 為準，props 無 lat/lon）
- 資料量：31,333 features / 16.4MB（minified）

（完整契約 → 上游 handoff §3）

## 前端接線位置

- 靜態檔：`public/tourism/*_national.geojson`（12 檔，overlayRegistry 直接 fetch，無 Supabase loader）
- Overlay：`src/map/overlayRegistry.ts`（12 entries）
- UI toggle：`src/components/sidebar/layerCatalog.ts`（THEMES「觀光 Tourism」+ LAYER_COLORS + SECTIONS）
- Legend：`src/components/LegendPanel.tsx` + LEGEND_REGISTRY
- Popup：featureInfo registry + `useMapInteraction`

## 硬依賴欄位（改一定爆）

- attractions：`category`（五值分色）、`annual_visitors_2024` / `yoy_pct`（熱度模式；**null = 非統計據點顯示灰，不是 0**）
- hotels：`hotel_classes`（逗號串代碼 1~4，分色 + select 篩選）
- activities：`start_time` / `end_time` / `event_status`（三態時間篩選）
- heritage：`category`（古蹟/歷史建築/文化景觀 三值分色；注意不是 `grade`）
- scenic areas：`name` / `area_km2`（⚠️ `manager` 實測全 null、`category` 為常數，前端不顯示）
- hot_spring_zones：`zone_no` / `name` / `area_m2`

## 上游改動 → 下游要跟改的觸發點

| 上游改動 | 下游動作 |
|---|---|
| 重跑 08_pulse_export.py（每月） | C 類 9 檔重 copy 進 git；D 類 3 檔重跑 upload-deploy-assets.sh tourism 段 |
| category / hotel_classes 值域變動 | 分色 expression + 圖例 + select options 同步 |
| cuisine_class 官方對照表出現 | tourRestaurants v2 升級分色（見 backlog） |

## 已知不對稱

- 上游 Supabase `tourism.*` 15 表是 store-of-record，**前端不讀 DB**，只吃 GeoJSON 快照
- 觀光活動（tourEvents，觀光署節慶 828）與 culture 的 `artsEvents`（文化部藝文 6,121）不同源不同性質，side-by-side 並存，label 刻意區分
- 森林遊樂區 / 博物館 / 步道等已由其他主題涵蓋，觀光分組不重做（上游 handoff §6-1）
