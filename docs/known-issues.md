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
