# N3 共用統計家族：市區客運營運概況

這片沿用既有 `createSocialStatisticsAdapters`，按 manifest 的單一 layer key 對應單一固定 release；七個已確認業務語意的縣市指標開放查詢、行政區比較與 aggregate。來源為 SEGIS `315FH_1D3` 的 114 年（2025）縣市統計，boundary identity `COUNTY_MOI_1140318`，來源授權 OGDL。八個 COLUMN release 的固定 ID、dimensions 與單位見 `src/research/busOperationStatisticsDatasets.ts`；不跨指標加總，也不把縣市客運供給解讀為唯一乘客或路線。

上游 `taipei-gis-analytics/docs/data-catalog/transportation/segis_bus_operation_county_315fh_1d3.md` 明寫 **COLUMN6 顯示名稱尚待修正，完成前不可稱作電動車**。因此本片在代碼與文件保留該 release ID 與 15/22 PARTIAL、七縣市 `null` 證據，但沒有把 `statsBusElectricVehicleCount` 註冊成可查詢 dataset。其餘七個 source 欄位均為 22/22；`status=observed,value=0` 與來源 `null/status=missing` 不互換。

本地測試以固定 release/dimensions/boundary fixture 驗 selector、source-null 與零值、跨縣市缺值、拒絕未註冊 COLUMN6。adapter 在實際執行時仍走 `regionalStatisticsLoader` 的正常資料端點，不能把 fixture 通過算作 endpoint readback。執行期缺 `VITE_SUPABASE_*` 時無法宣稱七個 release 已在此 worktree 的瀏覽器實讀。

待確認：上游資料 steward 完成 COLUMN6 官方欄名校正後，更新 catalog、manifest label/indicator/release 與本 adapter，重新跑 source/版本/瀏覽器全鏈驗收；在此之前不要用「電動車」回答此欄。
