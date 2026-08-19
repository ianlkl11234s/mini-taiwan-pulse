# Changelog — 公司登記 B1/B2/B3/A4

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
