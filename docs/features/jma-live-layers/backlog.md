# Backlog — 日本氣象廳即時圖層

| ID | Category | Priority | State | Outcome | Next action | Acceptance |
|---|---|---|---|---|---|---|
| JMA-1 | validation | P1 | verifying | 四層在 develop 預覽站可開、popup 正常 | 併入 develop 後瀏覽器逐層開啟 | 截圖：AMeDAS 四模式、警報上色、地震、火山 popup |
| JMA-2 | product | P2 | conditional | 冬季積雪模式實際有值 | 11 月後確認 `snow` 非全 NULL（2026-10-09 積雪計 336 站全 NULL，畫中空） | 地圖出現 0／>0 分色點 |
| JMA-3 | product | P3 | ready | 地震可看各地震度 | popup 目前只列原始 intensity_by_pref；改成縣別表 | popup 顯示縣名＋震度 |
| JMA-4 | validation | P1 | blocked | 解析積雪深以真實發布幀播放 | 等 gis-platform RPC `get_weather_imagery_manifest` 與 collector 發布幀（R2）上線；develop 預覽站開 `jmaSnowDepth`，拖時間軸到 10-10 之後 | 有積雪時著色、10-10 前顯示「未涵蓋」、缺測格為灰；PNG 四角與 AMeDAS 積雪站對得上 |
| JMA-5 | product | P2 | done | 其餘發布幀產品上圖 | 2026-10-15 完成 8 層（radar／rasrf／risk_land／risk_inund／uv_anal／sst_him／sea_ice／himawari_b13） | 每產品色票對 decode table、圖例有「未涵蓋」 |
| JMA-7 | validation | P1 | blocked | 其餘產品以真實發布幀驗證 | 等 collector 回補／部署：risk_*（有著色時）、uv_anal（白天）、sst_him、himawari_b13；develop 預覽站逐層拖時間軸 | 位置與上游圖對得上；risk 首次著色時以 PLTE 驗證並更新色票版本 |
| JMA-8 | product | P2 | conditional | 海冰色票改用官方圖例 | 12 月海冰季開始後，取氣象廳海氷情報頁的密接度凡例色 | `sea_ice` paletteVersion 去掉 provisional |
| JMA-9 | product | P3 | conditional | 雲圖在亮色底圖可讀 | 目前白雲在 light 底圖對比低；需要的話依 isDarkTheme 換 ramp | light 底圖截圖可辨識雲帶 |
| JMA-10 | validation | P1 | conditional | 洪水キキクル有警戒時的上色與屬性 | 下次日本有河川達注意以上時，開 `jmaRiskFlood` 對照氣象廳キキクル頁；抓一個非空 pbf 看 `level`／`type` 等欄位 | 線色與官方一致；決定是否補 popup（目前在 NO_POPUP ledger） |
| JMA-11 | product | P3 | conditional | 雪覆蓋多日合成 | GIBS 單日雲遮多；需要時考慮 8 日合成產品（若 GIBS 有提供）或前端多日疊圖 | 冬季日本海側雲遮時仍可判讀 |
| JMA-6 | product | P3 | conditional | 積雪深點擊讀值 | 需要 PNG 像素探針（同 urbanHeat 讀值探針）；目前列在 NO_POPUP ledger | 點擊顯示積雪級距與解析時刻 |

## Explicitly not planned

- 不另下載警報界線：沿用既有 `jp_admin_boundaries.pmtiles`（實測 100% 對上）。
