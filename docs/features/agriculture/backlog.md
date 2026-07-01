# Backlog — agriculture

> memory 時點 2026-05-23 / 2026-05-25。已上線進 master（用戶確認 2026-07-01）。

## 進行中

- 暫無

## 待辦

- [ ] **AG-trim-upstream**：農企業 geojson 座標 17 位小數 + 冗欄位（lat/lon/source_slug/row_id/產製日期）可觀浪費 — 上游 taipei-gis-analytics 瘦身，不要在前端偷偷分叉 artifact
- [ ] **AG-eager-load-cost**：3 個農企業 geojson 共 ~34MB 在 style.load eager 載入（fireHydrants 12.8MB 是同慣例，3× 成本）— 觀察效能

## 已完成

- [x] **AG-shipped**：Phase 3 六層 + 132 作物 dropdown + 農企業 3 層全部進 master（2026-07-01 用戶確認）
- [x] **AG-phase3-batch1-wire**：6 層 + 132 作物 dropdown wiring，3 atomic commits（`9bc0e5c` factory + gitignore / `f8a4ecc` types+visibility+sidebar+params / `7d3092b` MapView 啟動）— 2026-05-23
- [x] **AG-business-wire**：農企業 3 層走 overlayRegistry 接線 — 2026-05-25
- [x] **AG-tsc-batch1** / **AG-tsc-business**：tsc 綠、資產 HTTP 200
- [x] **AG-crop-clean**：crop_name_zh 清洗完成
- [x] **AG-verify-batch1** / **AG-verify-business**：browser 驗收（上線前完成）
- [x] **AG-s3-deploy-batch1** / **AG-s3-deploy-business**：S3 資產已上
- [x] **AG-supabase-import**：農企業 3 層匯入 `spatial.agri_business_registrations`
- [x] **AG-commit-business**：農企業 wiring code 已 commit

## 已放棄 / 延後

- 暫無
