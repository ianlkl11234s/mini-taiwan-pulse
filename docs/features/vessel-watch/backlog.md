# Backlog — Vessel Watch

> 本檔只保留 current residual；VW-3 與資料層基礎建設已完成，移至歷史區。

## Release blocker

- [ ] **VW-8**：部署前上傳 `maritime_boundary.pmtiles`。
  - Outcome：正式站可同時看到船舶與海域界線，不因 PMTiles 不進 git 而 404。
  - Next action：執行 `scripts/deploy/upload-deploy-assets.sh`，核對 S3 HEAD/checksum、HTTP Range 與 browser base map。

## Data quality / backfill

- [ ] **VW-1**：回補 2026-02-03～02-27 的 S3 逐檔版面（每日 144 檔 × 4.2MB）。
  - Outcome：時間軸不再有已知日期缺口。
  - Next action：以 `--since`/ `--until` 分批回補，記錄成功檔數、checksum 與缺口。
- [ ] **VW-2**：人工審 46 艘規則認不出的船。
  - Outcome：registry 分類與 popup 語意更可靠。
  - Next action：執行 `scan_vessel_registry.py --report-only`，逐艘記錄決定與回歸測試。

## Product enhancement / UX validation

- [ ] **VW-5**：圖例接 `get_vessel_watch_classes()` 顯示即時艘數。
  - Outcome：圖例能反映目前分類數量，不只顯示靜態色票。
  - Next action：接 loader 已 export 的 RPC，browser 驗收 live refresh 與 empty state。
- [ ] **VW-6**：處理視窗內只有 1 個定位點的船沒有軌跡線的誤讀。
  - Outcome：使用者能分辨「單點資料」與「無資料」。
  - Next action：決定單點 marker/empty label 的 UX，補 popup/legend acceptance。
- [ ] **VW-9**：船 × 界線 geofence 分析（24 浬／12 浬）。
  - Outcome：回答船舶何時進入或接近界線的事件問題。
  - Next action：先定義時間窗、穿越判準與兩套幾何的授權／精度，再做分析 POC。

## Conditional / scheduled

- [ ] **VW-4**：週掃排程化。
  - Trigger：owner 願意把目前刻意手動流程改成排程。
  - Outcome：registry/影像回補不靠人工記憶。
  - Acceptance：成功／失敗告警、重跑與 retention 行為可驗證。

## 已完成／已決定（歷史，不列入 active）

- [x] **VW-3**：海域界線 PMTiles 接線與四鐵則（2026-08-13）。
- [x] 資料層兩表、分類函數、sweep cron、永久 retention、RPC、MMSI 守門／重算與軌跡切段。
- [x] **VW-7**：拼音字典已落地，grayzone-incursion ledger G04 的原假設可結案；若要回灌另開明確需求。
