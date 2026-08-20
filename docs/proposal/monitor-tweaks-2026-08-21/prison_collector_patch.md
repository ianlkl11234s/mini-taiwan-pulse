# 矯正收容資料停更 — 修復方案（待採用，尚未動手）

> 調查日期 2026-08-20。**本檔只是提案，data-collectors 一個字都沒改。**

## 結論先講

**collector 沒壞、cron 沒斷、parser 沒過時。上游自己停了。**

- `https://prisonmuseum.moj.gov.tw/jqw_pub/today.xml` → HTTP 200，內容仍是 `115/05/15`
- 歷史打包檔 `https://prisonmuseum.moj.gov.tw/jqw_pub/mjac.zip` → 最後一個檔 `20260515.xml`，
  zip entry mtime `2026-05-16 05:02`（此前每天 05:02~05:07 準時新增一檔）
- HTTP `Last-Modified` header（決定性佐證，2026-08-21 實測）：
  - `today.xml` → `Fri, 15 May 2026 21:02:18 GMT` = **2026-05-16 05:02 台北**
  - `mjac.zip`  → `Sat, 16 May 2026 01:00:07 GMT` = **2026-05-16 09:00 台北**
  兩個檔自那天起**一個 byte 都沒被重寫過**（97 天）。
- → **法務部矯正署自 2026-05-16 起停止發布這份每日資料**，三處獨立佐證。

所以「重啟 collector」「改 parser」都救不回來。能做的是三件事：
A) 把 7 年歷史一次回填（讓卡片馬上有時間軸）
B) 加「上游 observed_date 停滯」告警，恢復時第一時間知道
C) 修監控盲點（現在的 freshness gate 結構上偵測不到這種失效）

---

## A. 歷史回填（立刻可做，最高 CP 值）

上游雖然停更，但把 2019-04-18 ~ 2026-05-15 的每日檔整包留著。

- SQL 已產好：`prison_backfill.sql`（同目錄，213 KB，2,501 筆 INSERT）
- 產生器：`prison_backfill_build.py`（解析邏輯逐字複製 collector 的 `_roc_date`/`_int`/`_pct`）
- 重跑：`python3 prison_backfill_build.py mjac.zip prison_backfill.sql`

驗證過的點：
- 2,501 檔全部解析成功，0 筆失敗
- `2026-05-15` 解析結果 `(64005, 57010, 6995, 60552, 5.7, 139, 149)`
  **與 DB 現有那唯一一筆完全一致** → 解析正確
- 缺漏欄位有容錯：`20260511.xml` 少了 `<入監人數>` → `new_in_count = NULL`（全檔共 13 個 NULL）
- 用 `ON CONFLICT (observed_date) DO NOTHING`，不會覆蓋 collector 已寫的既有 row
- `collected_at` 補為該日 `05:00+08`（貼近上游實際發布時刻），與 collector 寫的 `now()` 可區分

**執行需用戶拍板**（寫入正式 DB）：
```bash
psql "$SUPABASE_DB_URL" -f prison_backfill.sql
```

---

## B. 上游停滯告警（collector 補丁）

`data-collectors/collectors/correctional_daily_snapshot.py`
現在拿到什麼就 upsert 什麼，資料停在三個月前也一聲不吭。

抄 `collectors/lightning_events.py:118 _maybe_notify_recovery` 的形狀，方向相反（偵測停滯）：

```python
# 檔頭 import 區加：
from utils.notify import send_telegram

STALE_ALERT_DAYS = 7   # observed_date 落後今天超過幾天就告警
```

```python
    def __init__(self):
        ...既有內容...
        self._stale_notified = False        # 新增：一次 process 只告警一次

    def _maybe_notify_stale(self, observed_date: date, now: datetime) -> None:
        """上游 today.xml 仍 200 但日期不前進 → 靜默斷供，發 Telegram。

        判準用 observed_date 而不是 collected_at ——
        本 collector 每天都成功寫入，collected_at 永遠是今天，
        用它偵測不到「回傳 200 但內容是三個月前」這種失效。
        """
        lag = (now.date() - observed_date).days
        if lag < STALE_ALERT_DAYS or self._stale_notified:
            return
        send_telegram(
            "🔒 *矯正收容日資料上游停滯*\n\n"
            f"`today.xml` 仍回 200，但日期停在 *{observed_date}*（落後 {lag} 天）。\n"
            "來源：prisonmuseum.moj.gov.tw/jqw_pub/today.xml\n\n"
            "若已恢復請忽略；長期停滯考慮改抓 rjsd.moj.gov.tw 月報。"
        )
        self._stale_notified = True
        print(f"[{self.name}] 🔒 上游停滯 {lag} 天（observed_date={observed_date}）")
```

`collect()` 裡 `observed_date` 解析成功、組 `record` 之前插一行：

```python
        observed_date = _roc_date(_t("日期"))
        if observed_date is None:
            return {...既有...}

        self._maybe_notify_stale(observed_date, now)      # ← 新增這行
```

副作用：無（只多一次比大小 + 條件式 Telegram）。不影響寫入路徑。

**順帶**：既然上游確定死了，`CORRECTIONAL_DAILY_SNAPSHOT_INTERVAL` 可以從 1440 拉到
7200（5 天）省請求，等 Telegram 告警恢復再調回來。這是 Zeabur env 改動，不是 code。

---

## C. 監控盲點（config 提案，涉及共用檔，請主 agent 統一接線）

`data-collectors/config/realtime_tables.yaml:128`

```yaml
- {schema: live, table: prison_population_daily, time_column: collected_at, ...}
```

`collected_at` 是**收集時刻**，collector 每天照跑照 upsert → 它永遠是今天 →
freshness gate 永遠綠燈，即使 `observed_date` 已經卡三個月。
**這張表是 PK=observed_date 的 upsert 表，用 collected_at 當 freshness 依據結構上錯的。**

建議改成：

```yaml
- {schema: live, table: prison_population_daily,    time_column: observed_date, owner_collector: correctional_daily_snapshot, expected_interval_min: 1440, critical: false, notes: 每日 1 row（2026-07-03 啟用）；⚠️ 上游 prisonmuseum 自 2026-05-16 停止發布，freshness 必須看 observed_date —— collected_at 因每日 upsert 永遠是今天，偵測不到靜默斷供}
```

（要先確認 freshness 檢查程式能吃 `date` 型欄位；若只吃 `timestamptz` 就得另外處理。
 這是共用登記檔，我沒改。）

同時 `cross_layer_map.yaml:499` 的 notes 可補一句上游斷供日期。

---

## D. 替代來源（找過了，沒有日更的）

| 來源 | URL | 粒度 | 最新 | 格式 | 可用性 |
|---|---|---|---|---|---|
| 矯正署 prisonmuseum（現用） | `https://prisonmuseum.moj.gov.tw/jqw_pub/today.xml` | 日 | **2026-05-15（死）** | XML | ❌ 停更 |
| 同上歷史打包 | `https://prisonmuseum.moj.gov.tw/jqw_pub/mjac.zip` | 日 | 2026-05-15 | ZIP of XML | ✅ 回填用 |
| data.gov.tw nid 101185 | `https://data.gov.tw/api/v2/rest/dataset/101185` | 日 | metadata 指向同一個 today.xml | — | ❌ 同一個死源 |
| **法務統計資訊網 矯正統計指標** | `https://www.rjsd.moj.gov.tw/RJSDWeb/indicator/Indicator.aspx` | **月** | **115 年 7 月底**（2026-07） | XLS / ODS / PDF | ⚠️ 唯一活著的官方源，但只有月粒度、無 JSON/CSV API |
| 法務統計 監獄受刑人人數（機關別） | `https://www.rjsd.moj.gov.tw/RJSDWeb/common/WebList3_Report.aspx?list_id=1218` | 月 | 115 年 1-7 月 | HTML 表 | ⚠️ 同上，需爬 |

⚠️ **口徑不同，不可直接續接**：rjsd 矯正統計指標（115 年 7 月底）寫的是
「在監人數 66,307」與「收容人數 62,384」，而 today.xml 的「實際收容」在 2026-05-15 是 64,005。
三個數字是三種定義（在監 = 監獄受刑人；收容 = 含看守所被告等；實際收容 = 全矯正機關當日在所）。
真要接月報 fallback，**必須先把口徑對齊再混進同一條序列**，否則趨勢圖會出現假跳階。

data.gov.tw 的 `/api/v2/rest/dataset` 搜尋端點需要 Authorization Key，
未帶 key 只能逐一查 dataset id（101185 已查，指向同一個死掉的 today.xml）。

**判斷**：沒有替代的「每日」開放資料源。要繼續日更只有兩條路——
(1) 等矯正署恢復（靠 B 的告警知道）；
(2) 接受降級成月更，新寫一個爬 rjsd 的 collector（XLS/HTML 解析，工程量遠大於現在這支）。

短期建議：**回填 + 告警 + 卡片標示資料截止日**，不要為了月更去重寫 collector。

---

## E. 補充：這個源以前也斷過，而且**自己活回來了**

回填資料的缺漏分佈（2,501 天 / 跨度 2,585 天 / 缺 84 天）：

| 年 | 缺漏天數 |
|---|---|
| 2019 | 12 |
| 2020 | 11 |
| 2021 | 1 |
| 2022 | 1 |
| 2023 | 1 |
| 2024 | 4 |
| 2025 | 1 |
| 2026 | **53** |

2026 那 53 天是**一整段連續斷供：2026-02-02 ~ 2026-03-26**，
然後 03-27 恢復、正常發了 7 週，5/16 又斷到今天。

→ **不要急著判死刑、也不要為了月更重寫 collector。**
   這個源會自己回來。B 的停滯／恢復告警是這次最該做的事：
   上次它 3/27 悄悄復活時我們也沒發現（那時 collector 還沒啟用，7/3 才上線）。
