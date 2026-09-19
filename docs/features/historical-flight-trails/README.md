# 歷史航班軌跡

台灣17場／日本78場選單，共用完整解析度靜態renderer。一般工作日及週末資料不足時如實標示，可另選既有案例。

機場選單提供「全部機場」；依國家與日期合併現有靜態資產、按航班去重，缺資料機場仍標示 unavailable。

- [資料契約與執行方式](handoff.md)
- [資料驗證清單](data-inventory.json)
- [驗收與限制](backlog.md)
- [本次變更](changelog.md)

## 發布狀態

`20260918-v1` 已由 `scripts/deploy/publish_historical_flight_trails.py` 發布至 S3 `deploy-assets/flight-trails`。98 份版本化 GeoJSON 與 1 份 manifest，共 99 個物件，均已完成 bytes、SHA-256、Content-Type 與 Cache-Control readback；receipt 見 [`evidence/20260919-s3-publication.json`](evidence/20260919-s3-publication.json)。

前端預設從同源 `/flight-trails` 讀取，可用 `VITE_FLIGHT_TRAILS_CDN_BASE` 覆寫；沒有 DB 或 FR24 fallback。此 S3 readback 不等於 production 已可用：程式尚未 PR／merge／deploy，production HTTP／browser readback 及真機效能仍未完成，來源 `license_status=unverified`。

原始圖層由 `codex/historical-flight-trails-20260918` 整合；本次供應鏈修改位於隔離分支 `codex/historical-flight-trails-publication-20260919`，不包含主目錄其他 session 未提交修改。


2026-09-18更新：現為3D藍白高度航跡，高度倍率可調；依使用者要求直接連接同航班的觀測空白。詳見acceptance.md與changelog.md。
