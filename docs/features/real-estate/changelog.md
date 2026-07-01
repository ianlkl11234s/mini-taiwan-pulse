# Changelog — real-estate

最新在上。

---

## 2026-06-24 — PR #31 merged

- 6 圖層全部上線（rental / sale / presale × {grid, points}）
- PMTiles 靜態化，前端零 RPC
- Timeline 季/月/週三粒度 + RAF 引擎 fade
- 排除雙北 toggle + p95 色階壓縮
- 全台 zoom：grid `-Z6`、point `-r1.7`
- 修 basemap dark↔Pure Black 切換 overlay 消失（`{diff:false}`）
- 資料量：365,219 points / grid 39MB / point 28MB

## 2026-06-24（未 push）— `feat/real-estate-points-customlayer`

- 3 個點層改 WebGL CustomLayer + GPU fade uniform（每幀固定成本）
- 新資產：`real_estate_points_buffer.bin`（interleaved Float32×5，7.3MB）
- 打包腳本：`taipei-gis-analytics/scripts/pack_real_estate_points_buffer.py`
- 取捨：⚠️ 點 hover/click 暫時放棄（CustomLayer 無 queryRenderedFeatures）
- 驗收：tsc 0 / 155 tests / browser 週播放流暢
