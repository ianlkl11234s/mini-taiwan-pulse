# Backlog — 日本氣象廳即時圖層

| ID | Category | Priority | State | Outcome | Next action | Acceptance |
|---|---|---|---|---|---|---|
| JMA-1 | validation | P1 | verifying | 四層在 develop 預覽站可開、popup 正常 | 併入 develop 後瀏覽器逐層開啟 | 截圖：AMeDAS 四模式、警報上色、地震、火山 popup |
| JMA-2 | product | P2 | conditional | 冬季積雪模式實際有值 | 11 月後確認 `snow` 非全 NULL（2026-10-09 積雪計 336 站全 NULL，畫中空） | 地圖出現 0／>0 分色點 |
| JMA-3 | product | P3 | ready | 地震可看各地震度 | popup 目前只列原始 intensity_by_pref；改成縣別表 | popup 顯示縣名＋震度 |

## Explicitly not planned

- 不另下載警報界線：沿用既有 `jp_admin_boundaries.pmtiles`（實測 100% 對上）。
