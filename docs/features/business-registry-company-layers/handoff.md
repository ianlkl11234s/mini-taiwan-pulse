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
- 2026-09-18 起 A4 改獨立 `manufacturing_company_points_202608_allzoom.pmtiles`，由完整 company source 的 `is_manufacturing=1` 篩出，保持公司登記地址語意。舊共用 source + overview 契約已取代。
- B1 維持密度概覽／z12 原點；A4、工廠、列管設施從全台尺度起顯示完整有座標原點，密度改由三個獨立圖層提供。
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

## 2026-09-18 全縮放工業點位與獨立密度（LOCAL_ONLY）

上游重現：`../taipei-gis-analytics/pipelines/business_registry/08_allzoom_density.py`；契約：`../taipei-gis-analytics/docs/handoff/industrial-allzoom-density.md`。點位 z0–14 禁止抽稀與聚合，最低 zoom 實解筆數與三個有座標母體一致。缺座標記錄不推測補點。

| 本地 artifact | records / cells | SHA-256 |
|---|---:|---|
| `public/business_registry/factory_density_1500m_202606.pmtiles` | 3,673 | `990def03aae7978b913693b55866adae8e19195e49b7c785bc3d6b75f1a8764d` |
| `public/business_registry/factory_density_450m_202606.pmtiles` | 14,285 | `2a04cb1a65ecd1e4f423c5dade26df08173c2af9b0bcdcb7bc046d3a3470a797` |
| `public/business_registry/factory_locations_202606_allzoom.pmtiles` | 90,652 | `69eb8b02945717efdc84d8eecdfecda8750011d9ee89faaa7851d79e8feca23a` |
| `public/business_registry/manufacturing_company_density_1500m_202608.pmtiles` | 4,664 | `26df1dd39eb0223c767172fec5a87b1f89f5ec550698241fe36a4cb72a83ee70` |
| `public/business_registry/manufacturing_company_density_450m_202608.pmtiles` | 20,584 | `b95811e6284bbf097f0607d1c712a5fd7964779a1bcd74e63443cfabf82fa03c` |
| `public/business_registry/manufacturing_company_points_202608_allzoom.pmtiles` | 184,944 | `4ca87ad9dd39d95139ffd033dfff1be97ec223b04f5ffeaf64c0155d61880712` |
| `public/business_registry/regulated_facility_density_1500m_20260818.pmtiles` | 4,930 | `8fc9c718856c2a2a6ec2feb88c7f1e8b5f2fa7387da4ae23e8bc72138422ddc3` |
| `public/business_registry/regulated_facility_density_450m_20260818.pmtiles` | 18,317 | `1981a289f0e16f95693a0ba1c481b24f86fc1ea1af021d407af3a2146e833b6e` |
| `public/business_registry/regulated_facilities_20260818_allzoom.pmtiles` | 80,732 | `dc2f1e1dae80246ebffac638e238d3978e157ba34adc3e39b0f9cfcb40af2678` |

密度 `business_density_grid` 欄位：`grid_id`, `n_records`, `density_per_km2`, `grid_size_m`。網格為 EPSG:3826 固定 450 / 1500m 方格，密度除以完整格面積，不扣除海域。每種來源兩尺度各自加總守恆。前端只在 z4+ 顯示密度；z0 point count 驗證不延伸為 z0 polygon 全格可視的宣稱。

驗收：TypeScript 通過；54 個接線／expression／圖例／資料契約測試與 15 個 golden 測試通過。Browser 已確認全台原點三層、工廠 1.5km/450m 網格與 popup（G450_176_592：2 家，9.9 家/km²）。以上為提交前本地驗收；Git 發布狀態見下方 PR 紀錄。

補充 browser 驗收：三種原點與三種密度層均於 z7.38 全台視野確認可見；工廠密度在 z10.5 確認 450m 格與 popup。上游小型測試 3/3 通過（canonical grid、加總守恆、無效／缺失座標拒絕）。

## 2026-09-18 PR 整合驗收

- 前端 PR #260：保留產業／年齡既有 commit，分開提交標籤開關、科學色階、工業點位與密度；一般 merge 整合當前 master。
- 上游 PR https://github.com/ianlkl11234s/taipei-gis-analytics/pull/92 已一般合併，merge `01671db4cc871138bd968dbf82f0de80fdbab2be`；pytest 5 passed。
- 整合版 build 通過；完整測試 1595 passed / 8 skipped（掛載本地 PMTiles 前後均通過）。資料掛載後更新全 zoom SHA 與六個密度檔契約，PMTiles 契約 2/2 通過，驗到本次九個工業 artifacts。
- 整合版 browser 確認三個雙語名稱及全台工廠密度；Factory Density、Manufacturing Registry Density、Regulated Facility Density。
- 資料發布 gate：11 個 PMTiles＋2 個 sidecar，共 400,533,320 bytes；上傳與線上 Range/readback 尚未完成，不以 Git 合併代表 production ready。

### 資料發布回條（2026-09-18）

使用者明確授權後，13 檔共 400,533,320 bytes 已新增至既有 `s3://migu-gis-data-collector/deploy-assets/business_registry/`；逐檔 HEAD 大小／SHA metadata 與 S3 整檔下載 SHA 驗證通過。網站 `/data/business_registry/` 同步後 13 檔 SHA 均通過；沒有刪除或覆寫舊版本，也沒有重啟服務。完整檔案回條見 `evidence/20260918-publication.json`。上述待上傳 gate 已解除；CDN 驗證與最終 merge 狀態以 PR #260 回條為準，不以資產發布代表前端新程式已部署。
