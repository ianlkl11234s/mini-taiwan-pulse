# 歷史航班軌跡

台灣17場／日本78場選單，共用完整解析度靜態renderer。一般工作日及週末資料不足時如實標示，可另選既有案例。

機場選單提供「全部機場」；依國家與日期合併現有靜態資產、按航班去重，缺資料機場仍標示 unavailable。

- [資料契約與執行方式](handoff.md)
- [資料驗證清單](data-inventory.json)
- [驗收與限制](backlog.md)
- [本次變更](changelog.md)

## 發布狀態

目前 S3 pointer 指向 `20260919-v2`：台灣日期為 `2026-02-20`、`2026-02-24`、`2026-02-18`，日本維持 `2026-02-18`；前端預設仍為台灣全部機場 `2026-02-20`。124 份版本化 GeoJSON 與 1 份 manifest 已完成 bytes、SHA-256、Content-Type 與 Cache-Control readback；receipt 見 [`evidence/20260919-v2-s3-publication.json`](evidence/20260919-v2-s3-publication.json)。舊 `20260918-v1` 保留為 immutable release。

前端預設從同源 `/flight-trails` 讀取，可用 `VITE_FLIGHT_TRAILS_CDN_BASE` 覆寫；沒有 DB 或 FR24 fallback。`20260919-v2` 已隨 PR [#316](https://github.com/ianlkl11234s/mini-taiwan-pulse/pull/316) 的一般 merge commit `9b6e9d88` 部署，Zeabur deployment `6aae9e2f` 為 `RUNNING`；正式 manifest 與桃園三日期、羽田 02/18 均通過 HTTP bytes、SHA-256、MIME 與 cache readback。證據見 [`evidence/20260919-v2-production-deployment.json`](evidence/20260919-v2-production-deployment.json) 與 [`evidence/20260919-v2-production-http-readback.json`](evidence/20260919-v2-production-http-readback.json)。新版桌面 browser 與真機效能仍未完成，來源 `license_status=unverified`。

原始圖層由 `codex/historical-flight-trails-20260918` 整合；本次供應鏈修改位於隔離分支 `codex/historical-flight-trails-publication-20260919`，不包含主目錄其他 session 未提交修改。


2026-09-18更新：現為3D藍白高度航跡，高度倍率可調；依使用者要求直接連接同航班的觀測空白。詳見acceptance.md與changelog.md。
