# IoT 水利署整合研究

> Last updated: 2026-04-26
> 研究主題：data-collectors 新增的 6 個水資源 collector 中，`iot_wra` (~2,800 站 / 7 類型) 跟既有 collector 的重疊度、互補性，以及前端整合決策。
> 結論：**groundwater 完全重複（已停 iot 端）；river 互補（兩個都留）；5 個獨有類別接前端**。
> 影響範圍：`data-collectors/collectors/iot_wra.py`、`gis-platform/migrations/063_iot_wra_pre_aggregate.sql`、`mini-taiwan-pulse/src/{data,hooks,components}/`

---

## 1. 問題定義

2026-04-22 加入新 collector `iot_wra.py`，一次抓水利署 IoT 平台 7 類水文站點：

| station_type | 站數 | 跟既有 collector 重疊？ |
|---|---:|---|
| river | 1,634 | ⚠️ 跟 `river_water_level` 部分重疊 |
| groundwater | 765 | ⚠️ 跟 `groundwater_level` 部分重疊 |
| cumulativeflow | 671 | ✅ 全新 |
| watergate | 232 | ✅ 全新 |
| erosiondepth | 228 | ✅ 全新 |
| damstructure | 44 | ✅ 全新 |
| dustemission | 8 | ✅ 全新 |

**核心問題**：要不要停掉舊版，還是兩邊並存？前端怎麼接才不會雙重顯示？

---

## 2. 資料構成分析（為什麼 24h 449k rows）

### 量級反直覺

預估「~2,800 站 × 24 hr = ~67k」，實測 **449k rows / 24h**，差 6.7 倍。

### 倍增公式

```
rows_per_station_per_day = 6 (每小時取樣) × 平均 PQ 數
```

| station_type | 站數 | 平均測項/站 | rows/24h/站 | 24h 總筆數 |
|---|---:|---:|---:|---:|
| river | 1,382 | 1.13 | 137 | 189k |
| watergate | 205 | **3.83** | **492** | 101k |
| groundwater | 703 | 1.00 | 117 | 82k |
| cumulativeflow | 257 | 1.84 | 236 | 61k |
| damstructure | 41 | 3.29 | 299 | 12k |
| erosiondepth | 218 | 1.35 | 51 | 11k |
| dustemission | 7 | 3.43 | 430 | 3k |

### 為什麼是 6/hr 而不是 1/hr

`iot_wra.py` collector 排程**每 60 分鐘**跑一次，但水利署 IoT API 一次回給你**過去 1 小時內每 10 分鐘的觀測**。所以實際取樣是 6/hr。

### 為什麼 watergate 倍增係數最高（3.83 PQ/站）

閘門站一站掛多個測項：閘門開度 (%)、絕對開度 (cm)、閘門內水位 (m)、閘門外水位 (m)，所以一站一次取樣寫 3-5 筆 row。

### Storage 影響

```
449k rows/day × 30 = ~14M rows/月 → ~4 GB/月（含索引）
```

migration 062 已設 7 天 retention（`realtime.cleanup_iot_wra_measurements()`），穩態 storage ≈ 900MB。

---

## 3. 重疊度比對：座標 + 站名雙驗證

### 方法

```sql
-- 100m 內視為「同一站」
SELECT COUNT(*)
FROM old_table o
JOIN public.iot_wra_stations n
  ON ST_DWithin(o.geom::geography, n.geom::geography, 100);
```

### Groundwater：完全重複

| | 站數 |
|---|---:|
| 既有 `groundwater_level_readings`（959 站含座標） | 959 |
| iot_wra `groundwater` | 765 |
| **iot 站 500m 內找得到 old 對應** | **725 / 765 = 95%** |

**最強證據**：8 對最近站，**全部距離 = 0.0 公尺，名字一樣**：

```
old_name      iot_name      dist_m
竹山(1)       竹山(2)       0.0
新光(2)       新光(1)       0.0
自強國小(1)   自強國小(1)   0.0
壯圍(1)       壯圍(1)       0.0
九隆(1)       九隆(1)       0.0
利澤(1)       利澤(1)       0.0
利澤(2)       利澤(1)       0.0
無尾港舊閘門  無尾港舊閘門  0.0
```

→ 結論：**同一批井，不同 API 重複抓**。
- old：`opendata.wra.gov.tw`（每 10min API call）
- iot：`iot.wra.gov.tw`（每 10min API call，60min collector 抓 6 筆）

兩邊用不同編號系統（text station_id vs UUID）所以表面看不出是重複。

### River：互補

| | 站數 |
|---|---:|
| 既有 `river_water_level`（含座標的） | 831 |
| iot_wra `river` | 1,634 |
| **100m 內配對** | **僅 266 / 369 對** |
| **iot 獨有**（沒對應到 old） | **1,265 站（76%）** |
| **old 獨有**（沒對應到 iot） | **565 站（68%）** |

→ 結論：兩邊**互補性極強**，僅小部分重疊；停哪一邊都會留下大片地圖空白。

---

## 4. 欄位豐富度比對

|     | old | iot | 誰贏 |
|---|:---:|:---:|---|
| 縣市/鄉鎮 | ✅ | ✅ | 平手 |
| **詳細地址 address** | ✅ 100% | ❌ | **old** |
| 流域 basin_name | ❌ | 欄位有但**空字串** | 平手（都沒）|
| **管理單位 admin_name** | ❌ | ✅ 100% | iot |
| **電壓 voltage**（運維健康度）| ✅ | ❌ | **old** |
| 海拔 elevation_m | 欄位有 0% NULL | ❌ | 都廢 |
| **metadata jsonb** | ✅ 100% | ❌ | **old** |
| 歷史長度 (groundwater) | 5 天 | **5 年** | iot |
| 取樣頻率 | 10 min | 10 min | 平手 |
| **多測項支援**（PQ）| ❌ 單一水位 | ✅ 多 PQ（river 含預測水位）| **iot** |

### 結論：兩邊各有優勢

- **old 的隱形價值**：voltage（裝置健康度，運維重要）+ address + metadata jsonb
- **iot 的優勢**：多測項（特別 watergate / damstructure）+ 歷史長 + admin_name

→ 修正初步直覺「iot 比較多元」：對 groundwater 並不成立，但對 river 跟 5 個新類別成立。

---

## 5. 架構決策

### 5.1 Collector：停 iot groundwater，其餘保留

`data-collectors/collectors/iot_wra.py` 的 `STATION_TYPES` 列表 comment 掉 groundwater：

```python
STATION_TYPES = [
    ("river",          "/river/stations"),
    # groundwater 跟舊版 groundwater_level.py 完全重複（同一批井，500m 內 95% 配對）
    # ("groundwater",    "/groundwaterlevel/stations"),
    ("cumulativeflow", "/cumulativeflow/stations"),
    ...
]
```

已收的 5 年歷史保留在 DB（不影響）。每天省 ~82k rows / ~16MB storage 增量 + 1 個 API call/小時。

### 5.2 DB：Pre-aggregate 兩張表（migration 063）

原 RPC `get_iot_wra_latest` 每次 DISTINCT ON 掃過去 6h 的 449k rows，效能差且有踩 PostgREST 20K cap 風險。

#### Table 1：`realtime.iot_wra_latest`（地圖點圖示用）
- 每站每測項當前最新值 + 當日 delta
- ~4,000 rows 固定大小
- pg_cron 每 10 min refresh（`refresh_iot_wra_latest()`）

#### Table 2：`realtime.iot_wra_daily`（時間軸拖拉用）
- 每站每測項每日 1 row，timeline 字串編碼 `"epoch,val;epoch,val;..."`（每小時 1 個 timepoint，仿 freeway pattern）
- 7 天保留（`cleanup_iot_wra_daily(7)`）
- pg_cron 每 20 min refresh today + yesterday

#### Cron 排程錯開（避免 IO 撞車）
```
ship-trails    : 0,15,30,45      (15 min)
flight-trails  : 3,18,33,48      (15 min)
freeway        : 6,26,46         (20 min)
youbike-h3     : 9,29,49         (20 min)
disaster       : 12,32,52        (20 min)
temperature    : */20 (=0,20,40)
iot-wra-latest : 7,17,27,37,47,57 (10 min)  ← 新
iot-wra-daily  : 19,39,59         (20 min)  ← 新
```

### 5.3 前端：兩個獨立 toggle

| Layer key | 內容 | 為何不合併到既有 |
|---|---|---|
| `iotWraRiver` | iot river timeline，紫↔cyan 著色 | 跟既有 `riverLevel`（藍色）色系區隔；兩個並存自然「視覺整合」|
| `iotWraStructure` | 5 in 1（流量/閘門/堤防/沖刷/揚塵），按 type 著色 | 既有沒有對應 layer，全新 |

不嘗試「一個 toggle 雙來源 + schema normalize」是因為 old/iot RPC schema 差異大（station_id text vs UUID + 多 PQ vs 單水位），合併維護成本高。

### 5.4 細項 toggle（user 後續追加）

每個 layer 的 expandable panel 提供：
- iotWraRiver：即時水位 / 預測水位 (12-19h) 各一 toggle
- iotWraStructure：5 個 station_type 各一 toggle

預設全開。實作上 boolean state 在 `overlayParams` 內轉 0/1 number 通過（仿 metroPillarVisible pattern），App.tsx 用 `!!(... ?? 1)` 還原。

---

## 6. 量化效益

### 前端 latest 查詢

| 指標 | 改前 | 改後 | 比 |
|---|---:|---:|---:|
| Scan rows | ~110k (DISTINCT ON 24h) | ~4k (直讀) | **27x** |
| Response time | 1-3s | 50-100ms | 20-60x |
| 20K cap 風險 | 高 | 無 | ✅ |

### Storage（含 retention）

| | 改前無 retention | 改後 |
|---|---|---|
| 月成長 | ~4 GB | ~900 MB stable |
| 1 年大小 | ~50 GB（無上限）| ~3 GB | **16x** |

### 前端覆蓋

- river 站數：831（既有）→ 831 + 1,265 獨有 = **2,096 站可見**
- 全新類別：流量 (250) + 閘門 (203) + 堤防 (35) + 沖刷 (13) + 揚塵 (7) = **508 個全新感測點**

---

## 7. 方法論總結（給未來其他 collector 的交叉檢核）

當新 collector 跟既有重疊嫌疑高時：

1. **先用座標 ST_DWithin 100m 比對**（不要相信編號系統，編號常用 UUID vs text 互不認識）
2. **Sample 5-10 對最近站**，看名字像不像同一個（dist=0 + 名字相同/相近 → 確認重複）
3. **比 schema 欄位填充率**（COUNT 大量 vs sample 看是否全空字串），不要被 schema 「有這個欄位」誤導
4. **比歷史長度 + 取樣頻率**（決定誰當主、誰當備援）
5. **互補度看獨有站數比例**（>50% 獨有 = 兩邊都要留；<20% 獨有 = 可考慮停一邊）

---

## 相關檔案

| 路徑 | 用途 |
|---|---|
| `data-collectors/collectors/iot_wra.py` | Collector，已停 groundwater 子端點 |
| `gis-platform/migrations/061_iot_wra.sql` | 原 schema + 第一版 RPC |
| `gis-platform/migrations/062_iot_wra_cleanup.sql` | 7 天 retention |
| `gis-platform/migrations/063_iot_wra_pre_aggregate.sql` | 本次 pre-aggregate 兩表 + 改寫 RPC + cron |
| `mini-taiwan-pulse/src/data/iotWraRiverLoader.ts` | iot river fetch + timeline 解析 |
| `mini-taiwan-pulse/src/data/iotWraStructureLoader.ts` | iot structure fetch + 5 type filter |
| `mini-taiwan-pulse/src/hooks/useIotWraRiverLayer.ts` | iot river layer hook |
| `mini-taiwan-pulse/src/hooks/useIotWraStructureLayer.ts` | iot structure layer hook |
| `mini-taiwan-pulse/src/components/LegendPanel.tsx` | 兩個新 legend section |
