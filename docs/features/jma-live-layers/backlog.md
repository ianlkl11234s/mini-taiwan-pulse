# Backlog — 日本氣象廳即時圖層

| ID | Category | Priority | State | Outcome | Next action | Acceptance |
|---|---|---|---|---|---|---|
| JMA-1 | validation | P1 | verifying | 四層在 develop 預覽站可開、popup 正常 | 併入 develop 後瀏覽器逐層開啟 | 截圖：AMeDAS 四模式、警報上色、地震、火山 popup |
| JMA-2 | product | P2 | conditional | 冬季積雪模式實際有值 | 11 月後確認 `snow` 非全 NULL（2026-10-09 積雪計 336 站全 NULL，畫中空） | 地圖出現 0／>0 分色點 |
| JMA-3 | product | P3 | ready | 地震可看各地震度 | popup 目前只列原始 intensity_by_pref；改成縣別表 | popup 顯示縣名＋震度 |
| JMA-4 | validation | P1 | blocked | 解析積雪深以真實發布幀播放 | 等 gis-platform RPC `get_weather_imagery_manifest` 與 collector 發布幀（R2）上線；develop 預覽站開 `jmaSnowDepth`，拖時間軸到 10-10 之後 | 有積雪時著色、10-10 前顯示「未涵蓋」、缺測格為灰；PNG 四角與 AMeDAS 積雪站對得上 |
| JMA-5 | product | P2 | ready | 其餘發布幀產品上圖 | `JMA_IMAGERY_PRODUCTS` 各加一筆（radar／rasrf／risk_land／risk_inund／uv_anal／sea_ice／sst_him）＋manifest／catalog／legend | 每產品色票對 decode table、圖例有「未涵蓋」 |
| JMA-6 | product | P3 | conditional | 積雪深點擊讀值 | 需要 PNG 像素探針（同 urbanHeat 讀值探針）；目前列在 NO_POPUP ledger | 點擊顯示積雪級距與解析時刻 |

## Explicitly not planned

- 不另下載警報界線：沿用既有 `jp_admin_boundaries.pmtiles`（實測 100% 對上）。
