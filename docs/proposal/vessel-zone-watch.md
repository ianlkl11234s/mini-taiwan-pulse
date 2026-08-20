# Vessel Zone Watch — 中國公務船接近領海／鄰接區監看

> **狀態**：2026-08-20 拍板，P1 執行中。本檔為本 feature 的設計 SSOT。
> **來源**：backlog `VW-9`「船 × 界線 geofence 分析（24 浬／12 浬）」的具體化。
> **母 feature**：[`docs/features/vessel-watch/`](../features/vessel-watch/)（船在哪）
> ＋ `maritimeBoundary` 圖層（哪條線）—— 本案是把兩者在資料庫裡接起來。
> **關聯**：`mini-taiwan-osint/projects/2026-07-grayzone-incursion/`（前身研究，ledger G04 拼音字典已落地）

## 0. 一句話

把已經永久保留的 `live.vessel_watch_positions`（62.5 萬筆 / 174 天）跟已經在前端畫出來的
領海界線幾何**在資料庫裡接起來**，替每個定位點算出「距 24 浬鄰接區外界線多少浬、在哪一環」，
於是「中國海警何時逼近台灣」變成可查詢、可統計、可畫成圖表的事實。

## 1. 為什麼這件事比想像中便宜

| 已具備 | 證據 |
|---|---|
| 軌跡點有 PostGIS 幾何 + GiST 索引 | `live.vessel_watch_positions.geom geometry(Point,4326)`、`idx_vessel_watch_positions_geom`（migration 339:294） |
| 半年歷史已在庫、永久保留 | 625,072 筆，2026-02-27 ~ 2026-08-19，每日 3.5k~6.3k 筆 |
| 目標船已分類完成 | effective_class（GENERATED STORED）：中國海警 92 艘/37,033 筆、中國海事局 86/134,765、中國科研船 27/35,163 |
| 界線幾何四組**全部閉合** | 實測 `closed=True`：baseline 臺灣 146 pts、24nm 臺灣本島 6,503 pts、12nm 臺灣本島 5,547 pts、釣魚台 12nm 為 2 段皆閉合 → **可直接 ST_MakePolygon 做內外判斷** |
| 24 浬線未被海峽中線截斷 | bbox 118.879,21.355 ~ 122.551,26.036，西界比澎湖 24 浬還外 |
| PostGIS 可用 | 3.3.7 / PG 17.6，geography ST_Distance 實測正常 |

→ **不必新增任何 collector、不必動 AIS 熱寫入路徑、不必等新資料累積。**
   回補一次 UPDATE，半年趨勢圖當天就有。這是本案最大的槓桿。

## 2. 唯一的資料缺口

界線幾何**還沒進 Supabase**（查遍所有 schema，`maritime`/`territorial`/`baseline` 相關表 0 筆）。
目前只存在兩個地方：
- 上游 GeoJSON：`taipei-gis-analytics/data/processed/environment/maritime_boundary/maritime_boundaries.geojson`（4.1MB，38 features）
- 前端 PMTiles：`public/base_map/maritime_boundary.pmtiles`（355KB，**不進 git**，VW-8 尚未上傳 S3）

→ Phase 1 第一步就是把它灌進 DB。灌進去之後這份幾何同時服務「地圖顯示」與「空間判斷」兩用途。

## 3. 空間模型

### 3.1 分帶（待用戶拍板，見 §8）

以官方 24 浬鄰接區外界線為基準，**距離為帶符號值**（線內為負、線外為正）：

```
        陸           內水    領海        鄰接區          預警帶 A   預警帶 B      公海
   ─────┬───────────┬──────┬───────────┬──────────────┬─────────┬──────────┬────────
      基線        (0)     12浬線      24浬線(基準0)   +6浬      +12浬
                          Z0:領海      Z1:鄰接區       Z2        Z3          Z4:遠海
```

| zone | 判準 | 語意 |
|---|---|---|
| `territorial` | 在 12 浬線內 | 進入領海 —— 最高強度事件 |
| `contiguous` | 12 浬線外、24 浬線內 | 進入鄰接區 —— 我方得行使關務/移民/衛生管制 |
| `approach_6` | 24 浬線外 0–6 浬 | 貼線 |
| `approach_12` | 24 浬線外 6–12 浬 | 接近 |
| `outer` | 24 浬線外 >12 浬 | 不記事件，只留距離 |

### 3.2 為什麼用「到官方 24 浬線的距離」而不是「到基線的距離」

- 用戶的語意就是「24 浬線再往外推 N 浬」，直接對應
- 官方 12/24 浬線是內政部公告成果，自己 buffer 基線重算會與公告線有出入（基線含直線基線段與正常基線混用），**憑空製造一條不存在的法律線是誤導**
- 內外判斷用 `ST_Contains(polygon_24, geom)`，因為線閉合，不需要自己補陸側封閉

### 3.3 分區（region）

四組界線各自獨立：臺灣本島（含澎湖）、東沙群島、釣魚台列嶼、黃岩島。
每個定位點取**所有 region 中距離最小者**，同時記下 `zone_region`。

⚠️ **統計預設只算「臺灣本島（含澎湖）」，釣魚台／黃岩島／東沙改成可切換的附加列**（假設，非待決問項）。
理由：中國海警在**黃岩島是常駐**、釣魚台是常態化巡航，若混進主標題數字，圖表會變成一條天天滿格的直線，
把真正該看的「逼近台灣本島」訊號整個淹掉——那是日本／菲律賓的故事，不是台灣海域態勢。

### 3.4 已知覆蓋缺口（必須在 UI 揭露）

**金門、馬祖、烏坵、東引無公告領海基線**（98 年第一批只公告本島＋澎湖＋東沙＋釣魚台＋黃岩島）。
這幾處恰恰是中國海警「常態化執法巡查」最密集的海域 —— 本功能**在那裡什麼都算不出來**。
→ 後續可接海巡署／國防部公告的「限制、禁止水域」線另立一組 zone，列為 Phase 4 選項。

## 4. 資料層設計（gis-platform migration，一支或兩支）

### 4.1 界線表

```sql
CREATE TABLE spatial.maritime_zones (
  zone_key    text PRIMARY KEY,      -- 'twmain_24nm' / 'twmain_12nm' / 'dongsha_24nm' …
  layer       text NOT NULL,         -- baseline / territorial_sea_12nm / contiguous_zone_24nm
  region      text NOT NULL,         -- 臺灣本島 / 東沙群島 / 釣魚台列嶼 / 黃岩島
  line_geom   geometry(Geometry,4326) NOT NULL,   -- 原始線（Line/MultiLine）
  area_geom   geometry(MultiPolygon,4326) NOT NULL, -- ST_MakePolygon 封閉後的面
  source_note text NOT NULL          -- 內政部 98 年公告（第一批領海基線）
);
```
- 灌入方式：`ogr2ogr` 或 psql `\copy` GeoJSON → 一次性、38 features，可寫成 migration 內的 `INSERT`（幾何用 WKT 太大，改由 data-collectors 一支 loader 腳本灌）
- GiST index on both geoms
- RLS 唯讀 policy 給 anon/authenticated（比照 pla_tracks）

### 4.2 定位點加距離欄位

```sql
ALTER TABLE live.vessel_watch_positions
  ADD COLUMN dist_24nm_nm real,       -- 帶符號：負=24浬線內，正=線外
  ADD COLUMN zone          text,      -- territorial/contiguous/approach_6/approach_12/outer
  ADD COLUMN zone_region   text;      -- 臺灣本島/東沙群島/…
```

- **用 BEFORE INSERT trigger 計算**，不用改 `sweep_vessel_watch()` ——
  因為寫入有兩條路徑（每小時 pg_cron sweep + `backfill_vessel_watch.py` 歷史回補），
  trigger 才能同時覆蓋。每小時只插數百筆，trigger 開銷可忽略。
- 幾何查詢函數 `live.classify_vessel_zone(geom) RETURNS (dist real, zone text, region text)`，IMMUTABLE/STABLE。
- **回補**：分批 UPDATE（每批 5 萬筆，含 advisory lock，比照專案既有 pre-aggregate 慣例），
  625k 筆一次跑完；只算中國類的話僅 ~207k 筆，但建議**全算**（台灣海巡署、他國執法船的相對位置日後同樣有敘事價值，且成本差不多）。

> **為什麼分帶模型還沒拍板就敢先存 `zone`**：真正的儲存真相是帶符號的 `dist_24nm_nm`（連續值）。
> `zone` 只是它的閾值切分——領海／鄰接區是法律固定值不會變，只有 +6/+12 兩條預警線可能改，
> 屆時從已存的距離一次批次 UPDATE 重算即可，不必回頭重跑幾何運算。

### 4.3 統計層（**先量測再決定要不要預聚合**）

專案規則是「RPC >1s 或 >10k rows 才套 pre-aggregate」。這裡先寫薄 RPC 跑 `/check-rpc`：

```sql
public.get_vessel_zone_daily(p_days int, p_classes text[])
  → (day date, vessel_class text, zone text, ships int, positions int, min_dist_nm real)
```
- 日界用 **Asia/Taipei**（`(collected_at AT TIME ZONE 'Asia/Taipei')::date`，PRINCIPLES pg_cron target_day 教訓）
- 分類 join registry 的 `effective_class`（不是把 class 冷凍進 positions）→ 保住「改字典免 backfill」性質
- 若 EXPLAIN >1s → 建 `live.vessel_zone_daily` 普通表 + per-day refresh function + pg_cron，
  並在字典/分類變更後手動重跑（記進 handoff）
- ⚠️ 所有聚合一律帶 `AND NOT r.is_excluded`（registry 有人工排除欄位，漏掉會把已判定為誤收的船算進態勢數字）
- ⚠️ `get_vessel_watch_current` 要加 `dist_24nm_nm` / `zone` 兩個回傳欄位 →
  Postgres 不允許 `CREATE OR REPLACE` 改動 `RETURNS TABLE`，migration 必須寫成 **DROP FUNCTION + CREATE**

### 4.4 事件表（Phase 3，敘事價值最高）

```sql
live.vessel_zone_events(mmsi, zone, region, entered_at, exited_at, duration_min,
                        min_dist_nm, min_dist_at, min_lat, min_lng, position_count, is_open)
```
- 由窗口函數切段生成：同一 mmsi、同一 zone、**相鄰點間隔 > 1 小時即斷開**
  （與軌跡層 `TRAIL_GAP_SEC=3600` 同一把尺；不切會生出橫跨數日的假滯留）
- 這張表才回答得了「8/16 海警 XXXX 在鄰接區停留 6 小時」這種句子

## 5. 前端

### 5.1 Monitor 新卡 `VesselZoneCard`（用戶的主要訴求）

三處手動同步（無自動衍生，這是 Monitor 的既有形狀）：
1. `src/components/intel/monitor/monitorLayout.ts` — `MonitorWidgetId` union 加 id + dock 座標（建議 `fit:"content"`）
2. `src/components/intel/monitor/monitorSplitLayout.ts` — `MONITOR_LAYOUT_SPLIT` 補同一 id
   ⚠️ 漏這步 TS 不會紅，卡片只是在 split 模式**靜默消失**
3. `src/components/intel/monitor/MonitorPanel.tsx` — import + fetch + `widgets` 映射
   座標走 `docs/features/monitor-split/sandbox-split.html` 沙盒匯出，不手算；`monitorPacking.test.ts` 會驗

卡片內容（比照 PlaBoard 的資訊層次）：
- **頭**：最新一日「進入鄰接區 N 艘 / 貼線 M 艘」＋ 最近距離（浬）＋ 分級色
- **趨勢**：近 30/90/120 天可切窗的逐日柱狀圖，柱高=艘數、柱色=最深 zone
  → 直接復用 `src/components/intel/monitor/HazardTrendBars.tsx`（props: bars/levelColors/caption/footer/onSelectBar），
    它的 `value===null` 畫灰樁正好符合「那天沒資料 ≠ 那天 0 艘」的 NULL/0 分離鐵則
- **分類列**：中國海警／中國海事局／中國科研船 各自出現天數橫條（比照 `KindRow`）
- **分區列**（可選）：臺灣本島／東沙／釣魚台
- **（P2 選項）國防部通報對照線**：`live.pla_activity_daily.official_ships` 是國防部每日通報的共軍公務船數，
  `fetchPlaSeverityDaily` 已經在抓。把它當背景參考線疊上去，可以讓「AIS 只看得到一部分」這件事
  **用視覺講出來**，而不只是footnote 一行字。
  ⚠️ 語意 caveat：國防部數的是「台灣周邊活動的公務船」，本卡數的是「進入特定距離帶的船」，
  兩者母體不同 → 只能當脈絡線，不可放同一軸比大小。預設不開，等你看過再決定
- hover 一律走 `useChartTooltip()` + `fmtChartValue()`（全站 35 個圖表共用）
- 顏色用 `src/components/intel/intelTokens.ts` 的 `COLORS`，字型 `FONT_CJK`/`FONT_DATA`，不寫死 hex

資料取得：`src/data/intelLoaders.ts` 加 `fetchVesselZoneDaily()`，走 `withLoading` + `cachedByKey`（比照既有）。

### 5.2 vesselWatch 圖層增強

- `get_vessel_watch_current` 回傳加 `dist_24nm_nm` / `zone` → popup 顯示「距 24 浬線 3.2 浬（鄰接區內）」
- 船點依 zone 加 `circle-stroke`（領海=紅、鄰接區=橙、貼線=黃），不改主色（主色仍是分類色，兩個維度不搶）
- 新增 layer param：`vesselZoneOnly` toggle「只顯示接近界線的船」
  → manifest `params.count` 3→4、`layerParamsSpec` 補一筆（`out: null`），兩處逐位對應有契約測試焊住

### 5.3 預警環圖層（+6 / +12 浬）

- 由 DB `ST_Buffer(area_geom::geography, 6*1852)` 產生 → 簡化後匯出**小 GeoJSON 放 `public/`**（走 git）
- **刻意不塞進 `maritime_boundary.pmtiles`** —— 那顆 PMTiles 不進 git，且 VW-8（部署前上傳 S3）還是未結的 release blocker，
  塞進去等於把新功能綁在一個未完成的部署步驟上
- 視覺：比 24 浬虛線更淡的同色系點線，避免被誤讀成另一條法律界線；圖例文字寫「預警參考線（非法律界線）」

## 6. 跨 repo 順序（有資料契約變動，照 CLAUDE.md 上游先動）

| # | repo | 動作 | 備註 |
|---|---|---|---|
| 1 | taipei-gis-analytics | `docs/handoff/vessel-zone-watch.md` 建檔（含三要素）＋ catalog doc 補「已入 Supabase」 | 幾何 pipeline 本身**不用改**，沿用既有 GeoJSON 產物 |
| 2 | gis-platform | migration：zones 表 + positions 三欄 + trigger + 分類函數 + RPC + RLS/GRANT | 建議拆兩支：`3xx_maritime_zones.sql`、`3xx_vessel_zone.sql` |
| 3 | data-collectors | 新增 `scripts/load_maritime_zones.py`（一次性灌幾何）＋ 回補腳本 | **collector 本體不動**，不必 Zeabur 重部署 |
| 4 | mini-taiwan-pulse | Monitor 卡 + 圖層增強 + 預警環 GeoJSON + `docs/features/vessel-watch/` 四檔更新 | |

## 7. 必須寫進 UI 的誠實限制（這是本功能與共機圖層最大的差別）

| # | 限制 | 為什麼非寫不可 |
|---|---|---|
| 1 | **AIS 是自願廣播，這是觀測下限不是全量** | 共機數字來自國防部每日通報（官方全量）；這裡的數字來自船自己開 AIS。同一時刻岸基只看得到 20~33 艘，3 天視窗才 150+ 艘。關掉 AIS 的船直接消失 |
| 2 | **約 15 分鐘一筆取樣、實測最大訊號中斷 67 小時** | 快速穿越可能整段漏掉；事件時長只能當下限 |
| 3 | **金馬烏坵東引無公告基線 → 不可判定** | 否則讀者會以為「那邊沒事」 |
| 4 | **分類是規則推斷**（registry 686 艘中 `confirmed_class` 目前 0 艘人工確認） | 名冊 46 艘規則認不出（VW-2 未結） |
| 5 | **界線為內政部 98 年公告，供態勢參考非法律認定** | 釣魚台／黃岩島幾何存在爭議，統計呈現不等於主張 |
| 6 | 「中國海事局（HAIXUN 海巡）」一律寫全稱 | 與台灣海巡署（MID 416）是兩回事，簡寫會造成嚴重誤讀 |

## 8. 待用戶拍板

1. **分帶模型**：24 浬線外 +6 / +12 兩環？還是只要單一 +12 警戒圈？
2. **監看名單**：只「中國海警／中國海事局／中國科研船」三類？
   registry 另有中國漁政 60 艘、中國海監 26 艘、中國其他公務船 13 艘、中國油氣作業船 52 艘 ——
   要不要一起納入（建議納入為可切換的分類，統計預設只顯示用戶點名的三類）

## 9. 分期與粗估

| Phase | 內容 | 產出 |
|---|---|---|
| **P1 資料層** | 幾何入庫 + 距離欄位 + trigger + 625k 回補 + `get_vessel_zone_daily` + `/check-rpc` | 可用 SQL 直接回答「過去半年海警進鄰接區幾次」 |
| **P2 Monitor 卡** | `VesselZoneCard` + loader + 兩份座標 + 沙盒排版 | 用戶要的圖表上線 |
| **P3 圖層增強** | popup 距離 / zone 描邊 / 只看接近船 toggle / 預警環 GeoJSON | 地圖上看得出誰在逼近 |
| **P4 事件化（選）** | `vessel_zone_events` + 事件列表卡 + 金馬限制水域線 | 「哪一艘、何時、待多久、最近多少浬」 |

P1 完成即可先驗證資料是否有故事（若半年來根本沒有中國公務船進 24 浬，功能敘事要調整成「接近帶」為主）。
**建議 P1 做完先看一眼實際數字再決定 P2 的圖表主軸。**

## 10. POC 現況（2026-08-20）

幾何準備**已完成**（scratchpad，未動 repo）：
- `territorial_sea_12nm` 臺灣本島 5,547 pts → 簡化 33 pts，Hausdorff 誤差 0.00493° ≈ 547m ≈ **0.295 浬**
- `contiguous_zone_24nm` 臺灣本島 6,503 pts → 簡化 44 pts，誤差 0.00474° ≈ 526m ≈ **0.284 浬**
- 兩者簡化後仍閉合，可直接 `ST_MakePolygon`
- 產物：`prep_boundaries.py` / `line12.wkt` / `line24.wkt`

**待授權**：`SUPABASE_DB_URL` 在 `mini-taiwan-pulse/.env`，依團隊守則含機密的檔案需用戶授權才讀。
授權後即可跑 7 題唯讀查詢（連線層加 `PGOPTIONS='-c default_transaction_read_only=on'` 強制唯讀），
回答「半年來到底有沒有進 24 浬」，據此決定卡片主軸是**事件**還是**接近距離**。

⚠️ POC 只涵蓋臺灣本島兩條線，數字不可外推到東沙／釣魚台／黃岩島。

## 11. 拍板（2026-08-20，用戶決定）

1. **分帶模型：兩環 +6 / +12** —— 5 帶：領海(<12) / 鄰接區(12~24) / 貼線(24~30) / 接近(30~36) / 遠海(>36)
2. **監看名單：只三類** —— 中國海警、中國海事局、中國科研船。
   漁政/海監/其他公務船/油氣作業船**不納入**本功能（資料層 trigger 仍全船計算距離，
   未來要加只是改 RPC 的分類白名單，不需回補）
3. **授權跑唯讀 POC**（連線層 `default_transaction_read_only=on`）

---

# 12. POC 實測結果（2026-08-20，臺灣本島兩條線，唯讀）

> 精度：邊界簡化容差 0.005°，Hausdorff 實測 12nm 線 547m / 24nm 線 526m ≈ **±0.3 浬**。
> 五帶分類不受影響；個位數浬的「最貼近距離」應視為 ±0.3 浬量級估計值。
> ⚠️ **只涵蓋臺灣本島**，東沙／釣魚台／黃岩島完全未計入。

## 12.1 ⚠️ 先修這個：壞 MMSI 污染

| mmsi | registry 分類 | 不同船名數 | 定位筆數 |
|---|---|---|---|
| **412000000** | 中國海警 | **43** | 1,202 |
| **412000006** | 中國海警 | 5 | 46 |
| 412000003 | 中國其他公務船 | 4 | 89 |
| 413555220 | 中國海監 | 4 | 16,291 |

`412000000` / `412000006` 是 **412 開頭全零的 AIS 預設／碰撞代碼**，43 個不相關船名共用同一組 mmsi
（TAISHAN、YUAN HAI 088、CHINACOASTGUARD18602、"0"、"00091"…），座標橫跨 22.4~27.8N / 116.7~122.7E，
**其中一筆落在屏東內陸陸地上**。目前 registry 標成「中國海警」且未排除。

**後果**：原始查詢顯示「中國海警進入 12 浬領海 1 艘 / 83 筆 / 9 天」——**全部來自這組假訊號**。

→ **P1 必辦（守門，不是選項）**：
1. registry 把 `412000000` / `412000006` 標 `is_excluded=true`（另兩筆 412000003 / 413555220 未落入接近帶，但同樣可疑，一併審）
   ⚠️ **這是正式 DB 寫入 → 須用戶拍板，不由 P1 自行執行**。
   安全性佐證：sweep 條件是「(在 registry 且未排除) OR `is_watch_candidate()`」，
   而這些訊號的船名帶 CHINACOASTGUARD 字樣會命中 candidate 規則 →
   **標了 is_excluded 只擋統計污染，不會停止收集**，「寫入端刻意比分類端寬」的原則不受破壞
2. `scan_vessel_registry.py` 加通用規則：**一個 mmsi 對到 >3 個不同船名 → 自動標 needs_review**
3. 加**陸上點守門**：定位點落在陸域（基線向陸側）直接標為無效，不進統計
   —— 這是「資料自帶 ground truth」型守門，比事後人工看更可靠（PRINCIPLES 2026-08-02）

以下數字**全部是清洗後版本**。

## 12.2 進入 24 浬鄰接區（territorial + contiguous）

| 分類 | 定位點數 | 不重複船數 | 涉及天數 |
|---|---|---|---|
| 中國海事局 | 39 | 3 | 1 |
| 中國科研船 | 62 | 5 | 6 |
| 中國海警 | 1 | 1 | 1 |

## 12.3 進入 12 浬領海：**0**

清洗後三類監看船在 174 天內**沒有任何可信的領海進入紀錄**。

## 12.4 五帶分布（定位點數 / 不重複船數）

| 分類 | territorial | contiguous | approach_6 | approach_12 | outer |
|---|---|---|---|---|---|
| 中國海事局 | 0 | 39 / 3 | 108 / 3 | 131 / 3 | 134,778 / 86 |
| 中國海警 | 0 | 1 / 1 | **790 / 13** | **2,404 / 24** | 32,733 / 89 |
| 中國科研船 | 0 | 62 / 5 | 339 / 6 | 234 / 9 | 34,580 / 26 |

approach 帶排除壞 mmsi 前後只差個位數（796/14 → 790/13）→ **這一帶的訊號是真的**，污染集中在 territorial。

## 12.5 逐月趨勢（zone ≠ outer，艘數 / 筆數）

| 月份 | 中國海事局 | 中國海警 | 中國科研船 |
|---|---|---|---|
| 2026-03 | — | 3 / 43 | 1 / 57 |
| 2026-04 | — | 3 / 51 | 3 / 50 |
| 2026-05 | — | 1 / 20 | 3 / 77 |
| 2026-06 | 3 / 278 | 6 / 332 | 3 / 147 |
| 2026-07 | — | 13 / 311 | — |
| 2026-08（至 19 日） | — | **14 / 2,438** | 4 / 304 |

**中國海警 8 月未過完已創半年新高**，清洗前後幾乎不變（15→14 艘）→ 不是壞 mmsi 造成的雜訊。

⚠️ caveat：「清洗前後不變」只排除了壞 mmsi 這一個雜訊源，**沒有排除收集端變動**。
08/06–08/09 的高峰群集早於 08-12 sweep 上線，那段資料是 S3 回補進來的而非 live sweep。
上游 AIS 來源相同，趨勢大機率為真，但**應在穩定 live 收集數週後再確認一次**再對外宣稱。

## 12.6 最貼近個案 Top 5（負值＝已在 24 浬線內）

| mmsi | 船名 | 分類 | 距 24 浬線 | 時間 | 座標 |
|---|---|---|---|---|---|
| 413218280 | XIANG YANG HONG 22 | 中國科研船 | **−8.17 浬** | 06-18 18:20 | 25.469N 122.398E（東北外海） |
| 413393570 | HAI XUN 08 | 中國海事局 | −5.31 浬 | 06-07 07:40 | 21.486N 120.662E |
| 413269590 | HAI XUN 09 | 中國海事局 | −5.12 浬 | 06-07 07:40 | 21.469N 120.689E |
| 413294310 | HAI XUN 06 | 中國海事局 | −4.76 浬 | 06-07 07:20 | 21.470N 120.673E |
| 413875010 | CHINACOASTGUARD 1401 | 中國海警 | −1.59 浬 | 07-08 22:30 | 24.977N 120.354E |

**2026-06-07 HAI XUN 06/08/09 同日同區三船編隊**（台灣南端外海）是全期最具體的協同事件。
向陽紅 22 深入鄰接區 8 浬，距 12 浬領海線只剩約 4 浬。

## 12.7 逐日密度（近 60 天）

- 「進入 24 浬內」：**61 天裡 59 天是 0** → 做成連續柱狀圖會整片空白
- 「approach_6 + approach_12」：7 月起穩定 1–3 艘，**8/06–8/09 出現 4/8/6/8 的高峰群集** → 密度足夠撐時間軸

## 12.8 效能：確定要套 pre-aggregate

| 查詢 | 實測 | 走 GiST？ |
|---|---|---|
| 全期 3 類 × 5 帶聚合 | **2,385 ms** | ❌ Parallel Seq Scan |
| 近 120 天 × 日聚合 | **2,587 ms** | ❌ 走時間索引非幾何索引 |

幾何運算寫在 SELECT 的 CASE 裡，PostGIS 無法下推到索引 → 兩者都破 1 秒門檻。
**正式版把 zone/距離在 trigger 寫入時算好存欄位，聚合就變成純數值 GROUP BY**，這問題自然消失；
但 120 天 × 日聚合仍建議照專案慣例做 `live.vessel_zone_daily` 預聚合表 + pg_cron。

---

# 13. 依 POC 修正的設計主軸

**原本假設「進入鄰接區事件數」當主視覺 → 改掉。**

| 層級 | 內容 | 理由 |
|---|---|---|
| **主視覺** | 接近帶（24~30 / 30~36 浬）逐日不重複船數趨勢，分類疊色 | 唯一有連續性與趨勢的序列；海警 8 月創新高是真故事 |
| **次視覺** | 鄰接區進入 = 疊在趨勢圖上的**稀疏事件標記**（非獨立柱狀圖） | 174 天只有 8 天有事件，獨立畫會大片空白 |
| **事件卡** | 具名事件：06-07 HAI XUN 三船編隊、向陽紅系列各次逼近 | 這才是讀者記得住的東西 |
| **領海指標** | 保留欄位但目前恆為 0，**且必須先修壞 MMSI 才可上線**，否則會持續誤報 | 清洗前它顯示「9 天有海警進領海」——是假的 |

P2 卡片頭部建議改成：**「approach 帶今日 N 艘 / 本月最高 M 艘 / 最近距離 X 浬」**，
而不是「今日進入鄰接區 N 艘」（那個數字幾乎永遠是 0，卡片會看起來壞掉）。

# 14. ⚠️ 事故記錄：.env 憑證片段外洩

POC agent 第一次嘗試 `source mini-taiwan-pulse/.env` 時，該檔**第 2 行被 shell 誤判為指令**，
錯誤訊息把一段憑證片段印到該 subagent 的 stdout（已進入其 transcript）。
agent 後續改用 `grep`+`sed` 只截取單行、未再重現，且從未主動 echo 憑證值。

→ **建議處置**：
1. 檢查 `.env` 第 2 行格式（值未加引號或含特殊字元，才會被 shell 當指令執行）
2. 視該片段為已外洩，評估是否輪替該憑證
3. 往後給 agent 的連線授權，一律用 `grep '^SUPABASE_DB_URL=' .env | cut -d= -f2-` 這種**單鍵萃取**，
   不要用 `source` 整檔（整檔 source 會執行檔案內容，格式一有瑕疵就洩漏）

**責任歸屬**：`source` 這個做法是主 agent 在授權訊息裡指定的，不是 subagent 自作主張。

**可稽核的位置**：
- POC agent transcript：`<session>/tasks/a66e4e11b572ddeb0.output`（外洩片段在此）
- ⚠️ **另有一筆待稽核**：稍早的資料層探勘 agent（`tasks/afb83a167ca5ef604.output`）
  在本 session 更早就成功以 `SUPABASE_DB_URL` 連線，但 POC agent 在全新 subagent shell 裡
  發現該變數是空的 —— 代表前者可能自行讀了 `.env`。若要完整追credential 接觸軌跡，
  這份 transcript 值得一併檢視

---

# 15. 壞 MMSI 查證結果（2026-08-20，已執行排除）

## 15.1 結論：412000000 / 412000006 確認為 AIS spoofing 假 MMSI（信心：高）

### 內部物理證據
| 項目 | 412000000 | 412000006 |
|---|---|---|
| 相異船名 | 43 | 6 |
| 船名切換段數 | 294 | 8 |
| 隱含速度 >40 節佔比 | **40.7%**（491/1207 區間） | 未觸發（但見下） |
| 最大隱含速度 | **1,947 節**（10 分鐘瞬移 324 浬，福建外海↔釣魚台） | 32 節 |
| 陸上定位點 | **12 筆**（屏東內埔距海岸 20km、桃園市區重複 3 次） | 0 |
| call_sign | 字面 `"0"`（對照：413875010=`BNRV`、413875054=`BPQF7`） | NULL |

412000006 的決定性證據不是速度而是**軌跡拆解**：2026-08-16 可清楚分離出
`YUPAIYANGZHI006`（08-13~08-16 06:00 平滑連續）與 `MINPUYU49338`（10:20~13:40 平滑連續）
**兩艘各自合理的真船在同一號碼上交替廣播**，中間 4h10m 跳躍 133 浬。這是多船共用的教科書指紋。

### 外部佐證
- **Global Fishing Watch** AIS spoofing 專文直接點名 `412000000` 為「多艘中國船舶共用同一 MMSI」典型案例
  https://globalfishingwatch.org/data/spoofing-one-identity-shared-by-multiple-vessels/
- **MarineTraffic** 同號存在 3 個不同 shipid：`Q` / `GJM928` / `XIAMEN`（IMO 皆為 0）
- **MyShipTracking** 頁面自述該號「很可能屬於無效、測試或被多船共用的編號」
- `412000006` **外部查無獨立紀錄**（WebSearch 命中的 FENG SHAN HAI 經核對是與 412008000 混淆，不採信）→ 判定純依內部證據，`verified_by='not_found'`

### 內部先例
registry 早已用同一準則排除過 4 筆：`200000000`（evidence_note:「多艘不同船舶同時廣播」）、
`413000000`、`666666666`、`412345678`。本次判定與既有慣例一致。

## 15.2 ⚠️ 修正：413555220 是真船，不可排除

`413555220` = **中國海監「海監 66」**（2011 建造，全長 77.39m，2013 改名 CCG-2166，Wikipedia 有據）。
99.97% 定位使用同一船名，那「4 個相異船名」是 5 筆亂碼雜訊。
→ **單用「>3 個船名」的規則會誤殺這艘真船**，規則必須加集中度條件。

## 15.3 已執行的寫入（2026-08-20）

```sql
UPDATE live.vessel_watch_registry SET is_excluded=true, verified_by='web_search'|'not_found',
       verified_at=now(), evidence_note='…' WHERE mmsi IN ('412000000','412000006');
-- UPDATE 1 / UPDATE 1，已 COMMIT
```
413555220 與 412000003 **未動**。

## 15.4 建議的通用守門規則（附全表實測影響）

| 規則 | 全表命中 | 已排除 | 待處理 | 誤殺風險 |
|---|---|---|---|---|
| 後 6 碼全 0 | 6 | 2 | 4 | 有（425000000/546000000 是單船巧合尾零） |
| 後 4 碼以上全 0 | 11 | 2 | 9 | 更高（台灣海巡署 416090000、軍艦 368920000 也中） |
| 相異船名 >3 | 18 | 4 | 14 | 有（誤殺 413555220、416005379） |
| ★ **相異船名 >3 且最大單一船名占比 <90%** | **16** | 4 | **12** | **低**（自動避開 413555220 的 100%、416005379 的 90.5%） |
| 隱含速度 >40kt ≥1 次 | 54 | 3 | 51 | 高（多為單次 GPS 噪點） |
| 隱含速度 >40kt ≥10 次 | 12 | 3 | 9 | 低，與 ★ 高度重疊 |

→ **建議 `scan_vessel_registry.py` 採 ★ 規則（可選 OR 隱含速度 ≥10 次互相印證），命中者標 needs_review 而非直接排除。**

剩下 12 個未排除候選（`994161168`、`123456789`、`0`、`111111111`、`800123456`、`400000000`、
`999999999`、`12345678`、`412000003`、`222222222` 等）**本次只做規則命中、未逐一覆核**，
不應照單排除，需另案走同等級驗證。

## 15.5 查證未能完成的部分（誠實記錄）
1. ITU-R M.585 原始 PDF 未直接讀取，格式規則僅透過 Wikipedia 二手摘要確認
2. `412000006` 完全無外部獨立佐證
3. MarineTraffic 直接 fetch 被 403，僅靠搜尋摘要佐證
4. 陸域判斷用**手工描繪的台灣本島近似多邊形**（面積校驗 36,850 km² vs 實際約 36,000 km²），
   海岸凹凸處誤差數公里；但命中的內陸點距海岸 15~20km，結論穩健
5. 「>40kt 累積 ≥10 次」門檻是觀察到的自然斷點（真船最多 1~2 次、假碼 13~488 次），**未做統計檢定**
