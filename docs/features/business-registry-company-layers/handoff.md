# Handoff — 公司登記 B1/B2/B3/A4（下游視角）

## 上游 SSOT

- `taipei-gis-analytics/docs/handoff/company-points.md`
- `taipei-gis-analytics/docs/handoff/company-capital-grid.md`
- `taipei-gis-analytics/docs/handoff/company-filters.md`
- `taipei-gis-analytics/docs/handoff/manufacturing-company-points.md`

## Immutable assets

| asset | bytes | SHA-256 | 契約 |
|---|---:|---|---|
| `public/business_registry/company_points_202608.pmtiles` | 15,049,420 | `c2021ad8866963721fc41d363800b5f98197d82ec38da4974ed8afc85c6788a1` | `company_points`, z8–14, 654,165 features；circle z12+ |
| `public/business_registry/company_capital_grid_202608.pmtiles` | 15,114,716 | `35a6ea13c0259525e461792b382b9476fac5fcb931b7192ce69f5f2f0b1be8eb` | `company_capital_grid`, z6–14, 89,754 features |
| `public/business_registry/company_filters_202608.json` | 14,127 | `733b956d87eabe525f7cceb53cb30b90f8222043c24980f6eac2e42d24c9a895` | 89 行業中類、B1 共用欄位/filter 契約 |

三檔是 gitignored deploy staging；production key 為 `deploy-assets/business_registry/<dated filename>`。三檔已上傳並逐檔讀回驗證，尚未 deploy。

## 前端硬依賴

- B1/A4 十欄白名單：`capital_total, capital_q, is_manufacturing, categories, industry_mid, setup_year, county, addr_mismatch, is_listed, has_trademark`；無公司名、統編、地址或代表人。
- `capital_q=0` 是缺值；`industry_mid` 是 string，`01` 不可轉成 `1`。
- A4 必須使用 B1 同 source-layer 並套 `is_manufacturing=1`；這是公司登記地址，不是工廠位置。
- B2 四欄：`grid_id, capital_sum, n_companies, capital_median`；中位數缺值用 neutral 色。
- 所有資本額文字明示「202608 快照」，不使用 current／目前資本額語意。

## B3 UI 範圍

已接 89 個 `industry_mid`、21 縣市、`capital_q`、`setup_year` 範圍，以及 `is_manufacturing / is_listed / has_trademark / addr_mismatch`。同一 layer 以 `all` filter 合併，不複製圖層。
