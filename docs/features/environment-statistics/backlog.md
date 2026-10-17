# Progress — environment-statistics

- [x] 37 層 recipe／catalog／manifest／types／params／visual／legend／loader／popup 接線。
- [x] 期別＋細項選擇、原始數／比例 toggle、二元圖例、資料來源總覽（原始／衍生）。
- [x] tsc、完整 tests、build、designSystemGuard、layer golden（只增新 key）。
- [x] R2 發布後瀏覽器驗收（2026-10-02，cmux；手機僅 viewport 模擬）：All Off → 單層 → 期別／細項切換 → 原始／比例切換（含每列管設施 2025-only 拒絕訊息）→ 缺值與二元圖例 → popup 揭露 → 資料來源總覽搜尋 → 390px mobile → 全關。
- [ ] CDN readback：抽查公害陳情 2025 總計、自來水不合格 0 值、裁處率 >100% 縣市。
- [x] 靜態圖層：RPI 測站、水質測站、污水處理廠、飲用水水源水質保護區（環境部）。
- [ ] 效能：環境 catalog（約 211 KB 原始／16 KB gzip）目前在首屏共享 chunk；如需再壓，改走 PF-7 的家族 lazy details。
- [x] 上游 handoff JSON 重產（位置口徑改用上游）。
- [x] RPI 與水質測站同開時 RPI 在上（2026-10-02 第二波，見 [environment-layers](../environment-layers/README.md)）。
- [ ] 羅浮／義盛水資源回收中心 geocode 為同一座標（上游 APPROXIMATE），兩點重疊。
- [ ] 主 agent commit 時需正式 `git add` 四個 GeoJSON（目前為 intent-to-add，deployContract 測試依賴 git 追蹤）。
- [ ] `MedicalStatisticsGroupControls` 拒絕切換時的訊息固定為「請先調整年份」，細項不符時措辭不精確。
- [x] 二元圖例（自來水不合格）不再顯示「淺 → 深」通用說明（2026-10-02 第二波）。
- 第二波 9 個一般圖層另見 [environment-layers](../environment-layers/README.md)。
