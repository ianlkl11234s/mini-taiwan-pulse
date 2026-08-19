# Changelog — 共同登記地址

> 逐 PR 變更紀錄。最新在上。

---

## 2026-08-18 — r2 threshold + capital sum

- artifact 改用 immutable `common_registration_addresses_202608_r2.geojson`，新增 `capital_sum`。
- 新增 5–800 家門檻 slider，以 Mapbox filter 重建 circle；legend 顯示目前門檻。
- popup 新增資本額總和，保留中位數與中性語意。
- r2 artifact：11,121 features、2,688,498 bytes、SHA-256 `bf78dc3cdd7524a038c2b73ea0c72b4511314e552397c65a763821d0e876d6c1`；已 upload 並完成 SHA-256、size、object metadata 讀回驗證，**deploy / production browser smoke 仍 pending**。

## 2026-08-18 — local staging（PR / commit 待建立）

- 新增 `commonRegistrationAddresses` 靜態 GeoJSON 圖層。
- 點大小採同址公司數 log 尺度；顏色採資本額中位數固定非線性級距。
- 完成 opacity / scale、雙編碼圖例、click popup 與中性說明。
- 完成 `business_registry/` immutable dated asset 的 upload / pull / nginx / Docker 契約。
- 此為 r1 staging artifact：11,121 features、2,402,661 bytes、SHA-256 `818ec3b9e1ed5af6adf89d72e44ad3f7dddbebb4cfee77a8b3d467bda4fcbb43`；已被 r2 取代，不覆寫舊 key。
- Breaking：無；migration：不需要。
