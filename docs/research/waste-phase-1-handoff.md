# Phase 1 Handoff — Track B（mini-taiwan-pulse 端）

> 寫於 2026-05-10（重寫於同日，加入 hwms finding）
> 對象：下個 session
> 預估：1-2 週、3 個 sub-task

---

## 兩個 Track 並行

```
Track A：TGOS 流程              ← user 端 / taipei-gis-analytics
   ├─ 7 天上傳 day_001-007
   ├─ 寫 12_unified_callback.py
   └─ callback 跑完灌 DB（22 縣市 stops 從 77K → 385K）

Track B：mini-taiwan-pulse      ← 新 session 工作
   ├─ 1. 接台中 GPS collector（並行不卡 Track A）
   ├─ 2. 新北 OSRM 接 map-matching
   ├─ 3. 5/9-5/10 OSRM 收尾（BL-9 / BL-14）
```

**新 session 只做 Track B**。Track A 是 user 自己 + taipei-gis-analytics 的事，無需介入。

---

## Session 起手三步

```
1. 讀本檔
2. 讀 .claude/memory/STATUS.md（5/10 結束點）
3. 讀 docs/research/waste-multi-city-progress.md（22 縣市現況）
```

讀完就動手。

---

## Track B 主目標（一句話）

```
3-4 天內把台中 GPS 接好、新北/台南 OSRM 收尾、BL-14 查清楚
為 Phase 2（OSRM 擴展）+ Phase 3（時刻表動畫）打基礎
```

---

## Sub-task 1 — 接台中 GPS collector（0.5-1 天）

### Endpoint（5/10 16:14 實打 200 OK / 1300+ vehicles）

```
URL: https://newdatacenter.taichung.gov.tw/api/v1/no-auth/resource.download?rid=c923ad20-2ec6-43b9-b3ab-54527e99f7bc
採樣: 每 10 min
Token: 無（路徑含 /no-auth/）
License: 政府資料開放授權 v1.0
Dataset 主頁: https://opendata.taichung.gov.tw/search/62205d71-7d1c-4545-b0dc-1bf262d57c0b
```

### 測試指令（先跑這個確認 endpoint 還活著）

```bash
curl -sS -m 30 -A "Mozilla/5.0 (compatible; TaipeiGISBot/1.0)" \
  "https://newdatacenter.taichung.gov.tw/api/v1/no-auth/resource.download?rid=c923ad20-2ec6-43b9-b3ab-54527e99f7bc" \
  | python3 -c "import json,sys; d=json.load(sys.stdin); print(len(d), d[0])"
```

### Response schema 範例

```json
[{"lineid":"24908","car":"KED-1385","time":"20260510T160411",
  "location":"龍井區清潔隊回收廠","X":"120.540557","Y":"24.192597",
  "SpeedValue":"0","OverSpeed":"N"}, ...]
```

### vs SOA 標準的差異（必看，會踩坑）

```
1. 欄位名稱不同：
   - lineid（多 e、台南是 linid）
   - X/Y 大寫（台南是小寫 x/y）

2. 無 SOA wrapper：
   - 高雄/台南 response: {success: true, data: [...]}
   - 台中 response: 直接是 [...] array
   - r.json() 直接拿 list，不要 .get('data')

3. 多兩個欄位：SpeedValue / OverSpeed（可忽略或塞 metadata）

4. Time format 不同：
   - 高雄/台南：'%Y-%m-%d %H:%M:%S' 或 ISO8601
   - 台中：'%Y%m%dT%H%M%S'（緊湊式無分隔）
   - TIME_FORMATS tuple 要加這格式（放最前面）
```

### 實作步驟

`data-collectors/collectors/waste_positions.py`：

```python
# 1. ENDPOINTS 加台中
ENDPOINTS['Taichung'] = 'https://newdatacenter.taichung.gov.tw/api/v1/no-auth/resource.download?rid=c923ad20-2ec6-43b9-b3ab-54527e99f7bc'

# 2. CITY_NAMES 加台中
CITY_NAMES['Taichung'] = '臺中市'

# 3. TIME_FORMATS 加台中格式
TIME_FORMATS = ('%Y%m%dT%H%M%S', ...)  # 既有放後

# 4. 寫 _normalize_taichung（不能直接 reuse _normalize_soa）
def _normalize_taichung(self, rows, city, url, fetch_time):
    # 不檢查 success wrapper
    # 欄位 case map: lineid → linid（or 直接用 lineid）/ X→x / Y→y
    # status classify 沿用 _classify_status(location)（PARKED_KEYWORDS 已涵蓋台中）

# 5. 寫 _fetch_taichung
def _fetch_taichung(self, fetch_time):
    url = ENDPOINTS['Taichung']
    r = self._get_with_retry(url, '臺中市')
    body = r.json()  # 直接 list
    return self._normalize_taichung(body, '臺中市', url, fetch_time)

# 6. FETCHERS 加 'Taichung': '_fetch_taichung'
```

### 部署後驗證

```sql
SELECT city, COUNT(*) AS rows, COUNT(DISTINCT vehicle_no) AS vehicles, MAX(observed_at) AS latest
FROM spatial.waste_positions_realtime
WHERE city = '臺中市' AND observed_at > NOW() - INTERVAL '1 hour'
GROUP BY city;
-- 期望：> 100 vehicles，最近 < 15 分鐘
```

---

## Sub-task 2 — 新北 OSRM 接 map-matching（0.5 天）

新北 stops + GPS 都已在 DB，現在只是把它加進 `WASTE_MATCH_CITIES`。

### 步驟

```bash
# 1. CLI 加新北
npx zeabur@latest variable update --id 6940282e03ed383c19b036f5 \
  -k "WASTE_MATCH_CITIES=高雄市,臺南市,新北市" -y -i=false

# 2. 驗證 env var 真的存進去
npx zeabur@latest variable list --id 6940282e03ed383c19b036f5 -i=false 2>&1 | grep WASTE_MATCH_CITIES

# 3. 改 README trigger redeploy（empty commit 不會 trigger）
cd ~/.../data-collectors
echo "# YYYY-MM-DD: extend WASTE_MATCH_CITIES to 新北市" >> README.md
git -c commit.gpgsign=false commit -am "chore: extend OSRM map-matching to NewTaipei"
git push origin main

# 4. 等 deploy + 一輪、查 attempt 表
psql "$SUPABASE_DB_URL" -c "SELECT day, city, COUNT(*) AS attempts, SUM((success)::int) AS success, ROUND(100.0*SUM((success)::int)::numeric/COUNT(*), 1) AS pct FROM realtime.waste_match_attempts WHERE day >= CURRENT_DATE - 1 GROUP BY day, city ORDER BY day DESC, city;"
```

### 預期

新北採樣 2 min（跟高雄一樣）→ trip-gap 900s 應該 OK → success rate ~50-60%。

如果不到，看 5/9-5/10 session 的 INCIDENTS（可能要查 dup pattern / trip 結構）。

---

## Sub-task 3 — BL-9 / BL-14 收尾（0.5 天）

### BL-9：5/9-5/10 高雄 + 台南 OSRM 觀察 3 天

```sql
-- 連 3 天 query 一次（5/10 / 5/11 / 5/12 早上各跑一次）
SELECT day, city, COUNT(DISTINCT vehicle_no) AS matched_vehicles
FROM realtime.waste_trails_matched_daily
WHERE day >= CURRENT_DATE - 3
GROUP BY day, city ORDER BY day DESC, city;
```

3 天看結果穩定後 → BACKLOG BL-9 標 done、寫 `.claude/retrospectives/2026-05-10-tainan-rollout.md`。

### BL-14：高雄 5/9 落差查證

```sql
-- 對比 5/8 同時段 13:00-18:00 高雄 success rate
WITH s AS (
  SELECT day, success,
    EXTRACT(EPOCH FROM (a.created_at::time - '13:00:00'::time)) AS sec_after_1pm
  FROM realtime.waste_match_attempts a
  WHERE city='高雄市'
    AND day IN (CURRENT_DATE - 1, CURRENT_DATE - 2)
)
SELECT day,
  COUNT(*) FILTER (WHERE sec_after_1pm BETWEEN 0 AND 18000) AS attempts_1to6pm,
  SUM(success::int) FILTER (WHERE sec_after_1pm BETWEEN 0 AND 18000) AS success_1to6pm,
  ROUND(100.0 * SUM(success::int) FILTER (WHERE sec_after_1pm BETWEEN 0 AND 18000)::numeric
        / NULLIF(COUNT(*) FILTER (WHERE sec_after_1pm BETWEEN 0 AND 18000), 0), 1) AS pct
FROM s GROUP BY day ORDER BY day;
```

**判讀**：
- 5/8 13-18 = 30%、5/9 13-18 = 30% → daily variance（沒事）
- 5/8 13-18 = 50%、5/9 13-18 = 30% → trip-gap 900 副作用（要 per-city dict）

寫進 `.claude/memory/INCIDENTS.md`。

---

## 已知坑（5/9-5/10 session 累積，新 session 必看）

| 坑 | 觸發 | 正確做法 |
|---|---|---|
| Zeabur empty commit 不 trigger redeploy | 改 env var 想觸發 redeploy | 改檔（README 加一行）+ push |
| Cobra CLI `${}` 雷 | 設跨 service env var ref | 用 dashboard 設、不用 CLI |
| Cobra CSV 逗號值 OK | 設 `WASTE_MATCH_CITIES=A,B,C` | 純逗號值可走 CLI（5/10 驗證）|
| psycopg2 `%` placeholder | SQL 註解寫 `1%` `8%` | escape `%%` 或改 `pct` 字 |
| OSRM HMM 拒收同時間戳點 | DB row 重複寫 | SQL `DISTINCT ON` 或 ETL UNIQUE |
| trip-gap 600s 對台南太緊 | 5 min 採樣 + 短停 | 改 900s（已部署）|
| 跨 Zeabur project 內網不通 | gomn ↔ ship-only | 走 osrm-proxy public + Bearer |
| AWS Lightsail IP 被擋 | 收高雄/台南 GPS | 用 ship-only project IP |
| 同 city/vehicle/observed_at 重複寫入 | polling 重疊 | DB 加 UNIQUE (BL-15) 或 SQL DISTINCT ON |

---

## Phase 1 Track B 結束時要產出

### Code

- `data-collectors/collectors/waste_positions.py` 加台中 fetch / normalize
- `WASTE_MATCH_CITIES` env var 加新北
- `data-collectors/README.md` 紀錄新增

### Data

- DB 內 `spatial.waste_positions_realtime` 加 city='臺中市' GPS（採樣 10 min）
- `realtime.waste_match_attempts` 加新北 attempts

### Docs

- 更新 `.claude/memory/STATUS.md` 結束 Track B
- 寫一篇 `.claude/retrospectives/` 心得
- BL-9 / BL-14 標 done in BACKLOG

---

## 起手第一個 5 分鐘的具體動作

```bash
# 1. 確認台中 endpoint 還活著
curl -sS -m 30 -A "Mozilla/5.0 (compatible; TaipeiGISBot/1.0)" \
  "https://newdatacenter.taichung.gov.tw/api/v1/no-auth/resource.download?rid=c923ad20-2ec6-43b9-b3ab-54527e99f7bc" \
  | python3 -c "import json,sys; d=json.load(sys.stdin); print(len(d), d[0])"

# 2. 看 collector 結構
cd /Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/data-collectors
grep -nE "_fetch_kaohsiung|_fetch_tainan|_normalize_soa|FETCHERS|TIME_FORMATS" collectors/waste_positions.py | head

# 3. 看 5/9-5/10 attempt 現況
cd /Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/mini-taiwan-pulse
set -a; source .env; set +a
psql "$SUPABASE_DB_URL" -c "SELECT day, city, COUNT(*) AS attempts, SUM((success)::int) AS success FROM realtime.waste_match_attempts WHERE day >= CURRENT_DATE - 2 GROUP BY day, city ORDER BY day DESC, city;"
```

跑完前 3 個指令就有 context 開始動手。

---

## Q & A

**Q: TGOS 還沒 callback 之前，前端就動工嗎？**
A: 不必。Phase 2/3 都依賴 stops 灌進 DB。Track B 是先把台中 GPS + OSRM 部分鋪好，Phase 2 接著做不卡。

**Q: 台中 endpoint 萬一掛了？**
A: 有 CSV 替代：`https://newdatacenter.taichung.gov.tw/api/v1/no-auth/resource.download?rid=f6dda80e-7380-4223-9bda-97d82a541ad9`（同一份資料）

**Q: 新北 OSRM 加完後 success rate 不如預期？**
A: 看 INCIDENTS（5/10 台南踩過的坑都記著）。新北採樣 2 min 跟高雄一樣，預期成功率接近高雄。

**Q: 我可以中途暫停？**
A: 可以。Sub-task 1/2/3 都 atomic。台中 GPS 接好 deploy 完就可以停下。
