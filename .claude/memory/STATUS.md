# Status

**最後更新**：2026-08-22（Monitor 微調 9 項 → 拍板執行三件資料面修正 → 回頭修兩個 bug；7 PR merged）

> 本檔只保留當前 release truth、blockers 與下一棒。歷史工作留在 git、
> `docs/features/`、`BACKLOG.md` 與 `REFLECTIONS.md`。

## Scope ledger

| repo / system | current truth |
|---|---|
| **mini-taiwan-pulse** | `master` **0/0**、乾淨。merge PR **#153**（Monitor 微調 9 項）／**#154**（migration 編號撞號）／**#155**（attribution regression）。⚠️ commit range 內夾雜平行 session 的 `1980b73` / `f1b7cdc`（religion） |
| **gis-platform** | `main` **落後 2 / 領先 1**、乾淨。PR **#59** merged：migration **367**（公衛去重）。領先的 1 個是平行 session 未推的 `368_religion_pii_revoke` → **無法 ff pull，未代為處理** |
| **data-collectors** | `main` **0/0**、乾淨。PR **#53**（公衛 DO UPDATE）／**#54**（CAP bytes 解析）merged。⚠️ 前一版 STATUS 寫的「主樹停在 `feat/gov-events-snapshot`」**已不成立**，本輪三方獨立確認在 `main` |
| **taipei-gis-analytics** | `master` **落後 2 / 領先 3**、**4 個髒檔**。PR **#53**（食品指數排程）merged。領先的 3 個是平行 session 未推的 religion commit；髒檔 = 2 個平行 session modified ＋ 2 個我 `git checkout origin/master --` 還原的 staged 檔（launchd 指向的 `run_daily.sh`）。**該 repo 不做任何 commit** |
| **正式 DB（Supabase）** | 4 項實際變更，全部第一手 query 複驗（見下表） |
| **Production（Zeabur）** | data-collectors **已自動部署並實測驗證**；frontend 正式站 HTTP 200，但**未做 browser 驗收** |
| **本機 launchd** | `com.gis.foodprice_index` 已 `launchctl load`，每天 06:00 |

### 正式 DB 變更

| 動作 | 結果 | 備份 |
|---|---|---|
| `live.public_health_weekly` 去重 + 換 `UNIQUE NULLS NOT DISTINCT` | DELETE 159,272 → **14,730** 列 | `live.public_health_weekly_backup_20260821`（174,002） |
| `live.prison_population_daily` 回補 | INSERT 2,500 → **2,501** 列（2019-04-18~2026-05-15） | 無（純新增、`DO NOTHING`，原有列未被覆蓋） |
| `analytics.food_price_index_daily` 補資料 | **14,061** 列，補到 2026-08-21 | 無（upsert） |
| `live.disaster_alerts` 亂碼修復 | UPDATE 95 列，全表西里爾/拉丁擴充/希臘字元 **0** | `live.disaster_alerts_mojibake_backup_20260822`（95） |

> 兩張備份表刻意留著，**待使用者確認後才 DROP**。

## Release truth matrix

| release unit | build | contract/wire | stage | upload | readback | pull | deploy | HTTP | browser |
|---|---|---|---|---|---|---|---|---|---|
| Monitor 微調（#153） | done：`tsc -b`＋650 測試 | done：兩個 zoom 常數＋`flex:1 1 0%` | N/A | N/A | N/A | N/A | **done**：正式站 chunk 含 `influenza`（本輪才有的字串） | done：200 / 0.89s | done（**local 3721**，1920×1080 三模式）；**正式站 not run** |
| 公衛去重（mig 367 + collectors #53 + 前端） | done：pytest 184 | done：約束＋collector＋id 對照 | N/A | N/A | **done**：交易內斷言 14,730／W29=11,869／W32=13,304／零重複 | N/A | **blocked**：HiCloud VM collector 未重新部署 | N/A | done（local）：三卡 +17%／−88%／+18% |
| 在監回補 | N/A | done：RPC 本來就回序列，前端原本丟掉 `rows[1..n]` | N/A | N/A | **done**：2,501 列、RPC 回 214 筆 | N/A | N/A | N/A | done（local）：趨勢 214 點＋53 天缺口斷線 |
| 食品價格 pipeline＋排程（analytics #53） | done：4 步實跑 | done：`--start` 月初防呆實測會擋 | N/A | **done**：14,056 列 upsert | **done**：入庫確認四指數日期 | N/A | done：`launchctl list` 可見 | N/A | done（local）：停更警示自動解除 |
| attribution regression（#155） | done：`tsc -b`＋650 測試 | done：`...(x ? {k:x} : {})` | N/A | N/A | N/A | N/A | **unknown**：minified chunk 無法區分是否含此 PR | done：200 | done（**local 6002**）：source 103→264、孤兒層 0 |
| NCDR 亂碼（collectors #54 + 95 列修復） | done：pytest 184 | done：`r.content` + `ET.fromstring(bytes)` | N/A | N/A | **done**：全表亂碼 0 | N/A | **done**：Zeabur 自動部署，18:42 收集 121 筆／亂碼 0 | N/A | N/A |

⚠️ **本輪所有 browser 證據都是 local dev（3721 / 6002），正式站 frontend 一次都沒驗過。**
不得把 local 證據寫成 production frontend 已驗收。

## Current deliverables

### Monitor 微調 9 項（PR #153）

1 split 預設／2 字級 `MONITOR_CONTENT_ZOOM=1.15`／3+4 並排卡同寬／5 在監時間軸＋停更標註／
6 共機船舶 `MONITOR_DENSE_CARD_ZOOM=1.12`／7 船舶拆四條分帶時間軸／8 直播改 TVBS／9 食品價格誠實標註。

- **3+4 的根因不是 grid**：等高模式外層是 flex **row**，widget cell 沒有 `flex-grow`
  就退化成 shrink-to-fit。實測欄寬都是正確的 413px，卡片卻只有 261/296/267。
- **字級用 CSS `zoom` 不逐處改 `fontSize`**：卡片裡約 200 處 fontSize 混用字面值與 token，
  只放大字會撐爆量過才定的固定高格子。調整入口是 `monitorLayout.ts` 兩個常數。

### 三件資料面修正（用戶 2026-08-21 拍板）

公衛去重／在監回補／食品價格補資料＋排程。根因、修法與驗收數字見
`docs/proposal/monitor-tweaks-2026-08-21/README.md` 第五節。

### 兩個回頭撿到的 bug

`attribution: undefined` → 161 個 source 建不出來（regression，隔夜）；
NCDR CAP 中文亂碼（從 2022 年零星寫壞）。細節見 `INCIDENTS.md` 同日條目。

## Verification

- **主樹（真環境）**：`npx tsc -b` 通過；Vitest **50 檔 650 passed**。
- data-collectors：`pytest tests/` **184 passed**（第二次補跑確認 —— 第一次的
  `venv/bin/python3` 路徑不存在，`||` fallback 把結果吃掉了）。
- DB 數字全部第一手 query 驗證，未採信 commit message 或子代理回報。
- 版面與圖層數字全部瀏覽器實測（`getBoundingClientRect` / `getStyle().sources`），未用推論。

## Current blockers

1. **PH-1（P1）**：HiCloud VM 的公衛 collector 未重新部署 → 吃不到 `DO UPDATE`。
   期間是安全的（約束已修好、重複進不來），只是吃不到 CDC 的回修值。
2. **PH-2（P1）**：登革熱上游被 CDC 整個下架（404），該卡目前沒有活的來源，需三選一決策。
3. **PR-1（P2）**：migration **369** 已寫好但未 apply，待拍板。
4. 兩個 repo 的本地預設分支有平行 session 未推 commit，無法 ff pull —— **不代為處理**。
5. 既有 blockers（CAT-1、G016、BR-2/BR-3、DS-01/02）狀態不變，見 `BACKLOG.md`。

## Next-session entry

1. **repo/branch**：mini-taiwan-pulse `master`（0/0、乾淨）。
2. **第一個可執行步驟**：重新部署 HiCloud VM 的 `cdc_public_health_weekly`（BACKLOG `PH-1`）。
3. **驗收條件**：VM 跑完一輪後，同一 key 的 `metric_value` 會跟著 CDC 回修更新
   —— 用 2026-W29 台南市 65+ 那筆（431 vs 432）對照。
4. **待拍板**：migration 369（`PR-1`）、登革熱換源三選一（`PH-2`）。
5. **兩張備份表**待確認後 DROP：`public_health_weekly_backup_20260821`、
   `disaster_alerts_mojibake_backup_20260822`。
6. **沿用未做**：`.gis-agent-system/journal/` 當月檔仍未 append（上一輪就欠）；
   跨 repo handoff（`taipei-gis-analytics/docs/handoff/`）未建，見 VZ-11。
7. 若之後取得 frontend deploy 授權，本輪所有 UI 變更仍需補正式站 browser acceptance。

詳細 active work 與 acceptance criteria 見 `BACKLOG.md`。
