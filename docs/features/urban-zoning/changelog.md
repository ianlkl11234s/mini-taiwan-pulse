# Changelog — urban-zoning

> 逐 PR 變更紀錄。最新在上。

---

## 2026-07-17 — PR #73 `54b7f17`（squash，branch 原 3 commits）

- `8a8de4b` feat(urban)：北市（15,518）+ 新北（34,190）土地使用分區 PMTiles 圖層，zone_category 9 類統一分色、分類篩選 dropdown、共用圖例/panel；資產 gitignored 走 S3，零 deploy 變更
- 上游：pipelines/urban_composite/urban_zoning（官方向量，OGDL）+ handoff `urban-zoning.md`
- `6ad58ff` fix：濾除北市 4 筆範圍框 meta-polygon（zone_raw="nan"）+ popup 標題 fallback 鏈（新北靠 zone_raw）
- `bca05c5` refactor：搬群 都市分析 → 底圖 Base Map（官方參考底圖非分析產物）
- Breaking：無
