# Backlog — tree-layers

> 本檔只保留 current residual；已完成的 canopy 重出移至歷史區，不再混在 active checkbox。

## Release blocker / verifying

- [ ] **TL-1 · `verifying`**：部署前上傳 5 個 gitignored 新檔（protected/riverside/parks GeoJSON + national/tree_pits/3epoch/canopy PMTiles）。
  - Outcome：正式站不因大檔未進 git 而出現 404 或缺圖層。
  - Next action：執行 `upload-deploy-assets.sh`，核對 S3 HEAD/checksum、pull 與 browser 各層可見性。

## Data quality / governance

- [ ] **TL-2**：上游補 data-catalog 條目（7 個 dataset 目前 `upstreamRegistry` 標 `catalog_missing`）。
  - Outcome：資料來源、授權與更新週期可被 registry/CI 追蹤。
  - Next action：補齊 taipei-gis-analytics catalog，再跑 upstream registry contract test。

## Product enhancement

- [ ] **TL-3**：樹穴 × 行道樹 spatial overlay「空樹穴偵測」。
  - Outcome：由現況圖層延伸到維護缺口分析。
  - Next action：先確認樹穴與樹木 snapshot 日期、join 距離與誤差門檻，再開分析規格。

## Conditional / tech debt

- [ ] **TL-5**：全國行道樹上游瘦身（移除 lat/lon 冗餘欄並重出 PMTiles）。
  - Trigger：確認下游不再依賴冗餘欄位，且重出成本值得。
  - Outcome：降低磚體大小與下載成本。
  - Acceptance：欄位契約測試、大小前後對照、S3 checksum 與 browser render 均通過。

## 已完成（歷史，不列入 active）

- [x] **TL-4**：canopy 512px tile 重出（PR #83；高度編碼 RGBA 512px，z13 約 20m）— 見 [changelog.md](./changelog.md)。
- [x] **TL-0**：7 層一次接線 — 見 [changelog.md](./changelog.md)。
