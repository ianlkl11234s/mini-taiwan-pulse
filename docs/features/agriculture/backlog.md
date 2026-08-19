# Backlog — agriculture

> memory 時點 2026-05-23 / 2026-05-25。已上線進 master（用戶確認 2026-07-01）。

## Active work（進行中／待辦）

- 暫無

## Tech debt / performance backlog

- [ ] **AG-trim-upstream** · `data-health` · P2 · `waiting_external`：農企業 GeoJSON 座標精度與冗欄位造成體積浪費；Next action：上游提出瘦身成品與 checksum，前端不分叉 artifact；Acceptance：欄位契約、大小/精度對帳與 HTTP 200。
- [ ] **AG-eager-load-cost** · `performance` · P3 · `conditional`：3 個農企業 GeoJSON 約 34MB 在 style.load eager 載入。Trigger：實測首屏或記憶體超過門檻；Next action：建立 baseline 後評估 lazy load；Acceptance：效能數據與 browser 回歸。

## Completed / historical（已完成／歷史）

- [x] **AG-shipped**：Phase 3 六層 + 132 作物 dropdown + 農企業 3 層全部進 master（2026-07-01 用戶確認）
- [x] **AG-phase3-batch1-wire**：6 層 + 132 作物 dropdown wiring，3 atomic commits（`9bc0e5c` factory + gitignore / `f8a4ecc` types+visibility+sidebar+params / `7d3092b` MapView 啟動）— 2026-05-23
- [x] **AG-business-wire**：農企業 3 層走 overlayRegistry 接線 — 2026-05-25
- [x] **AG-tsc-batch1** / **AG-tsc-business**：tsc 綠、資產 HTTP 200
- [x] **AG-crop-clean**：crop_name_zh 清洗完成
- [x] **AG-verify-batch1** / **AG-verify-business**：browser 驗收（上線前完成）
- [x] **AG-s3-deploy-batch1** / **AG-s3-deploy-business**：S3 資產已上
- [x] **AG-supabase-import**：農企業 3 層匯入 `spatial.agri_business_registrations`
- [x] **AG-commit-business**：農企業 wiring code 已 commit

## Explicitly not planned（明確不做）

- 暫無
