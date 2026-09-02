# Supabase retention 補漏 + road_sections 優化提案（2026-09-01）

來源：2026-09-01 Supabase 儲存唯讀稽核（3 輪 SQL + 5 repo 使用追蹤）。

## 問題

7 張 `live` 時序表從建表起**無任何 retention**（不在 `metadata.retention_policies`、
也無 cleanup cron），合計 ~4.1GB 且持續成長。`check_retention_coverage()` 回報
「0 缺口」卻完全漏掉它們——因為它只查「分區母表未登記」與「已登記 delete 表無 cron」，
**看不到從未登記的非分區表**（假安心）。

使用追蹤結論：7 張**全部在用**（collector 活著寫 + 有 RPC 讀 + 前端消費），
所以修法是設 retention（削舊）**不是刪表**。`river_water_level` 由
mini-taiwan-pulse ＋ mini-taiwan-info **兩站共用同一 Supabase 專案**。

> 掃描範圍界線：只掃 gis-platform / data-collectors / mini-taiwan-pulse /
> mini-taiwan-info / plan-art。mini-taiwan-transport / embed / north-frame 等
> 其他可能直連者未掃——套用前值得確認沒有別站在讀更長歷史。

## retention 天數決策（下限實測自 RPC + 前端窗口，非拍腦袋）

| 表 | 現況 | 前端/RPC 實際窗口（下限）| **本提案設定** | 時間欄 | 首次清理後估存量 |
|---|---|---|---|---|---|
| border_airport_snapshot | 10M 列 / 自 2026-06-27 | 固定 24h | **7 天** | collected_at | ~1M 列 |
| river_water_level | 5.9M 列 / 自 2025-12-14 | rangeDays 1~7d（clamp）| **14 天** | observed_at | 兩站共用，保守 |
| road_events_current | 323k 列 / 自 2025-08-05 | 內部 24h（前端不直讀）| **3 天** | collected_at | 兜底 app 端 expire 刪除 |
| taipei_sewer_measurements | 2.24M 列 / 自 2026-03-02 | 24h | **7 天** | observed_at | |
| taipei_pumb_status | 1.02M 列 / 自 2026-06-08 | 24h | **7 天** | observed_at | |
| er_hospital_status | 397k 列 / 自 2026-06-03 | **14d**（get_er_wait_total_14d）| **30 天** | observed_at | 下限最緊者 |
| **aqi_imagery_frames** | 13k 幀 / 自 2026-04-14 | 24h | **14 天（cron 暫緩）** | observed_at | ⚠️ 見下 |

全部設定值都 >> 實測下限，不會弄壞任何現有卡/圖層。

### ⚠️ aqi_imagery_frames 特殊處理（唯一有不可逆損失風險）
其他 6 張是數值觀測，刪舊無損失。aqi 是 **base64 影像、目前無 R2 副本、上游大概率不留檔**。
本提案**登記但不排 cron**（仿 migration 282 對 uswg 的暫緩）：登記列讓 coverage check
持續提醒，實際刪除待下列其一：
- **(a)** AR-11f 完成 R2 雙寫（比照 cwa 的 `image_key IS NOT NULL` 防呆），或
- **(b)** owner 明確接受「丟失 >14 天的 AQI frame」。

決定後的一次性 SQL：
```sql
-- (a) R2 就緒後：只刪已上傳的
SELECT cron.schedule('cleanup-aqi-imagery-frames', '30 22 * * *',
  $$CALL live.cleanup_rows_batched('aqi_imagery_frames','observed_at',14,5000,200,'image_key IS NOT NULL');$$);
-- (b) 接受損失：無條件刪 >14 天
SELECT cron.schedule('cleanup-aqi-imagery-frames', '30 22 * * *',
  $$CALL live.cleanup_rows_batched('aqi_imagery_frames','observed_at',14,5000);$$);
```

## 套用步驟（DB 唯讀者無法代做，須有權限者拍板執行）

1. **取號**：本工作區有平行 session 搶 migration 號（BACKLOG PR-1 教訓：367/368/369 都被搶過），
   取號當天再定，把 `live_retention_unregistered_tables.PENDING.sql` 改名為
   `gis-platform/migrations/NNN_live_retention_unregistered_tables.sql`。
2. **確認 procedure 名**：現況清理 procedure 應為 `live.cleanup_rows_batched`
   （312 已從 282 的 `realtime.` 搬到 `live.`；317 佐證）。跑一句確認：
   `SELECT proname, pronamespace::regnamespace FROM pg_proc WHERE proname='cleanup_rows_batched';`
3. **套用**：離峰時段（避開台灣 10:00-20:00 餐期）跑 migration。
4. **觀察首夜**：首次執行刪大量 backlog（border_airport ~10M、river ~5.9M 列多數過期），
   `cleanup_rows_batched` 每晚上限 1000 萬列，backlog 大者分數晚清完（282 設計如此）。
   隔日查 `cron.job_run_details` 確認 succeeded + `check_retention_coverage()` 缺口變少。
5. **一次性縮小實體檔（選配）**：DELETE 不還磁碟給 OS。要真正縮小，對這幾張
   跑 `VACUUM FULL`（鎖表）或 `pg_repack`（不鎖表），務必避開餐期。

## road_sections_live 優化（回答「為何 800MB/天、能優化嗎」）

**是什麼**：TDX 全國省道 + 五縣市市區路況即時快照。一列 = 一路段一次抓取狀態，
**表內無幾何**（線型另存靜態表）。每 5 分鐘（288 次/天）**無 upsert、無 dedup**
全量 append，實測 1 天分區 = **221 萬列 / 7,729 路段 / 286 次快照**（每段每次都寫）。
7 天分區清理正常運作（無 backlog），靠它維持 ~4.4GB。前端其實只讀下游日聚合
`road_congestion_daily`（每段 288 字元等級時間軸，gzip <300KB/天）。

**去重天花板實測**（抽 800 段 LAG 比對；壅塞等級 81% 是暢通 level 1，長時間不變）：

| 策略 | 仍需寫入 | 可省 | 代價 |
|---|---|---|---|
| 只在**壅塞等級變化**時寫 | 18.8% | **~81%** | 失去等級不變期間的連續速度值 |
| 等級或速度(捨入1km/h)變化時寫 | 42.1% | ~58% | 幾乎無損 |
| 完整逐欄去重（速度會抖）| 43.3% | ~57% | 無損 |

**建議（依效益/風險排序）**：
1. **最省力**：retention 7 天 → **2 天**（前端只用日聚合，原始表只需活到當天聚合跑完）。
   零程式碼、即生效、省 ~3GB。SQL 見 PENDING 檔尾附錄。
2. **最省量（治本）**：collector 端加「等級變化才寫」dedup（仿 `road_event_live` 既有的
   「內容沒變不寫」邏輯）→ **省 ~81%**（800→~150MB/天），且下游日聚合只用等級、**不損失產品實際用到的東西**。
   前提：確認沒有別的消費者用 `road_sections_live.travel_speed`（popup 等）；若有則改用「無損逐欄去重」省 ~57%。
   此為 data-collectors 改動，需另開 PR。
3. **組合**：dedup + 2-3 天 retention，量與存量雙降。

## 實作狀態與部署計畫（2026-09-01）

三塊全部**已寫好 + 測過**，但**皆未套用 / 未 commit / 未 push**（正式庫變更依團隊鐵律由你執行）。

### (1) 7 表 retention migration — 可獨立套用
- 檔：`live_retention_unregistered_tables.PENDING.sql`（本目錄）。前置條件已唯讀驗證（表在 live、`live.cleanup_rows_batched` 存在且已 schema-qualify）。
- 套用：見上方「套用步驟」。與 (2)(3) 無相依，隨時可跑。

### (2) road_sections 收集器 dedup（含 daily heartbeat）
- 分支：`data-collectors` 的 `feat/road-congestion-dedup`（未 commit）。改 `supabase_tables.py`（加 `history_dedup_cols`）+ `supabase_writer.py`（dedup + heartbeat）+ 測試。
- 行為：level/speed/travel_time 任一變化才寫 history（float4 round(2) 防浮點誤判）；current 表維持每輪全量 upsert；**每台北日第一輪 bypass dedup 全量寫一次（heartbeat）**保證每天至少一張完整快照。
- 測試：`python3 -m pytest` 全專案 **330 passed**（含 11 個 road_congestion 案：dedup 判定 + heartbeat 跨日）。
- 預估：省 ~57% history 寫入量（實測去重天花板）；heartbeat 成本 ~7.7k 列/天（現量 0.3%）。

### (3) 285 日聚合 LOCF 重寫 — 配合 (2) 的必要下游改動
- 分支：`gis-platform` 的 `feat/road-congestion-daily-locf`（未 commit）。檔：`migrations/road_congestion_daily_locf.PENDING.sql` + `.test.sql`。
- 為何必要：dedup 讓 `road_sections_live` 變稀疏；`refresh_road_congestion_daily()` 是它**唯一**的時間窗讀取端（已 grep 全 repo 確認），原本純時間桶對位、無 forward-fill → 稀疏後會破洞/整段消失。重寫成 LOCF forward-fill + 跨日 seed + section 清單改用 `road_sections_current`。
- 依賴：正確性依賴 (2) 的 heartbeat（保證 gap ≤24h）；`seed_lookback_days=1`（須 < road_sections_live retention 天數）。
- 測試：合成稀疏 4 案全過（含 HEARTBEAT_ONLY：整天只有 slot 0 一筆 → 整天正確顯示等級）；正式庫向後相容抽樣 50 段，**不變量 50/50 成立**（新邏輯絕不改動舊版有效字元，只補舊版本來就是 '-' 的洞）。

### ⚠️ 部署順序（不可顛倒）
1. **先 (3)**：285 LOCF 上線。它在 dense 資料上運作正常（只是多補正式庫本來就有的零星漏抓），可與舊收集器共存。
   - 套用前**必跑一次 `EXPLAIN ANALYZE`（避開 10:00–20:00 尖峰）**：15-min cron 每 tick 呼叫 refresh 2 次，lookback=1 下掃描量約基準 2x（4 分區-日/tick）。確認 15 分鐘跑得完再上。若太慢，可把 seed 子查詢與 slotdata 拆開（seed 只需每段午夜前最後一列，不必掃整個 lookback 窗）。
2. **後 (2)**：確認 (3) 穩定後，再上收集器 dedup+heartbeat。資料開始稀疏，(3) 的 LOCF 接手，量體下降。
- **絕不可先 (2)**：舊聚合遇稀疏會破圖。

## 關聯 BACKLOG（建議新增）
- 7 張未登記表 retention（本提案）
- `check_retention_coverage()` 未登記表盲點（本提案 D 段已補）
- CLAUDE.md §2「禁前端直打 realtime.*」措辭過時，應改 `live.*`
- iot_wra_measurements 有 062 專屬 cron 但未進註冊表（治理小缺口）
