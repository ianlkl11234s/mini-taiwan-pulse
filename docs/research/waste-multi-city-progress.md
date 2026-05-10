# 全臺垃圾清運資料整合 — 進度紀錄

> 最新更新：2026-05-10
> **核心 framing**：資料來源是 hwms.moenv.gov.tw（環境部一站式涵蓋 22 縣市）+ TGOS 補經緯度
> 用戶 5/3-5/8 已在 taipei-gis-analytics 完成完整 ETL pipeline，剩 TGOS 上傳 + callback

---

## 我們最終想要什麼（一句話）

```
做出全臺 22 縣市垃圾車的「捷運式時刻表動畫」：
看著時間軸推進，車按表沿馬路跑、停在站點。
GPS 城市疊加實際位置（看誤差）、無 GPS 城市純按表跑。
```

像 Mini Tokyo 3D 看電車，但對象是垃圾車。

---

## 整體 pipeline（已完成 90%）

```
hwms.moenv.gov.tw                     → ✅ 5/3 爬完 22 縣市 / 3,991 路線
                                        產出 308,129 筆 unified stops（含時刻表 + 星期）
       ↓
地址去重 + 與既有 catalog 比對         → ✅ 5/3 67,446 真新增 / 22,739 重複跳過
                                        產出 day_001-007 × 10K 共 67,911 地址
       ↓
TGOS 跑門牌 → 經緯度                  → ⏳ day_001+002 已上傳完 + 拿到結果（5/10 16:36）
                                        result/v2/Address_Finish (32)+(33).csv 各 10K 行
                                        ⚠️ 座標系是 TWD97 (EPSG:3826)，要轉 WGS84
                                        🔴 user 持續上傳 day_003-007（每天 1 batch）
       ↓
12_unified_callback.py 整合三源       → 🔴 待寫（要含 TWD97 → WGS84 transform）
       ↓
回灌 spatial.waste_collection_stops   → ✅ Schema 已 ready（5/8 import script 跑過）
       ↓
mini-taiwan-pulse 視覺化              → ⏳ Phase 3 prototype 可先 5 城做（不卡 TGOS）
                                        等 callback 完才能擴展到 22 城
```

## 5 城 stops 已 100% 完整（5/10 驗證）— Phase 3 prototype 立即可做

| 縣市 | stops | arrival_time | departure_time | weekday_pattern | route_id | route LineString |
|---|---:|---:|---:|---:|---:|---:|
| 高雄市 | 32,422 | 100% | 100% | 100% | 100% | ✅ 1,399 條 |
| 新北市 | 26,672 | 100% | 100% | 100% | 100% | ✅ 649 條 |
| 宜蘭縣 | 12,071 | 100% | 100% | 100% | 100% | ❌ 用 OSRM /route |
| 臺北市 | 4,048 | 100% | 100% | 100% | 100% | ❌ 用 OSRM /route |
| 基隆市 | 1,912 | 100% | 100% | 100% | 100% | ❌ 用 OSRM /route |

---

## 兩種資料：靜態 vs 動態

### 靜態（站點 + 路線 + 時刻表）

```
✅ 全 22 縣市 hwms 爬完 → 308K stops + 3,991 routes
⏳ 67,911 地址等 TGOS 補經緯（既有 22,739 已有座標 / 跳過）
✅ migrations 067/068 上線、5/8 import 跑過
```

**TGOS 跑完後 DB 預期規模**：
- `waste_collection_stops`: 77,125 → **~385K**（+308K）
- `waste_collection_routes`: 2,048 → **~6,039**（+3,991）

### 動態（即時 GPS）

```
✅ 新北 / 台南 / 高雄 collector 上線（GPS 持續進 spatial.waste_positions_realtime）
⏳ 台中待接（endpoint 已找到、見 handoff）
❌ 其他 18 城無 GPS（政府未提供）
```

---

## 22 縣市現況一張表

| 縣市 | hwms 爬完 | TGOS 待上傳量 | 即時 GPS | mini-taiwan-pulse 可視化 |
|---|---|---|---|---|
| 台北 | ✅ | 含 day_004 1,895 筆 | ❌ | 待 callback |
| **新北** | ✅ | 含 day_002 132 筆 | ✅ 2 min | 待 callback |
| 桃園 | ✅ | 含 day_002+003 共 4,825 筆 | ❌ | 待 callback |
| 新竹市 | ✅ | 含 day_006+007 共 2,286 筆 | ❌ | 待 callback |
| 新竹縣 | ✅ | 含 day_007 1,896 筆 | ❌ | 待 callback |
| 苗栗 | ✅ | 含 day_006 2,261 筆 | ❌ | 待 callback |
| **台中** | ✅ | 含 day_003+004 共 11,960 筆 | ⏳ 待接 10 min | 待接 GPS + callback |
| 彰化 | ✅ | 含 day_005 6,359 筆 | ❌ | 待 callback |
| 南投 | ✅ | 含 day_006 2,269 筆 | ❌ | 待 callback |
| 雲林 | ✅ | 含 day_005+006 共 2,128 筆 | ❌ | 待 callback |
| 嘉義市 | ✅ | 含 day_006 636 筆 | ❌ | 待 callback |
| 嘉義縣 | ✅ | 含 day_006 1,356 筆 | ❌ | 待 callback |
| 台南 | ✅ | 含 day_002+003 共 8,156 筆 | ✅ 5 min | 已上線 + 待 callback |
| **高雄** | – | 0 筆（既有座標齊） | ✅ 2 min | 已上線完整 |
| 基隆 | ✅ | 含 day_004 1,173 筆 | ❌ | 待 callback |
| 宜蘭 | ✅ | 含 day_004 1,480 筆 | ❌ | 待 callback |
| 花蓮 | ✅ | 含 day_007 1,424 筆 | ❌ | 待 callback |
| 台東 | ✅ | 含 day_007 437 筆 | ❌ | 待 callback |
| 屏東 | ✅ | 含 day_004+005 共 3,433 筆 | ❌ | 待 callback |
| 澎湖 | ✅ | 含 day_007 820 筆 | ❌ | 待 callback |
| 金門 | ✅ | 含 day_007 412 筆 | ❌ | 待 callback |
| 連江 | ✅ | 含 day_007 119 筆 | ❌ | 待 callback |

**沒有 Tier 2/3 之分了**：所有 21 城（高雄已有）都靠 hwms + TGOS 補完。

---

## 你做 vs 我做

### 你做（taipei-gis-analytics 範圍）

```
1. 7 天循環上傳 day_001-007 到 TGOS
   - 每天上傳 1 個 batch（CP950 編碼）
   - 等結果（數小時 - 一天）
   - 下載放 data/intermediate/tgos/result/
   - 7 天都收齊再做下一步

2. 寫 12_unified_callback.py
   - 合併三源（waste callback + hwms callback + pre_geocoded.json）
   - 讀 day_NNN_mapping.csv 的 source 欄位分流
   - 回填各自 GeoJSON 並 import 到 supabase
   - 待 Day 1 結果回來前補上

（高雄不在 TGOS 範圍 — 高雄既有座標齊、5/3 dedupe 階段就跳過了）
```

### 我做（mini-taiwan-pulse 範圍）

```
1. 接台中 GPS collector（與 TGOS 並行，不互卡）
2. 等 callback 把 stops 灌進 DB 後：
   - 新北 / 台中 / 台南 OSRM map-matching 擴展
   - 前端 City 切換 UI
   - 時刻表視覺化（捷運式動畫）
   - GPS + 表定誤差分析
```

### 一起做

```
- TGOS 上傳遇到問題（編碼、批次大小、quota）討論
- callback script 設計確認
- 時刻表動畫視覺方向決策
```

---

## 進度標記

```
✅ 已 done
⏳ 進行中 / 待動作
🔴 未開始 / 待寫
```

### 5/3-5/8 已完成（taipei-gis-analytics）

```
✅ 06_hwms_full_crawl.py    爬蟲：22 縣市 3,991 路線（5/3）
✅ 07_hwms_to_unified.py    統一 schema：308K stops（5/3）
✅ 08_hwms_tgos_batch.py    TGOS 批次：90K → 10 batch（5/3）
✅ 10_hwms_dedupe_and_rebatch.py  dedupe → 7 batch（5/3）
✅ 11_repack_daily.py        合併 waste+hwms → day_001-007（5/3）
✅ 12_clean_address_commas   清逗號（5/3）
✅ migration 067/068 apply   schema 上線（5/5）
✅ Phase 10 round 1-3 救援  facilities 4,609 + disposal 13,751（5/8）
✅ 23_import_phase10_to_supabase  灌進 DB（5/8）
```

### 待 user 動作

```
⏳ TGOS 7 天上傳 day_001-007（每天 1 batch）
🔴 12_unified_callback.py 寫（Day 1 結果回來前補）
```

### 待我動作（mini-taiwan-pulse）

```
🔴 接台中 GPS collector（並行不卡 TGOS）
🔴 BL-9 / BL-14 收尾（5/9-5/10 OSRM 已做、視覺驗證 done）
🔴 等 callback 後：OSRM 擴展 / City 切換 UI / 時刻表動畫
```

---

## Q & A

**Q: 為什麼說「TGOS 處理完就 OK」？**
A: 因為靜態資料（22 縣市站點 / 路線 / 時刻表）你都爬好了、schema 也準備好了、pipeline 也跑通了，只差 TGOS 把地址轉經緯度這一步。沒了。

**Q: 那高雄為什麼不在 TGOS 範圍？**
A: 因為高雄既有 stops 已有座標（32K stops with geometry），5/3 dedupe 階段就跳過了。

**Q: hwms 跟「環保署」有什麼關係？我前面 agent 沒找到？**
A: hwms = 環境部資源循環署「全國垃圾車路線網」（hwms.moenv.gov.tw），是中央級單一 portal、涵蓋 22 縣市。前面 agent 用 master_catalog.sqlite 找開放資料平台，那邊收的是各縣市 portal、沒收進 hwms。盲點。

**Q: 還有什麼風險？**
A:
- TGOS 跑 67K 地址可能 quota 限制 / 上傳失敗 → 7 天分批就是因應
- callback script 沒寫好可能會傷既有 77K stops → 必須謹慎 dedupe
- hwms 後續若改版 / 失效 → 已爬下來的資料還能用，但下次更新要補
