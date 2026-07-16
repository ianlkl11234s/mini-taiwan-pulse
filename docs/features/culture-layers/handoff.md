# Handoff — culture-layers（下游視角）

> **上游 SSOT**：`../../../taipei-gis-analytics/docs/handoff/culture-layers.md`（詳細契約看那份）
>
> 本檔只放**前端接線的簡表 + 上游約定的差異點**。契約細節不重複寫，只反向引用。

## 上游 handoff 摘要

- 產物路徑：靜態 4 檔 `public/culture/*.geojson`（快照副本，git 管理，❌ 無 PMTiles / S3）；realtime 走 Supabase RPC `public.get_tpml_seat_current()` / `public.get_tpml_seat_24h(p_area_id)`
- 更新頻率：arts_events 每月**整檔換血**（滾動窗，uid 集合大變動）；performing_venues 每月 upsert 只增不減；facilities 年更；museums 不定期；tpml_seat 10 分鐘（collector 自動，前端輪詢即可）
- 座標系統：WGS84（events/venues 的 lon/lat 是 properties 冗餘欄，與 geometry 同值）
- 資料量：787 / 252 / 6,121 / 857 features；RPC current 固定 29 rows（6 分館）、24h 約 144 rows/區
- 上游保證：pulse 版已 drop null-geometry（每 feature 100% 有 Point 幾何）、已 drop `coord_status`、minified

## 前端接線位置

- 色票 SSOT：`src/data/cultureTypes.ts`
- Realtime loader：`src/data/librarySeatsLoader.ts`（withLoading + cachedOnce）
- Realtime hook：`src/hooks/useLibrarySeatsLayer.ts`（setInterval 輪詢，比照 er-hospital，不接 timeStore）
- Overlay：`src/map/overlayRegistry.ts`
- UI toggle：`src/components/sidebar/layerCatalog.ts`（LAYER_COLORS + THEMES「文化 Culture」）
- Popup：`src/components/featureInfo/culturePanels.tsx` + `registry.tsx`

## 硬依賴欄位（改一定爆）

- `facility_type`（facilities）— 6 類分色 match expression + 分類篩選 + 圖例
- `type`（museums）— 5 類分色 + 分類篩選 + 圖例
- `start_date` / `end_date`（events，`YYYY/MM/DD` 零填字串）— 進行中/未開始分色與篩選靠**字典序比較**，格式改了會爆
- `event_count`（venues）— 半徑 √ 權重
- RPC `get_tpml_seat_current`：`branch_name`（6 分館聚合 key）/ `free_count` / `total_count` / `is_closed` / `lat` / `lng` / `area_id`（傳給 24h RPC）
- RPC `get_tpml_seat_24h`：`observed_ts`（unix **秒**）/ `free_count` / `is_closed`

## 上游改動 → 下游要跟改的觸發點

- arts_events `category` 目前是原始代碼（"1"-"19"，無官方對照）→ 上游查得轉換表後，popup「類別代碼」要改顯示名稱、可考慮升級成分類篩選
- 欄位改名/移除 → 上游先改 handoff 再動（上游 §4 約定）
- 金門：facilities/venues 有經度 118.25 起的點；events 本月恰無外島點是巧合，下月滾動窗可能出現 → 前端永遠不得加 lon ≥ 119/120 的 bbox 假設
- `is_closed=true` 語意：**必須顯示「休館中」，不能顯示 0 空位**（閉館快照 free_count 無意義）
