# Handoff — animal-adoption（下游視角）

> 上游 SSOT：`../../../taipei-gis-analytics/docs/handoff/animal-adoption.md`

## 上游 handoff 摘要

- 摘要 RPC：`public.get_animal_adoption_shelter_summary(p_county_code?, p_animal_kind?)`
- 時序 RPC：`public.get_animal_adoption_daily(p_from,p_to,p_county_code?,p_shelter_id?,p_animal_kind?)`
- 更新頻率：每日快照；不是 realtime
- 座標系統：WGS84
- 地圖粒度：官方收容所點位；popup 才載單所每日序列
- 壓力 RPC：`public.get_animal_shelter_pressure_latest(p_county_code?, p_include_ambiguous=false)`
- 成果 RPC：`public.get_animal_shelter_outcome_monthly(p_county_code,p_from_year?,p_to_year?,p_include_annual=false)`
- 壓力／成果是官方月報，不是 realtime；缺月與歧義 revision 不補 0
- 服務點 RPC：`get_animal_welfare_points(p_point_types,p_county_codes,p_bbox,p_include_inactive,p_include_unlocated,p_limit,p_offset)`；預設 `null/null/null/false/false/5000/offset`，必須翻頁至短頁（active located baseline 7,020 筆）
- 服務點歷程：只在 popup 點擊單點後呼叫 `get_animal_welfare_point_history(...,p_limit=400)`；不得在初次載圖逐點查詢
- 服務點欄位：保留 facility canonical key、類型、服務標籤、地址／電話／狀態、WGS84、geocode metadata、details、availability／last_seen／source count；無效座標不進地圖

## 前端接線位置

- Loader：`src/data/animalAdoptionLoader.ts`
- Hook：`src/hooks/useAnimalAdoptionLayer.ts`
- Host：`src/layers/hosts/animalWelfareHosts.tsx`
- Manifest：`src/data/layerManifest.ts`（唯一登記 SSOT）
- 月報 Loader：`src/data/animalShelterOutcomesLoader.ts`
- 月報 Hook：`src/hooks/useAnimalShelterPressureLayer.ts`（重用 NLSC 縣市 PMTiles）
- 服務點 Loader／Hook：`src/data/animalWelfarePointsLoader.ts`／`src/hooks/useAnimalWelfarePointsLayer.ts`（7 類 filter、未 cluster）

## 硬依賴欄位

- `canonical_shelter_id` — popup 時序查詢 key
- `longitude` / `latitude` — 官方收容所位置
- `listed_count` — 圓圈大小與 popup 數量
- `species_counts` — 犬／貓分色與 popup
- `latest_snapshot_date` — 資料時間與趨勢查詢上界
- `report_grain_key`／`period_start` — 月報 grain 與實際資料月
- `official_metrics.fe_sum_count` — 月底在養總數
- `official_metrics.max_stay_dog_count`／`max_stay_cat_count` — 犬貓核定容量；兩者完整時才衍生總容量使用率
- `source_dataset_id`／`source_record_key` — service-point popup history 查詢 key
- `point_type`／`service_tags`／`name`／`address`／`phone`／`status` — 服務點分類、圖例與 popup

## 2026-08-20 驗收證據

- production migrations 353–360 已套用；adoption summary/daily/current/individual history、pressure latest/monthly/outcomes、service-point summary/points/history RPC 均 HTTP 200。
- service points 分頁實測為 5,000 + 2,020 = 7,020；source keys 全唯一、跨頁無重疊、座標皆有效且全為 listed。
- `npx tsc -b` 通過；全站 `npm test -- --run` 為 50 files、649 passed、1 skipped。
- Browser All Off 單層驗收：adoption 點位＋daily popup、pressure 縣市著色＋monthly popup、service points 8 選項 type filter＋7 類 legend＋按點 history 均通過；乾淨重載後 console 無 error/warn。
- Browser 首輪抓到 service-point radius 把含 `zoom` 的 interpolate 再包乘法，Mapbox 拒絕渲染；已改為直接縮放各 zoom stop，並新增 expression 回歸測試。

本地 pressure 驗收需暫時從正式站補 `base_map/county_boundary.pmtiles`（S3/gitignored 資產）；驗收後已移除。未取得明確授權前不要 deploy、push 或上傳資產。
