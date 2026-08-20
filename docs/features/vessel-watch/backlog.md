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
- [x] **VW-9**：船 × 界線 geofence 分析 —— **2026-08-20 拍板並展開為 Vessel Zone Watch**，
  設計 SSOT：[`docs/proposal/vessel-zone-watch.md`](../../proposal/vessel-zone-watch.md)。
  POC 已完成（唯讀，臺灣本島兩條線）：確認接近帶才是主訊號、進 24 浬罕見但真實、進 12 浬為 0。
  子項見下方 VZ-* 系列。

## Vessel Zone Watch（VZ-*，VW-9 的展開）

- [ ] **VZ-1**：界線幾何入庫 `spatial.maritime_zones`（gis-platform migration 353 + data-collectors 灌入腳本）。
  - Outcome：24/12 浬線與基線在 DB 裡可做空間判斷，不再只有前端 PMTiles。
  - Acceptance：12 features 全入、`ST_IsValid` 全 true、三題空間邏輯測試通過
    （台北 101 在兩線內／遠洋點在 24 浬外／向陽紅 22 於 25.4685N,122.3982E 在 24 浬內但 12 浬外）。
- [ ] **VZ-2**：`vessel_watch_positions` 加 `dist_24nm_nm` / `zone` / `zone_region` 三欄 + BEFORE INSERT trigger + 62.5 萬筆回補。
  - Outcome：每個定位點都帶「距 24 浬線幾浬、在哪一帶」，歷史與新資料一致。
  - 為何用 trigger 不改 sweep：寫入有兩條路徑（每小時 pg_cron sweep + `backfill_vessel_watch.py`），trigger 才能同時覆蓋。
  - Acceptance：回補後數字與 POC 對得上（中國海警 approach_12 = 24 艘 / 2,404 筆等，±簡化誤差）。
- [ ] **VZ-3**：`live.vessel_zone_daily` 預聚合表 + refresh function + pg_cron + `public.get_vessel_zone_daily` RPC。
  - 為何一定要預聚合：POC 實測即時聚合 2,385 ms / 2,587 ms，破專案 1 秒門檻。
  - 日界用 **Asia/Taipei**；分類 join registry `effective_class` 保住「改字典免 backfill」性質；一律 `AND NOT is_excluded`。
  - Acceptance：`/check-rpc` < 1s。
- [ ] **VZ-4**：Monitor 卡 `VesselZoneCard`（主視覺＝接近帶趨勢，鄰接區進入為稀疏事件標記）。
  - ⚠️ 三處手動同步：`monitorLayout.ts`（id union + dock 座標）／`monitorSplitLayout.ts`（split 座標，**漏了不會編譯錯、卡片靜默消失**）／`MonitorPanel.tsx`。
  - 座標走 `docs/features/monitor-split/sandbox-split.html` 沙盒匯出，不手算。
  - 復用 `HazardTrendBars`（`value===null` 灰樁區分「沒資料」與「真的 0 艘」）+ `useChartTooltip`。
- [ ] **VZ-5**：vesselWatch 圖層增強（popup 顯示距離與 zone、船點依 zone 描邊、「只看接近船」toggle）。
  - ⚠️ `get_vessel_watch_current` 加回傳欄位須 **DROP + CREATE**（Postgres 不允許 `CREATE OR REPLACE` 改 `RETURNS TABLE`）。
- [ ] **VZ-6**：+6 / +12 浬預警環 GeoJSON（放 `public/`，**刻意不進 `maritime_boundary.pmtiles`** —— 那顆不進 git 且 VW-8 未結，塞進去等於把新功能綁在未完成的部署步驟上）。
  - 圖例文字須寫「預警參考線（非法律界線）」。
- [ ] **VZ-7**（選）：`live.vessel_zone_events` 進出事件表 + 事件列表。
  - 切段用與軌跡層同一把尺（相鄰點間隔 > 1 小時即斷開），不切會生出橫跨數日的假滯留。
- [ ] **VZ-8**：`scan_vessel_registry.py` 加壞 MMSI 守門規則。
  - 採「相異船名 >3 **且** 最大單一船名占比 <90%」（單看船名數會誤殺海監 66 這種真船），命中標 `needs_review` 不自動排除。

### VZ 已完成
- [x] 2026-08-20 排除 3 筆 AIS spoofing 假 MMSI：`412000000`（43 個船名、最高隱含速度 1,947 節、12 筆陸上點、
  Global Fishing Watch 專文點名）、`412000006`、`412000003`。`413555220`（海監 66）查證為**真船**，保留。

## Conditional / scheduled

- [ ] **VW-4**：週掃排程化。
  - Trigger：owner 願意把目前刻意手動流程改成排程。
  - Outcome：registry/影像回補不靠人工記憶。
  - Acceptance：成功／失敗告警、重跑與 retention 行為可驗證。

## 已完成／已決定（歷史，不列入 active）

- [x] **VW-3**：海域界線 PMTiles 接線與四鐵則（2026-08-13）。
- [x] 資料層兩表、分類函數、sweep cron、永久 retention、RPC、MMSI 守門／重算與軌跡切段。
- [x] **VW-7**：拼音字典已落地，grayzone-incursion ledger G04 的原假設可結案；若要回灌另開明確需求。
