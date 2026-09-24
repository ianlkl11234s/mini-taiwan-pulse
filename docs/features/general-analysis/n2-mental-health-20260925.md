# N2 心理衛生機構資料契約（2026-09-25）

## 固定來源

- 資產：`public/welfare/mental_health_facilities_national.geojson`
- SHA-256：`b72e5a8102b409612fabda14b2fbff54dd6e51d144bdae31eb0d87e7ed8c4e34`
- 原始產物：70/70 Point、22 縣市；所有 `uid`、名稱、地址、縣市、`sub_code`、`permit_status` 與座標來源欄位均非空。
- 上游契約：衛福部社會福利機構總表 `data.gov.tw/dataset/165355`；OGDL-Taiwan-1.0；上游說明的最後 pipeline 日期為 2026-08-12，資料實際觀測期與目前營運狀態 unknown。
- `permit_status` 全為 `C04`，但上游明示不得將許可狀態解讀為有效／失效；reader 僅逐字保留。

## 座標與可分析範圍

| reader | 選擇條件 | 筆數 | geometry role | 空間操作 |
| --- | --- | ---: | --- | --- |
| `tw-mental-health-facilities-upstream-coordinates` | `tgos_upstream` + `upstream` | 63 | actual | bbox / nearest 可用 |

另有 7/70 筆 `google` 派生座標（5 `exact`、2 `approximate`）維持 **HOLD**，不登記 reader、不可查詢也不可用於 bbox／nearest。Google Geocoding API 政策對非 Google 地圖呈現及長期儲存有明確限制，見 <https://developers.google.com/maps/documentation/geocoding/policies>；在確認可替代的合法座標前不擴大其使用。既有靜態顯示圖層與原始資產不在本次修改範圍。

即使是 63 筆 actual reader，也不代表入口、服務轄區、可達性或目前開放狀態。

## 驗收

reader 固定驗證同一份 70 筆來源的 SHA 與總筆數，再驗證 63 筆固定選擇。focused test 覆蓋臺／台名稱變體、7 筆被選擇排除、Google subset 未註冊、完整 receipt，以及來源 SHA mismatch fail-closed。
