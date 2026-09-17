# Handoff — 公司登記 B1/B2/B3/A4（下游視角）

## 上游 SSOT

- `taipei-gis-analytics/docs/handoff/company-points.md`
- `taipei-gis-analytics/docs/handoff/company-capital-grid.md`
- `taipei-gis-analytics/docs/handoff/company-filters.md`
- `taipei-gis-analytics/docs/handoff/manufacturing-company-points.md`

## Immutable assets

| asset | bytes | SHA-256 | 契約 |
|---|---:|---|---|
| `public/business_registry/company_points_202608_r2.pmtiles` | 28,261,394 | `44210b690c0267e7667f514df4510e79d9b557ec400f6cc7db4cbdf638eb1184` | `company_points`, z8–14, 654,165 features；detail circle z12+；新增 `company_name` |
| `public/business_registry/company_points_overview_1500m_202608_r2.pmtiles` | 183,236 | `9352dfcc2e7d83406a1c99e6c29ff50ef8c8509e9872cf580239b883907b6d78` | `company_points_overview`, z4–11, 5,745 points；`grid_id,n_companies,n_manufacturing` |
| `public/business_registry/company_capital_grid_150m_202608_r2.pmtiles` | 17,493,436 | `153aed9746622b2b230fec6d9b3a30e5153d3544028dde1361f10cfd095c2d5c` | `company_capital_grid`, z4–14, 89,754 polygons |
| `public/business_registry/company_capital_grid_450m_202608_r2.pmtiles` | 5,821,423 | `a9c9a97b8e79ba6e94658a97e43e25b2d9fe826d1fd7b1ab3480381a280eb1cb` | `company_capital_grid_450m`, z4–13, 26,834 polygons |
| `public/business_registry/company_capital_grid_1500m_202608_r2.pmtiles` | 1,415,002 | `3feaf851d6755e6c21f50e1e8e053141940b4a3e39f8f070148b419bf25cb1e9` | `company_capital_grid_1500m`, z4–12, 5,745 polygons |
| `public/business_registry/company_filters_202608_r2.json` | 14,572 | `eac748b712faf4dd39dc414d4c3f3dfa2c778a2bab38a8031d37ae1e8ee0599f` | 89 行業中類、B1 r2 十一欄（含 `company_name`）/filter 契約 |

上表 6 個 r2 / overview / multi-scale assets（含 B3 r2 companion contract）已 upload 至 `deploy-assets/business_registry/<dated filename>`，並完成逐檔 SHA-256、size 與 object metadata 讀回驗證。Pulse `public/business_registry/` 仍是 gitignored local deploy staging；**deploy 與 production browser smoke 仍待完成**。舊 r1 assets 已上傳但不是本版前端依賴。

## 前端硬依賴

### 2026-09-10 本地呈現更新

- `companyPoints` 改為 z4 ≤ zoom < 10：1.5km polygon；10 ≤ zoom < 12：450m polygon；z12+：原始個別公司點位。
- 概覽重用上表 `company_capital_grid_1500m_202608_r2.pmtiles` 與 `company_capital_grid_450m_202608_r2.pmtiles` 的 `n_companies`，除以完整格面積（2.25／0.2025 km²）得到公司數／km²；沿岸格不改用陸地面積。不同尺度共用固定密度色階。
- `companyCapitalGrid` 保留手動尺度與原有三指標；`manufacturingCompanyPoints` 保留既有 overview。
- 個別公司篩選啟用時隱藏缺乏相應欄位的概覽，圖例提示放大至 z12；不把全公司網格當篩選結果。完整的低倍率篩選加總需要新上游資料。
- 這是既有 artifact 的本地前端呈現修改，沒有改寫來源資料、發布新 artifact 或部署正式站。驗收結果見 changelog；下方舊 B1/A4 共用 overview 描述中，B1 已由本節取代。

- B1/A4 detail 十一欄白名單：`company_name, capital_total, capital_q, is_manufacturing, categories, industry_mid, setup_year, county, addr_mismatch, is_listed, has_trademark`；popup 顯示公司名稱，不發布統編、地址或代表人。
- `capital_q=0` 是缺值；`industry_mid` 是 string，`01` 不可轉成 `1`。
- A4 detail 必須使用 B1 同 source-layer 並套 `is_manufacturing=1`；overview 改讀 `n_manufacturing`；這是公司登記地址，不是工廠位置。
- B1/A4 z4–11 顯示 1.5km 聚合計數，z12+ 顯示個別點；overview 納入全部已定位 records，不等於全部原始 rows。
- B2 三尺度都依賴 `grid_id, capital_sum, n_companies, capital_median`；尺度由使用者手動切換，未選中 source 用 `visibility:none` 避免下載。中位數缺值用 neutral 色。
- 所有資本額文字明示「202608 快照」，不使用 current／目前資本額語意。

## B3 UI 範圍

已接 89 個 `industry_mid`、21 縣市、`capital_q`、`setup_year` 範圍，以及 `is_manufacturing / is_listed / has_trademark / addr_mismatch`。同一 layer 以 `all` filter 合併，不複製圖層。

## 2026-09-10 登記產業分布／公司年齡結構

上游 SSOT：[company-demographics-grid.md](../../../../taipei-gis-analytics/docs/handoff/company-demographics-grid.md)。本次產物僅在本地 staging，尚未上傳或部署；新圖層不依賴 Supabase runtime。

| asset | bytes | SHA-256 |
|---|---:|---|
| `company_demographics_grid_1500m_202608.pmtiles` | 3,496,171 | `a5d757bcaf3dcb472327601eebc842d238c82089120a11a293100cdf12bf059c` |
| `company_demographics_grid_202608_metadata.json` | 11,150 | `04ffe155c2ed2ac09e1c8d6cd1f9b2692e642a46004c69eedb1ff056129221f4` |
| `company_demographics_grid_450m_202608.pmtiles` | 12,055,368 | `0dc3a564f4856d6bbde46aae2bbe533f2619ade8644f21369fe3f3b8fc821441` |

- 兩尺度共用 source-layer `company_demographics_grid`；450m 26,834 格、1.5km 5,745 格。每尺度公司數合計 654,165；主 agent 全量比對既有資本額網格，grid_id、逐格公司數、geometry bounds 全部相同。
- 前端硬依賴 `grid_id,n_companies,i_01…i_96`（僅 89 個有效碼）、`i_unknown`、`age_known,age_missing,age_invalid,age_recent,age_median,age_0_2,age_3_5,age_6_10,age_11_20,age_21_plus`。計數 0 是已檢查真值，缺欄位不是 0。
- 第一順位登記行業中類有值 654,165、未對應 0；年齡有效 654,149、缺設立年 16、異常年 0。五年齡桶合計等於有效年齡母體，另加缺值／異常才等於公司總數。
- 近五年設立：2022–2026，共 168,065；年齡為 `2026 - setup_year`，非逐日實歲，也不隨 timeline 改變。中位數依各尺度原始點重算。
- 網格面積採完整 0.2025／2.25 km²，不扣除海域；這是登記地址分布，不是店面、工廠或實際營業據點分布。
- 既有 nginx `/business_registry/` 及 upload/pull 目錄規則涵蓋新檔；發布仍須 scoped upload、checksum/Range 讀回與 production browser 驗收。本次未執行發布。

### 產業固定色比較

使用者要求產業群組以不同顏色比較。新增前端顯示模式：預設固定群組色，由所選群組中家數最多者決定格色；另一模式保留合計密度。原始聚合欄位與資產未改，沒有重新發布資料。群組固定色、並列／缺欄位／零觀測色由 `businessDemographicsTypes.ts` 共用，點選摘要呈現所選群組組成；最多不等於過半。
