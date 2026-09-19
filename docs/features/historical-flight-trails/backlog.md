# 驗收與未完成項

- [x] 原始解析度離線exporter與日期/geometry單元測試。
- [x] loader完整性/快取測試及renderer零抽稀/清除測試。
- [x] tsc -b 初次通過；最終驗證見acceptance.md。
- [x] layerConsistency/manifest/hook registry/golden檢查初次通過。
- [x] 桌面Browser：台日選擇器、缺值、藍白航跡、popup、底圖重載；見acceptance.md。
- [x] `20260918-v1` S3 靜態資產發布：98 GeoJSON + manifest（99 objects）bytes/SHA-256/Content-Type/Cache-Control readback；見 `evidence/20260919-s3-publication.json`。
- [x] `20260919-v2` S3 靜態資產發布：台灣改為 02/20、02/24、02/18，日本維持 02/18；124 GeoJSON + manifest（125 objects）完整 readback。
- [x] deploy pull 契約：release 先同步、manifest 原子替換；nginx `/flight-trails` fail-closed 與 release/manifest cache 規則。
- [ ] 一般工作日／週末補足全部機場：需另外估算付費抓取，尚未授權執行。
- [ ] 恆春可得軌跡查證／取得。
- [ ] 來源查詢分頁/事件日完整對帳，現有全為partial或unavailable。
- [ ] 個別資料合約與公開展示授權：`license_status=unverified`。
- [x] Production deployment、HTTP status／Content-Type／Cache-Control／bytes／SHA-256 readback，以及桌面 browser 載入驗收；見 `evidence/20260919-production-*.json`。
- [x] `20260919-v2` 日期變更已合併部署；production manifest 與桃園三日期資產 HTTP readback 通過。
- [x] `20260919-v2` 桌面 browser 日期選單／三日期切換、3D 航跡與 console 驗收；見 `evidence/20260920-v2-production-browser.json`。
- [ ] 實體手機效能；桌面窄視窗不等於真機。
- [x] PR #313 以一般 merge commit `becb3e9e` 整合；Zeabur deployment `6aae2d9c` 完成並為 `RUNNING`。
