# Changelog

## 2026-09-07 — 本機接線完成，未發布

- Japan 新增治安 → 點位 → 日本警察設施；四類色票、opacity／scale／篩選、圖例及 popup。
- 保留名冊／可上圖／無座標計數與 degraded 精度語意。
- PMTiles 複製與 SHA-256 對帳、TypeScript／Vitest／本機瀏覽器驗收見 [handoff](./handoff.md)。
- 無 PR、commit 或部署。

## 2026-09-07 — 全縮放層級保留完整點位

- 修正上游預設 point dropping，z5–14 均有 13,195 點與 22 degraded。
- 更新本機 PMTiles 與內容版本，維持 z16 overzoom；未發布。

## 2026-09-07 — PR 整合

- 最新 master 整合：保留既有 450 層，新增日本警察設施。
- TypeScript 通過；Vitest 131 files、1,213 tests passed、3 skipped。
- Frontend PR [#224](https://github.com/ianlkl11234s/mini-taiwan-pulse/pull/224)；實作 commit `a88b96f`。
- Upstream PR [#82](https://github.com/ianlkl11234s/taipei-gis-analytics/pull/82) 已合併，squash `a98e4e96f9c874dd3498edc6430698e892459f47`。
- Frontend squash hash 以 PR #224 的合併記錄為準。
