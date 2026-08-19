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

## 前端接線位置

- Loader：`src/data/animalAdoptionLoader.ts`
- Hook：`src/hooks/useAnimalAdoptionLayer.ts`
- Host：`src/layers/hosts/animalWelfareHosts.tsx`
- Manifest：`src/data/layerManifest.ts`（唯一登記 SSOT）
- 月報 Loader：`src/data/animalShelterOutcomesLoader.ts`
- 月報 Hook：`src/hooks/useAnimalShelterPressureLayer.ts`（重用 NLSC 縣市 PMTiles）

## 硬依賴欄位

- `canonical_shelter_id` — popup 時序查詢 key
- `longitude` / `latitude` — 官方收容所位置
- `listed_count` — 圓圈大小與 popup 數量
- `species_counts` — 犬／貓分色與 popup
- `latest_snapshot_date` — 資料時間與趨勢查詢上界
- `report_grain_key`／`period_start` — 月報 grain 與實際資料月
- `official_metrics.fe_sum_count` — 月底在養總數
- `official_metrics.max_stay_dog_count`／`max_stay_cat_count` — 犬貓核定容量；兩者完整時才衍生總容量使用率

## 下一個 session 起手：production backend smoke test 與 browser 驗收

這一輪前端程式已完成，不要重做資料層。gis-platform migrations 353–357 已套用至 production，下列 5 支 PostgREST RPC 已實測 HTTP 200；先做一次 production smoke test 確認契約未漂移，再直接進 browser 驗收。不得以 mock、舊月份 fallback 或補 0 假裝成功。

- `get_animal_adoption_shelter_summary(p_county_code, p_animal_kind)`
- `get_animal_adoption_daily(p_from, p_to, p_county_code, p_shelter_id, p_animal_kind)`
- `get_animal_shelter_pressure_latest(p_county_code, p_include_ambiguous)`
- `get_animal_shelter_pressure_monthly(p_county_code, p_from_year, p_to_year, p_include_ambiguous)`
- `get_animal_shelter_outcome_monthly(p_county_code, p_from_year, p_to_year, p_include_annual)`

先跑 `npx tsc -b` 與 animal welfare focused tests，再啟動本機前端做 browser 驗收：

1. 關閉其他圖層，只開 `animalAdoption`；確認官方收容所點位、泡泡大小、popup 與每日序列，缺日保留缺口。
2. 關閉其他圖層，只開 `animalShelterPressure`；確認重用 22 縣市 boundary、缺值透明、顯示實際資料月份，popup 可載成果趨勢。
3. 確認 ambiguous revisions 預設排除，壓力與成果不跨來源相加，也不把缺值轉成 0。
4. 確認 console 無錯誤、loading 不會卡住，並保存畫面與 RPC 回應作為驗收證據。

驗收通過後更新 feature backlog／changelog；未取得明確授權前不要 deploy 或 push。開發伺服器依工作區規則管理，不要使用 `pkill -f vite`。
