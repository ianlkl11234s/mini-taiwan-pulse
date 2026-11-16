# realtime-incidents（即時 119 案件／警廣即時路況）前端交接

- 圖層：`fire119Live`（消防 › 事件）、`pbsRoadEventsLive`（交通 › 即時監控），皆站主限定（manifest `OWNER_ONLY`＋gis-platform `public.gated_layers`）。
- 上游（反向引用）：
  - 計畫與站主決策：taipei-gis-analytics `docs/topic-research/realtime_incidents/`（`PLAN.md`、`decision-log.md`）
  - 表與 RPC：gis-platform `migrations/555_fire119_pbs_live_owner.sql`（`get_fire119_live`／`get_pbs_road_events_live`，時間窗 60–360 分）
  - 收集器：data-collectors `external/fire119_vm/`（HiCloud VM，每分鐘）
  - 路段線：analytics `pipelines/realtime/road_gazetteer/`（OSM ODbL）產出 `road_lines_20261116.pmtiles` → 本 repo `public/base_map/`（lock 登記，發版前上傳 S3 deploy-assets）
  - 鄉鎮代表點：同一份 gazetteer `towns` 表（representative_point）→ `src/data/townRepresentativePoints.json`
- 前端檔案：`src/data/liveIncidents{Types,Loader}.ts`、`src/hooks/use{Fire119Live,PbsRoadEventsLive}Layer.ts`、`src/layers/hosts/liveIncidentsHosts.tsx`、`src/components/legend/liveIncidentsLegends.tsx`、`src/components/featureInfo/liveIncidentsPanels.tsx`。
- 呈現規則（實作）：
  - 當下快照，開著時每分鐘重抓，不接時間軸；RPC 一律取 360 分鐘，「時間範圍」1／3／6 小時在前端依受理時間篩（新北沒有受理時間，看最後一次內容變化）。
  - 返隊：灰化，依 `updated_at` 60 分鐘線性淡出到不上圖。脈動最多 20 個（取最新受理）。
  - 沒有位置（none 且沒有醫院、district 沒有鄉鎮碼）的件數寫在圖例，不靜默消失；`meta.truncated` 也寫在圖例。
- 未入倉：兩層要列進 pulse-data `registry/_display_only.yaml`（站主限定、即時個資近似資料），之後重產 `layer-status.csv` 才過 Warehouse gate。
