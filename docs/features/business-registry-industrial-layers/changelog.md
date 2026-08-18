# Changelog — 工廠、列管設施與產業園區

## 2026-08-18 — local staging

- 新增 A1 `factoryLocations`、A2 `industrialParkBoundaries`、A5 `regulatedFacilities`、A6 `industrialParkComparison`。
- A1/A5 採 z11 gate；legend/popup 明示 coverage 與中性語意。
- 新增 `industrial_zone/` immutable upload、pull、nginx、Docker 與 deploy contract。
- A6 僅切換正式欄位 `factory_count`、`company_count`、`company_capital_total_sum`，明示 geocode coverage bias 與零值語意。
- A3 僅記錄 assertion contract，不建立虛構 map layer。
- 未 commit、push、upload 或 deploy。
