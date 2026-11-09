> **已封存 2026-11-09**（原路徑 `docs/features/urban-form/backlog.md`）：讀過後仍有效的未完成項目已搬進 [`.claude/memory/BACKLOG.md`](../../../../../.claude/memory/BACKLOG.md)（各主題群，附回本檔連結；已完成／過時／查不到證據的列在「待勾選（2026-11-09 feature backlog 封存）」段）。本檔保留原文，不再更新。

# Backlog — 都市形態 Urban Form

> 本檔只保留 current residual；UF-1/UF-3 已隨 PR #71（v1.9.0）上線並勾選。

## Release / verifying

- [x] **UF-1 · `verifying`**：都市紋理網格（500m、145,119 格）接線 release evidence。 — 2026-10-16 盤點關閉：PR #71（v1.9.0）
  - Outcome：確認正式站可載入 grid，六種指標染色與 popup/legend 不只是本地完成。
  - Next action：核對 PR/merge、PMTiles/HTTP 與 browser zoom/filter/3D；以無 404、資料量與四鐵則為 acceptance。
- [x] **UF-3 · `verifying`**：GBA 建物輪廓接線 release evidence。 — 2026-10-16 盤點關閉：PR #71（v1.9.0）
  - Outcome：高度分級、3D 與高度門檻在 production 有可追溯證據。
  - Next action：核對 PR/merge、S3 asset、browser 2D/3D 與 popup。

## Product enhancement / data coverage

- [ ] **UF-2**：補齊澎湖／金馬建物圖磚。
  - Outcome：都市形態圖層不再只覆蓋本島。
  - Next action：上游先確認外島來源、授權、geometry coverage 與 PMTiles 成本，再重出並做 county coverage report。
