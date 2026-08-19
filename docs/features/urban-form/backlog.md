# Backlog — 都市形態 Urban Form

> 本檔只保留 current residual；UF-1/UF-3 已完成施工但 PR pending，移到 release verifying。

## Release / verifying

- [ ] **UF-1 · `verifying`**：都市紋理網格（500m、145,119 格）接線 release evidence。
  - Outcome：確認正式站可載入 grid，六種指標染色與 popup/legend 不只是本地完成。
  - Next action：核對 PR/merge、PMTiles/HTTP 與 browser zoom/filter/3D；以無 404、資料量與四鐵則為 acceptance。
- [ ] **UF-3 · `verifying`**：GBA 建物輪廓接線 release evidence。
  - Outcome：高度分級、3D 與高度門檻在 production 有可追溯證據。
  - Next action：核對 PR/merge、S3 asset、browser 2D/3D 與 popup。

## Product enhancement / data coverage

- [ ] **UF-2**：補齊澎湖／金馬建物圖磚。
  - Outcome：都市形態圖層不再只覆蓋本島。
  - Next action：上游先確認外島來源、授權、geometry coverage 與 PMTiles 成本，再重出並做 county coverage report。
