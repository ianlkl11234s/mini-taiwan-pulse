# Phase 1 Handoff — 垃圾清運 7 城資料層擴展

> 寫於 2026-05-10 凌晨
> 對象：下個 session 起手做 Phase 1
> 預估：1-2 週、4 個並行 sub-task

---

## Session 起手三步

```
1. 讀本檔（你正在讀）
2. 讀 .claude/memory/STATUS.md（上次結束點）
3. 讀 docs/research/waste-multi-city-progress.md（每城進度表）
```

讀完就能動手。其他文件按需要讀。

---

## Phase 1 目標（一句話）

```
把 Tier 1 7 城（雙北 / 高雄 / 台南 / 台中 / 基隆 / 宜蘭）資料全部進 DB，
為 Phase 2 OSRM 擴展 + Phase 3 時刻表視覺化鋪路。
```

---

## 4 個並行 sub-task

### Task 1.1 — 接台中 GPS collector（0.5-1 天）

**Endpoint 已找到（agent 確認 5/10 16:14 實打 200 OK / 1300+ active vehicles）**：

```
URL: https://newdatacenter.taichung.gov.tw/api/v1/no-auth/resource.download?rid=c923ad20-2ec6-43b9-b3ab-54527e99f7bc
採樣: 每 10 min
Token: 無（路徑含 /no-auth/）
License: 政府資料開放授權 v1.0
Dataset: https://opendata.taichung.gov.tw/search/62205d71-7d1c-4545-b0dc-1bf262d57c0b
```

**測試指令**：

```bash
curl -sS -m 30 -A "Mozilla/5.0 (compatible; TaipeiGISBot/1.0)" \
  "https://newdatacenter.taichung.gov.tw/api/v1/no-auth/resource.download?rid=c923ad20-2ec6-43b9-b3ab-54527e99f7bc" \
  | python3 -c "import json,sys; d=json.load(sys.stdin); print(len(d), d[0])"
```

**Response schema 範例**：

```json
[{"lineid":"24908","car":"KED-1385","time":"20260510T160411",
  "location":"龍井區清潔隊回收廠","X":"120.540557","Y":"24.192597",
  "SpeedValue":"0","OverSpeed":"N"}, ...]
```

**vs SOA 標準的差異**：
- `lineid`（多 e，台南是 `linid`）
- `X / Y` 大寫（台南是小寫 `x / y`）
- **無 SOA wrapper**（台南/高雄是 `{success, data: [...]}`、台中是 raw array）
- 多 `SpeedValue` / `OverSpeed`（可忽略）

**實作步驟**：

```python
# data-collectors/collectors/waste_positions.py

# 1. ENDPOINTS 加台中
ENDPOINTS['Taichung'] = 'https://newdatacenter.taichung.gov.tw/api/v1/no-auth/resource.download?rid=c923ad20-2ec6-43b9-b3ab-54527e99f7bc'

# 2. CITY_NAMES 加台中
CITY_NAMES['Taichung'] = '臺中市'

# 3. TIME_FORMATS 加台中格式（放最前面，台中筆數最多）
TIME_FORMATS = ('%Y%m%dT%H%M%S', ...)  # 原本的格式跟在後面

# 4. 寫 _normalize_taichung（仿 _normalize_soa 但無 wrapper、欄位 case 不同）
def _normalize_taichung(self, rows: list, ...) -> list[dict]:
    # 不檢查 success wrapper
    # 欄位 map: lineid → linid（or 直接用 lineid）
    # X / Y → x / y
    # 其他同 SOA
    
# 5. _fetch_taichung
def _fetch_taichung(self, fetch_time):
    url = ENDPOINTS['Taichung']
    r = self._get_with_retry(url, '臺中市')
    body = r.json()  # 直接 list，無 .get('data')
    return self._normalize_taichung(body, '臺中市', url, fetch_time)

# 6. FETCHERS 加 'Taichung': '_fetch_taichung'

# 7. config.py: WASTE_POSITIONS_CITIES 預設已含 Taichung（看一下確認）
```

**驗收條件**：DB `spatial.waste_positions_realtime` 有 city='臺中市' 過去 24h > 100 vehicles。

**部署注意**（從 5/9-5/10 session 學到）：
- Empty git commit 不會 trigger Zeabur redeploy → push 時改檔（README）
- Zeabur PREBUILT_V2 service port 是 8080（這次不影響但記著）

---

### Task 1.2 — 5 城靜態 stops/routes seeder（2-3 天）

**5 城清單**：

| 縣市 | DB 現況 | 要做什麼 |
|---|---|---|
| 台中 | 0 stops / 0 routes | 兩個都從零接（最大工作量）|
| 台南 | 0 stops / 0 routes | 兩個都從零接 |
| 台北 | ✅ 26K stops | 確認完整、補 routes |
| 基隆 | ✅ 部分 stops | 確認完整、補 routes |
| 宜蘭 | ✅ 部分 stops | 確認完整、補 routes |

**還沒找 endpoint**（Phase 1 第一動作就要找）：
- 跑 catalog-search skill 對「台中 清運 路線」「台南 清運」「台北 垃圾」等
- 或直接看各縣市 open data portal

**suggested 實作 pattern**：

跟 collector 不同 — 是**一次性 seeder**，不需要 cron：

```python
# 建議放：data-collectors/scripts/seed_waste_stops.py
# 或：mini-taiwan-pulse/scripts/preprocess/seed-waste-stops.py
# （視 framework 慣例決定）

# 對每城：
#   1. 抓 open data CSV / JSON / GeoJSON
#   2. normalize 到 spatial.waste_collection_stops schema
#   3. INSERT INTO ... ON CONFLICT (...) DO UPDATE  # idempotent
#   4. 同樣方式處理 routes（含 LineString geometry）
```

**Schema 已存在**（不用改）：
- `spatial.waste_collection_stops`：`city, route_id, arrival_time, departure_time, weekday_pattern, geometry(Point)`
- `spatial.waste_collection_routes`：`city, route_id, vehicle_no, weekday_pattern, geometry(LineString)`

**驗收條件**：5 城 stops + routes 都進 DB、可用 SQL 查到 row count > 0。

---

### Task 1.3 — TGOS 啟動（user 端 + 並行）

**重要結論（agent 找完）**：

```
✗ 沒有可重用的歷史 TGOS 批次
  既有批次：火災（台北消防）/ 1999（台北）/ 不動產（台北 + 高雄但 geocoding 失敗）
  跟 Tier 2 4 城需求都對不上
✓ 4 城需要從零跑 TGOS
```

**4 城優先序建議**（按行政區人口）：
1. 雲林（68 萬人）
2. 新竹市（45 萬）
3. 嘉義市（27 萬）
4. 澎湖（10 萬）

**user 要做**：
- 跟 TGOS 端接洽（如有 quota 限制）
- 用 `tgos-batch-geocoding` skill（已存在）對 4 城地址清單跑批次
- 跑完把結果交給我

**我要做**（拿到結果之後，可能在 Phase 4 才做）：
- 整理進 `spatial.waste_collection_stops`（city 欄位加 4 個新 city）
- 寫對應 4 城 stops/routes seeder

---

### Task 1.4 — 新北 / 台南 OSRM 收尾（0.5 天）

**目前狀態**：

```
台南 5/9 success rate ~45%（樣本 160）
台南 5/8 success rate ~21%（樣本 155，backfill 還在累積）
高雄 5/9 success rate 30%（vs 5/8 49% — BL-14 待查）
```

**要做**：

1. **連續 3 天監控**：每天 query 一次 attempt 表 + matched_daily，看 success rate 穩定區間
2. **查 BL-14**：高雄 5/9 30% 是 daily variance 還是 trip-gap 900 副作用？
   - SQL：對比 5/8 同時段 13:00-18:00 高雄 success rate
   - 如果 5/8 那時段也 30% → daily variance（沒事）
   - 如果 5/8 那時段 45-50% → trip-gap 副作用 → 考慮 per-city dict
3. **BL-9 完整收尾**：在 BACKLOG 標 done、寫一篇 retro

**驗收條件**：BL-9 標 done、BL-14 有結論。

---

## 已知坑（從 5/9-5/10 session 累積，新 session 必看）

寫在 INCIDENTS.md，Phase 1 要避免：

| 坑 | 觸發場景 | 正確做法 |
|---|---|---|
| Zeabur empty commit 不 trigger redeploy | 改 env var 想觸發 redeploy | 改檔（README + 一行 comment）+ push |
| Cobra CLI `${}` 雷 | 設跨 service env var ref | 用 dashboard 設、不用 CLI |
| Cobra CSV 逗號值 OK | 設 `WASTE_MATCH_CITIES=A,B` | 純逗號值可走 CLI（5/10 驗證）|
| psycopg2 `%` placeholder | SQL 註解寫 `1%` `8%` | escape `%%` 或改 `pct` 字 |
| OSRM HMM 拒收同時間戳點 | DB row 重複寫 | SQL `DISTINCT ON` 或 ETL UNIQUE |
| trip-gap 600s 對台南太緊 | 5 min 採樣 + 短停 | 改 900s（已部署）|
| 跨 Zeabur project 內網不通 | gomn ↔ ship-only | 走 osrm-proxy public + Bearer |
| AWS Lightsail IP 被擋 | 收高雄/台南 GPS | 用 ship-only project IP |

---

## Phase 1 結束時要產出什麼

### Code

- `data-collectors/collectors/waste_positions.py` 加台中 fetch / normalize
- 5 城 stops/routes seeder 腳本（位置待定）
- 可能：`data-collectors/storage/supabase_tables.py` 加 waste_stops 對應 metadata

### Data

- DB 內 7 城 stops + routes 齊（除 5 城找不到 endpoint 才例外）
- DB 內台中 GPS 進來（採樣 10 min）

### Docs

- 更新 `docs/research/waste-multi-city-progress.md` 打勾
- 更新 `.claude/memory/STATUS.md` 結束 Phase 1
- 寫一篇 `.claude/retrospectives/` Phase 1 心得

### Memory

- BL-9 標 done（如果 Task 1.4 順利收尾）
- BL-14 結論寫進 INCIDENTS

---

## Q & A 預期

**Q: 為何不先做 Phase 2 OSRM 擴展？**
A: Phase 2.1（台中 OSRM）依賴 Phase 1.1（台中 GPS 進 DB），不能跳。但 Phase 1.1 一接好就立刻可以做 Phase 2.1。

**Q: 5 城找不到 endpoint 怎麼辦？**
A: 那 5 城會降到 Tier 2/3 處理。Phase 1 deliverable 改成「找到 endpoint 的部分都進 DB」。

**Q: 台中 endpoint 要是 5/10 之後掛掉怎辦？**
A: 有 CSV 替代：`https://newdatacenter.taichung.gov.tw/api/v1/no-auth/resource.download?rid=f6dda80e-7380-4223-9bda-97d82a541ad9`（同一份資料）。

**Q: TGOS 還沒回覆怎辦？**
A: Phase 1 不卡 TGOS（Task 1.3 是 user 端啟動，並行不阻塞）。Phase 4 才處理 TGOS 結果。

**Q: 我可以中途暫停做別的事嗎？**
A: 可以。每個 sub-task 都 atomic。建議完成 Task 1.1 + 1.4（資料 + 收尾）後可暫停，1.2 跨 5 城可分次。

---

## 起手第一個 5 分鐘的具體動作

```bash
# 1. 確認台中 endpoint 還活著
curl -sS -m 30 -A "Mozilla/5.0 (compatible; TaipeiGISBot/1.0)" \
  "https://newdatacenter.taichung.gov.tw/api/v1/no-auth/resource.download?rid=c923ad20-2ec6-43b9-b3ab-54527e99f7bc" \
  | python3 -c "import json,sys; d=json.load(sys.stdin); print(len(d), d[0])"

# 2. 看 collector 結構
cd /Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/data-collectors
grep -nE "_fetch_kaohsiung|_fetch_tainan|_normalize_soa|FETCHERS" collectors/waste_positions.py | head

# 3. 看 5/9-5/10 上線後 attempt 表現況
cd /Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/mini-taiwan-pulse
set -a; source .env; set +a
psql "$SUPABASE_DB_URL" -c "SELECT day, city, COUNT(*) AS attempts, SUM((success)::int) AS success FROM realtime.waste_match_attempts WHERE day >= CURRENT_DATE - 2 GROUP BY day, city ORDER BY day DESC, city;"
```

跑完前 3 個指令就有 context 開始動手了。
