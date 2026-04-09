# Known Issues / Historical Bugs

## 資料斷層 + Zeabur 重啟
- Zeabur 可能無預警重啟，導致 data-collectors 斷層
- 歷史斷層案例：2026-04-04 08:00 ~ 04-06 21:00
- 前端在無資料時段會顯示 0 ships/flights（非時區 bug）
- Timeline 已改為「今天從當前時間開始」避免從午夜空等

## 歷史時區 bug（2026-04-07 已修復）
- **Bug**: `data-collectors/collectors/base.py` 用 `datetime.now()` 產生 naive 台灣時間，PostgreSQL UTC session 當 UTC 解讀，所有 `collected_at` 偏移 +8h
- **修復**: 改用 `datetime.now(TAIPEI_TZ)` (timezone-aware)
- **資料修復**: 從 S3 archive 全量回填 3/9 ~ 4/6 (29 天)，TRUNCATE 後重建
- **回填腳本**: `data-collectors/scripts/backfill_ship_flight.py`
  - ship `_fetch_time` 是台灣時間 → 加 `+08:00`
  - flight `fetch_time` 是 UTC → 加 `+00:00`

## Supabase pooler 2 分鐘 timeout
詳見 [`supabase-optimization.md`](./supabase-optimization.md#關鍵坑必讀)。

## IO / CPU 爆表事件（2026-04-09）

### 症狀
- Supabase Dashboard 橫幅：`Your project is currently exhausting multiple resources`
- Disk IO Budget 93%（Micro 只有 87 Mbps baseline + 30min/day burst）
- 所有前端 RPC timeout（`get_flight_dates` / `get_ship_dates` 等）
- `psql` 直連 → `MaxClientsInSessionMode: max clients reached`（session 5432 pool 耗盡）
- 接著整個 DB 57P03 `the database system is not accepting connections`，5 個 service 變紅

### 根因（兩層）
1. **表層**：Goal 2 一口氣加了 **8 個 `*/10` pg_cron refresh job**，全部同一秒觸發，瞬間 IO + CPU 尖峰
2. **潛伏元兇**：有 **5 個早期 `refresh_mv_*_dates` MV refresh cron 被遺忘**（命名用底線不是連字號，跟新的 `refresh-*` 分隔排列，很容易漏看）。它們 `*/30` 做 `REFRESH MATERIALIZED VIEW CONCURRENTLY` 全掃 ship/flight/youbike/freeway/disaster 大表，**這才是主要燒 IO 的來源**。Goal 2 的新 cron 只是壓垮駱駝的最後一根

### 解法（組合拳）
1. **升級 Compute Micro → Small**（Pro plan add-on，扣 $10 credit 後月費 +$5）
   - RAM 1GB → 2GB
   - IO baseline 87 Mbps → 174 Mbps
   - 必須先關 Organization → Spend cap 才能加購
2. **`cron_throttle.sql`**：refresh job 從 `*/10` 降到 `*/15` ~ `*/20`，錯開啟動分鐘（0/3/6/9/12 ...），不再同秒撞
3. **移除 5 個 `refresh_mv_*_dates` 廢棄 cron**（這個影響最大）
4. **CWA imagery SINCE_HOURS 48 → 24**（前端 `useCwaImageryLayer.ts`），降 egress + DB IO
5. **修正 `refresh_temperature_dates()` 函式名**（`cron_throttle.sql` 第一版寫錯成 `_cache` 後綴）

### 重要教訓
- **Micro instance 1GB RAM / 87 Mbps IO 撐不住 ship_positions 80 萬/天 + 多個定期聚合**，pre-aggregate pattern 本身沒問題，但要搭配**錯開 cron 分鐘 + 合適的機器規格**
- **pre-aggregate pattern 把「查詢時慢」換成「背景週期慢」**，週期太密集 + 機器太小 = 總 IO 可能更多
- **Supabase pg_cron 清單一定要 `ORDER BY jobname`**，用底線/連字號不同的 naming convention 會讓舊 job 被漏看
- **Pro plan $10 compute credit** 會自動抵 compute 費用，Small 實際只多 ~$5/月
- **Supabase Organization Usage 頁**追蹤的是「plan quota 層」（Egress/MAU/Storage），**不是「硬體層」**（CPU/IO/RAM）。Compute 警告不會出現在 Usage 頁，只在 Advisor / Reports

### 保留的資源
- `data-collectors/docs/sql/cron_throttle.sql` — 降頻 + 錯開 + 移除廢棄 MV cron
- `data-collectors/docs/sql/diagnose_resource.sql` — 9 段診斷查詢（資源爆表時檢查用）

## 診斷指令

```bash
# 查看船舶可用日期（快速確認斷層）
curl -s "$SUPABASE_URL/rest/v1/rpc/get_ship_dates" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" | python3 -m json.tool

# 查某日最早紀錄
curl -s "$SUPABASE_URL/rest/v1/ship_positions?select=collected_at&collected_at=gte.2026-04-06T00:00:00%2B08:00&order=collected_at.asc&limit=1" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"

# 查 pg_cron 運行狀態
psql "$SUPABASE_DB_URL" -c "SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;"
```

## 關聯專案

| 專案 | 路徑 | 用途 |
|---|---|---|
| gis-platform | `../gis-platform` | Supabase 時空資料庫（migrations/） |
| data-collectors | `../data-collectors` | 多源資料收集腳本 + SQL 範本 |
| pulse-api | `../pulse-api` | FastAPI+DuckDB（備援 API） |
| mini-taipei-v3 | `../mini-taipei-v3` | 鐵道 Supabase 模式參考 |
