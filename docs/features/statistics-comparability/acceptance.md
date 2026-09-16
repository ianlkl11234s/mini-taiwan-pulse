# 統計比較：本輪驗收

狀態：**本地復原完成，未發布。** 本頁只採 2026-09-17 recovery logs 與現存 receipt；舊 tmp worktree、舊 browser 截圖及早期 `evidence/` 不構成本輪通過證據。

## 已驗證

| 驗收面向 | 結果 | 範圍與界線 |
|---|---:|---|
| Python | 24 passed | builders、receipt、selector 增量、缺值與 A2 事故錨點等；不代表 production data release。|
| Runtime | 256 / 256 | 244 comparison selectors + 12 education views，讀取本地復原 CDN。|
| 組裝 receipt | 188 keys / 244 新 selectors / 3,834 total | `LOCAL_ONLY`，既有 3,590 selectors 保留。|
| 教育路由 | 648 結果 | 北臺灣路網 pilot，foot/car 各 81 起點 × 4 學制；非全臺、非人口加權。|
| Frontend tests | 1,390 passed / 4 skipped，28.84s | 完整本輪重跑；skips 不是功能驗收。|
| Build | 通過 | `npm run build` exit 0；只有既有 chunk > 500kB 警告。|
| Browser | 通過本輪代表情境 | 證據在 [`evidence/recovery/browser/`](./evidence/recovery/browser/)；不以舊截圖替代。|
| Local bundle | 1,557,858 bytes | SHA `d146c15b572a6a7e06e1f6a587647cf88117942cd8e7e1ee3adaf3b8579aca0f`，`LOCAL_ONLY`。|

## 待補

- **發布待補**：無 CDN 上傳、正式 `current.json` 更新、部署、實體手機或 production 驗收。

Browser evidence 已覆蓋：12 個教育入口各自 22/22 載入（preschool 警告已消失）、每班學生圖例、醫療每萬人口 159/368 與回切病床、住宅鄉鎮比例 368/368、漁業 share 22/22、水田 LQ 南投 0.165 popup、公車 share 15/22 與回切原量、A2 `PARTIAL` 22/22，以及 390px 教育／全關／住宅無橫向溢位；dev error logs 為空，教育 selector 最終證據為 `evidence/recovery/browser/education-selector-final.txt`。

## 必須保留的產品限制

- 醫療 coverage 不完整時顯示 `PARTIAL`；住宅 2020 截面及其他舊資料維持 `STALE`。
- A2/A1+A2 是事故錨點去重的原始事件統計，人口或面積密度不是旅次／車公里風險。
- 教育路由只覆蓋 receipt 中的北臺灣 network/sample extent；校點不是已驗校門，且沒有學區、招生、時刻表或學齡人口模型。
- ratio 回原始量必須先載目標 release metadata，再解析 exact selector；無法解析即不切換。

本輪重跑方式與路徑見 [復原操作](./recovery.md)。
