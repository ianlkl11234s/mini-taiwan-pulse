# Backlog — tree-layers

> 本 feature 的待辦。

## 進行中

（無）

## 待辦

- [ ] **TL-1**：S3 deploy-assets 上傳 5 個新檔（protected/riverside/parks geojson + national/tree_pits/3epoch/canopy pmtiles）— 部署前必做，>2MB 檔不進 git
- [ ] **TL-2**：上游 taipei-gis-analytics 補 data-catalog 條目（7 個 dataset 目前 upstreamRegistry 標 `catalog_missing`）
- [ ] **TL-3**：樹穴 × 行道樹 spatial overlay「空樹穴偵測」（規格書建議的進階分析，本次未做）
- [ ] **TL-4**：canopy 512px tile 重出評估（mapbox-pmtiles tileSize 寫死 512，現以 256 tile 顯示略軟；瀏覽驗收若覺模糊再做）
- [ ] **TL-5**：全國行道樹上游瘦身（剔 lat/lon 冗餘欄可減磚重；需重出 PMTiles）

## 已完成（近期）

- [x] **TL-0**：7 層一次接線（本 feature 初版）— feat/tree-layers, 2026-07-15

## 已放棄 / 延後

（無）
