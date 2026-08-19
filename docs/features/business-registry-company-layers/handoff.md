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

- B1/A4 detail 十一欄白名單：`company_name, capital_total, capital_q, is_manufacturing, categories, industry_mid, setup_year, county, addr_mismatch, is_listed, has_trademark`；popup 顯示公司名稱，不發布統編、地址或代表人。
- `capital_q=0` 是缺值；`industry_mid` 是 string，`01` 不可轉成 `1`。
- A4 detail 必須使用 B1 同 source-layer 並套 `is_manufacturing=1`；overview 改讀 `n_manufacturing`；這是公司登記地址，不是工廠位置。
- B1/A4 z4–11 顯示 1.5km 聚合計數，z12+ 顯示個別點；overview 納入全部已定位 records，不等於全部原始 rows。
- B2 三尺度都依賴 `grid_id, capital_sum, n_companies, capital_median`；尺度由使用者手動切換，未選中 source 用 `visibility:none` 避免下載。中位數缺值用 neutral 色。
- 所有資本額文字明示「202608 快照」，不使用 current／目前資本額語意。

## B3 UI 範圍

已接 89 個 `industry_mid`、21 縣市、`capital_q`、`setup_year` 範圍，以及 `is_manufacturing / is_listed / has_trademark / addr_mismatch`。同一 layer 以 `all` filter 合併，不複製圖層。
