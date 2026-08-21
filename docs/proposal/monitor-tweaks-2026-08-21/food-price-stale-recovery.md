# 食品價格板停更 — 調查結論與恢復手冊（2026-08-20 調查，唯讀）

## TL;DR

**collector 沒壞、上游沒壞、RPC 沒壞。壞的是 taipei-gis-analytics 的本機指數 pipeline —— 它從來就沒有排程，2026-08-03 手動跑過一次之後沒人再跑。**

| 環節 | 狀態 | 證據 |
|---|---|---|
| 農業部 4 支上游 API | ✅ 活著 | curl 全 200，最新資料到 2026-08-19/20（見下） |
| data-collectors `food_prices` collector | ✅ 每日在跑 | `live.food_price_daily` max(trade_date)=2026-08-20、max(collected_at)=2026-08-20 |
| **taipei-gis-analytics 指數 pipeline** | ❌ **17 天沒跑** | 本機 parquet mtime 全是 `2026-08-03 12:38`；`08_supabase.py` 是 5ed29c0（2026-08-03）新增的手動腳本 |
| `analytics.food_price_index_daily` | ❌ 凍在 08-02/08-03 | 見下表 |
| public RPC 336 | ✅ 正常，但**會掩蓋停更** | 視窗錨在 `max(trade_date)` 不是 `CURRENT_DATE` |

## 1. 資料現況（psql 實查）

```
-- analytics.food_price_index_daily
indicator | n    | first      | last       | days_stale
EPI       | 5755 | 2010-10-07 | 2026-08-02 | 18
FPI       | 1252 | 2023-01-01 | 2026-08-03 | 17
MPI       | 5680 | 2010-10-07 | 2026-08-02 | 18
VPI       | 1307 | 2023-01-01 | 2026-08-03 | 17
```

08-03 那兩筆是 **半天資料**（VPI coverage=0.4117、FPI coverage=0.0042，light 都是 `low_coverage`）
→ pipeline 最後一次執行是 2026-08-03 當天中午，抓到當日未齊的資料就停在那。

RPC 目前回給前端的東西（= 畫面上看到的）：
```
indicator | latest_date | latest_val | latest_light | latest_dev | yoy_pct | span_from  | span_to    | n_days
EPI       | 2026-08-02  | 110.21     | green        |   4.96     |  13.2   | 2026-02-04 | 2026-08-02 | 179
FPI       | 2026-07-31  | 116.84     | green        |  -0.58     |  -0.6   | 2026-02-04 | 2026-08-03 | 137
MPI       | 2026-08-02  | 100.08     | green        |  -0.57     |  -2.9   | 2026-02-04 | 2026-08-02 | 177
VPI       | 2026-08-02  | 118.62     | amber        | -26.09     | -15.7   | 2026-02-04 | 2026-08-03 | 180
```
對照 `live.food_price_daily`（原始價，collector 每日增量，完全新鮮）：
```
source  | category  | n     | last_trade | last_collect
moa:026 | hog       |   815 | 2026-08-20 | 2026-08-20
moa:037 | fruit     | 12515 | 2026-08-20 | 2026-08-20
moa:037 | vegetable | 32524 | 2026-08-20 | 2026-08-20
moa:039 | aquatic   | 13067 | 2026-08-20 | 2026-08-20
moa:056 | chicken   |    69 | 2026-08-19 | 2026-08-20
moa:056 | egg       |    46 | 2026-08-19 | 2026-08-20
moa:058 | duck/goose/egg | 69 | 2026-08-19 | 2026-08-20
```
（`live.food_price_daily` 只有 2026-07-27 起共 59,105 列 —— 364 萬筆歷史回補**從未灌進 Supabase**，
`08_supabase.py --raw` 預設不做，這是設計如此不是 bug。）

## 2. 為什麼「畫面看起來有資料」—— RPC 沒有 forward fill，但視窗錨在 max()

`gis-platform/migrations/336_food_price_rpc.sql`：

```sql
WHERE d.trade_date >= (SELECT max(x.trade_date) FROM analytics.food_price_index_daily x)
                      - make_interval(days => GREATEST(p_days, 1))
```

**沒有把舊值當新值（無 forward fill），但視窗跟著資料的 max 一起凍住。**
結果是圖上永遠有完整 180 點（VPI n_days=180）、span 2026-02-04→2026-08-03，
看起來就像「資料正常，只是最近平穩」。前端目前只在 hover tooltip（`FoodPriceBoard.tsx` L179-184 的 `title`）
才看得到 `latestDate` → 使用者不 hover 就完全看不出停更。這是這次沒人發現的直接原因。

## 3. 停更根因

`analytics.food_price_index_daily` **沒有任何自動化寫入者**：

- pg_cron：`SELECT jobid, jobname FROM cron.job WHERE command ILIKE '%food%'` → **0 rows**（全庫 60 個 job 無一相關）
- taipei-gis-analytics 只有 `.github/workflows/sync-catalog-to-supabase.yml`，與 food 無關
- data-collectors 的 `food_prices` collector 明文只寫 raw：
  `collectors/food_prices.py` docstring —「歷史回補與指數建構在 taipei-gis-analytics/pipelines/food_prices/wholesale_prices/，本 collector 只負責每日增量。」
- `08_supabase.py` docstring 的用法就是**手動指令**，讀本機 `data/processed/food_prices/*/*.parquet`

→ 指數是「分析師在本機跑完 → 手動灌一次」的一次性動作，08-03 之後沒人再跑。

**監控缺口**：`data-collectors/config/realtime_tables.yaml:115` 只登記了 `live.food_price_daily`
（`time_column: collected_at`，那張表是新的所以永遠綠燈）。
`analytics.food_price_index_daily` **沒有任何 timestamptz 欄**（只有 `trade_date DATE`），
套不進 `metadata.check_collector_freshness(30)` 那套機制 → 沒人盯，停 17 天無告警。

## 4. 上游端點實測（2026-08-20，全部免金鑰、curl -k）

| 來源 | URL | 結果 |
|---|---|---|
| 蔬果 moa:037 | `GET https://data.moa.gov.tw/api/v1/AgriProductsTransType/?Start_time=115.08.18&End_time=115.08.19&MarketName=台北一&TcType=N04` | **HTTP 200**, 445 rows, 日期 115.08.18/115.08.19 ✅ |
| 漁產 moa:039 | `GET https://data.moa.gov.tw/Service/OpenData/FromM/AquaticTransData.aspx?IsTransData=1&UnitId=039&StartDate=1150818&EndDate=1150819` | **HTTP 200**, 2,104 rows, 交易日期 1150819 ✅ |
| 毛豬 moa:026 | `GET https://data.moa.gov.tw/Service/OpenData/FromM/AnimalTransData.aspx?IsTransData=1&UnitId=026&$skip=0` | **HTTP 200**, 9,999 rows, 首筆交易日期 **1150820**（今天）✅ |
| 家禽 moa:056 | `GET https://data.moa.gov.tw/Service/OpenData/FromM/PoultryTransBoiledChickenData.aspx?IsTransData=1&UnitId=056` | **HTTP 200**, 5,776 rows（全歷史檔）✅ |

**上游沒有改版、沒有需要金鑰、沒有擋。**

## 5. 恢復步驟（照抄即可，約 10-20 分鐘）

環境已備妥：`taipei-gis-analytics/venv`（pandas 3.0.3 + psycopg2 可用）、
`gis-platform/.env` 內有 `DATABASE_URL`（08_supabase.py 自己去讀，不用自己填）。

```bash
cd /Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/taipei-gis-analytics
P=pipelines/food_prices/wholesale_prices

# ⚠️ --start 必須是「月初」2026-08-01，理由見下方【月界陷阱】
./venv/bin/python3 $P/01_download.py  --source all --start 2026-08-01
./venv/bin/python3 $P/02_normalize.py --source all
./venv/bin/python3 $P/06_build_index.py
./venv/bin/python3 $P/08_supabase.py --dry-run     # 先看筆數
./venv/bin/python3 $P/08_supabase.py               # 正式灌（ON CONFLICT DO UPDATE）
```

### ⚠️ 月界陷阱（會弄丟資料，這行是 load-bearing）

`01_download.py` 蔬果的落檔是 **月 × 市場整檔覆寫**：
`write_gz(rows, out_dir / f"produce_{lo:%Y%m}_{market}.json.gz")`，
而 `month_ranges()` 用 `max(cur, start)` 當 `lo`。
→ 若下 `--start 2026-08-04`，檔名仍是 `produce_202608_*.json.gz`，
   但內容只剩 08-04 之後，**08-01~08-03 的蔬果原始資料會被靜默覆蓋掉**。
→ 一定要用月初 `--start 2026-08-01`。

### 漁產重疊不用管
`02_normalize.py:94` 是 `sorted(d.glob("*.json.gz"))` 全讀，
`:251` 做 `drop_duplicates(subset=["date","category","item_name","market_name"])`（keep=first）。
新的 `aquatic_20260801.json.gz`（完整窗）排在舊的殘缺 `aquatic_20260803.json.gz` 之前 → 新的勝出。
不需要手動刪舊檔。

### 灌入是全量 upsert，不是只補新的
`08_supabase.py` 的 `load_index()` 讀整份 parquet、`INDEX_SQL` 是
`ON CONFLICT (trade_date, indicator) DO UPDATE` → **08-03 那兩筆 low_coverage 半天資料會自動被修正**。

### 驗收 SQL（跑完貼這個）
```sql
SELECT indicator, count(*) n, max(trade_date) last,
       (CURRENT_DATE - max(trade_date)) days_stale
FROM analytics.food_price_index_daily GROUP BY 1 ORDER BY 1;
-- 期望：四個 indicator 的 last 都到 2026-08-19 或 08-20，days_stale <= 1

SELECT trade_date, indicator, coverage, light
FROM analytics.food_price_index_daily
WHERE trade_date BETWEEN '2026-08-01' AND '2026-08-05' ORDER BY 1,2;
-- 期望：08-03 的 VPI/FPI coverage 回到 0.9 以上、light 不再是 low_coverage

SELECT indicator, latest_date, latest_val, latest_light FROM public.get_food_price_summary(180);
-- 期望：latest_date 都到 08-18~08-20
```

## 6. 長期方案（需用戶拍板，本次不動手）

三選一，成本由低到高：

**A. 本機排程（最小改動）** — macOS launchd 或 crontab，每天 06:00 跑上面 4 步。
   缺點：機器沒開就不跑；跟現有 Zeabur/pg_cron 生態不一致。

**B. 移進 data-collectors（跟其他 collector 一致）** — 新增一支 `food_price_index` collector。
   ⚠️ 難點：燈號 baseline 是 **rolling 1095 日 median**，需要 3 年歷史，
   但 `live.food_price_daily` 只有 24 天（回補未灌入）。
   要先跑 `08_supabase.py --raw` 把 364 萬筆歷史原始價灌進 Supabase（migration 334 註解已提醒要配 retention/partition），
   或改成 collector 讀本機 parquet（等於沒解耦）。

**C. 只補監控（最便宜的止血）** — 讓下次停更 2 天內就被發現。
   `analytics.food_price_index_daily` 沒有 timestamptz 欄，兩種做法：
   - 加一欄 `loaded_at TIMESTAMPTZ DEFAULT now()`（要新 migration），再登記進 `realtime_tables.yaml`
   - 或寫一支只看 `max(trade_date)` 的 freshness check，門檻放寬到 **3~4 天**（T+1 + 週末 + 連假休市）
   ⚠️ `data-collectors/config/realtime_tables.yaml` 是共用登記檔，依全域規則不由 agent 代改。

建議先做 **A 或 C 止血**，B 另開票。

## 7. 前端誠實提示（主 agent 負責改，本 agent 未動任何檔）

檔案：`src/components/intel/monitor/FoodPriceBoard.tsx`

| 位置 | 現況 | 建議 |
|---|---|---|
| **L90-94** footer 文案 | 寫死「農業部批發拍賣成交價 · 每日 T+1 · …近 180 天」 | 加「資料截至 {maxLatestDate}」常駐顯示；`CURRENT_DATE - latestDate > 3~7 天` 時整段轉警示色並標「⚠️ 已 N 天未更新」 |
| **L179-184** `title` tooltip | `latestDate` 只在 hover 才出現 | 不算誠實標註，日期要上到常駐 UI |
| L26 `const WINDOW = 180` 註解 | — | 可註記「RPC 視窗錨在資料 max()，資料停更時圖仍是滿的 180 點，必須靠 latestDate 判斷新鮮度」 |

資料端**不需要任何改動**：`FoodPriceSummary.latestDate` / `spanTo` 已由
`src/data/intelLoaders.ts`（interface L673-689、mapping L753-771）帶到前端，純前端即可算 staleness。

計算方式建議（四個指數取最新的那個）：
```ts
const latestDate = summary.reduce((a, s) => (s.latestDate > a ? s.latestDate : a), "");
const staleDays = Math.floor((Date.now() - new Date(latestDate + "T00:00:00+08:00").getTime()) / 86400000);
```
門檻建議 **> 3 天** 才算異常（T+1 + 週末休市 + 連假）；現況 18 天必觸發。

## 8. 順帶發現（各一行，不影響本次結論）

- `analytics.food_price_index_daily` 的 **MPI 每天 `n_items = 0` 但 `coverage = 1.0000`** —— pipeline 計數 quirk（毛豬/家禽寬表沒被算進品項數），index_val 有正常變動，另開票查。
- `../data-collectors` 工作區實際在 **`main`** 分支（任務描述說的是 `feat/gov-events-snapshot`），本次全程唯讀未動。
- `live.food_price_daily` 只有 2026-07-27 起 24 天資料，若之後要在 DB 端做品項下鑽（「青蔥近一年走勢」），得先補歷史原始價。
