# Changelog — 急診壅塞 er_hospital

> 逐 PR 變更紀錄。最新在上。

---

## 2026-07-26 — ERCard 全醫院分區網格改版（branch `feat/er-hospital-grid`，PR #待補）

- **上游**：gis-platform migration `319`（`public.get_er_hospital_24h_all()`，無參數、anon+authenticated、實測 26ms / 59 rows / 每院約 84 點），已 apply production。
- Loader 新增 `fetchErHospital24hAll()`（`cachedOnce` 60s + `withLoading("er:24h:all")`）；單院 `fetchErHospital24h()` 保留（popup `EmergencyHospitalPanel` 仍在用）。
- 新增 `src/components/intel/monitor/erCardData.ts`：19 縣市 → 台電四大區對映（宜蘭歸北部）+ `buildErRegionGroups()`。實測 area_name 無離島縣市（澎湖／金門／連江無重度級或兒童急救責任醫院），未知縣市落「其他」保底。
- `ERCard.tsx` 改版：移除縣市 select／醫院 chip tabs／單院大圖，改為 59 院全覽 —— 北部 30 / 中部 17 / 南部 10 / 東部 2 分區 section（區名 + 院數），區內按等一般病床 desc；小卡 = 院名（截斷）+ 等床大字（嚴重度色）+ 24h `wait_general_cnt` 迷你 sparkline（沿用 PowerCard UNIT OUTPUT 的 `Sparkline`，無軸）。grid `auto-fill minmax(140px,1fr)`。
- 嚴重度判定／配色仍走 `erCongestionTypes.ts` SSOT，未改閾值。輪詢維持 5 min。
- **驗收**：`tsc -b` exit 0 / `vitest run` 18 files 197 綠 / browser 2000×1300（監看格）+ 900×1200（堆疊）雙尺寸親驗，console 無新 error。

## 2026-07-10 — Batch 1（branch `feat/er-hospital`，未 PR / 未 push）

- 新增 `erHospital` 圖層：掛在既有「醫療 Medical」section 新增的「即時 Emergency」group。59 家重度級/兒童急救責任醫院即時急診量能，動態 GeoJSON circle 層，點色分 5 級壅塞。
- **上游**：gis-platform migration `283_er_hospital_rpcs.sql`（`get_er_hospital_latest()` + `get_er_hospital_24h(hosp_id)`），已 apply production、anon 實測通過。免 pre-aggregate（資料量小）。
- **座標**：即時表無座標 → 前端 join 既有 `public/geo/medical_hospitals.geojson`（`facility_id === hosp_id`，57/59 命中），2 家（聯醫仁愛 0101020017、大甲光田 1536030075）用 geojson 院區座標 override 硬編。
- **popup**：`EmergencyHospitalPanel`（medicalPanels.tsx）— 4 項量能 + inform + 24h「等一般病床」折線（複用 `TimeseriesSparkline`，warningValue=49 紅線）。
- **Monitor**：`ERCard.tsx` — 原生 select 選區（19 區 + 全台）+ 壅塞 top-6 醫院 tab + 24h sparkline + 壅塞燈。
- **著色 SSOT**：`src/data/erCongestionTypes.ts`，主軸 wait_general_cnt，閾值依 2026-07-10 er_hospital_status **37 天 history 校準**（p50=17/p75=31/p90=49/max=160）→ 綠≤15 / 黃16–31 / 橙32–49 / 紅>49 / 灰=無資料；`wait_icu>0` 加白 ring。
- **驗收**：`tsc -b` exit 0 / `pnpm test` 190 綠（含 layerConsistency）/ browser 親驗（popup 林口長庚 severe + 24h 折線、Monitor ERCard 截圖）。
- **Breaking**：無（純新增）。需 migration 283。

### 待辦（backlog）
- `upstreamRegistry` 暫標 `pulse_only`（catalog handoff pending）→ 待補 taipei-gis-analytics catalog 條目後升 `verified`。
- `inform` Y/N 旗標語意未證實（Y 佔 15%）→ v1 只 popup 展示，累積比對一個月後再決定是否升為紅燈條件。
- 急救責任醫院名單年年評定會變 → geojson join 命中率會漂移，loader 已 log 未命中數。
