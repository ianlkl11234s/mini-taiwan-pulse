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
- [x] **VZ-3**（2026-08-20 完成，migration 358）：`live.vessel_zone_daily` 1,259 列（175 天 × 10 分類）
  + per-day refresh function + pg_cron `refresh-vessel-zone-daily`（`20 * * * *`）+ RPC。
  **效能：即時聚合 4,551 ms → RPC 1.16 ms**。對帳逐格與直查 positions 完全一致，anon 實測通過。
  ⚠️ 待驗：cron 首次執行（查詢時 `cron.job_run_details` 仍 0 筆，需下次確認 jobid 113 有 succeeded）。
  ⚠️ 待補：`docs/supabase_rpc_audit.md` 未登錄本 RPC（跨 repo，上一軌授權外）。
- [ ] ~~**VZ-3**~~：`live.vessel_zone_daily` 預聚合表 + refresh function + pg_cron + `public.get_vessel_zone_daily` RPC。
  - 為何一定要預聚合：POC 實測即時聚合 2,385 ms / 2,587 ms，破專案 1 秒門檻。
  - 日界用 **Asia/Taipei**；分類 join registry `effective_class` 保住「改字典免 backfill」性質；一律 `AND NOT is_excluded`。
  - Acceptance：`/check-rpc` < 1s。
- [ ] **VZ-4**：Monitor 卡 `VesselZoneCard`
  - 🔴 **前端契約：`ships` 欄位絕對不可跨日 SUM**。它是每日 distinct 艘數，同一艘船跨多日會重複計數。
    實證（臺灣本島・中國海警・approach_6）：**RPC 逐日加總 = 45，實際不重複艘數 = 13**（虛胖 3.5 倍）。
    → 卡片只能「逐日使用」或「取 MAX」（例如「本月單日最高 M 艘」），
    要全期不重複艘數必須另外查 `live.vessel_watch_positions`，日聚合表結構上回推不出來。（主視覺＝接近帶趨勢，鄰接區進入為稀疏事件標記）。
  - ⚠️ 三處手動同步：`monitorLayout.ts`（id union + dock 座標）／`monitorSplitLayout.ts`（split 座標，**漏了不會編譯錯、卡片靜默消失**）／`MonitorPanel.tsx`。
  - 座標走 `docs/features/monitor-split/sandbox-split.html` 沙盒匯出，不手算。
  - 復用 `HazardTrendBars`（`value===null` 灰樁區分「沒資料」與「真的 0 艘」）+ `useChartTooltip`。
- [ ] **VZ-5**：vesselWatch 圖層增強（popup 顯示距離與 zone、船點依 zone 描邊、「只看接近船」toggle）。
  - ⚠️ `get_vessel_watch_current` 加回傳欄位須 **DROP + CREATE**（Postgres 不允許 `CREATE OR REPLACE` 改 `RETURNS TABLE`）。
- [ ] **VZ-6**：+6 / +12 浬預警環 GeoJSON（放 `public/`，**刻意不進 `maritime_boundary.pmtiles`** —— 那顆不進 git 且 VW-8 未結，塞進去等於把新功能綁在未完成的部署步驟上）。
  - 圖例文字須寫「預警參考線（非法律界線）」。
- [ ] **VZ-7**（選）：`live.vessel_zone_events` 進出事件表 + 事件列表。
  - 切段用與軌跡層同一把尺（相鄰點間隔 > 1 小時即斷開），不切會生出橫跨數日的假滯留。
- [x] **VZ-8**（2026-08-20 完成，data-collectors `39efbcc`）：三條規則
  （A 船名分散 / B 格式違規 / C 隱含速度 >40 節累積 ≥10 次），命中只印待審清單不寫 DB。
  **正樣本 15/15 命中、負樣本 4/4 乾淨**（MATANGI / YU ZHENG81967 / 海監 66 / 416002560 皆未誤判）。
  船名正規化刻意只去「分隔符+1~4 位數字+%」這個窄格式，不去所有尾端數字 ——
  否則 `SHUNDA168` 這類真正該算相異的型號尾碼會被稀釋掉。
  新圈出 7 筆待人工查證：`100900918`、`108002427`、`416000087`、`416005696`、`825441324`、`845333644`、`900118637`。
  ⚠️ 兩個已知瑕疵：(1) `needs_review` 目前只是報告輸出，**registry 沒有這個欄位**，
  要落地成可查詢欄位需另開 gis-platform migration；(2) `999999999` 因首碼 99 被路由進 AtoN 群組
  而非測試碼群組（已 `is_excluded` 故無害，但屬規則邊界瑕疵）。
- [ ] ~~**VZ-8**~~（原始描述保留）：`scan_vessel_registry.py` 加壞 MMSI 守門規則。
  - 基礎規則：「相異船名 >3 **且** 最大單一船名占比 <90%」（單看船名數會誤殺海監 66 這種真船）。
  - ⚠️ **必須再加一條反誤判過濾：船名欄位被挪用回報狀態的樣式**。
    2026-08-20 查證實例：`994161168`（台灣自主無人載具 MATANGI）82 個「相異船名」其實全是
    `CT4-2073-XXXX%` 的電量回報；`412819678`（中國漁政）3 個名字是 `YU ZHENG81967` 加電量%後綴。
    → 判準：把船名的**數字/百分比尾綴正規化後再算相異數**，否則會把真船判成假碼。
  - 命中一律標 `needs_review`，**不自動排除**。
- [ ] **VZ-9**：AIS 寫入端加格式閘門（`live.is_watch_candidate()` 或 sweep 前置驗證）。
  - 起因：垃圾廣播在 `source='sweep'` 與 `source='s3_backfill'` **兩條路徑都有** →
    是原始 AIS 資料流本來就有的雜訊，不是某支 collector 的 parser bug，
    **要在寫入層擋，不是去改 collector**。
  - 分級（實測影響，全表 627,306 筆 / 693 個 mmsi）：
    - **A 格式檢查**（強烈建議）：`mmsi !~ '^[0-9]{9}$'` → 1,188 筆 / 3 個 mmsi
    - **B ＋已知測試碼黑名單** → 累計約 4,838 筆 / 9 個 mmsi（占全表 0.77%）
    - **C ＋完整 ITU MID allowlist**（維護成本高）→ 另有 13 個 mmsi / 3,086 筆屬非法 MID
  - ⚠️ **99 開頭（AtoN 格式）不可在寫入端擋** —— 目前 4 個 mmsi / 2,277 筆，其中 `994161168`
    已確認是真實資產。應路由到獨立分類（AtoN／自主載具）並豁免船舶身份去重規則。
- [ ] **VZ-10**：`994161168` 分類精修 + `994161820`（323 筆，同為 99 開頭）比照查證。
  - `994161168` = **MATANGI AUTONOMOUS，台灣籍自主無人載具**（MyShipTracking 有獨立紀錄）。
    目前 registry 標「軍艦」，語意不夠精確（它不是艦艇也不是固定 AtoN）。
  - 附帶未解：DB 記的 call_sign 是 `SDE03`，外部顯示 `VWMI24`，原因不明。

### VZ 已完成
- [x] 2026-08-20 **第二批排除 8 筆**測試碼／格式違規 MMSI：`123456789`（MarineTraffic 官方標記
  「AIS TEST 903」）、`0`（ITU 群組呼叫位址，非船舶識別碼）、`111111111`、`999999999`（首碼不在
  合法 MID 2–7 範圍）、`800123456`（MID 800 不在 200–775）、`400000000`（MID 未分配）、
  `12345678`（僅 8 碼，USCG 確認須恰 9 碼）、`222222222`（外部文獻證實 ≥10 艘船共用；
  ⚠️ 原被規則依船名「FRENCHWARSHIP」誤判為軍艦）。
  **保留 `994161168`**（真實資產，見 VZ-10）；`412819678` / `416002560` **列待議**
  （內部證據皆指向真船、零瞬移，但外部查無精確 MMSI 紀錄，需中文來源或漁業署資料再查證）。
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
