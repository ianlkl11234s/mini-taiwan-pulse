# Changelog — 台灣好行 tourist_shuttle

> 逐 PR 變更紀錄。最新在上。

---

## 2026-07-10 — Batch 1（branch `feat/er-hospital`，未 PR / 未 push）

> ⚠️ 因並行約束，本 feature 與急診 er-hospital 接在同一 branch（共用檔變更交織，無法乾淨拆兩 PR）。

- 新增 `touristShuttleLive` 圖層：交通「即時運具」group。全國台灣好行觀光公車即時位置（564 台 / 82 路線 / 41 業者），progress-based 沿路線 LineString 3D orb 渲染（車不亂走）。
- **範本**：完全比照「公路客運 intercity」變體；`BusEngine` / `BusScene` / `busCustomLayer` 零改動重用（僅 BusScene/busCustomLayer 加 gated `setOpacity`，不影響既有公車）。
- **上游**：gis-platform migration `284_tourist_shuttle_rpcs.sql`（`get_tourist_shuttle_current()` + `tourist_shuttle_trails_daily` 預聚合 + refresh + pg_cron + `get_tourist_shuttle_trails/_dates`），apply production + backfill 7 天 + anon 實測。
- **路線幾何**：`public/bus/tourist_shuttle_routes.json`（6.73MB，147 entries，key=`{route_uid}_{direction}`），由 taipei-gis-analytics `08_build_tourist_shuttle_routes.py` 過濾既有 bus shapes 產生，**命中率 100%（82/82）**，多子線選最長。
- **cron**：refresh `:12/:27/:42/:57`（錯開 bus :02 / intercity :07）、cleanup `03:12`、**trails retention 30 天**（比 intercity 3 天長，避免 Replay 日期被 positions 7 天綁死）。
- **驗收**：`tsc -b` exit 0 / `pnpm test` 190 綠（公車 test 未受影響）/ browser 親驗（日月潭沿路線 orb 137 台 replay + LIVE 564 台 fresh-server 實測 poll 200）。
- **Breaking**：無（純新增）。需 migration 284。

### 待辦（backlog）
- **距離 gate（v2）**：v1 用 route_uid 級配對（多子線挑最長），未加「GPS 距 shape >500m fallback 畫原始點」的防抖 gate（因需動 BusEngine 共用 hot path、且 100% 命中風險低，刻意延後）。
- **sub_route 級精準幾何（v2）**：129 sub_route vs 82 route，v1 挑最長子線；v2 走 TDX Tourism/Bus/Shape 端點取 SubRouteUID 幾何（需先驗端點是否含 SubRouteUID）。
- route JSON 6.73MB **走 S3 deploy-assets**（gitignore + `BUS_BIG_FILES` + pull loop 已設）；⚠ 上線前需跑 `scripts/deploy/upload-deploy-assets.sh` 上傳，否則正式環境 nginx `/bus/` 抓不到。
- upstreamRegistry 沿用 `bus_realtime` datasetId（比照 busIntercityLive）。
