# Changelog — 工廠、列管設施與產業園區

## 2026-08-18 — A1 low-zoom overview

- 新增 `factory_locations_overview_1500m_202606.pmtiles`（3,673 格），z4–10 顯示全 90,652 筆已定位工廠的聚合計數。
- z11+ 仍使用 `factory_locations_202606.pmtiles` 個別點，概覽與 detail 都可點擊。
- overview 已 upload，並完成 SHA-256、size、object metadata 讀回驗證；**deploy / production browser smoke 仍 pending**。

## 2026-08-18 — local staging

- 新增 A1 `factoryLocations`、A2 `industrialParkBoundaries`、A5 `regulatedFacilities`、A6 `industrialParkComparison`。
- A1/A5 採 z11 gate；legend/popup 明示 coverage 與中性語意。
- 新增 `industrial_zone/` immutable upload、pull、nginx、Docker 與 deploy contract。
- A6 僅切換正式欄位 `factory_count`、`company_count`、`company_capital_total_sum`，明示 geocode coverage bias 與零值語意。
- A3 僅記錄 assertion contract，不建立虛構 map layer。
- 當時 A1 detail / A2 / A5 / A6 後續已 upload；本次新增的 A1 overview 也已 upload 並讀回驗證，仍待 deploy / browser smoke。
