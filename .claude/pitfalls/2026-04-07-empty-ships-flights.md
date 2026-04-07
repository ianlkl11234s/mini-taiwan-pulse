# 2026-04-07 — Timeline 看不到船舶/航班

## TL;DR

前端 timeline 顯示 0 ships 或船舶完全消失，調試後發現根因**不在前端**：
1. data-collectors (Zeabur) 在 4/4 ~08:00 當機，4/6 ~13:00 才恢復，期間 ~61 小時沒寫入 Supabase
2. data-collectors 的 `base.py` 有 **+8h 時區 bug**，所有 `collected_at` 偏移 8 小時

修復：data-collectors 修正後，從 S3 全量回補 30 天歷史資料。

## 症狀

| 操作 | 觀察 |
|------|------|
| 開啟 4/6 timeline 從 00:00 | Console 顯示載入 10K+ ships，但畫面 **0 ships** |
| 切到 4/5 | 同樣 0 ships |
| 切到 4/7 | timeline 在 13:33 就有資料，但**真實時間只有 10:51**（未來資料）|
| 4/6 flight | 只有 21:00-23:59 有資料 |

## 一開始的錯誤假設

幾次以為是時區 bug，改了：
- `dayStartUnix()` 計算
- Timeline 起始時間
- `isDateAvailable()` 不要阻擋
- Date 切換時的載入邏輯

都沒解決。問題其實**不在前端**。

## 真相

### 加 debug log 印出 frontend currentTime vs backend data range：

```
[Ship DEBUG] currentTime=1775404973 (2026-04-05T16:02:53.237Z)  ← Taiwan 4/6 00:02 真實
  data range: 1775480409 ~ 1775494556 (4/6 13:00 ~ 16:55 UTC)
```

frontend 在 4/6 00:02，但 data 從 4/6 21:00 才開始。差 21 小時 → 顯然有問題。

### 查 S3 archives → 發現

| 日期 | Supabase 中的記錄數 | S3 archive 大小 | 結論 |
|------|---------------------|----------------|------|
| 4/3 | 828K | 30MB | 正常 |
| 4/4 | 220K | 30MB | **Supabase 缺，S3 有** |
| 4/5 | 0 | 33MB | **Supabase 完全缺，S3 完整** |
| 4/6 | 123K | 33MB | **大部分缺**，21:00 才恢復 |

→ Zeabur collector 沒寫入 Supabase 但**有寫到 S3**（本地存檔流程獨立）

### 進一步發現：時區也是錯的

```sql
SELECT now() AT TIME ZONE 'Asia/Taipei',
       MAX(collected_at) AT TIME ZONE 'Asia/Taipei' FROM ship_positions;
-- now:  2026-04-07 10:57
-- max:  2026-04-07 18:52   ← +8h 在「未來」
```

**根因**：`data-collectors/collectors/base.py` 用 `datetime.now()` 產生 naive 台灣時間，
PostgreSQL UTC session 把它當 UTC 解讀，所有時間戳偏移 +8 小時。

詳細根因分析見 [`data-collectors/.claude/pitfalls/2026-04-07-timezone-bug.md`](../../../data-collectors/.claude/pitfalls/2026-04-07-timezone-bug.md)。

## 修復步驟

### 前端側（立即可做）

1. **`useTimeline.ts`**: 「今天」預設從**現在時間**開始（不是午夜），避免空等無資料時段
2. **`useShipData.ts` / `useAirspaceData.ts`**: 移除 `isDateAvailable()` 的硬阻擋（改成 try fetch）
3. **資料載入失敗時**清空 `ships` / `flights` state，避免顯示前一天的 stale 資料

### 後端側（治本）

1. `data-collectors/collectors/base.py`: 改用 `datetime.now(TAIPEI_TZ)` (timezone-aware)
2. Push 到 main → Zeabur 自動部署
3. SQL: `TRUNCATE` 所有 ship/flight 資料
4. 從 S3 archive 全量回補 30 天

## 教訓

### 1. **不要在前端假設後端資料是對的**
這次連續修了好幾次前端，根因卻在後端時區 bug + collector 當機。
**Debug 順序應該是**：資料層 → API 層 → 前端，而不是反過來。

### 2. **時區問題的最快定位方式**
直接比對 frontend `currentTime` (epoch) 跟 backend `collected_at` (epoch)：
```js
console.log(`now: ${currentTime}, data: ${ship.path[0][3]}, diff_h: ${(ship.path[0][3]-currentTime)/3600}`)
```
如果差 ±8 → 時區 bug。如果差小時級別 → 資料缺失。

### 3. **Console 顯示「載入了 N 筆」不代表畫面會出現**
還要看 `getVisibleCount()`（被時間過濾後的可見數量）。
這次 status bar 顯示「1470 flights · 0 ships」就是因為 flights 用 `length`、ships 用 `getVisibleCount()`，兩個邏輯不一致。

### 4. **背景服務當機要有監控**
data-collectors 在 Zeabur 上當了 61 小時都沒人發現，因為：
- 沒有 health check alert
- 沒有「最後寫入時間」監控
- 前端 fallback 機制掩蓋了問題

**TODO**: 在 gis-platform 加 cron monitor，每小時檢查 `MAX(collected_at)` 距離現在 > 30 分鐘就告警。

## 相關 commit

- mini-taiwan-pulse:
  - timeline 起始時間改用「現在」(useTimeline.ts)
  - 移除 isDateAvailable 阻擋 (useShipData.ts, useAirspaceData.ts)
- data-collectors:
  - `6e2e2d0` — `fix: 修正 Supabase 寫入 +8h 時區偏移 bug`
