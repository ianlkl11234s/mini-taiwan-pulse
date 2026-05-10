# Status

**最後更新**：2026-05-10（凌晨 - 早晨 台南 OSRM 上線 + 22 縣市盤點 + hwms finding + Phase 1 規劃）
**分支**：`feat/historical-mode`（本機領先 origin **20 commits**）

## 本次 session（5/10）完成

### 1. 台南 OSRM map-matching 上線

- 環境變數加台南：`WASTE_MATCH_CITIES=高雄市,臺南市`
- 找到並修 3 個 production bug（commit `d8297f9` / `e937383` / `971a105` / `b66361f`）：
  - **OSRM 400**：台南 polling 重疊 → 同 (city, vehicle_no, observed_at) 寫 2-4 次 → SQL `DISTINCT ON` fix
  - **trip 切碎成 2 點**：trip-gap 600s 對 5min 採樣太緊 → 改 900s
  - **psycopg2 % escape**：SQL 註解 `1%` `8%` 被當 placeholder → 改 `pct` 字
- DELETE 5/8+5/9 台南 attempts 強制重跑驗證
- 最終 success rate：5/9 台南 ~45%（樣本 160）/ 5/8 台南 ~21%（backfill 中）/ 5/9 高雄 30%（vs 5/8 49% — BL-14 待查）

### 2. 22 縣市資料盤點 + 重大 finding

3 份 research note（commit `48b4471`、5/10 重寫）：
- `docs/research/waste-multi-city-survey.md`：22 縣市 catalog 盤點
- `docs/research/waste-multi-city-roadmap.md`：4 phase / 3-4 週工程表（含 Track A/B）
- `docs/research/waste-multi-city-progress.md`：22 縣市進度 + hwms 為核心

**重大 finding**（5/10 晚）：
- 用戶 5/3-5/8 已在 taipei-gis-analytics 做完一個完整 ETL pipeline：
  - hwms.moenv.gov.tw（環境部資源循環署「全國垃圾車路線網」）爬蟲：22 縣市 / 3,991 路線 / 308K unified stops
  - TGOS 批次打包：day_001-007 共 67,911 地址等上傳
  - Schema migrations 067/068 已 apply、Phase 10 import 跑過
  - facilities 4,609 + disposal_points 13,751 + squads 345 全到位
- **「Tier 2/3 資料缺口」其實不存在** — hwms 一站式涵蓋全臺 22 縣市
- 之前 master_catalog.sqlite 沒收 hwms（盲點），導致 Agent B 結論錯誤

### 3. 前端視覺微調（commit `fd464d7`）

- App.tsx + useWasteLayer 預設 cities 加台南
- WASTE_STATUS_COLORS 全 status 統一琥珀 `#fbbf24`
- 音符色 `#fbbf24` → `#fff8d6`（暖黃白）
- 音符 spawn 500ms → 800ms

### 4. 記憶系統更新（commit `1d2555a`）

BACKLOG BL-9 標 partial、新增 BL-14（高雄落差）/ BL-15（ETL UNIQUE）/ BL-16（前端 city 切換）

### 5. STATUS + Handoff（commit `96c4597` + 本次重寫）

- `.claude/memory/STATUS.md`（本檔）
- `docs/research/waste-phase-1-handoff.md`：Phase 1 Track B 起手包

## 下次 session 必做（Track B / Phase 3 prototype 提前）

詳見 → [`docs/research/waste-phase-1-handoff.md`](../../docs/research/waste-phase-1-handoff.md)

**核心 framing 修正（5/10 晚）**：

5/10 驗證 DB 內 **5 城共 77K stops 已 100% 完整**（高雄/新北/宜蘭/台北/基隆 — arrival_time + departure_time + weekday_pattern + route_id 都齊）。**Phase 3 prototype（時刻表動畫）不必等 TGOS callback** → 可立即用 5 城做、跟 TGOS 並行。

**Track A 進度**（user / taipei-gis-analytics）：

```
✅ day_001+002 已上傳完拿到結果（5/10 16:36）
   result/v2/Address_Finish (32)+(33).csv
   座標系是 TWD97 (EPSG:3826)，callback 要轉 WGS84
⏳ user 持續上傳 day_003-007
🔴 寫 12_unified_callback.py
🔴 callback 跑完 → DB stops 77K → 385K
```

**Track B 順序（next session）**：

```
1. Phase 3 prototype 時刻表動畫（5 城）  ← 先做、1 週
   - 建 RPC get_waste_schedule_day
   - 寫 wasteScheduleLoader / useWasteScheduleLayer
   - WasteScheduleScene 3D 按表跑
   - 高雄+新北用 routes LineString / 台北+基隆+宜蘭用 OSRM /route 補
2. 接台中 GPS collector（0.5-1 天）
   - Endpoint 已找好 5/10 16:14 實打 200 OK / 1300+ vehicles
3. 新北 OSRM 接 map-matching（0.5 天）
4. BL-9 / BL-14 收尾
```

**為何重排**：5 城時刻表完整 → Phase 3 立即可做、不卡 Track A，user 並行繼續推 TGOS 7 天上傳。

## 待用戶執行（5/9 殘留 + 5/10 新增）

- [ ] **mini-taiwan-pulse 本機 push 到 origin（user 之前說先不用）**：20 commits ahead
- [x] **gis-platform push**：0 commits ahead，**不用 push**（5/10 確認，前面 STATUS 寫錯）
- [x] **data-collectors push**：已 push 到 `b66361f`
- [ ] **TGOS 7 天上傳啟動**（taipei-gis-analytics 範圍）
- [ ] **寫 `12_unified_callback.py`**（taipei-gis-analytics 範圍，Day 1 結果回來前補）
- [ ] **規劃寫入 gis-wiki**：本 session 領域知識（OSRM HMM / 台南 GPS pattern / 5/10 三 bug / hwms finding）

## 累計狀態快照

- **垃圾車 OSRM matched 資料**：5/4-5/10 共 7 天 / ~2,800 rows / ~1,400 vehicle-days
- **DB 內覆蓋**（mini-taiwan-pulse 端）：5 城 stops + 2 城 routes + 3 城 GPS（+ 5/8 phase 10 後 facilities 4,609 / disposal_points 13,751 / squads 345）
- **5/9 台南覆蓋率 64.2%**（170/265 vehicles）
- **TGOS 批次（taipei-gis-analytics）**：67,911 地址 / 7 batch / 涵蓋 19 縣市 / 待 user 上傳
- **hwms 爬蟲（taipei-gis-analytics）**：3,991 路線 / 308K stops 待 callback 灌 DB

## 關鍵下一步候選（[BACKLOG.md](BACKLOG.md)）

- **Phase 1 Track A**：TGOS 7 天上傳（user 端）+ callback script
- **Phase 1 Track B**：接台中 GPS（endpoint 已備好）+ 新北 OSRM
- **Phase 2 OSRM 擴展**：等 callback 跑完 + 4 GPS 城都接上
- **Phase 3 時刻表視覺化**：22 縣市捷運式動畫（依賴 callback + Phase 2）
- **BL-15 ETL UNIQUE constraint**（hygiene，每天少寫 50K dup）

詳細：[Phase 1 Handoff](../../docs/research/waste-phase-1-handoff.md) / [Roadmap](../../docs/research/waste-multi-city-roadmap.md) / [Progress](../../docs/research/waste-multi-city-progress.md) / [BACKLOG.md](BACKLOG.md)
