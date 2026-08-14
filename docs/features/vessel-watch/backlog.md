# Backlog — Vessel Watch

## 待處理

- [ ] **VW-8** ⚠️ 部署前必跑 `scripts/deploy/upload-deploy-assets.sh` 上傳
      `maritime_boundary.pmtiles`（PMTiles 不進 git，nginx /base_map/ 無 dist fallback → 不跑會 prod 404，PT-1 同款）
- [ ] **VW-9** 船 × 界線的 geofence 分析（有了兩半才做得起來：某船何時進入 24 浬／12 浬）
- [ ] **VW-1** S3 回補 2026-02-03 ~ 02-27（逐檔版面，每日 144 檔 × 4.2MB 較慢）。`--since 2026-02-03 --until 2026-02-27`
- [ ] **VW-2** 人工審 46 艘規則認不出的船（`scan_vessel_registry.py --report-only`）
- [ ] **VW-4** 週掃排程化（目前刻意手動，用戶要求）
- [ ] **VW-5** 圖例接 `get_vessel_watch_classes()` 顯示即時艘數（RPC 已寫、loader 已 export，未接）
- [ ] **VW-6** 視窗內只有 1 個定位點的船沒有軌跡線，視覺上與「無資料」無法區分
- [ ] **VW-7** 回灌 `mini-taiwan-osint` 的 grayzone-incursion ledger G04（拼音字典已落地，該假設可結案）

## 已完成

- [x] **VW-3** 界線圖層（2026-08-13）—— `maritimeBoundary` 進「底圖 → 海域界線」。
      4MB GeoJSON → 355KB PMTiles；基線／12浬／24浬（虛線）／基點 4 類分色。
      至此「哪艘船逼近哪條線」兩半到齊

- [x] 資料層兩表 + 分類函數 + sweep cron（migration 339）
- [x] 永久 retention 註冊
- [x] 前端 RPC（340）
- [x] MMSI 守門（341）+ 重算（342）
- [x] 前端圖層 + 四鐵則
- [x] 軌跡訊號中斷切段
