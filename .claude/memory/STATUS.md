# Status

**最後更新**：2026-09-01（Supabase 儲存稽核 → retention + road_congestion dedup/LOCF + aqi R2，全部上線驗證）

> 本檔只保留目前主線、release truth、blockers 與下一棒；歷史過程留在 git、feature 文件與 `REFLECTIONS.md`。

## Scope ledger

| repo / system | current truth |
|---|---|
| **gis-platform** | PR **#82 merged** origin/main（migrations 385-388）；migrations 已套用+驗證 production。local main 未同步 origin（ahead/behind，非本 session 造成）|
| **data-collectors** | PR **#69**（road dedup+heartbeat）、**#70**（aqi R2 雙寫）merged origin/main；**Zeabur 已部署並實測運作**（資料行為佐證）|
| **mini-taiwan-pulse** | `master`：memory + `docs/proposal/supabase-retention-2026-09-01/`；**未 push**（memory commits 依 wrap-up 不 push）|
| **DB (Supabase)** | retention cron ×7 排上、首夜 22:xx UTC 已首刷；road_congestion LOCF 上線、refresh cron 連續 succeeded；aqi 16,185 幀全上 R2 |
| **R2 (mini-tw-pulse bucket)** | aqi backfill 100%（`imagery/aqi/…`，物件數 = DB image_key 數）|

## Release truth matrix

| release unit | build | applied/upload | deploy | verify |
|---|---|---|---|---|
| migrations 385-388 | done：檔+idempotent | done：套用 DB | done：PR#82 | done：cron/function/column 查驗 |
| road_congestion dedup+LOCF | done：pytest 330 | done：#69 | done：Zeabur | done：rows/section 12→3-5；refresh 12 輪 succeeded；聚合 dash 10% 正常 |
| aqi R2 雙寫+backfill | done：pytest 339 | done：backfill 16185 = R2 count | done：#70 | done：15z 起新圖自帶 image_key |

無 `blocked`/`unknown`；全鏈第一手證據驗證。

## Blockers / next-session entry

- **無 blocker**；三改動皆上線並驗證。
- 下一步（皆可選）：
  1. read-only 驗昨晚 retention 實際回收多少空間（6 表 + aqi）。
  2. **WA-3 殘留**：把 coverage 現在 flag 的 6 表（iot_wra_measurements / ship_trails_daily / bus_trails_daily / youbike_h3_daily / news_events / freeway_sections_current）補登記或標 keep-forever。
  3. **ST-1**：aqi_imagery_frames + groundwater/rain_gauge index 的 `VACUUM FULL`（回收 OS 空間，避尖峰）。
- ⚠️ 不碰：三 repo 的 local main/master 未同步 origin，屬既有狀態，非本 session 造成，未代 sync/push。

## Verification boundaries

- 部署以 GitHub merge SHA + DB／資料行為第一手證據為準。Zeabur CLI 未登入，部署用 `image_key`（新圖自帶 key）與 `rows/section`（12→3-5）資料行為佐證，非代碼推斷。
- `stats_reset` 會歸零 pg_stat_*；判 bloat/unused-index 一律用 `pg_class.reltuples`。
