# Backlog — 噪音／聲響六圖層

> 本 feature 的 active／release truth SSOT。資料契約以上游 handoff 為準。

## Active work

| ID | Category | Priority | State | Outcome | Next action | Acceptance |
|---|---|---|---|---|---|---|
| NOISE-3 | release | P1 | blocked | local commit 已建立；經授權後才 push／建立 PR 並發布資產與前端 | 等 owner 明確授權 push、PR、deploy | push／PR、資產 production HTTP readback/checksum、production deploy 與 production browser acceptance 分開留證 |

## Decision needed

目前無產品語意待拍板；六層保持獨立、不做綜合噪音分數已由上游契約固定。

## Conditional / triggered later

| ID | Category | Priority | State | Trigger | Next action | Acceptance |
|---|---|---|---|---|---|---|
| NOISE-4 | data-health | P2 | conditional | 上游 official／NoiseCapture snapshot 或公告資產更新 | 依上游 SOP 重建、QA 後整檔替換五個新發布副本；裁處仍走既有 pollution pipeline | 新 manifest/QA 可解釋 count 變化；PMTiles verify、下游 contract 與 browser 通過 |
| NOISE-5 | product | P2 | conditional | 新縣市取得已驗官方管制 polygon／航空法定名單／聲音照相可重現定位 | 更新 coverage、色票 domain、legend 與 popup，不對缺資料區補假 polygon／centroid | 上游 unmatched/geometry QA 通過；下游 coverage 文案、filter 與 browser 通過 |

## Completed / historical

- [x] **NOISE-2**：localhost `127.0.0.1:3722` 從 All Off 實際開啟六層，完成資料範圍移動、NoiseCapture z10／z11／z13、period／precision filter、legend、popup 與 console 驗收 — 2026-08-28。
- [x] **NOISE-1**：`npx tsc -b`、focused 52 tests、full 748 passed／1 skipped、asset count／SHA／PMTiles verify／localhost readback 均通過 — 2026-08-28。
- [x] **NOISE-0**：上游五個新靜態產物與既有裁處 PMTiles 重用契約已交付 — 2026-08-27；詳見[上游 handoff](../../../../taipei-gis-analytics/docs/handoff/noise-layers.md)。

## Explicitly not planned

- **NOISE-X1**：六層合成單一「噪音分數」— 觀測、群眾樣本、法定分類、裁處與設備清單不能互相替代。
- **NOISE-X2**：為 v1 新增 Supabase migration 或 collector — 六層均走靜態資產／既有污染裁處資產。
- **NOISE-X3**：因 NoiseCapture 稀疏而放寬品質門檻 — 1／1／3 格與全部 provisional 是發布事實，不以較差樣本填圖。
- **NOISE-X4**：將 66 筆 pending camera 以行政區中心點補位 — 保留清單計數，但不渲染假精確位置。
