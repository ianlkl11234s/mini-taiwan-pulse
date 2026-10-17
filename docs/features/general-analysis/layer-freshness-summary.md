# 圖層 metadata 與資料新鮮度摘要

> 由 `scripts/research/build-layer-freshness.mjs` 產生；逐層明細見 [layer-freshness.csv](./layer-freshness.csv)。
> 即時層最新時間取自上次線上查詢 snapshot（查詢時間 2026-10-05T13:28:57Z）；其餘以 2026-10-05 為基準日。
> 「unknown」不是正常：缺資料時間或缺數值化更新間隔時，不推定新鮮。檔案 mtime 不當成資料時間。

- 圖層總數：**982**
- metadata 五欄齊全：**180/982**
- 新鮮 **398**／過期（資料年齡 > 3 倍預期間隔）**16**／未知 **464**／靜態（lifecycle=static，不預期更新，另列）**104**
- 即時層 DB 查詢：46 張表，成功 44，跳過 2

## 資料類型

| 資料類型 | 圖層數 |
|---|---|
| custom_or_derived | 95 |
| dynamic_live | 73 |
| static_asset | 346 |
| statistics_snapshot | 420 |
| supabase_static | 48 |

## 各欄位缺漏圖層數

| 欄位 | 缺漏圖層數 |
|---|---|
| source | 18 |
| license | 616 |
| coverage | 241 |
| time_fields | 363 |
| refresh_interval | 415 |

## metadata 缺漏前 20 名

（同缺漏數時依資料類型、key 排序；缺漏數相同的圖層遠多於 20，完整清單看 CSV。）

| layer_key | 缺漏欄位 | 資料類型 |
|---|---|---|
| aquacultureIntegrated | source、license、coverage、time_fields、refresh_interval | static_asset |
| canopyGiants | source、license、coverage、time_fields、refresh_interval | static_asset |
| evIsland | source、license、coverage、time_fields、refresh_interval | static_asset |
| gasCoverageAll | source、license、coverage、time_fields、refresh_interval | static_asset |
| jpBuildingHeight | source、license、coverage、time_fields、refresh_interval | static_asset |
| jpCanopyHeight | source、license、coverage、time_fields、refresh_interval | static_asset |
| propertyValueGrid | source、license、coverage、time_fields、refresh_interval | static_asset |
| cemsStackLive | source、license、coverage、time_fields、refresh_interval | supabase_static |
| cwaUvDaily | source、license、coverage、time_fields、refresh_interval | supabase_static |
| facOffshore | source、license、coverage、time_fields、refresh_interval | supabase_static |
| islandPowerGrid | source、license、coverage、time_fields、refresh_interval | supabase_static |
| nuscGammaRadiation | source、license、coverage、time_fields、refresh_interval | supabase_static |
| osmPowerPlantsStatic | source、license、coverage、time_fields、refresh_interval | supabase_static |
| osmSolarFarms | source、license、coverage、time_fields、refresh_interval | supabase_static |
| parkingOffstreet | source、license、coverage、time_fields、refresh_interval | supabase_static |
| parkingOnstreet | source、license、coverage、time_fields、refresh_interval | supabase_static |
| powerPlants | source、license、coverage、time_fields、refresh_interval | supabase_static |
| waterEffluentLive | source、license、coverage、time_fields、refresh_interval | supabase_static |
| fireIsochrone | license、coverage、time_fields、refresh_interval | custom_or_derived |
| gfwDarkVessels | license、coverage、time_fields、refresh_interval | custom_or_derived |

## 過期前 20 名（依 年齡／預期間隔 由大到小）

| layer_key | 最新資料時間 | 依據 | 預期間隔 | 年齡（日） |
|---|---|---|---|---|
| a1AccidentRealtime | 2026-06-27T16:20:24Z | db_snapshot | live:720min | 99.88 |
| medAED | 2026-05-24 | catalog_last_updated | daily | 135.00 |
| tourAttractions | 2026-07-22 | catalog_last_updated | daily | 76.00 |
| eduCramSchool | 2026-08-07 | catalog_last_updated | daily | 60.00 |
| agriProduceWholesale | 2026-05-25 | catalog_last_updated | monthly | 134.00 |
| agriRetail | 2026-05-25 | catalog_last_updated | monthly | 134.00 |
| agriWholesaleMarket | 2026-05-25 | catalog_last_updated | monthly | 134.00 |
| coastGuardStation | 2026-06-26 | catalog_last_updated | monthly | 102.00 |
| correctionalFacility | 2026-06-26 | catalog_last_updated | monthly | 102.00 |
| crimeAreaMonthly | 2026-06-26 | catalog_last_updated | monthly | 102.00 |
| immigrationOffice | 2026-06-26 | catalog_last_updated | monthly | 102.00 |
| policeIsoCityDept | 2026-06-26 | catalog_last_updated | monthly | 102.00 |
| policeIsoPrecinct | 2026-06-26 | catalog_last_updated | monthly | 102.00 |
| policeIsoSubstation | 2026-06-26 | catalog_last_updated | monthly | 102.00 |
| policeStation | 2026-06-26 | catalog_last_updated | monthly | 102.00 |
| womenChildWarning | 2026-06-26 | catalog_last_updated | monthly | 102.00 |

## 即時層未能取得時間（標未知）

| layer_key | 原因 |
|---|---|
| temperatureWave | unqueried:no_time_index(relkind=p,reltuples=-1) |
| temperatureGrid | unqueried:no_time_index(relkind=p,reltuples=-1) |
| aqiMicroSensors | unqueried:no_time_index(relkind=p,reltuples=-1) |

## 即時層對照表尚未涵蓋（live-map 的 _unmapped）

| layer_key | 原因 |
|---|---|
| nuscGammaRadiation | not in yaml (analytics id environment.radiation_realtime_nusc); useEnvironmentLiveLayer.ts:16; collector pending per manifest |
| waterEffluentLive | not in yaml (environment.effluent_auto_monitoring); useEnvironmentLiveLayer.ts:17; collector pending |
| cemsStackLive | not in yaml (environment.cems_realtime, 4-5h upstream lag); useEnvironmentLiveLayer.ts:18; collector pending |
| cwaUvDaily | not in yaml (environment.uv_index_daily_max, previous-day max, not realtime); useEnvironmentLiveLayer.ts:19 |
| vesselWatch | get_vessel_watch_current reads live.vessel_watch_positions/registry (mig 346), not in yaml |
| gfwVesselPresence | live.gfw_vessel_presence_current is in yaml (1440) but manifest says legacy daily collector disabled; real freshness = public.get_gfw_hourly_publish_health() |
| gfwHourlyTracks | freshness via get_gfw_hourly_publish_health(), deliberately excluded from generic MAX(time) (yaml comment) |
| windField | static frames /climate/frames/manifest.json (climateFrames.ts:24), not Supabase; global_climate_grids is producer only |
| oceanCurrents | same as windField (static climate frames) |
| dustForecast | same as windField (static climate frames, CAMS) |
| rail | timetable-inferred positions, not a live table; train_positions in yaml but layer does not read it |
| medICUBeds | manifest: not in active THEMES; no table identified |

## 判定規則與限制

- 即時層：`layer-freshness-live-map.json` 指到 live 表與時間欄，預期間隔抄自 data-collectors `realtime_tables.yaml`；查 `max(time)`，大表（reltuples >= 100000）時間欄沒有 btree 前導索引就跳過。事件驅動表（地震、閃電等）的間隔本來就放寬，無事件不代表壞掉。confidence=medium 表示前端實際讀衍生表／view，對照的是同 collector 的底層表，底層新鮮不保證衍生表也更新。
- 統計 snapshot：最新時間 = 配方最新 release 的 `period_end`（觀察期末，不是發布日）；預期間隔取自倉庫 catalog 同 dataset 的 lifecycle，沒有就是未知。
- 其他圖層：最新時間 = 倉庫 catalog `last_updated`（取同層各 dataset 中最新者）；預期間隔 = 該 dataset 的 lifecycle（daily 1／weekly 7／monthly 31／quarterly 92／semi_annual 183／yearly 366 日）；irregular／manual／planned 沒有數值，維持未知。**catalog last_updated 是倉庫收錄的資料版本日期，不保證等於來源端最新發布日。**
- 純圖層（沒有倉庫 dataset、沒有 manifest 版本日期）沒有任何時間依據 → 未知。
