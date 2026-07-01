# Backlog — agriculture

> memory 時點 2026-05-23 / 2026-05-25。當下三重待辦：browser 驗收 / S3 部署 / Supabase import。

## 進行中

- [ ] **AG-verify-batch1**：Phase 3 Batch 1 六層 browser 視覺驗收 — 用戶開 `npm run dev` (port 3721) 一個個 toggle 確認顯示（memory 時點：尚未做）
- [ ] **AG-verify-business**：農企業 3 層 browser 驗收 — 慣例：先按 All Off 再單測；headed agent-browser 看 GPU
- [ ] **AG-crop-dropdown-test**：132 作物 dropdown 互動測試 — 切作物有沒有 re-render polygon

## 待辦

- [ ] **AG-s3-deploy-batch1**：跑 `scripts/deploy/upload-deploy-assets.sh` 把 Phase 3 Batch 1 六個資產推到 S3（如要部署 Zeabur）
- [ ] **AG-s3-deploy-business**：把 3 個農企業 geojson 推到 S3
- [ ] **AG-supabase-import**：把 3 個農企業 geojson 匯入 `spatial.agri_business_registrations`（overwrite，manifest 已註明）— 走 gis-data-onboard SOP
- [ ] **AG-commit-business**：農企業 geojson 因 gitignore 不進 git，wiring 的 code 改動要 commit
- [ ] **AG-trim-upstream**：農企業 geojson 座標 17 位小數 + 冗欄位（lat/lon/source_slug/row_id/產製日期）可觀浪費 — 上游 taipei-gis-analytics 瘦身，不要在前端偷偷分叉 artifact
- [ ] **AG-eager-load-cost**：3 個農企業 geojson 共 ~34MB 在 style.load eager 載入（fireHydrants 12.8MB 是同慣例，3× 成本）— 觀察效能

## 已完成（近期）

- [x] **AG-phase3-batch1-wire**：6 層 + 132 作物 dropdown 完整 wiring，3 atomic commits（`9bc0e5c` factory + gitignore / `f8a4ecc` types+visibility+sidebar+params / `7d3092b` MapView 啟動）— 2026-05-23，feat/water-extensions
- [x] **AG-business-wire**：農企業 3 層走 overlayRegistry（宣告式）接線 — 2026-05-25，feat/fire-rescue
- [x] **AG-tsc-batch1**：`npx tsc -b` 綠、dev server 起得來、6 資產 HTTP 206/200
- [x] **AG-tsc-business**：`npx tsc -b` 綠、3 資產 HTTP 200（20.9MB/13.1MB/30KB）、business_type 值確認吻合
- [x] **AG-crop-clean**：crop_name_zh 清洗 — 剝除「適栽性等級分布圖」尾綴；6 筆 `(unmatched)` 用 nameEn 兜底（aspara/bigatem/macada/malabar/marush/passion/snapbea/vegetsoy）

## 已放棄 / 延後

- 暫無

## TBD（memory 未講清楚 → 待用戶補）

- 農企業 3 層是否已 commit（memory 只說「待辦」但未指定 commit hash）
- Phase 3 Batch 1 是否已 push 到遠端（memory 只提 3 個 commit hash 未提 push 狀態）
