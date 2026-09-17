# Changelog — 公司登記 B1/B2/B3/A4

## 2026-09-10 — 產業群組固定配色（本地完成）

- 預設改為「產業群組色」，十群組固定不同色、unknown 灰；所選群組中家數最多者決定格色，並列米白、必要欄位缺失深灰、零觀測透明。聚焦中類使用所屬群組色。
- 新增顯示方式，可切回「合計密度」；兩模式各自圖例。Popup 排序列出所選群組家數及占比，明示最多不一定過半、分母為所選公司合計。
- 未改資料、未 upload／部署。Mapbox expression 編譯及實際求值覆蓋最多／並列／真零／缺值／單中類；型別檢查、manifest／golden／expression／helper 39 tests 通過。
- 本地 browser：z7.17 全台彩色與圖例可見；z11 點選原 3,171 家格，批零 1,087（34.3%）、專業支援 642（20.2%）、金融 469（14.8%）等與上游逐欄加總一致；密度模式切換顏色／圖例成功。

## 2026-09-10 — 登記產業分布與公司年齡結構（本地完成）

- 新增兩個獨立圖層，z4–<10 使用 1.5km、z≥10 使用 450m 全量聚合網格。十產業群組加 unknown 可多選；單中類下拉可聚焦；全不選隱藏網格。
- 年齡提供近五年設立占比／年齡中位數，popup 顯示五桶家數與占比、有效分母、缺值／異常及小樣本提醒。
- 全量母體 654,165 公司；設立年有效 654,149、missing 16、invalid 0。新舊 grid_id、逐格公司數及 geometry bounds 全量一致。上游 6 tests、兩 PMTiles verify 通過。
- 修復 Mapbox 數值 expression 不能混合 null 的樣式錯誤：以負 sentinel 僅作內部不可用分支，外層顯示 neutral，真值 0 不變。新增 style validation 涵蓋全選／全不選／單中類／兩種年齡指標。
- 網格精確點選 e.point，避免 POI bbox 容差命中鄰格；z10 僅查 450m，避免透明 bridge 搶點擊。
- `npx tsc -b` 通過；frontend focused 66 tests 通過；最終改動後 expression/helper 8 tests 通過。全套 1347 pass／2 skipped／1 fail，仍為原有 upstreamRegistry 的 14 個農漁業／日本 catalog refs，無新工商登記缺失。log `/private/tmp/company-demographics-full-tests.log`。
- 本地 HTTP Range 206，450m header range `0-126/12055368`。未 upload、部署或 production 驗收。LQ／並排比較保留後續。

### 本地 browser 驗收

| 案例 | 結果 |
|---|---|
| z11，G450_354_827 全產業 | 3,171 家／15,659.3 家/km² |
| 同格單中類 56 餐飲 | 42 家／207.4 家/km²，與來源一致 |
| 同格製造＋住宿餐飲多選 | 172 家／849.4 家/km²，與來源一致 |
| 全關產業群組 | 網格隱藏 |
| 同格 age | 近五年 1,103／3,171 = 34.8%，median 7，五桶家數／占比與來源一致 |
| age 指標／透明度 | median 圖例切換、slider 0.1／0.65 成功 |
| z9.99，G1500_107_247 | age 4,319／14,258 = 30.3%，median 8；industry 14,258／6,336.9 家/km² |
| z10 精確交界 | 使用 450m；點選 3,171 家格而非鄰格 |

Screenshot：`/private/tmp/company-age-structure-20260910.png`。以上為桌機本地驗收，未聲稱 mobile 或 production。

## 2026-09-10 — 公司登記分布本地調整

- `companyPoints` 改名公司登記分布，低倍率以 1.5km／450m 網格公司密度呈現，z12+ 保留個別公司。
- 密度單位為家／km²，共用固定藍色色階 0／10／50／200／1000／5000／10000；預設總透明度 0.65，缺值保持 neutral。450m 資料的非空格 P50=19.8、P90=261.7、P99=1580.2、max=15659.3 家／km²，級距為固定門檻而非每次重算分位。
- 設定篩選條件時隱藏不支援該條件的全量概覽，圖例提示放大查看；既有資本額網格手動尺度與製造業計數概覽保持原語意。
- 修正 mapbox-pmtiles roundZoom 在交界前使用下一級 tile 的空窗：render maxzoom 延長 0.01，paint 在 z10／z12 精確歸零，避免雙尺度疊色。
- 產業多選與公司年齡的新增圖層建議記於 README；尚未產製新加總資料、尚未接線。
- 型別檢查與相關 47 項測試通過；全套 1343 pass／2 skipped／1 fail，fail 是原有 upstreamRegistry 的 14 個農漁業／日本 catalog refs 缺失，無工商登記 ref。原始 log `/private/tmp/company-scale-tests.log`。
- 本地 browser 已確認 450m 點選數值（1814 家／8958 家/km²）、z12.6 個別公司可見、縣市篩選後概覽提示。另已驗證 z9.67 的 1.5km 網格（7289 家／3239.6 家/km²）、z11.8 的 450m 網格（1523 家／7521 家/km²）。尚未部署。

## 2026-08-18 — r2 zoom / multi-scale adjustment

- B1/A4 新增 z4–11 1.5km 全已定位 records 計數概覽，z12+ 保留個別點。
- detail 改用 `company_points_202608_r2.pmtiles`，popup 顯示 `company_name`，不顯示代表人。
- B3 companion contract 改用 `company_filters_202608_r2.json`，欄位白名單與 B1 r2 的 `company_name` 對齊；SHA-256 `eac748b712faf4dd39dc414d4c3f3dfa2c778a2bab38a8031d37ae1e8ee0599f`。
- B2 改為 150m / 450m / 1.5km 三份 immutable PMTiles，尺度手動切換並只載入選中 source。
- 新增 layer-level `maxzoom` 契約，避免 overview 在高 zoom overdraw 或搶點擊。
- 6 個 r2 assets 已 upload，並逐檔完成 SHA-256、size、object metadata 讀回驗證；**deploy / production browser smoke 仍 pending**。

## 2026-08-18 — local staging

- 新增 `companyPoints`、`companyCapitalGrid`、`manufacturingCompanyPoints`。
- B1/A4 共用一份 PMTiles source；A4 使用 `is_manufacturing=1`，未複製 asset。
- B3 用同一 B1 layer 的 params/filter 支援 89 行業中類與 production subset。
- 新增 202608 snapshot 語意、十欄 popup 白名單、B2 三指標圖例與契約測試。
- 當時 r1 assets 後續已 upload；已被上方 r2 契約取代，不得覆寫舊 immutable key。

## 2026-09-17 — 科學色階與底圖標籤

- 公司密度改用 Viridis，固定級距 0 / 1 / 5 / 20 / 100 / 500 / 2,000 家／km²；1.5km 與 450m 共用絕對門檻，不隨視窗重新分位。202608 完整格網密度 p50 / p90：1.5km 為 4 / 92，450m 為 19.75 / 261.73，故加強低中密度辨識。
- 公司資本額網格改用 Magma，保留原尺度與數值級距；年齡改 Cividis。三色帶取 Matplotlib 原始色帶 0.18–1 的七個等距樣本，截去近黑端；亮度隨數值遞增。數值色帶不代表產業分類。
- 資本額與年齡預設 opacity 0.85；公司分布不再額外壓低使用者 opacity。圖例同步標示區間、單位及年齡指標方向；缺值仍保留。
- 桌面與 mobile full 的底圖選單旁加入「地名：開／關」；只處理 composite 底圖文字 symbol，切換底圖後維持本次設定，重新載入預設開啟。
- 本地驗證：TypeScript 通過；61 項相關測試通過；browser 確認三層新色階、關閉地名保留網格、Dark → Light 仍關閉地名。未部署。
- 配色參考：https://arxiv.org/abs/1712.01662 （Cividis 色覺友善設計）；https://matplotlib.org/stable/users/explain/colors/colormaps.html 。

## 2026-09-18 — 工廠／製造業／列管設施原點與密度分離

- 原 `factoryLocations`、`manufacturingCompanyPoints`、`regulatedFacilities` 改用獨立 `*_allzoom.pmtiles`，z0 起顯示每一筆有可用座標的登記點，移除低倍率聚合圓圈；小點隨 zoom 調整半徑，同址仍可能重疊。
- 新增 `factoryDensityGrid`、`manufacturingCompanyDensityGrid`、`regulatedFacilityDensityGrid`；各自開關、opacity、圖例與 popup，1.5km z4–<10、450m z10+。固定密度門檻與 Viridis 色帶共用，數值為每 km² 登記記錄數，不把三個母體合併或推論成產能、排放與風險。
- 網格 popup 用精確點擊位置選格；z10 切換排除透明的另一尺度。
- 上游重現與 QA：`taipei-gis-analytics` 本次工業點位／密度匯出管線；檔名、完整性與實測結果見本 feature handoff。

- PR #260：補齊三個密度圖層英文名稱，原子提交並整合最新 master；上游 PR #92 已一般合併。資料發布與前端 merge 仍受上述 handoff gate 約束。

- 2026-09-18 發布回條：13 檔已沿用既有 S3／網站 CDN 路徑發布，S3 整檔下載與網站 volume SHA 均通過；詳見 `evidence/20260918-publication.json` 與 PR #260。
