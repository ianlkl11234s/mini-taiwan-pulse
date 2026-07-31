# Earthquake Replay — Changelog

## 2026-07-31 初版上線（feat/earthquake-replay）

- `earthquakeReplay` 圖層：事件清單（34 起，Tier A/B badge）+ scoped 播放器（play/pause/scrub/重播，×0.4–4 自動壓縮倍率）
- Tier A 五步編排（震央→測站 S 波亮起→網格波前展開→鄉鎮定格→沙灘球）；Tier B 三步
- 專案首個「統計值 join 行政區 polygon」choropleth（township PMTiles promoteId + feature-state）
- 沙灘球 strike/dip/rake 自繪 SVG（`src/lib/beachball.ts`，對官方圖 4/4 方位驗證）
- gis-platform mig 324 清單 RPC（resolved key 模式，時間窗封裝 DB 端）
- **順手修**：本土 `earthquakes` 圖層補 click popup（現存四鐵則違規；ripple 動畫圈刻意不做點擊目標避免搶點擊；本土 CWA 排 USGS 之前）
- 四鐵則全接：opacity slider / CWA 震度圖例 / 測站+鄉鎮 popup / select
- 驗證：tsc -b 零錯、212 測試全綠、agent-browser 端到端（楠西五步、scrub、dispose 無殘影）
