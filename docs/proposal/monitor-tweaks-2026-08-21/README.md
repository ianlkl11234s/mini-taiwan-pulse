# Monitor 微調批次 — 2026-08-20 過夜任務交接

> 分支 `feat/monitor-tweaks-20260820`（**未 push**）
> 用戶 9 項清單全數處理完畢。
>
> **2026-08-21 第二輪：用戶拍板後三件資料面修正已執行**（見文末「執行紀錄」）。
> 本檔上半部的「待拍板」字樣為第一輪原文，實際狀態以文末紀錄為準。

## 一、已完成（可直接驗收）

| # | 項目 | 做法 | 佐證 |
|---|---|---|---|
| 1 | Monitor 預設 split | `App.tsx` 初始 state + 右上 Monitor 鈕開啟時都改 `"split"` | 1920×1080 實測開啟即 split，Split 鈕高亮 |
| 2 | 字級放大 | 新增 `MONITOR_CONTENT_ZOOM = 1.15`，套在 `gridRef` **內層**包裹層 | 邏輯 726 → 視覺 835；換行掃描 605 個文字節點，唯一真換行是警訊六宮格「民生」→ 已補 `nowrap` |
| 3a | 公衛同寬 | 固定 `repeat(3, 1fr)` → `repeat(auto-fit, minmax(200px, 1fr))`；走勢圖 62→88px | 卡片從 267px → 撐滿 413px 欄寬 |
| 4 | 機場入出境同寬 | 見下方「根因」 | 296px → 413px |
| 6 | 共機／特殊船舶字級 | 另加 `MONITOR_DENSE_CARD_ZOOM = 1.12`（疊乘 ≈ 1.29） | 這兩張是全站最小字（8~10px 字面值），其他卡是 11~12px token |
| 7 | 船舶拆分帶時間軸 | `DayAgg` 加 `byZone`，四條獨立趨勢圖（領海／鄰接區／貼線／接近，由深到淺） | 實測：領海「90 天內未出現」、鄰接區 8 天、貼線 33 天、接近 43 天 |
| 8 | 直播預設台 | 三立 `set` → `tvbs` | `set` 沒有 `fallbackVideoId`，@SETN 輪播單場直播會下播，resolver 沒解到就開天窗 |

### 3+4 的根因（不是 grid 分配問題）

`renderMonitorNode` 的「等高模式」外層是 flex **row**（為了讓 `height:auto` 的卡片靠
`align-self:stretch` 撐滿被拉平的格高）。橫向 flex 的主軸是寬度，widget cell 沒有
`flex-grow` 就退化成 **shrink-to-fit**。

1920 寬 split 實測：外層格子都是正確的 413px，但卡片只長到內容寬 ——
**在監 261 / 機場 296 / 公衛 267**，右邊各留一大塊空白。
TAIEX 之所以「看起來正常」只是它內容本來就超過 413px 被夾回去。

修法：`flex: "1 1 0%"`。dock / wall 模式同一條路徑，一併修好。

### 為什麼字級用 CSS `zoom` 而不是逐處改 `fontSize`

卡片裡約 200 處 `fontSize`，混用字面值（8 / 8.5 / 9 / 9.5 / 10.5…）與 `FONT_SIZE` token。
只放大字不動 padding／固定高，會撐爆那些量過才定的固定高格子
（`monitorSplitLayout.ts` 就記著「alertBoard h5 會讓六宮格數字溢出卡片外」）。
`zoom` 等比縮放整個座標系 —— 字、間距、圖表、卡片一起放大，相對排版零變動。

調整入口：`monitorLayout.ts` 的兩個常數，改一個數字就好。

---

## 二、資料面調查結論 + 待拍板事項

### 5. 全國在監 — **沒有在更新，而且是上游自己死了**

| 項目 | 值 |
|---|---|
| 表 | `live.prison_population_daily`，**總共 1 筆**（2026-05-15） |
| collector | 正常，每天照跑，只是一直 upsert 同一天 |
| 上游 | `prisonmuseum.moj.gov.tw/jqw_pub/today.xml` HTTP 200，但內容 `<日期>115/05/15</日期>`，**HTTP `Last-Modified` = 2026-05-16，97 天沒被重寫過一個 byte** |
| 歷史檔 | `mjac.zip` 最後一檔 `20260515.xml` |
| 替代源 | 找過了，**沒有日更的**。rjsd 矯正統計是月粒度、口徑不同（在監 66,307／收容 62,384／實際 64,005 三種定義），不可直接續接 |
| 前例 | 這個源 2026-02-02 ~ 03-26 斷過 53 天後自己活回來，不建議判死刑 |

**已做（前端）**：燈號停更轉灰、標「⚠ 上游已 N 天未更新」、接上趨勢圖
（RPC 本來就回序列，前端原本把 `rows[1..n]` 丟掉）。

**待拍板**：

| 動作 | 檔案 | 影響 |
|---|---|---|
| 回補 7 年歷史 | [`prison_backfill.sql`](./prison_backfill.sql)（2,501 天，2019-04-18 ~ 2026-05-15，`ON CONFLICT DO NOTHING`）| 跑完 365 天視窗內有 214 筆，趨勢圖立刻有東西。產生器：[`prison_backfill_build.py`](./prison_backfill_build.py) |
| migration（待取號） | [`prison_population_window_anchor.PENDING.sql`](./prison_population_window_anchor.PENDING.sql) | RPC 視窗從 `now()` 錨改成 `max(observed_date)` 錨。不改的話上游不恢復時卡片會逐日縮水、約 2027-05 整張變空 |
| collector 加靜默斷供告警 | [`prison_collector_patch.md`](./prison_collector_patch.md) B 段 | 現在 `realtime_tables.yaml` 用 `collected_at` 判 freshness，而這是 PK=`observed_date` 的 upsert 表 → **結構上偵測不到「200 但內容三個月前」** |
| `realtime_tables.yaml:128` `time_column: collected_at` → `observed_date` | data-collectors 共用登記檔 | 同上。共用檔，由人統一接線 |

### 9. 食品價格 — **停更 19 天，指數 pipeline 從來沒有排程**

| 指數 | 最新日 |
|---|---|
| VPI 菜 / FPI 魚 | 2026-08-03 |
| MPI 豬雞 / EPI 蛋 | 2026-08-02 |

- **原始價表 `live.food_price_daily` 是新鮮的**（到 2026-08-20，四來源全到齊），停的只有指數那一段。
- 指數的唯一寫入者是 `taipei-gis-analytics/pipelines/food_prices/wholesale_prices/08_supabase.py` ——
  **手動本機腳本**，讀本機 parquet。parquet mtime 全是 2026-08-03，跑過一次就沒再跑。
- 排程三處全查空：`cron.job` 60 個 job 無 food、GitHub Actions 沒有、Zeabur 沒有對應服務。
- **上游完全正常**（4 支端點 curl 實測 200、免金鑰）。
- **為什麼看起來像有資料**：RPC 視窗錨在 `max(trade_date)` 而非 `CURRENT_DATE`
  → 圖上永遠是完整 180 點，像「正常但平穩」。（與在監 RPC 是相反方向的同一個雷。）

**已做（前端）**：footer 拿掉寫死的「每日 T+1」，改成
「⚠ 資料截至 2026-08-02（已 19 天未更新）」，> 3 天轉警示色。

**待拍板**：跑 pipeline 補資料，指令與驗收 SQL 在 [`food-price-stale-recovery.md`](./food-price-stale-recovery.md)。

> ⚠️ **唯一會弄壞資料的坑**：`01_download.py --start` **必須是月初 `2026-08-01`**。
> 蔬果落檔是 `produce_{YYYYMM}_{market}.json.gz` 月檔整檔覆寫，
> 下 `--start 2026-08-04` 會用只含 08-04 之後的內容覆蓋掉 08-01~03。

長期排程三選一（A 本機 launchd／B 移進 collector／C 只補監控止血），詳見該檔 §6。

### 3b. 公衛「有哪些資料可以蒐集」— **先修三個 bug，再談新增**

完整清單（17 項分 A/B/C 級 + 30 個端點實測表）：[`public-health-proposal.md`](./public-health-proposal.md)、
原始探測 JSON：[`cdc_endpoint_probe.json`](./cdc_endpoint_probe.json)。

**三個 bug（都是新發現，優先於接新資料）**：

| Bug | 內容 | 嚴重度 |
|---|---|---|
| **A** | 前端 id 對不上：RPC 回 `influenza`/`dengue`/`enterovirus`，`intelLoaders.ts` 的 `HEALTH_DEFAULTS` key 是 `flu`/`dengue`/`entero` → L463-465 的 `if (!def) continue` 把類流感、腸病毒兩張卡**默默丟掉**。RPC 實測回 3 筆，DB 正常，純前端 bug | 中（卡不見） |
| **B** | `live.public_health_weekly` 唯一鍵含 `is_imported`，rods 列是 NULL → `ON CONFLICT DO NOTHING` 永不觸發。**174,002 列 vs 14,730 個唯一鍵**，數值被乘上「該週被收集過幾次」 | **高（畫面在說謊）** |
| **C** | 登革熱上游被 CDC 下架：`Weekly_Age_County_Gender_061.csv` → **404**，CKAN 裡 `aagstable-weekly-dengue` 整個 dataset 消失（08-13~08-20 之間），連 NIDSS 官網自己的下載連結也 404 | 高（現在唯一顯示的那張卡沒源了） |

**Bug B 的具體後果**（這是為什麼我沒有今晚就修 Bug A）：

- flu sparkline 顯示 `{47395, 38415, 26877, 13304}`，真值是 `{11869, 12816, 13463, 13304}`
  → **畫面上那條「急速下降」完全是假的，真實是持平微升**。
- YoY 是算術幻覺：`1 − 1/13 ≈ −92%`，所以 flu 和 entero 都顯示 -91%。
  用 CDC 原始 CSV 重算 2026-W32 vs 2025-W32：**類流感 +17%**、**腸病毒 +18%**。
- 最新一週的頭條數字是對的（W32 只被收過一次），錯的是 sparkline 與 YoY。

**所以修 Bug A 必須跟 Bug B 綁在一起** —— 只修 A 會讓兩張帶著假「-91% 大跌」的卡浮上檯面，
比現在只有一張卡更糟。順序建議：**B 去重 → A 改 mapping → 再談接新指標**。

修法（都在提案檔，未動手）：

1. 去重：`DISTINCT ON (…) ORDER BY …, collected_at DESC` **保留最新**（CDC 會回修數字，不可任選一筆）。174,002 → 14,730 列。**刪資料，需拍板**。
2. 擋再犯：migration 改 `UNIQUE NULLS NOT DISTINCT`（PG 17.6 已確認支援），或 collector 把 `is_imported` 正規化成 `false`。
3. upsert 策略：`DO NOTHING` → `DO UPDATE SET metric_value = EXCLUDED.metric_value`（否則修好 key 後會凍在第一次抓到的未修訂值）。⚠️ collector 有**兩份**要同步：`data-collectors/collectors/cdc_public_health_weekly.py` 與 `external/cdc_public_health_weekly_vm/…`（實際在 HiCloud VM 跑的那份）。
4. 登革熱三選一：走 NIDSS 網站查詢（每日 08:30 更新、現在已到 W33，但是 ASP.NET 表單，難度高）／去信 CDC 問新位址／停掉這張卡改掛下方候選。

**A 級新候選節錄**（完整 17 項在提案檔）：

| 資料 | 頻率 / 粒度 | 難度 | 為什麼值得看 |
|---|---|---|---|
| **熱傷害人次監測**（HPA） | **日** × 縣市 × 年齡 × 性別，2011 起 | 低 | 唯一日粒度公衛指標，可與氣溫圖層直接疊 |
| ROD 急性腹瀉急診 | 週 × 縣市 × 年齡 | 低 | 諾羅／食物中毒早期訊號 |
| ROD COVID-19 急診 | 週 | 低 | 補「呼吸道總體壓力」 |
| NHI 類流感門急診（**含總就診人次分母**） | 週 × 門診/急診 × 縣市 | 中 | 可算「就診佔比 %」= CDC 官方指標，不被總門診量帶著跑 |
| 旅遊疫情建議 | 事件驅動 × **ISO3166 國別** | 低 | 直接餵現有全球圖層 |
| 國際疫情訊息（CAP） | 近即時 | 低 | 天生的 Monitor ticker 內容 |

---

## 三、觀察到但**沒有動**的既有問題

| 現象 | 判斷 |
|---|---|
| 共機卡「空域方位」的西南／北部／東部／中部標籤折成兩行 | **既有問題**，非本次造成（zoom 是等比縮放，不會改變折行行為）。修法是把 `width: 30` 加寬，屬於動別人量過的版面，沒動 |
| 在監卡下方留白（同列的機場卡較高，等高規則拉平） | 既有行為，卡片背景只有內容高。不在本次範圍 |
| 公衛卡只有一張登革熱時偏空 | 那是資料問題（Bug A/B/C），不是版面問題 |
| `../data-collectors` 實際在 `main` 且工作區乾淨 | 與 `STATUS.md` 記載的「停在 `feat/gov-events-snapshot`」**不符**。兩個調查代理各自獨立確認。只是回報，沒有動它 |
| 工作區有未追蹤的 `dt.json` | 不是本次產生的，照平行 session 規則沒碰 |

---

## 四、驗證方式

- `npx tsc -b` 綠、`npm test` **650 passed / 50 files**
- agent-browser 1920×1080 三種模式（split / dock / wall）實測：
  欄寬全數填滿、`document.scrollWidth` 無水平溢出
- 換行回歸掃描：對 605 個文字節點比對 zoom 1.0 vs 1.15 的 boundingRect 高度，
  只有 1 處真換行（已修），其餘都是 ±1px 捨入
- ChartHoverTooltip 在單層 zoom（1.15）與**巢狀 zoom**（1.15×1.12）下各驗一次，
  定位皆正確（body portal + `clientX/Y`，不受 zoom 影響）


---

## 五、執行紀錄（2026-08-21 第二輪，用戶拍板後）

### ✅ 公衛去重（已 apply 正式庫）

| 步驟 | 結果 |
|---|---|
| 備份 | `live.public_health_weekly_backup_20260821`（174,002 列）— 確認無誤後可 DROP |
| 去重 + 換約束 | 單一交易，`DELETE 159272` → 剩 **14,730** 列；約束改 `UNIQUE NULLS NOT DISTINCT` |
| 交易內驗證 | 列數 = 14,730 ✓、flu W29 = 11,869 ✓、W32 = 13,304 ✓、零重複 ✓ |
| migration | `gis-platform/migrations/367_public_health_weekly_nulls_not_distinct.sql`（分支 `fix/public-health-nulls-not-distinct`，未 push）|
| collector | `data-collectors` 兩份改 `DO UPDATE`（分支 `fix/cdc-health-upsert-do-update`，未 push），pytest 184 passed |
| 前端 | `HEALTH_ID_ALIAS` 對照，三張卡回來 |

**畫面實測**：類流感 1.3萬 **↑+17%**（原本顯示 -91%）／登革熱 1 ↓-88%／腸病毒 329 **↑+18%**。

> ⚠️ **需要你手動做的一件事**：實際跑的是 HiCloud VM 上那份 collector，
> commit 不會自動生效，**要重新部署 VM** 才吃得到 DO UPDATE。
> 在那之前是安全的 —— 約束已修好、重複進不來，只是吃不到 CDC 的回修值。

### ✅ 在監歷史回補（已 apply 正式庫）

`INSERT 0 2500` → 總計 **2,501 筆**（2019-04-18 ~ 2026-05-15）。
`ON CONFLICT DO NOTHING` 生效，collector 原本那筆 2026-05-15 未被覆蓋（64,005 / 57,010 / 6,995 原值不變）。
**`get_prison_population_window(365)` 回正好 214 筆** —— 即用戶要的範圍。

順帶修：`TimeseriesSparkline` 的 X 軸步距階梯原本停在 7 天（設計時最長約 32 天），
1Y 視窗的 268 天跨度會生出 38 個標籤疊成字牆 → 延長為 14/30/60 天步距，≤70 天維持原行為。

**仍待拍板**：migration（RPC 視窗改錨 `max(observed_date)`，**檔名不帶編號，apply 當天才取號**）。
不套也能用（RPC 錨 now() 仍回 214 筆，前端已自行錨在序列末日），
但上游持續不恢復的話卡片會逐日縮水、約 2027-05 整張變空。

### ✅ 食品價格（已補資料 + 已上排程）

- 補跑 pipeline（`--start 2026-08-01`）：VPI/FPI 到 **2026-08-21**、MPI/EPI 到 **2026-08-20**
- 8/3 的 VPI 覆蓋率 0.41 → 0.72（脫離 low_coverage）；
  FPI 8/3 仍是 0.0042 —— 該日漁市本來就幾乎沒交易，燈號誠實標為 `low_coverage`，非 bug
- 前端警示自動解除：「⚠ 資料截至 2026-08-02（已 19 天未更新）」→「資料截至 2026-08-21」
- **方案 A 已上線**：launchd `com.gis.foodprice_index` 每天 06:00 跑
  `taipei-gis-analytics/pipelines/food_prices/wholesale_prices/run_daily.sh`
  （分支 `feat/foodprice-daily-schedule`，未 push；plist 已 `launchctl load`）
  - `--start` 用 `date +%Y-%m-01` 每天算，並加防呆拒收非月初（實測會擋）
  - 已知代價：Mac 睡眠／關機不跑，醒來補跑一次
- **方案 B 已記進 backlog**：`.claude/memory/BACKLOG.md` 的 **FP-1**（搬進 data-collectors，
  卡在燈號 baseline 需要 1095 日歷史）與 **FP-2**（停更告警缺口）

### 四個 repo 的分支狀態（全部**未 push**）

| repo | 分支 |
|---|---|
| mini-taiwan-pulse | `feat/monitor-tweaks-20260820` |
| gis-platform | `fix/public-health-nulls-not-distinct` |
| data-collectors | `fix/cdc-health-upsert-do-update` |
| taipei-gis-analytics | `feat/foodprice-daily-schedule` |
