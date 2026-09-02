# Changelog — 路況 road_congestion

> 逐 PR 變更紀錄。最新在上。

---

## 2026-09-01 — dedup + heartbeat + 285 LOCF（data-collectors #69 / gis-platform #82 migration 386，已上線驗證）

- **收集器 dedup**：`road_sections_live` 從「每 5 分鐘全量 append」改為「congestion_level/travel_speed/travel_time 任一變化才寫」（float4 round(2) 防浮點誤判）；`road_sections_current` 維持每輪全量 upsert。**每台北日第一輪 bypass dedup 全量寫一次（heartbeat）** 保證每天至少一張完整快照。實測 rows/section 12 → 3-5（省 ~57-75%）。
- **285 改 LOCF**（migration 386）：原 `refresh_road_congestion_daily()` 純時間桶對位、無 forward-fill，稀疏化會破洞/整段消失。重寫成 LOCF forward-fill（island 技巧）+ 跨日 seed（`seed_lookback_days=1`，依賴 heartbeat）+ section 清單改用 `road_sections_current`。簽名/回傳 char(288)/合約不變。
- **blast radius**：全 repo grep 確認 `road_sections_live` 唯一時間窗讀取端就是這支聚合。
- **驗收**：pytest 330（含 heartbeat 跨日）；合成稀疏 4 案 + 正式庫向後相容抽樣 50/50 不覆蓋有效讀數；部署後 refresh cron 連續 12 輪 succeeded、聚合 dash 10% 正常；EXPLAIN 44s（15-min cron 餘裕充足，約基準 2x，dedup 後降）。
- 取捨：`seed_lookback_days` 必須 < road_sections_live retention（7 天）；若 refresh 成長可拆 seed 子查詢（見 BACKLOG ST-2）。

---

## 2026-07-10 — Batch 2（branch `feat/road-congestion`，stack 於 feat/er-hospital，未 PR / 未 push）

- 新增 `roadCongestion` 圖層（即時監控 §，**v1 省道 highway**）：省道路段依即時 congestion level 綠→紅染色。
- **全站首個 PMTiles feature-state 染色**：幾何走 PMTiles（不隨 RPC 帶），前端 `setFeatureState`（promoteId=`section_uid`）。有別於 freeway 的 GeoJSON setData 每 tick 重建。
- **上游 migration 285**：288 字元編碼 pre-aggregate（每段一列 char(288)，每字元一 5min 槽，`'1'-'4'`=level `'-'`=無資料）+ refresh + pg_cron `:00/:15/:30/:45` + cleanup 03:15 + `get_road_congestion_day/_dates`。payload **2.1MB raw**（vs 裸抄 freeway day-RPC 43MB）；refresh 23 秒未 OOM；backfill 7 天。
- **PMTiles** `road_congestion_highway.pmtiles`（2.65MB，6818 段 z5-14，keep_attrs section_uid+section_id，走 S3 `deploy-assets/road/`，taipei-gis `06_export_highway_congestion_pmtiles.sh`）。
- 前端：loader 288 解碼 + hook feature-state diff 染色（只在 level 變/換日 flush，不每 frame 全刷）+ hit 層 popup（section_id + 當前等級）+ 4 級圖例 + opacity/width slider。
- **驗收**：tsc 0 / test 190 / browser 主 agent 親驗（彰化省道四色染色截圖 + promoteId round-trip 實證）。
- Breaking：無（純新增）。需 migration 285 + PMTiles 上 S3。

### 待辦 / 取捨
- **⚠ refresh 延遲取捨**：pre-aggregate refresh 落後當下 ~15-18 分鐘 → 前端 clamp 到「最新可得快照」（對齊 freeway snap-back，真正離線路段仍灰）。若要嚴格精確 slot（當下可能全灰、等下輪 refresh）→ 拿掉 loader `lastPopulatedSlot` + hook `Math.min` clamp。
- v2：市區 city 5 縣市（桃園/台中/台南/基隆/宜蘭，台中幾何 2.7 頂點過粗）、速度欄位 popup、refresh 分段（若資料成長）。
- popup 只有 section_id/section_uid（無路名，資料源本身無此欄位）。
