# Changelog — urban-zoning

> 逐 PR 變更紀錄。最新在上。

---

## 2026-08-02 — PR #（待補） `（待補 squash hash）`

- 新增 `nonUrbanZoning`：非都市土地使用分區 68,220 面 / 18 縣市 PMTiles（z5-14, 37.5MB）
- 上色欄用 `zone_code` 11 碼而非 `zone_category` 10 值 —— 為了保留「特定農業區 vs 一般農業區」
  的差別（農地變更難易度差很大，是這份資料最有價值的區別）
- 配色刻意與都計 9 類同色系對齊（農業黃綠 / 工業紫 / 保育綠 / 公設藍），兩者疊圖讀得起來像同一套語言
- fill-opacity 預設 0.35（都計是 0.5）：本層覆蓋全台山區農地，太實會糊掉底圖
- 新 SSOT `src/data/nonUrbanZoningTypes.ts`；圖例 11 列兩欄排版；專屬 `NonUrbanZoningPanel`
- 上游：`pulse-batch-20260801` 批次（urban_composite 包）
- 資產 gitignored 走 S3（`public/urban/*.pmtiles` 既有規則），**零 deploy 腳本變更**
- Breaking：無

## 2026-07-17 — PR #73 `54b7f17`（squash，branch 原 3 commits）

- `8a8de4b` feat(urban)：北市（15,518）+ 新北（34,190）土地使用分區 PMTiles 圖層，zone_category 9 類統一分色、分類篩選 dropdown、共用圖例/panel；資產 gitignored 走 S3，零 deploy 變更
- 上游：pipelines/urban_composite/urban_zoning（官方向量，OGDL）+ handoff `urban-zoning.md`
- `6ad58ff` fix：濾除北市 4 筆範圍框 meta-polygon（zone_raw="nan"）+ popup 標題 fallback 鏈（新北靠 zone_raw）
- `bca05c5` refactor：搬群 都市分析 → 底圖 Base Map（官方參考底圖非分析產物）
- Breaking：無
