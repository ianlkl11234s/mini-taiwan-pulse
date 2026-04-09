---
description: 對 Supabase RPC 跑 EXPLAIN ANALYZE 判斷是否需要套 pre-aggregate pattern
argument-hint: <rpc_name> [target_date=today]
---

# /check-rpc

檢查某個 Supabase RPC 的執行計畫與實際耗時，判斷是否需要套用 pre-aggregate pattern（詳見 `docs/supabase-optimization.md`）。

## 參數

- `$1` (必填): RPC 名稱，例如 `get_ship_trails`
- `$2` (選填): 測試參數（通常是日期），預設 `CURRENT_DATE`

## 執行步驟

1. **讀取 `SUPABASE_DB_URL`**（從 `.env`）
2. **找到 RPC 定義**：
   ```bash
   psql "$SUPABASE_DB_URL" -c "\sf public.$1"
   ```
3. **EXPLAIN ANALYZE**（重點看 plan 結構）：
   ```bash
   psql "$SUPABASE_DB_URL" -c "EXPLAIN (ANALYZE, BUFFERS, COSTS OFF) SELECT * FROM public.$1('${2:-CURRENT_DATE}');"
   ```
4. **測實際 RPC 響應**：
   ```bash
   time psql "$SUPABASE_DB_URL" -c "SELECT count(*) FROM public.$1('${2:-CURRENT_DATE}');"
   ```

## 判斷準則

| 現況 | 建議 |
|---|---|
| 響應 < 500ms、rows < 5k | ✅ 不需優化 |
| 響應 500ms ~ 1s、plan 穩定 | 🟡 監控即可，加進 audit 報告 |
| 響應 > 1s 或 rows > 10k | 🔴 **必須** 套 pre-aggregate pattern |
| 看到 `Sort` + 大量 rows | 🔴 可能是 plan 問題，先跑 `ANALYZE <source_table>` |
| 看到 `Parallel Append` + `Sort` global | 🔴 planner 選錯 plan，試圖 force Merge Append + index |
| 含 `string_agg` / `ST_Union` / 複雜 JOIN | 🔴 一律套 pre-aggregate |

## 套 pre-aggregate 的下一步

使用 skill `supabase-optimize` 產生 SQL 範本：
```
使用 supabase-optimize skill 為 $1 產生 pre-aggregate SQL
```

或手動參考 `docs/supabase-optimization.md` 與 `../data-collectors/docs/sql/matview_*.sql` 範本。

## 注意事項

- **Supabase pooler 強制 2min statement_timeout**，若 EXPLAIN ANALYZE 超時，代表現況已不可用，必須優化
- anon role default timeout 3s，前端實際可用時間更短
- 若 plan 有 stale stats 嫌疑，先 `ANALYZE realtime.xxx_source_YYYYMMDD;` 看是否改善
- 大 payload RPC 記得加 `SET statement_timeout TO '60s'` function 屬性
