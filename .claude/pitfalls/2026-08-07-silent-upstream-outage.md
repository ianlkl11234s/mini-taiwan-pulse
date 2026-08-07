# 上游靜默斷供：程序每次都「成功」，產出永遠是空的（2026-08-07）

## 症狀

一天之內查出**三個獨立資料源同時是這個病**，症狀都是「前端某圖層空了」，但沒有任何錯誤訊息：

| 資料源 | 斷多久才被發現 | 表面症狀 |
|---|---|---|
| 共機航跡向量化 | 5 天 | 圖層預設「單日」空白 |
| 台電落雷 | **28 天** | 圖層永遠沒點 |
| 警政署 A1 事故 | **6 週** | 表停在 06-28 |

三個的 collector 都在跑、HTTP 都回 200、都沒有 exception、沒有告警。

## 為什麼監控看不出來

### 1. heartbeat 只在「有資料寫入」時更新

`metadata.collector_status` 的 `last_success_at` 是在 `supabase_writer.write()` 裡呼叫
`_report_heartbeat()` 更新的，而 `write()` 開頭就是：

```python
records = self._transform(collector_name, result, timestamp)
if not records:
    return          # ← 沒資料就直接 return，heartbeat 根本不會跑
```

所以上游回空檔時，`last_success_at` 會**停在最後一次有資料的時刻**，看起來像 collector 掛了。
台電落雷的 `last_success_at` 停在 07-09，實際上它每分鐘都在正常執行。

### 2. `last_error` 會給你**誤導性的舊錯誤**

同一張表的 `last_error` 欄位停留在很久以前的一次失敗。台電落雷顯示
`borrow timeout 5.0s — 所有連線都 busy`，看起來像連線池問題，害人往完全錯的方向查。
真正的原因是上游回空檔，跟連線池毫無關係。

### 3. 「0 筆」對很多資料源是**合法結果**

這是最難的一點：

- 落雷：沒有雷雨時本來就是 0 筆
- 共機航跡：「共機 0 架次」那天本來就沒有形狀
- 地震：沒地震就沒資料

所以不能用「這輪有沒有資料」判斷健康。而 `realtime_tables.yaml` 的新鮮度監控是看
`max(time_column)`，對這類表會**把「沒事發生」誤判成「壞了」**，久了就變成沒人理的噪音。

## 三種判準（按可靠度排序）

### A. Ledger 表（最可靠，共機用這個）

為 pipeline 開一張執行帳本，**每個處理過的單位必有一列**，不論產出幾筆：

```sql
CREATE TABLE spatial.pla_tracks_runs (
    report_date DATE PRIMARY KEY,
    extracted   INTEGER NOT NULL DEFAULT 0,   -- 0 是合法值
    ok          BOOLEAN NOT NULL,
    error       TEXT,                          -- 非 NULL → 下次重試
    run_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

`max(run_at)` 才是這條 pipeline 真正的心跳，且它同時是**補跑判定依據**（撈「有原料但
ledger 沒有成功列」的日子）與**品質儀表**。監控要指向 ledger，不是產出表。

對應地，產出表要加進測試的 `_REALTIME_TABLES_EXEMPT` 並寫明「由 ledger 代監控」。

### B. 交叉驗證第二資料源（落雷用這個）

同一個現象兩個獨立來源，一邊有一邊沒有 = 立刻現形。落雷加了氣象署
`O-A0039-001` 當第二源（寫同一張表，`source` 欄位區分）。

代價是兩源欄位不對等（氣象署沒有電流強度、只到分鐘級），**不是等價替代**，
但拿來當「對方是不是還活著」的對照組非常有效。

### C. 用第三方訊號反證（診斷當下用這個）

要證明「台電是壞的、不是沒閃電」，最快的方法是找**不相干的資料佐證同一個物理事實**：

```sql
-- 同期有沒有雷雨警特報？
SELECT to_char(sent AT TIME ZONE 'Asia/Taipei','MM-DD'), count(*)
FROM live.disaster_alerts WHERE event ILIKE '%雷%' GROUP BY 1;
-- 同期時雨量？
SELECT max(precipitation_1hr) FROM live.rain_gauge_readings WHERE observed_at >= …;
```

當天有 9 則雷雨特報、最大時雨量 83mm、264 站破 20mm，而台電檔案是空的 → 定罪。

## S3 archive 的檔案大小是免費的時間軸

這次最有力的證據來自 `aws s3 ls` 的 Size 欄位：

```
lightning_events/archives/2026-06-25.tar.gz  34,492,599   ← 大雷雨
lightning_events/archives/2026-06-26.tar.gz  53,280,481   ← 大雷雨
…
lightning_events/archives/2026-07-09.tar.gz      58,291
lightning_events/archives/2026-07-10.tar.gz      52,054   ← 從這天起
lightning_events/archives/2026-07-11.tar.gz      52,013
…（一路到 08-05 全部 52,0xx）
```

52KB 正是「1440 個空 JSON 壓縮後」的大小。**大小完全一致的連續區間 = 內容一模一樣 =
上游停止供資料的精確起點**。不必下載任何一個檔案就能定出 2026-07-10。

這招對任何有 archive 的 collector 都通用，比翻 log 快得多。

## 診斷 SOP

```bash
# 1. collector 到底在不在跑？（不要看 collector_status，它會騙你）
zeabur service exec --id <svc> -- sh -c "ls -la /data/<collector>/$(date +%Y/%m/%d)/ | tail -5"

# 2. 上游現在回什麼？（⚠ 有些端點會 302，一定要 -L）
curl -sL -o /tmp/x -w "%{http_code} | %{size_download} bytes\n" "<endpoint>"

# 3. 斷點在哪？看 archive 大小的轉折
aws s3 ls s3://<bucket>/<collector>/archives/ | tail -40

# 4. 反證：同期第三方訊號說有沒有事件發生
psql "$SUPABASE_DB_URL" -c "…"
```

## 相關

- 共機 ledger：`gis-platform/migrations/337_pla_tracks_runs.sql`
- 落雷雙源：`gis-platform/migrations/338_lightning_dual_source.sql`、
  `data-collectors/collectors/lightning_cwa.py`
- 恢復告警：`data-collectors/collectors/lightning_events.py` 的 `_maybe_notify_recovery`
  （判準是「DB 上一筆距今 > 3 天」，不是「這輪有資料」——後者每場雷雨都會誤報）
