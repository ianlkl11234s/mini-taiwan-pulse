# Handoff — 急診壅塞 er_hospital（下游視角）

> **上游 SSOT**：尚未建立 taipei-gis-analytics catalog 條目（**待補**，見 backlog）。
> 目前契約直接定義在 gis-platform migration `283_er_hospital_rpcs.sql`。

## 上游 handoff 摘要

- 資料源：衛福部健保署 NHI 即時 API（`collectors/er_hospital_realtime.py`，Zeabur，15 分整點更新）
- 表：`realtime.er_hospital_current`（59 家最新）+ `realtime.er_hospital_status`（時序，自 2026-06-03 累積）
- 兩表皆有 anon SELECT RLS policy
- RPC（public，anon）：
  - `get_er_hospital_latest()` → `hosp_id, hosp_name, area_no, area_name, level_name, inform, wait_see_cnt, wait_bed_cnt, wait_general_cnt, wait_icu_cnt, observed_ts`
  - `get_er_hospital_24h(p_hosp_id text)` → `observed_ts, wait_see_cnt, wait_bed_cnt, wait_general_cnt, wait_icu_cnt`
- **座標不由 RPC 回傳**：前端 join `public/geo/medical_hospitals.geojson`（`facility_id === hosp_id`）

## 前端接線位置

- 著色 SSOT：`src/data/erCongestionTypes.ts`
- Loader：`src/data/erHospitalLoader.ts`（latest + 24h + geojson 座標 join + 2 家 override）
- Hook：`src/hooks/useErHospitalLayer.ts`（circle 層，當下快照，不接 timeStore）
- Overlay：`src/map/overlayRegistry.ts`（dynamicData circle config）
- UI toggle：`src/components/sidebar/layerCatalog.ts`（LAYER_COLORS + 醫療 §即時 Emergency）
- Popup：`src/components/featureInfo/medicalPanels.tsx`（EmergencyHospitalPanel）
- Monitor：`src/components/intel/monitor/ERCard.tsx`

## 硬依賴欄位（改一定爆）

- `hosp_id` — join geojson `facility_id` 的鍵（座標來源）
- `wait_general_cnt` — 著色主軸（5 級壅塞）
- `wait_icu_cnt` — icu>0 白 ring
- `observed_ts` — popup/Monitor 24h 時間軸
- geojson `facility_id` — 座標 join 對側鍵

## 上游改動 → 下游要跟改

| 上游改動 | 下游動作 |
|---|---|
| 急救責任醫院名單變動 | geojson join 命中率漂移，檢查 override 清單 + loader 未命中 log |
| RPC 欄位改名 | erHospitalLoader mapper + 著色 SSOT 同步 |
| 補 taipei-gis-analytics catalog 條目 | upstreamRegistry 從 `pulse_only` 升 `verified` |

## 已知不對稱

- upstreamRegistry 標 `pulse_only`（RPC 已上 production，但上游 catalog 尚無 dataset 條目）。
