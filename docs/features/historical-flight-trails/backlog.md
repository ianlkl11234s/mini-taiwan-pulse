# 驗收與未完成項

- [x] 原始解析度離線exporter與日期/geometry單元測試。
- [x] loader完整性/快取測試及renderer零抽稀/清除測試。
- [x] tsc -b 初次通過；最終驗證見acceptance.md。
- [x] layerConsistency/manifest/hook registry/golden檢查初次通過。
- [x] 桌面Browser：台日選擇器、缺值、藍白航跡、popup、底圖重載；見acceptance.md。
- [x] `20260918-v1` S3 靜態資產發布：98 GeoJSON + manifest（99 objects）bytes/SHA-256/Content-Type/Cache-Control readback；見 `evidence/20260919-s3-publication.json`。
- [x] deploy pull 契約：release 先同步、manifest 原子替換；nginx `/flight-trails` fail-closed 與 release/manifest cache 規則。
- [ ] 一般工作日／週末補足全部機場：需另外估算付費抓取，尚未授權執行。
- [ ] 恆春可得軌跡查證／取得。
- [ ] 來源查詢分頁/事件日完整對帳，現有全為partial或unavailable。
- [ ] 個別資料合約與公開展示授權：`license_status=unverified`。
- [ ] production pull／nginx 後 HTTP status、Content-Type、Cache-Control、bytes/SHA-256 readback，以及 browser 載入驗收；S3 readback 不等於 production 可用。
- [ ] 實體手機效能；桌面窄視窗不等於真機。
- [ ] 主分支整合、commit/push/PR及部署。
