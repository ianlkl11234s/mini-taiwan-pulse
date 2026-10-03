# Vessel Watch — 特殊船舶名冊 + 長期留存

> 提案 2026-08-12 ｜ **v4**（2026-08-13 更新）｜ 狀態：**全部上線**（資料層 + 船舶圖層 + 領海界線）
>
> | 項目 | 狀態 |
> |---|---|
> | migration 339（兩表＋分類函數＋sweep cron＋永久 retention） | ✅ applied |
> | migration 340（三支前端 RPC） | ✅ applied |
> | migration 341（MMSI 有效性守門 — 前端驗收時發現的 bug） | ✅ applied |
> | migration 342（用軌跡真實 ship_type 重算 registry） | ✅ applied |
> | 母表 21 天搶救 | ✅ 109,997 筆 / 366 艘 |
> | 名冊 | ✅ **685 艘 / 13 分類 + 46 待人工審**（seed 當時 654，回補後成長） |
> | S3 回補 | ✅ **2026-02-27 ~ 08-13 共 168 天連續零缺口**（588,550 筆 / 685 艘 / 159 MB） |
> | 前端 `vesselWatch` 圖層 | ✅ 上線於「情勢 Situation → 軍事」，瀏覽器驗證通過 |
> | 船隨時間軸移動 | ✅ gap-aware 插值（commit `b645827`） |
> | 領海界線圖層 | ✅ `maritimeBoundary` 進「底圖 → 海域界線」（commit `08ed70b`） |
> | commit / PR | ⏸ 分支 `feat/vessel-watch`，未 push |
>
> 需求：把 AIS 裡的特殊船隻（海警／海巡／科研／軍艦…）獨立長期保存，並維護一份可持續更新的船隻名冊。
> 前身研究：`../mini-taiwan-osint/projects/2026-07-grayzone-incursion/`（Phase 0＋首跑，2026-07-07 後停擺）

## 拍板紀錄（2026-08-12）

| 決策 | 結果 |
|---|---|
| 保留期 | ✅ **永久**（`retention_days = NULL`） |
| 界線圖層（原 P4） | ✅ **2026-08-13 完成**（backlog VW-3），見 `docs/features/vessel-watch/` |
| 前端圖層（原 P3） | ✅ **同日追加完成**（用戶後續指示），見 §8 |
| 資料層 | ✅ **可做** —— 本次範圍 |
| 船隻名冊表 | ✅ 新增（用戶提案）＋ 每週手動掃描更新 |
| 涵蓋類別 | ✅ 擴大：執法船 → ＋科研船／軍艦／油氣作業船 |

---

## 1. 為什麼要新做一張表（而不是把 ship_positions 留久一點）

`live.ship_positions` 是分區表、retention **21 天**（`metadata.retention_policies`，migration 282）。
直接拉長保留期是錯的解法 —— 282 的檔頭就是「DB 長到 52GB」的事故報告。

實測（2026-08-12 16:00，近 24h）：

| 指標 | 全量 AIS | 執法船 | 佔比 |
|---|---:|---:|---:|
| rows / 24h | 666,024 | **2,539** | 0.38% |
| 不重複 MMSI / 24h | 14,733 | **69** | 0.47% |

取樣密度：每艘約 **15 分鐘一筆**（岸基 AIS 收得到才有，離岸遠就斷）。
`live.ship_current` 另有 **381 艘**曾出現過的執法船（sticky 最後已知位置）。

→ 篩出來只佔 0.38%，獨立存永久完全可行，母表 21 天 retention 一動不動。

---

## 2. 兩張表 + 一支週掃（回答「要不要維護一張清單」）

**要，而且它是這套設計的核心。** 分成兩張表各司其職：

```
vessel_watch_registry    「有哪些特殊船」——名冊，一船一列，慢速變動、可人工校正
vessel_watch_positions   「牠們去了哪」——軌跡，一船多列，只進不出、永久保留
```

### 2a. `live.vessel_watch_registry`（船隻名冊）

一艘船一列，key = `mmsi`。欄位分三組：

| 組別 | 欄位 | 誰維護 |
|---|---|---|
| **身分** | `mmsi`(PK), `imo`, `call_sign`, `names_seen`(TEXT[]), `length`, `width`, `draught` | 週掃自動累積 |
| **規則判定** | `rule_class`, `rule_flag`, `matched_by` | 週掃**每次覆寫** |
| **人工確認** | `confirmed_class`, `note`, `is_excluded`, `confirmed_at` | **只有你能改，週掃永不覆寫** |
| **時序** | `first_seen`, `last_seen`, `last_scan_at` | 週掃累積 |

> 刻意不放 `seen_days` 這種累計欄位——腳本重跑就會重複累加，是維護不了的欄位。
> 要「出現過幾天」直接從 `vessel_watch_positions` 算。

> ⚠️ **規則欄位與人工欄位必須分開** —— 這是整個「持續補足更新清單」需求的地基。
> 若週掃直接覆寫同一個 class 欄位，你這週手動改對的分類，下週掃描就被規則洗掉。
> 讀取時的有效分類 = `COALESCE(confirmed_class, rule_class)`。

### 2b. `live.vessel_watch_positions`（軌跡）

沿用母表欄位 ＋ `UNIQUE(mmsi, collected_at)`。**普通表非分區**（量級不需要）。

**寫入條件 = `mmsi IN (registry) OR <寬鬆規則>`**
—— registry membership 讓已認識的船**靠 MMSI 黏著追蹤**，就算牠哪天船名變亂碼、type 亂填也照樣收；
寬鬆規則則負責撈進「還沒被人看過的新船」等你每週審。這是兩張表的接合點。

### 2c. 每週掃描（你手動跑）

一支 Python 腳本，讀 **S3 raw**（不是 DB —— 見 §3 的原因）：

```
python3 scripts/scan_vessel_registry.py            # 掃最近 7 天
python3 scripts/scan_vessel_registry.py --since 2026-02-03   # 全量重掃
```

做三件事：發現新船 → upsert registry（只動規則欄位）→ 印出「本週新增待你確認的船」。

---

## 3. S3 歷史回補（你說的「今年以來」——實際範圍已查證）

### 實際涵蓋（2026-08-12 查證）

| 來源 | 範圍 | 內容 |
|---|---|---|
| `s3://migu-gis-data-collector/ship_ais/2026/` | **2026-02-03 → 02-28** | 3,493 檔逐次 JSON（12.65 GB） |
| `s3://.../ship_ais/archives/` | **2026-02-28 → 08-05** | 159 個每日 `tar.gz`（4.97 GB） |
| DB `live.ship_positions` | 最近 21 天（約 07-22 →今天） | 滾動視窗 |

**三者接起來 = 2026-02-03 → 今天，無縫**（S3 到 08-05、DB 從 07-22，重疊 14 天可對帳）。

> 📌 兩個修正：①不是「今年以來」，**1 月沒有**，最早 2026-02-03。
> ②`archives/` 是**延遲 6 天打包**（08-11 才產出 08-05 的檔），不是壞掉；最近 6 天要從 DB 取。

### S3 raw 的欄位比 DB 還豐富（重大加分）

S3 原始 JSON 有，但**當初沒進 DB** 的欄位：

`imo`（國際船舶識別碼，比 MMSI 穩定）、`call_sign`（呼號）、`length` / `width` / `draught`（船長寬吃水）、
`destination` / `eta`、`nav_status`、`cog` / `rot`

→ 這些正是 registry 最需要的身分證據。**名冊表要從 S3 raw 建，不是從 DB 建。**

### 兩個 backfill 技術點

**時鐘對齊**：DB `collected_at` = collector 抓取時間（整批同一戳），
S3 raw 同時有 `record_time`（AIS 訊息時間）與 `_fetch_time`（抓取時間）。
→ backfill 一律取 **`_fetch_time`** 對應 `collected_at`，語意才一致。
設一個 cutover 時間 T：`< T` 走 S3、`>= T` 走 DB sweep，避免邊界重複。

**密度降採樣**：S3 raw 是**每 2 分鐘**一個快照，而 go-forward 實測是每 15 分鐘一筆。
若照原解析度回補，190 天會灌進 400 萬筆以上，且大多是錨泊船連續數日的重複座標。
→ backfill **降採樣成每船每 15 分鐘一筆**，跟現行密度一致。

### 量級（go-forward 為實跑數字，非估算）

migration 在 transaction 內實跑 `live.sweep_vessel_watch('24 hours')` 後 ROLLBACK：

| 階段 | 數字 | 來源 |
|---|---|---|
| go-forward | **4,435 筆／93 艘／24h** | ✅ 實跑 |
| go-forward 一年 | ~162 萬筆 | 由實跑推算 |
| S3 回補 190 天（降採樣後） | ~55 萬筆 | 估算 |
| 含 geom 磁碟 | 約 300–500 MB | 估算 |

→ 永久保留成立。

---

## 4. 分類規則（全部由實測校正，非憑空猜測）

### 陷阱 A — `ship_type` 是船方自報，會漏
| 船名 | 自報 type | 實為 |
|---|---|---|
| `ZHONGGUOHAIJIAN 8003` | 其他 | 中國海監 |
| `CHINACOASTGUARD2505` | 其他(10) | 中國海警 |
| `HAIXUN08215` / `HAIXUN07602` | 搜救船 / 高速船 | 中國海事局 |
| `ZHONGGUOYUZHENG35122` | 漁船 | 中國漁政 |

### 陷阱 B — 只看船名會誤抓（MID 必須當條件）
`HAI AN NO.10`（416 台灣民間客輪）、`HAIAN PARK`（574 越南貨船）、
`XIN HAI XUN`（413 疏浚船）、`COASTGUARD`（400 貨船）
→ **`HAIAN` 不可入字典**；`HAIXUN` 要錨定字首防 `XIN HAI XUN`。

### 陷阱 C — 台灣海巡不用拼音，用船號前綴
實測 MID 416 執法船：`CG-127`、`CG1005`、`CG605`、`PP-10037`、`PP 10063`、`CL933`。
拼音字典對台灣端完全無效。同時 416+type55 裡混了 `CHANG SHENG 66`、`PING FU NO.2` 等疑似漁船。

### 陷阱 D — `HAIYANG`（海洋）是毒關鍵字
實測誤抓一大票：`HONG LI HAI YANG`、`FUHAIYANG`、`GANGHUIHAIYANG`（貨船）、
`HAI YANG NO 8`（416 拖船）。**不可單獨使用**，只能用 `HAIYANGDIZHI` 這種完整詞。

### 分類表

| vessel_class | 判定 | 實測樣本 |
|---|---|---|
| 中國海警 | MID 412/413/414 ＋ `CHINACOASTGUARD` / `ZHONGGUOHAIJING` | `CHINA COASTGUARD2101` |
| 中國海事局 | 同 MID ＋ `^HAIXUN` | `HAI XUN 0766`、`HAIXUN08171` |
| 中國漁政 | 同 MID ＋ `ZHONGGUOYUZHENG` | `ZHONGGUOYUZHENG33005` |
| 中國海監 | 同 MID ＋ `ZHONGGUOHAIJIAN` | `ZHONGGUOHAIJIAN 8003` |
| 中國其他公務船 | 同 MID ＋ type 55，名不匹配 | `CMS8001`、`MIN JIAO XUN 2001` |
| 台灣海巡署 | MID 416 ＋（type 55 或 `^(CG\|PP\|CL)`） | `CG-127`、`PP-10063` |
| **中國科研船** | MID 41x ＋ `XIANGYANGHONG` / `HAIYANGDIZHI` / `^SHIYAN` / `TANSUO` | `XIANGYANGHONG51`、`XIANG YANG HONG 03`、`SHIYAN2`、`HAIYANGDIZHIJIUHAO` |
| **台灣科研船** | MID 416 ＋ `OCEANRESEARCHER` / `FISHERY RESEARCHER` | `NEW OCEANRESEARCHER1/2`（新海研）、`FISHERY RESEARCHER 2` |
| **他國科研船** | 其他 MID ＋ 科研 pattern | — |
| **軍艦** | type 35 **或** 名含 `WARSHIP` / `NAVY` | `IDN WARSHIP 332`（印尼，MID 525） |
| **中國油氣作業船**（⚠️ 見下） | MID 41x ＋ `HAIYANGSHIYOU` / `HAI YANG SHI YOU` | `HAI YANG SHI YOU 291`、`HAIYANGSHIYOU720` |

> ⚠️ **命名地雷**：`HAIXUN`「海巡」是**中國海事局**的船，跟**台灣海巡署**（MID 416）完全兩回事。
> 任何顯示都要寫全稱，不可只寫「海巡」。

> 🤔 **中國油氣作業船（CNOOC）要不要收？** 實測約 30+ 艘（`HAI YANG SHI YOU` 系列）。
> 牠們不是執法船也不是科研船，但海上油氣勘探在主權爭議脈絡下有情報價值。
> **建議收進 registry 但獨立成一類**，未來畫圖層時預設關閉。你可以之後用 `is_excluded` 一鍵排除。

### 軍艦的誠實天花板
近 48h **type 35 命中數為 0**。中國與台灣海軍艦艇基本全程靜默，
唯一抓到的是靠船名的 `IDN WARSHIP 332`（印尼）。
→ 這一類實際能抓到的是**他國軍艦過境**，不是台海主戰兵力。這點在任何呈現上都要講明。

---

## 5. 實作範圍 —— ✅ 全部完成並已上線

| # | 產出 | 位置 |
|---|---|---|
| 1 | **migration 339** — 兩張表 ＋ `classify_vessel()` / `is_watch_candidate()` ＋ 每小時 sweep cron ＋ 兩張表各註冊一列 retention（`NULL`＝永久） | `gis-platform/migrations/339_vessel_watch.sql` |
| 2 | **回補腳本** — 讀 S3（`2026/` 逐檔＋`archives/` tar.gz）→ 降採樣 → 灌兩張表 | `data-collectors/scripts/backfill_vessel_watch.py` |
| 3 | **週掃腳本** — S3 ＋ 母表雙掃 → upsert registry 規則欄位 → 印待審清單 | `data-collectors/scripts/scan_vessel_registry.py` |

當時範圍不含前端；同日用戶追加「要能在前端顯示」→ 見 §8。
界線圖層已於 2026-08-13 補上（`maritimeBoundary`）。

### 驗證紀錄（2026-08-12，全程 transaction 內執行後 ROLLBACK，DB 無痕跡）

| 驗證 | 結果 |
|---|---|
| migration 完整執行 | ✅ 兩表 + 5 函數 + cron 建立成功 |
| 分類函數 × 12 個真實樣本 | ✅ 全對。含成功防住 `XIN HAI XUN`（疏浚船）、`HAI AN NO.10`（民間客輪）、`HONG LI HAI YANG`（貨船）三個誤抓陷阱 |
| `sweep_vessel_watch('24 hours')` 實跑 | ✅ 撈到 **4,435 筆 / 93 艘** |
| 冪等性（重跑同窗口） | ✅ 第二次回傳 0 |
| 腳本 SQL 模板實跑（含地雷列） | ✅ `REGISTRY_SQL` / `POSITIONS_SQL` / `REGISTRY_FROM_DB_SQL` 三支都跑過，含「空船名 + NULL imo/尺寸」列；貨船測試列被 `is_watch_candidate()` 正確濾掉 |
| backfill dry-run（archive 版面） | ✅ 2026-07-15 → 3,785 筆 / 105 艘 |
| Python 兩支腳本語法 | ✅ `py_compile` 通過 |
| 粗篩 pattern × 13 樣本 | ✅ 無漏網 |

### 這輪測出並修掉的兩個真 bug

1. **`array_agg` 空集合回傳 NULL**（會在每週掃描的**第二次**執行才爆）
   船名一直是空字串的船（實測存在），第一次 upsert 寫入 `names_seen = {}`，
   第二次 `array_agg(...) FROM unnest('{}')` 回傳 **NULL** 而非空陣列 → 撞 NOT NULL 約束。
   → 兩支腳本都補上 `COALESCE(..., '{}')`。這種 bug 只在重跑時現形，靠讀 code 看不出來。

2. **`S3Storage.list_files()` 回傳 dict 不是字串**
   2 月的逐檔版面路徑會直接 `TypeError`（`sorted()` 比較 dict）。
   → 改成 `sorted(..., key=lambda x: x['key'])` 並取 `f['key']`。

另外處理了 **2026-02-28 換版面邊界**：該日 tar.gz 只有 2.0MB（其餘日約 30MB），
表示當天資料分散在兩種版面 → 該日兩個來源都讀，靠降採樣去重。

實跑分類分布（24h，93 艘）：

| 分類 | 艘 | 分類 | 艘 |
|---|---:|---|---:|
| 台灣海巡署 | 25 | 中國海監 | 3 |
| 中國海事局 | 17 | 中國科研船 | 3 |
| 中國海警 | 10 | 他國執法船 | 3 |
| 中國漁政 | 9 | 軍艦 | 2 |
| 中國油氣作業船 | 7 | （規則認不出，待人工審） | 2 |
| 台灣科研船 | 6 | | |
| 中國其他公務船 | 6 | | |

→ 93 艘裡 91 艘規則判得出（覆蓋率 98%），待人工審的只有 2 艘。

另外實測 migration 檔尾建議的 `ship_current` seed（sticky 名單，含歷史上出現過的船）：
**名冊起手 604 艘，其中 581 艘規則判得出（96%），23 艘待你人工審。**
軍艦類在 sticky 名單裡有 26 艘（歷史過境累積），遠多於即時的 2 艘 —— 這正是名冊的價值：
即時看不到的船，名冊記得牠來過。

### 跨 repo 順序
1. **gis-platform** migration 339 → 🔴 **apply 須你拍板**
2. **data-collectors** 兩支腳本（手動執行，不進排程）
3. **collector 本體不改**（sweep 走 DB 端 cron，不碰熱寫入路徑）

---

## 6. 誠實限制

- **AIS 是自願廣播**：中國／台灣海軍艦艇基本靜默，這套看到的是**公務船、科研船、他國過境軍艦**，不是完整海上態勢。
- **`ship_type` 船方自報**，可造假也常填錯（§4 陷阱 A 實測）。分類是**推斷**不是官方認定 —— 這正是 registry 要留人工確認欄位的原因。
- **取樣稀疏**：每艘約 15 分鐘一筆，離岸遠就收不到 → 軌跡是**斷續取樣**，不可畫平滑曲線（PRINCIPLES：Catmull-Rom 只用於真實連續軌跡）。
- **寫入端要刻意放寬**：誤抓幾百艘民船的代價是幾 MB；漏抓的代價是**永久資料損失**（21 天後母表就沒了）。寧可多收再用 `is_excluded` 排除。

---

## 7. 相關檔案

| 用途 | 路徑 |
|---|---|
| 前身研究 + 首跑實測 | `../mini-taiwan-osint/projects/2026-07-grayzone-incursion/notes/2026-07-07-first-run.md` |
| 假設帳本（G04 = 拼音字典） | 同上 `ledger.md` |
| retention 註冊表機制 | `../gis-platform/migrations/282_retention_registry_and_coverage.sql` |
| 母表定義 / schema 搬遷 | `../gis-platform/migrations/002_realtime_tables.sql:131`、`312_move_realtime_to_live.sql` |
| collector 欄位對照（含未進 DB 的欄位） | `../data-collectors/collectors/ship_ais.py:100`、`storage/supabase_writer.py:508` |
| backfill 腳本前例 | `../data-collectors/scripts/backfill_ship_flight.py` |
| S3 每日凍結（另一條線，僅 08-08 起） | `../data-collectors/scripts/export_daily_trails.py` |
| 教訓：查不到常是字典不對 | `../gis-wiki/inbox/2026-07-11-灰色地帶可行性別太快放棄.md` |

---

## 8. 前端圖層（2026-08-12 追加上線）

用戶原本說「先不畫」，同日改為要畫。走 `/new-layer` + `layer-creator` 產骨架。

### 接線位置
「情勢 Situation → 軍事」，排在 `plaActivity` 之後。key = `vesselWatch`，色 `#fb7185`，icon `Radar`。

### 關鍵實作決策
- **純 Mapbox circle + line，零 Three.js**（PRINCIPLES §L828：一個 gl context 只能掛一個
  Three.js CustomLayer，`ships` 已佔用 ShipScene）
- 12 類色票抽成 `src/data/vesselWatchTypes.ts`，loader / 圖例 / popup 三邊共用
- 時間走 `timeStore` 訂閱，`currentTime` 未進 deps
- 四鐵則全實作，manifest **零 `null` 豁免**（三個 ledger 一行未動）
- 點擊優先序：`vesselWatch` 刻意排在 `plaActivity` **之前** —— 共機活動區是覆蓋整個海峽的
  大 polygon，first-hit-wins 之下船點排後面永遠點不到

### 瀏覽器驗收（agent-browser，dev 3721）
| 項目 | 結果 |
|---|---|
| 圖層/source 建立 | ✅ `vessel-watch-circle` + `vessel-watch-trail-line` |
| 資料載入 | ✅ 船位 90 + 軌跡 156 feature |
| 畫面渲染 | ✅ 255 feature、11 分類同時出現 |
| popup | ✅ 船名/分類/MMSI/IMO/呼號/速度/最後回報 + 誠實揭露文字 |
| 圖例 | ✅ 12 類全稱（未出現裸「海巡」） |

### 前端驗收時抓到的兩個真 bug

**① 軌跡虛構航跡（正確性問題，非美觀）**
截圖發現多條橫跨台灣海峽的長直線。量化後確認：3 天窗口 16,847 個相鄰點對中，
346 對間隔 > 1 小時、99 對 > 6 小時、**最大間隔 67 小時** —— 船離開岸基 AIS 覆蓋後
再出現，兩點直接連線 = 完全不存在的航跡。
→ `trailsToGeoJSON` 改為 **MultiLineString，超過 60 分鐘無訊號即切段**。
實測 **156 艘中有 92 艘（59%）需要切段**，最多切成 12 段。

**② MMSI 999999999 被判成「軍艦」**
點開一個船點，popup 顯示 MMSI `999999999`、船名 `RONG HUA 889`。
那不是軍艦、甚至不是船 —— ITU 規定船舶 MMSI 首碼為 2-7，
`99xxxxxxx` 是助航設備（AtoN）、`111xxxxxx` 是 SAR 航空器、`00xxxxxxx` 是海岸電台。
339 的髒資料檢查只驗「9 位數字」，全部漏網。名冊裡共 **17 艘**這類紀錄，
船名多為損壞訊號（`(FDB# GC FB PHVA`、`BK-\R#*)P(A LLM?P`）卻被標成軍艦/執法船顯示在圖上。
→ migration 341 把首碼檢查收進 `classify_vessel`，17 艘全部歸零分類。

> 兩個 bug 都是**跑起來看才發現的**，靜態審查與單元測試都不會抓到。

### 現況分類分布（654 艘名冊）

| 分類 | 艘 | 分類 | 艘 |
|---|---:|---|---:|
| 台灣海巡署 | 145 | 他國執法船 | 34 |
| 中國海警 | 90 | 中國科研船 | 27 |
| 中國海事局 | 85 | 軍艦 | 26 |
| 中國漁政 | 61 | 中國海監 | 26 |
| 中國其他公務船 | 50 | 台灣科研船 | 9 |
| 中國油氣作業船 | 49 | 他國科研船 | 1 |
| **（待人工審）** | **51** | | |

51 艘待審正是 registry 人工欄位的用途 —— 用 `scan_vessel_registry.py` 列出來，
標 `confirmed_class` 或 `is_excluded`。
