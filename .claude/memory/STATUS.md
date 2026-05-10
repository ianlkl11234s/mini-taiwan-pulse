# Status

**最後更新**：2026-05-10（凌晨 - 早晨 台南 OSRM 上線 + 22 縣市盤點 + Phase 1 規劃）
**分支**：`feat/historical-mode`（本機領先 origin **19 commits**）

## 本次 session（5/10）完成

### 1. 台南 OSRM map-matching 上線

- 環境變數加台南：`WASTE_MATCH_CITIES=高雄市,臺南市`
- 找到並修 3 個 production bug：
  - **OSRM 400**：政府 polling 重疊把同 (city, vehicle_no, observed_at) 寫 2-4 次 → 相鄰兩點時差 0 → OSRM HMM 拒收。Fix: SQL `raw` CTE 加 `DISTINCT ON` （commit `d8297f9`）
  - **trip 切碎成 2 點**：trip-gap 600s 對台南 5min 採樣太緊。Fix: 600s → 900s（commit `e937383`）
  - **psycopg2 % escape**：SQL 註解的 `1%` `8%` 被當 placeholder。Fix: 改 `pct` 字（commit `971a105` + `b66361f`）
- DELETE 5/8+5/9 台南 attempts 強制重跑、驗證 trip-gap 900 真效
- 最終 success rate：5/9 台南 ~45% / 5/9 高雄 30%（vs 5/8 49% — BL-14 待查）

### 2. 22 縣市資料盤點 + Phase 1 規劃

3 份新 research note（commit `[docs hash]`）：
- `docs/research/waste-multi-city-survey.md`：22 縣市靜態 / 動態 / 平台對照
- `docs/research/waste-multi-city-roadmap.md`：5 phase / 5-7 週工程表 + 依賴圖
- `docs/research/waste-multi-city-progress.md`：兩維度交叉表 + 每縣市進度

**關鍵 finding**：
- 動態 GPS 只 4 城（新北 / 台中 / 台南 / 高雄）
- A 類靜態完整 7 城（雙北 + 高雄 + 台南 + 台中 + 基隆 + 宜蘭）
- B 類 TGOS 補 4 城（新竹市 / 雲林 / 嘉義市 / 澎湖）
- C 類資料缺口 11 城（含桃園這個六都意外）
- **環保署沒有民生垃圾車統一 API**，要逐縣市串

### 3. 前端視覺微調

commit `fd464d7`：
- App.tsx + useWasteLayer 預設 cities 加台南
- WASTE_STATUS_COLORS 全 status 統一琥珀 `#fbbf24`
- 音符色 `#fbbf24` → `#fff8d6`（暖黃白）
- 音符 spawn 500ms → 800ms

### 4. 記憶系統更新

commit `1d2555a`：BACKLOG BL-9 標 partial、新增 BL-14（高雄落差）/ BL-15（ETL UNIQUE）/ BL-16（前端 city 切換）

## 下次 session 必做（Phase 1）

詳見 → [`docs/research/waste-phase-1-handoff.md`](../../docs/research/waste-phase-1-handoff.md)

**Phase 1 主目標**：把 Tier 1 7 城資料全部進 DB（為 Phase 2 OSRM 擴展 + Phase 3 時刻表視覺化鋪路）

**4 個並行 sub-task**：

1. **接台中 GPS collector**（0.5-1 天）
   - Endpoint 已找到：`https://newdatacenter.taichung.gov.tw/api/v1/no-auth/resource.download?rid=c923ad20-2ec6-43b9-b3ab-54527e99f7bc`
   - 採樣 10 min / 無 token
   - schema 與 SOA 接近但要寫 `_normalize_taichung`（X/Y 大寫、無 wrapper、time format `YYYYMMDDTHHMMSS`）

2. **接 5 城靜態 stops/routes seeder**（2-3 天）
   - 台中 / 台南：static 還沒進 DB
   - 台北 / 基隆 / 宜蘭：DB 有 stops 但需確認完整度 + 補 routes LineString

3. **TGOS 啟動（user 端）**
   - 已確認：**沒有可重用的歷史 TGOS 批次**（之前的批次是火災 / 1999 / 不動產，且高雄不動產 geocoding 失敗）
   - 4 城（新竹市 / 雲林 / 嘉義市 / 澎湖）需從零跑 TGOS

4. **新北 / 台南 OSRM 收尾**（0.5 天）
   - 連續 3 天監控 success rate
   - BL-9 完整 done

**Phase 1 結束 deliverable**：DB 內 7 城 stops/routes 齊 + 4 城 GPS 齊（含台中）+ BL-9 收尾

## 待用戶執行（5/9 殘留 + 5/10 新增）

- [ ] **`git push origin feat/historical-mode`**（19 commits ahead；data-collectors 已 push 到 `b66361f`）
- [ ] **gis-platform `git push origin master`**（4 commits ahead，含 074 + 075）
- [ ] **TGOS 對外接洽啟動**（B 類 4 城）
- [ ] **規劃寫入 gis-wiki**：本 session 領域知識（OSRM HMM 限制、台南 GPS pattern、5/10 三 bug）

## 累計狀態快照

- **垃圾車 OSRM matched 資料**：5/4-5/10 共 7 天 / ~2,800 rows / ~1,400 vehicle-days
- **DB 內覆蓋**：5 城 stops（基隆 / 宜蘭 / 新北 / 台北 / 高雄）/ 2 城 routes LineString（新北 / 高雄）/ 3 城 GPS（新北 / 台南 / 高雄）
- **5/9 台南覆蓋率 64.2%**（170/265 vehicles）
- **5/9 高雄覆蓋率 58.8%**（183/311 vehicles，但 success rate 30% < 5/8 49%，待查 BL-14）

## 關鍵下一步候選（[BACKLOG.md](BACKLOG.md)）

- **Phase 1.1 接台中 GPS**（Endpoint 已備好）
- **Phase 1.2 5 城 seeder**（台中 / 台南 / 台北 / 基隆 / 宜蘭 stops/routes）
- **Phase 2 OSRM 擴展**（4 GPS 城都跑 map-matching）
- **Phase 3 時刻表視覺化**（捷運式動畫，依賴 Phase 1.2）
- **BL-15 ETL UNIQUE constraint**（hygiene，每天少寫 50K dup）

詳細：[Phase 1 Handoff](../../docs/research/waste-phase-1-handoff.md) / [DATA_SCOPE.md](DATA_SCOPE.md) / [BACKLOG.md](BACKLOG.md)
