# Backlog — 都市熱島 Urban Heat

> 本 feature 的待辦。與全站 `.claude/memory/BACKLOG.md` 對應項編號要一致（UH-x）。

## 進行中

- [ ] **UH-1**：瀏覽器驗收（兩模式色帶、nodata 透明、z11→z12 overzoom、opacity slider）
  — 接線完成待跑 `pnpm dev` 目視。

## 待辦

- [ ] **UH-2**：S3 上傳 `deploy-assets/environment/urban_heat_lst_taiwan.pmtiles`
  （`./scripts/deploy/upload-deploy-assets.sh`）— **需 user 拍板**。
- [ ] **UH-3**：核對 `canopyHeight` 的 `raster-color-mix` 是否也踩到「正規化 vs 原始 DN」誤解
  （見 [handoff.md](./handoff.md)「已知不對稱」#3）；若確認，另開修正 PR。
- [ ] **UH-4**：回報上游把 `taipei-gis-analytics/docs/handoff/urban_heat_lst.md` §3.4 的
  mix 係數改成物理值寫法（51 → 0.2、63.75 → 0.25）。

## 已完成（近期）

- [x] **UH-0**：前端接線七步 + UX 四鐵則 + feature 文件 — 本 PR, 2026-07-30

## 已放棄 / 延後

- **UH-A**：popup 顯示點擊處的 ΔT / °C 數值 — raster 無法用 `queryRenderedFeatures` 取值，
  要自己抓磚解碼，成本遠高於效益；比照 `canopyHeight` 不做。
