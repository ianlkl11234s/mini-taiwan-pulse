# Changelog — 路況 road_congestion

> 逐 PR 變更紀錄。最新在上。

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
