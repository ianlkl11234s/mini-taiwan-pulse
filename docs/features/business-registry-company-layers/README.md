# 公司登記點位、網格與篩選

> **Slug**：`business-registry-company-layers`  
> **狀態**：r2 assets 已 upload 並讀回驗證；deploy / browser smoke 待完成
> **上線日期**：待授權

## 一句話說明

以同一份 202608 公司登記快照提供低倍率全已定位 records 概覽、可點擊個別公司、三尺度資本額網格與前端篩選；不宣稱即時或目前營業狀態。

## 圖層 / 元件

| layer key | 類型 | 資料源 | 狀態 |
|---|---|---|---|
| `companyPoints` | z4–9 1.5km／z10–11 450m 密度網格，z12+ 個別 Point | 既有 grid + detail PMTiles | 本地呈現更新，未部署 |
| `manufacturingCompanyPoints` | z4–11 製造業計數概覽，z12+ 個別 Point | 與 B1 共用兩個 sources | 🟡 uploaded / deploy pending |
| `companyCapitalGrid` | 150m / 450m / 1.5km Polygon | 三份 PMTiles，手動切換 | 🟡 uploaded / deploy pending |
| `companyIndustryDistribution` | 1.5km / 450m Polygon | 完整行業計數 PMTiles | 本地新增，未部署 |
| `companyAgeStructure` | 1.5km / 450m Polygon | 完整年齡結構 PMTiles | 本地新增，未部署 |

B3 是 `companyPoints` 的 params/filter 契約，不另建 11 個 layer；companion asset 固定為 `company_filters_202608_r2.json`。B1/A4 共用 detail source；B1 概覽與 B2 共用 polygon source，A4 保留計數 overview。低倍率只呈現格網，不在 z4 下載 65 萬個含名稱 feature。

## 關鍵檔案

- Manifest：`src/data/layerManifest.ts`
- 視覺與 filter SSOT：`src/data/businessRegistryTypes.ts`
- Params：`src/data/layerParamsSpec.ts`
- Overlay：`src/map/overlayRegistry.ts`
- Popup：`src/components/featureInfo/businessRegistryPanels.tsx`
- 契約：[handoff.md](./handoff.md)

## 2026-09-10 產業與年齡圖層

尺度切換、登記產業分布與公司年齡結構均已獲使用者核可。本次以 202608 完整已定位公司母體產製兩尺度聚合，再進行本地接線；發布狀態與驗收結果見 handoff / changelog。

### 產業分布

本版是一個圖層、多選產業。預設以固定類別色顯示「所選群組中家數最多的產業」，可切回固定藍色色階的合計密度。第一大不代表超過半數，也不代表該格只有該產業；popup 提供各所選產業家數及占比。並列最多另標示，不任意用排序挑一類；必要欄位缺值不當成 0，選取產業為 0 的網格透明。每家公司僅計一次；另有原始行業中類下拉選單，可聚焦單一中類（取代群組條件）。比較不同產業時，在相同範圍與尺度切換選取；多選聯集不等於各產業分別比較。LQ 登記行業集中度與並排視圖保留為後續，不在本版介面。

使用十個瀏覽群組（產品導覽分組，非新的官方分類）；另提供原始中類下拉選取，未知值另列：

| 群組 | 現有 industry_mid 代碼 |
|---|---|
| 農林漁牧、資源與公用事業 | 01–06、35–39 中的有效代碼 |
| 製造業 | 08–34 |
| 營造與不動產 | 41–43、67–68 |
| 批發與零售 | 45–48 |
| 運輸、倉儲與郵遞 | 49–54 |
| 住宿與餐飲 | 55–56 |
| 資訊、通訊與媒體 | 58–63 |
| 金融與保險 | 64–66 |
| 專業與企業支援服務 | 69–82 中的有效代碼 |
| 教育、照顧、休閒與其他服務 | 83–96 中的有效代碼 |

第一與最後一組較廣，必須保留子類選取，不可宣稱群組內公司彼此相似。正式分類依 [主計總處行業統計分類](https://www.stat.gov.tw/standardindustrialclassification.aspx?n=3144&rid=11&sms=0) 檢核；現有 codebook 並非完整涵蓋全體機構。

來源 `industry_mid` 是第一順位登記行業代碼中類，不是已驗證實際營業主業；`categories` 是多值來源群組，不作產業替代欄位。LQ 只稱「登記行業集中度」。算法為區域已分類公司之某類占比／全台相同母體占比；缺行業者獨立顯示、公開分類覆蓋率。小樣本標為不足，門檻需先看分布再定；分母為零時不可給 0 或無限大。

已從完整中繼資料沿用 canonical grid origin 重算 450m／1.5km 產業計數，沒有加總地圖當前載入或抽稀點。新資料附上游 manifest、QA、checksum 與跨 repo handoff；本地資產尚未發布。

### 公司年齡結構

獨立圖層，預設「近 5 年設立占已知設立年公司比例」，另可看年齡中位數。現有公開欄位只有設立年，使用 `2026 - setup_year` 作近似年齡，明示「202608 快照／按年份估算」，不使用今日日期滾動增加年齡。

Popup 顯示近似年齡 0–2、3–5、6–10、11–20、21 年以上五組人數與占比、有效分母、缺值數；若近 5 年使用 0–4 歲，UI 明示是 2022–2026 設立，不與 0–5 歲混用。來源 QA 記錄 16 筆設立年 missing，聚合需以實際發布母體重新核對。未知不算成 0 歲，未來年份另標異常。

這是快照內公司年齡組成，不是新增率、成長率、存活率或當地產業新舊程度的定論。多尺度中位數從完整有效年份重算，不做 median of medians。與產業篩選交叉時需上游聯合聚合契約，不能以獨立邊際分布推估交叉結果。
