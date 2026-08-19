# Backlog — terrain-vector

> 本檔只保留 current residual；已完成的坡度／坡向接線移至歷史區。

## Decision needed

- [ ] **TV-1**：決定是否 apply `gis-platform/migrations/289_h3_terrain.sql`，匯入 56,376 cells 並接 `public.get_h3_terrain(target_resolution)`。
  - Outcome：明確決定 H3 地形指標是否值得新增表與前端成本。
  - Next action：比較使用需求、migration 維護與 payload 成本；owner go/no-go 後才 apply。

## Data quality / performance

- [ ] **TV-2**：評估解析度精細化；目前 RES=100m 降採樣會平滑並低估陡度。
  - Outcome：在坡度精度與 polygon/PMTiles 載入成本間取得可量化取捨。
  - Next action：以候選 RES 產出面積、檔案大小、渲染耗時對照，再決定是否重出。

## Conditional / product enhancement

- [ ] **TV-3**：評估 `terrain_zonal` AOI 地形統計前端入口。
  - Trigger：出現「框一塊地看平均坡度／超過 30° 比例」的明確需求。
  - Outcome：把既有 on-demand 工具轉成可理解的分析體驗。
  - Acceptance：先定義 AOI、統計欄位與 loading/error UI，再決定 loader/hook。

## 已完成（歷史，不列入 active）

- [x] 坡度／坡向向量分級、legend、Layers 搜尋、舊 PNG 移除與 style 重掛 — 見 [changelog.md](./changelog.md)。

> TDX 真實時刻表等其他線與本 feature 無關，不列入此 backlog。
