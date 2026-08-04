# 嵌入動態／歷史圖層（EM 系列後續）

> 2026-08-04 規劃 · **尚未動工**
> 前置：[`embeddable-map-impl.md`](./embeddable-map-impl.md)（Phase 1 已完成）· [`embed-basemap-osm.md`](./embed-basemap-osm.md)（MapLibre 路線）
> 起因：`/embed` 目前只吃 145 個靜態圖層，動態圖層一律擋掉。本檔規劃「怎麼讓動態／歷史資料也能嵌」。

## 1. 先更正兩個前提

### 1-1. 歷史 RPC **已經做了**，不是還沒做

專案已有 **20+ 支** by-day 歷史 RPC 在跑，前端歷史模式正在用：

```
get_flight_dates / get_flight_trails      get_ship_dates
get_bus_dates / get_bus_intercity_dates   get_parking_dates
get_pla_track_dates / get_pla_tracks_day  get_road_events_dates / _day
get_news_event_dates                      get_disaster_alert_dates / _day
get_waste_trails_day                      get_youbike_h3_dates
get_temperature_dates                     get_freeway_dates
get_road_congestion_dates                 get_tourist_shuttle_dates
```

### 1-2. S3 也已經有 by-day raw archive

```
s3://<bucket>/bus/archives/2026-03-01.tar.gz     （每日 50–77 MB）
s3://<bucket>/ship_ais/{2026/, archives/}
s3://<bucket>/flight_fr24/{2026/, archives/}
```

**所以「到 S3 查過去的資料」這條路是通的** —— 你的直覺正確。真正沒做的是
BACKLOG **AR-14~16**（把歷史 trails 匯出成 per-day 靜態檔），那是另一個目的（主站效能）。

## 2. 但真正的阻礙不在資料，在渲染 ⚠️

這是規劃前必須先講清楚的事。動態圖層依「怎麼畫出來的」分三類，**能不能嵌差很多**：

| 類 | 渲染方式 | 代表圖層 | `/embed` 現況 | 移植成本 |
|---|---|---|---|---|
| **A** | `overlayRegistry` + `overlayManager` | 加油站、光電、風機、充電站、地熱井… | 被白名單擋（`dynamicData`） | 🟢 **零**（做成靜態快照即自動可嵌） |
| **B** | 專屬 hook + **原生** `map.addLayer` | `plaActivity`（共機）、`earthquakeReplay` | 完全不存在於 embed | 🟡 中（MapLibre API 相容，需搬 hook） |
| **C** | **Three.js CustomLayer** | `ships`、`flights`、`rail`、`busLive` | 完全不存在於 embed | 🔴 高（embed 刻意不掛 Three.js） |

> 也就是說：就算今天把白名單放寬、把歷史資料備好，**B 和 C 類仍然畫不出來** ——
> 它們的渲染邏輯在 `App.tsx` / `src/three/`，不在 `/embed` 共用的那條路上。
>
> 你說「不嵌的可以不嵌」——那 **C 類建議直接不做**（見 §6）。

## 3. 核心提案：按需歷史快照（不是全量管線）

### 3-1. 關鍵洞察

> **嵌入不需要「所有歷史日期」，只需要「文章引用的那一天」。**

一篇談 2026-03-01 某事件的文章，永遠只需要那天的資料。所以不必做 AR-14~16 的
全量 per-day 匯出（數百 GB、nightly 排程），只要「**寫文章時凍結那一天**」。

這同時解掉 proposal §7-4 講的「文章永久 vs 資料時效」——嵌入的畫面本來就該是凍結的。

### 3-2. 架構

```
寫文章時（一次性，人工觸發）
  ├─ 指定 圖層 × 日期
  ├─ 資料來源三選一：
  │    (a) 歷史 RPC —— 該日期仍在 retention 內（最省事）
  │    (b) S3 archive —— 更早的日期，需解析 raw
  │    (c) 既有 matview —— 已聚合好的
  ├─ 產出 public/embed-snapshots/<layer>/<YYYY-MM-DD>.geojson
  └─ 走既有 deploy-assets 管線上 S3 → 容器 → nginx → Cloudflare

讀者載入嵌入頁時
  └─ 讀 CDN 靜態檔（$0，不碰 Supabase）
```

### 3-3. 前端契約

`/embed` 的解析規則加一條：**`date=` + 動態圖層 → 改讀快照路徑**

```
/embed?v=1&lng=120.2&lat=23.1&z=10&layers=plaActivity&date=2026-03-01
                                                       ↑
        → 載入 /embed-snapshots/plaActivity/2026-03-01.geojson（非 RPC）
```

快照不存在時：**靜默略過該層**（與現有 URL 解析的降級原則一致，絕不白屏）。

### 3-4. 為什麼不直接讓 embed 打歷史 RPC

| | 打 RPC | 快照 |
|---|---|---|
| Supabase egress | 隨文章流量線性成長 | **0** |
| 讀取延遲 | 併發排隊（前端上限 8） | CDN 邊緣 |
| retention 過期後 | **資料消失、文章開天窗** | 永久有效 |
| 一致性 | 上游 pipeline 改了畫面就變 | 凍結 |

最後一項最關鍵：**RPC 是活的，文章是死的**。

## 4. 分階段

### Phase A —— A 類設施圖層（最省力，先做）

12 個「其實不會動」的圖層走既有 `static-to-cdn` 機制做快照：

```
osmWindTurbines  osmSolarFarms  offshoreWindZones  geothermalWells
evChargingStations  islandPowerGrid  renewablePermitsTaipei
gasStationCpc / Fpcc / Taisugar / Other / Canonical
```

做完後 `dynamicData` 旗標拿掉 → **自動進白名單，embed 端零改動**（白名單是派生的）。
主站也順便受益（脫離 DB 併發排隊，正是 static-to-cdn 的原始目的）。

> ⚠️ 其中若有 gated 圖層仍不會進白名單（電網類多為 owner-only），這是對的。

### Phase B —— 按需歷史快照（pilot 一層）

建議 pilot 選 **`plaActivity`（共機）**：B 類但用原生 layer、有 `get_pla_tracks_day`、
有明確的「某一天」敘事價值，而且是你最近做的、最熟。

| # | 工作 |
|---|---|
| B-1 | 匯出腳本 `scripts/export/export-embed-snapshot.ts <layer> <date>` |
| B-2 | 路徑慣例 + nginx `location /embed-snapshots/` + deploy 三處接線 |
| B-3 | `/embed` 支援 `date=` → 讀快照；快照缺失靜默略過 |
| B-4 | 把 `plaActivity` 的原生 layer 定義從 hook 抽成可共用的 spec（B 類移植的樣板） |

### Phase C —— Three.js 圖層（船舶／班機／鐵路／公車）

**建議不做**。理由見 §6。

## 5. 成本

| 項目 | 成本 |
|---|---|
| 快照儲存 | 每層每日數百 KB–數 MB；走既有 S3/R2，egress 免費或已含 |
| 讀者載入 | **$0**（CDN 靜態檔） |
| 產生快照 | 一次性腳本執行；用歷史 RPC 時打一次 DB |
| S3 archive 回填 | 僅在需要超出 retention 的日期時，逐次解析 |

對照「讓 embed 直接打 RPC」：一篇 5,000 PV 的文章 × 2 MB RPC 回應 = 10 GB egress，
Pro plan 250 GB 額度撐 25 篇同級文章就見底（超出 $0.09/GB）。

## 6. 待決事項

| # | 問題 | 我的建議 |
|---|---|---|
| 1 | Phase C（Three.js 圖層）做不做 | **不做**。船舶/班機是「即時感」圖層，嵌進靜態文章的敘事價值低；移植成本卻最高（要在 embed 重建 Three.js 場景 + 動畫時鐘）。真要呈現改用「截圖 + 連結」 |
| 2 | Phase B pilot 選哪層 | **plaActivity**（共機）—— 原生 layer、有 by-day RPC、敘事性強 |
| 3 | 快照格式 | 小資料 GeoJSON；若某層單日 >5 MB 再改 PMTiles |
| 4 | 快照要不要進 git | **不要**，比照 `public/base_map/` 走 gitignore + S3 |
| 5 | 舊快照清理策略 | 先不清（檔案小、且文章會一直引用）；日後看量再議 |

## 7. 已知風險

| # | 風險 |
|---|---|
| 1 | **上游死管線**（BACKLOG BL-25）：`get_flight_trails` retention ≈9 天、`get_waste_trails_matched_day` 全日期 0 rows、`get_youbike_h3_*` mv 停更於 04-09。做快照前必須逐層實測「那一天真的查得到資料」 |
| 2 | S3 archive 是 **raw** 格式（tar.gz），解析成本比 RPC 高，且各 collector 格式不一 |
| 3 | Phase A 拿掉 `dynamicData` 旗標會改變**主站**行為（改讀 CDN）→ 需回歸測試，不是純 embed 改動 |
| 4 | 快照是凍結的：上游修正了歷史資料（如共機回填）**不會**反映到已產生的快照，需手動重產 |

## 8. 不做

- 全量 per-day 匯出管線（AR-14~16 是主站效能的事，與嵌入不同目標，不要混做）
- 讓 `/embed` 直接打任何 Supabase RPC（違反本功能的成本前提）
- 即時類圖層的嵌入（閃電／停車位／急診壅塞 —— 文章永久性與即時資料語意衝突）
