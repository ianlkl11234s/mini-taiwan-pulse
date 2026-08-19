# Backlog — real-estate

> 本檔只保留 current residual；已完成 PR #31 項目移至歷史區。

## Release / verifying

- [ ] **RE-CustomLayer · `verifying`**：確認 `feat/real-estate-points-customlayer` 與 taipei-gis-analytics 改動是否已 push、PR/merge，及 production evidence。
  - Outcome：GPU picking 的 hover/click 取捨有可追溯 release 狀態，不把 local branch 當 shipped。
  - Next action：核對兩 repo branch/PR、PMTiles/S3 與 browser hover/click；若仍未合併，保留 branch blocker。

## Decision needed / tech debt

- [ ] **RE-ADR-CustomLayer**：補 ADR 記錄「放棄點層 hover 換效能」的取捨。
  - Outcome：後續不會重新爭論同一個 GPU picking/效能決策。
  - Next action：以實測 bundle/render/picking evidence 寫 ADR，連到 handoff。

## Conditional / scheduled

- [ ] **RE-2025Q4**：等 twinkle-hub 補 2025Q4 全國鏡像後，重跑 pipeline、重出 PMTiles + buffer。
  - Trigger：2025Q4 全國鏡像可取得且授權確認。
  - Outcome：房地產時間軸可包含該季度，不在來源尚未存在時反覆重跑。
  - Acceptance：全國 coverage、快照日期、PMTiles checksum 與時間軸資料對帳。

## 已完成（歷史，不列入 active）

- [x] 6 圖層上線、排除雙北 toggle、季/月/週時間軸與 basemap fix — PR #31, 2026-06-24。
