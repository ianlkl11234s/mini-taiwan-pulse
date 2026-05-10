# 全臺 22 縣市垃圾清運資料盤點 + MVP 擴展策略

> 寫於 2026-05-10
> 目的：在做完高雄 + 台南 OSRM map-matching 後（plan §14-15），盤點剩 20 縣市資料現況，決定 next phase 工程量級
> 資料來源：(1) Supabase gis-platform DB 內現有 waste_* 表盤點；(2) master_catalog.sqlite 對 7.4 萬筆政府開放資料 PLAR 視角搜尋（21 平台）

---

## TL;DR

```
全臺 22 縣市分三層：

Tier 1（直接整合，工程小）  7 縣市
  雙北 / 高雄 / 台南 / 台中 / 基隆 / 宜蘭
  → 都有經緯度站點 + 路線 + 表定時間
  → 4 城（新北 / 高雄 / 台南 / 台中）有即時 GPS

Tier 2（TGOS 補強，中工程）  4 縣市
  新竹市 / 雲林 / 嘉義市 / 澎湖
  → 有路線文字但只有地址，需 TGOS 門牌轉經緯

Tier 3（資料缺口，大工程）  11 縣市
  桃園 / 新竹縣 / 苗栗 / 彰化 / 南投 / 嘉義縣
  花蓮 / 台東 / 屏東 / 金門 / 連江
  → 政府平台找不到開放資料，要爬環保局網站或專案申請
```

**重要 finding**：
- 環保署沒有民生垃圾車的全國統一 API（只有事業廢棄物用），必須**逐縣市串接**
- **新北其實比台北資料更豐富**（新北有 GPS + 7 天 weekday flag、台北只有點位無 GPS）
- 桃園是六都裡資料最弱的（連基本路線 GIS 都沒有）

---

## 22 縣市完整對照表

| 縣市 | 即時 GPS | 採樣頻率 | 站點 GIS | 路線 LineString | 含星期 | DB 已收 | 來源平台 |
|---|---|---|---|---|---|---|---|
| 台北 | ✗（點位含 ETA） | – | ✅ 經緯 | – | 不明 | ✅ stops 26,672 | data.taipei |
| 新北 | ✅ | 2 min | ✅ 經緯 | ✅ | ✅ 7 天 flag | ✅ stops + GPS | datagov / 環保局 |
| 桃園 | ✗ | – | ✗（僅焚化廠 POI） | ✗ | – | facilities only | datagov |
| 新竹市 | ✗ | – | 路線文字 | ✗ | 不明 | ✗ | hsinchu_city |
| 新竹縣 | ✗ | – | ✗ | ✗ | – | ✗ | 缺 portal |
| 苗栗 | ✗ | – | ✗ | ✗ | – | ✗ | miaoli portal 無垃圾車 |
| **台中** | ✅ **新發現** | 10 min | ✅ 部分含座標 | ✅「定時定點」5 天 | ✅ g_d1~d5 | ✗ 待接 | datagov / taichung |
| 彰化 | ✗ | – | ✗ | ✗ | – | ✗ | 缺 portal |
| 南投 | ✗ | – | ✗ | ✗ | – | ✗ | nantou 無垃圾車 |
| 雲林 | ✗ | – | 名冊無經緯 | ✗ | – | ✗ | 需 TGOS |
| 嘉義市 | ✗ | – | 回收商無經緯 | ✗ | – | ✗ | 需 TGOS |
| 嘉義縣 | ✗ | – | ✗ | ✗ | – | ✗ | 缺 portal |
| 台南 | ✅ | 5 min | linid 識別碼 | 路線群組 | 不明 | ✅ GPS 已上 | datagov / SOA |
| **高雄** | ✅ | 2 min | ✅ 經緯 | ✅ 38 區逐區 | 不明 | ✅ 全到 | openapi.kcg |
| 基隆 | ✗（點位含 ETA） | – | ✅ 經緯 | ✅ 班別 | ✅ 回收日 | ✅ stops | datagov |
| 宜蘭 | ✗ | – | ✅ 經緯 | ✅ APP 清運點 | ✅ 星期欄位 | ✅ stops | yilan / 環保局 |
| 花蓮 | ✗ | – | ✗ | ✗ | – | ✗ | 缺 portal |
| 台東 | ✗ | – | ✗ | ✗ | – | ✗ | 缺 portal |
| 屏東 | ✗ | – | ✗ | ✗ | – | ✗ | 缺 portal |
| 澎湖 | ✗ | – | 多鄉鎮文字 | ✗ | ✅ | ✗ | 需 TGOS |
| 金門 | ✗ | – | ✗ | ✗ | – | ✗ | 缺 portal |
| 連江 | ✗ | – | ✗ | ✗ | – | ✗ | lienchiang 無垃圾車 |

---

## DB 內現有資料層別

從 Supabase 盤點 9 個 waste_* 表，row count 級別：

```
spatial.waste_positions_realtime    675,899  ← 即時 GPS（3 城活躍）
spatial.waste_collection_stops       77,125  ← 5 縣市站點
spatial.waste_disposal_points        13,751  ← 21 縣市投放點
spatial.waste_facilities              4,609  ← 21 縣市焚化/掩埋
realtime.waste_match_attempts         4,649  ← OSRM attempt 紀錄
realtime.waste_trails_daily           3,029  ← 日軌跡（v1）
realtime.waste_trails_matched_daily   2,609  ← OSRM matched
spatial.waste_collection_routes       2,048  ← 2 縣市路線（新北/高雄）
spatial.waste_cleaning_squads           345  ← 22 縣市清潔隊地址
```

**靜態 stops 已收 5 縣市**：基隆 / 宜蘭 / 新北 / 台北 / 高雄
- 新北 26,672 站點 / 649 路線
- 高雄 32,422 站點 / 1,399 路線（route 表只有新北 + 高雄帶 LineString）
- 已有 `arrival_time` `departure_time` `weekday_pattern` 欄位（無 stop_sequence）

**即時 GPS 過去 30 天活躍 3 城**：
- 高雄 366 vehicles / 270K pings
- 新北 409 vehicles / 198K pings
- 台南 296 vehicles / 206K pings
- *（台中 / 4th GPS 城**未接**收 collector）*

**OSRM matched** 過去 7 天：高雄 + 台南（2026-05-09 高雄 183 / 台南 170 vehicles）

---

## 4 個關鍵 finding（從盤點抽出）

### 1. 真正即時 GPS 的只有 4 縣市

```
新北   2 min   datagov 122972 / 125664
台中   10 min  datagov / 台中環保局   ← user 不知道、待接
台南   5 min   datagov / soa.tainan
高雄   2 min   openapi.kcg
```

台中是「**已知資料源但 collector 沒接**」的案例。也是 Tier 1 立即 ROI 最高的 next step。

### 2. 雙北資料不對稱

User 直覺「雙北資料完整」**部分正確**：
- **新北**：站點 + 路線 + LineString + 7 天 weekday flag + 即時 GPS（最完整）
- **台北**：站點 + ETA 但**無即時 GPS**（純表定）

新北可以做「時刻表 vs GPS 誤差分析」（你提到的方向 3-c），台北只能做「時刻表視覺化」。

### 3. 環保署沒有民生垃圾車統一 API

唯一的「環境部資源循環署 - 公告事業廢棄物清運機具資料」是**事業廢棄物**（資源回收業者用），不是民生垃圾車。

**結論**：必須逐縣市串接，沒有捷徑。但統一表 schema 是 OK 的（`spatial.waste_collection_stops` + `spatial.waste_positions_realtime` 已是 city 欄位多 city design）。

### 4. 「收運出勤表」其實已經部分編碼

User 提到「永和（新北）週一/二/四/五/六收」這種資訊：
- **新北已存** 在 `waste_collection_stops.weekday_pattern`（7-day boolean / `garbageMonday/Tuesday/...`）
- 基隆有「回收日（星期幾）」
- 宜蘭有「星期欄位」
- **台北 / 台中**待確認 schema 是否已含
- **TGOS 4 城（雲林 / 嘉義市 / 新竹市 / 澎湖）**也可能含星期文字，要逐個 check schema

不需要另開「全臺 22 縣市清運出勤表」 — 用現有 stops 表 + per-city UI 過濾「週幾」即可。

---

## 推薦下一步 — MVP 三層

### Phase A（1-2 週工程，立即 ROI）

```
A1. 接台中 GPS collector
    → 多 1 個全 GPS 城市，覆蓋台中市民
    → Pattern 同 SOA platform（仿 Kaohsiung / Tainan _normalize_soa）
    → 採樣 10 min 比台南 5 min 還稀疏，trip-gap 可能要 1500-1800s

A2. 把台北 + 基隆 + 宜蘭 的 stops 接入 OSRM map-matching
    → 等等，這 3 城沒 GPS 不能 OSRM matching
    → 改方向：用「時刻表 → 沿路網模擬」（OSRM /route 從 stop A 到 stop B）
    → 視覺上跟 GPS 城類似，但用「預期時間」而不是即時位置
    → 這就是 user 提到的「火車時刻表概念」

A3. 前端加 city 切換 UI（BL-16）
    → 仿 BusGroup 的多 city toggle
    → 預設顯示：高雄 / 台南 / 新北 / 台中（GPS 4 城）
    → 切換可看靜態 4 城（台北 / 基隆 / 宜蘭 + 4 GPS 城）

A4. 新北 GPS 接 OSRM map-matching
    → 已知採樣 2 min 跟高雄一樣
    → trip-gap 600s 應該夠
    → 預期 success rate 60%+ 跟高雄 baseline 接近
```

### Phase B（2-3 週工程，TGOS 補強）

```
B1. TGOS 批次轉換 4 縣市門牌 → 經緯度
    → 用 tgos-batch-geocoding skill
    → 新竹市 / 雲林 / 嘉義市 / 澎湖
    → 跟現有 stops 表合併（city 欄位加新 city）

B2. 接這 4 城靜態時刻表（無 GPS）
    → 同 Phase A2「時刻表 → 沿路網模擬」pattern
```

### Phase C（長期，資料缺口 11 縣市）

```
C1. 手動爬 11 縣市環保局網站
    → 桃園 / 新竹縣 / 苗栗 / 彰化 / 南投 / 嘉義縣
    → 花蓮 / 台東 / 屏東 / 金門 / 連江
    → 工程量級難估，可能需要逐縣市接洽

C2. 或申請各縣市開放資料 API（公文流程）
```

### Phase D（長期，OSRM 架構升級）

```
D1. BL-11 stop-to-stop OSRM /route 取代 HMM /match
    → 對「採樣稀疏 + 駐車多」城市顯著提升 success rate
    → 對台南 / 台中（高採樣間隔）特別有用
    → 工程 1-2 天，預期 success > 90%

D2. 「時刻表 vs GPS」誤差分析（user 提到的方向 3-c）
    → 對 4 GPS 城（新北 / 台中 / 台南 / 高雄）疊加表定 stops
    → 算每 stop 的「實際到達時間 - 表定時間」差
    → 找出常誤點路線、視覺化差異
    → 這是「你的車今天會準時嗎」這種終端 user value
```

---

## 待決定議題（待 user 拍板）

1. **Phase A 順序**：先接台中 GPS（A1）vs 先做時刻表視覺化（A2）vs 先做前端切換（A3）？
2. **時刻表 → 模擬 polyline 的 design**：要顯示「預期車到」還是「動畫車跑」？
3. **TGOS 4 縣市優先序**：4 個都做還是先挑人口多的（雲林）？
4. **缺口 11 縣市的態度**：先 8 縣市 MVP 上線 vs 等資料補齊一起出？
5. **誤差分析的優先級**：vs 多接縣市，哪個對 user 更有 demo value？

---

## 參考

- 高雄 + 台南 OSRM map-matching 細節：[`waste-osrm-mapmatching-plan.md`](./waste-osrm-mapmatching-plan.md) §14-15
- 5/9-5/10 台南上線過程：BACKLOG BL-9 / BL-14 / BL-15 / BL-16
- TGOS 批次工具：tgos-batch-geocoding skill（已存在）
- catalog 搜尋細節：master_catalog.sqlite + catalog-search skill
