# handoff — City Sound Atlas 跨 repo 契約與發布真相

> 更新：2026-11-11。

## 發布真相（release truth）

| 項目 | 狀態 |
|---|---|
| 分支 | `feat/city-sound-atlas-mvp`（worktree `mini-taiwan-pulse/.worktrees/sound-atlas`），從 `origin/develop` `dda9caa0` 分出 |
| push／PR | **未 push、未開 PR** |
| develop／master | **都沒有**本功能；正式站沒有 |
| 場景快照 S3／R2 | **未上傳**。lock 已登記 3 筆（`delivery=r2`，`s3_key=deploy-assets/sound-atlas/scenes/<id>.json`），本機 `public/sound-atlas/scenes/` 有實體檔 |
| Worker 路由 | 本分支 `deploy/cloudflare/src/worker.js` 的 `DATA_THEN_DIST` 加了 `sound-atlas`（先 R2 再 dist），並在 `worker.test.mjs` 加一條路徑；**部署面改動**，隨發版生效 |
| 使用者決定（11-11） | 今晚用本機畫面發文，不發版；發版／合併 master 須使用者拍板 |

### 發版前必做（會擋）

1. 上傳快照：`scripts/deploy/upload-deploy-assets.sh` 依 lock 上傳 S3 `deploy-assets/`（只新增不覆寫），發版時同步到 R2。沒做 → 正式站 `/sound-atlas/scenes/*.json` 404。
2. 若重產快照（檔內有 `generated_at`，sha 會變）：重跑 `build-public-assets-lock.py add`，且要在上傳前做；S3 已有同名不同內容時上傳腳本會停下。
3. 上線後核對：`npm run check:assets -- --verify-only --paths public/sound-atlas/scenes/<id>.json` 與正式站回 200、`X-Pulse-Src: r2`。
4. VALIDATION_REPORT.md（測試、瀏覽器驗收、效能）待 W2 完成後補。

## 跨 repo 契約

本功能**不新增** RPC、migration、collector，也不寫任何 DB 或 S3。只讀：

| 上游 | 物件 | 讀者 | 契約要點 |
|---|---|---|---|
| gis-platform | `public.get_flight_trails(date)` → `live.flight_trails_daily`（保留 7 天） | aviationAdapter、快照產生器 | `day`＝臺北日；`trail`＝`lat,lng,alt,ts;…`；alt 單位依 flight_id（8 hex ft／6 hex m） |
| gis-platform | `public.get_lightning_day(text, text)` → `live.lightning_events`（保留 7 天） | thunderAdapter、快照產生器 | 一定要指定 `p_source`；`strike_ts` unix 秒；cwa event_id > 2^53 |
| gis-platform | `public.get_rain_gauge_day(date)` → `live.rain_gauge_readings`（保留 30 天） | rainFieldAdapter、快照產生器 | 每站每小時一筆（該小時最後一筆） |
| mini 靜態快照 | `/static-rpc/get_waste_schedule_day_<dow>_<分組>.json`（＝`public.get_waste_schedule_day`） | wasteAdapter | `spatial.waste_schedule_day_agg` 2026-07-22 後未刷新 |
| data-collectors → S3 | `trails/flights/<D>.json.gz`、`lightning_cwa/archives/<D>.tar.gz`、`lightning_events/archives/<D>.tar.gz` | 快照產生器 | 航跡檔＝臺北日鏡像；落雷 archive 檔名＝**收集時間**的臺北日（臺北日 D 讀 D 與 D+1） |

若上游改了上述欄位、單位或歸日方式，要同步改 adapter 與 `build-sound-scenes.py`。

## 建議另開的 BACKLOG（不在本分支修）

- FlightScene 把 FR24 英尺當公尺（`src/three/FlightScene.ts` 163–164、333 行），3D 高度放大約 3.28 倍。
- `lightningLoader.ts` 檔頭「台電 07-10 起回空」已過時；Monitor 主來源是否改回台電待決。
- cwa `event_id` 超過 2^53，前端解析失真（RPC 可考慮回 text）。
- 垃圾車表 `waste_schedule_day_agg` 2026-07-22 後未刷新；臺北星期規則回官方確認。

## 接手點

- 引擎與 adapter：`src/sound/`（W1 完成）；UI：W2 進行中。
- 快照：`scripts/preprocess/build-sound-scenes.py`（場景清單在檔內 `SCENES`）；驗算：`scripts/preprocess/verify-sound-scenes.ts`。
- 執行計畫與波次：GIS `.gis-agent-system/projects/2026-11-11-city-sound-atlas/PLAN.md`。
