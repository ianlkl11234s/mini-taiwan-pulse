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

- ~~全量 per-day 匯出管線（AR-14~16 是主站效能的事，與嵌入不同目標，不要混做）~~ → **2026-08-08 翻案，見 §9 D-2**
- 讓 `/embed` 直接打任何 Supabase RPC（違反本功能的成本前提）
- 即時類圖層的嵌入（閃電／停車位／急診壅塞 —— 文章永久性與即時資料語意衝突；「凍結某日的回放」不在此限，見 §9）

## 9. 2026-08-08 增補：Phase C 翻案與定案

> Owner 拍板：重啟 Phase C（= EM-16），目標是「文章嵌入**凍結某一天**的動畫回放」。
> 依據：三份逐檔調查（本次 session），證實 §2 把 C 類標 🔴 的前提高估了成本。

### 9-1. 翻案證據（更正 §2 / §6-1）

- **計算層零成本**：`RailEngine`(171 行) + `TraTrainEngine`(314 行) + `BusEngine`(741 行) 皆純 TS，零 three / mapbox-gl / React 依賴，`update(unixSec) → 位置陣列` 可直接搬進 embed 或 Node 匯出腳本。
- **渲染層的 mapbox 執行期綁定只有一支檔案**：`src/utils/coordinates.ts`（`mapboxgl.MercatorCoordinate`）；maplibre-gl 有同名同簽名 API（`fromLngLat` / `meterInMercatorCoordinateUnits`）。`customLayer.ts` 對 mapbox-gl 是 type-only import。
- **時鐘有樣板**：`earthquakeReplayClock`（70 行 scoped external store）即「不掛全域 timeStore 的回放時鐘」先例，補 play/pause/speed 即可。
- **ships / flights 無獨立引擎**（插值寫在 Scene 檔內）→ 整套搬 Scene 反而**免去**抽取重構；2D 替代路線才需要動手術。
- Three.js bundle 成本：`three.module.min.js` 332 KB（gzip 估 ~100KB，未實測）；走 dynamic import 讓純靜態嵌入不受影響。
- ⚠️ 唯一未驗證項：本 repo 從未在 MapLibre 上實測 Three.js CustomLayer → 見 D-1 的 spike 前置。

### 9-2. 決議

| # | 決議 | 內容 |
|---|---|---|
| D-1 | 渲染器 = **Three.js 移植** | 前置 spike：MapLibre + InstancedMesh 最小 CustomLayer 實測（matrix / triggerRepaint / gl state）。FAIL 才退 2D setData 路線（`railTracks.ts` + `useRoadEventsLayer` 先例；留意「幾千 feature 逐幀 setData 卡死」前車之鑑） |
| D-2 | **啟動 nightly trails 匯出**（推翻 §8 第一條） | retention（bus ~3 天 / ships ~7 / flights ~7-9）讓「寫文章時再凍結」窗口過窄，每天不匯出都在永久流失。依 AR-14/D-B：collector 端直連 DB、`trails/<dataset>/<YYYY-MM-DD>.<arrow\|json.gz>`（大檔 Arrow、小檔 gzip JSON）、rows=0 硬性防呆。**rail 免**（`reference.daily_schedules` 永久累積）。nightly 存的是「原料鏡像」；§3-1 按需凍結原則不變，只是原料來源改為永久保存的鏡像，embed 成品包可日後隨時重做 |
| D-3 | 順序 | 共用件（時鐘/loader/白名單）→ **flights pilot**（單日 ~2MB 最簡）→ ships（Arrow + manifest 先例）→ **rail**（owner 第一篇文章目標；幾何 68MB 瘦身待量測，已平行調查）→ bus **暫緩**（渲染不做，資料照樣由 D-2 保存） |
| D-4 | 不變的鐵則 | embed 絕不打 Supabase；快照凍結原則（§3-4）；快照缺失靜默降級不白屏 |

### 9-3. 每日資料塊 vs 日期無關塊（bundle 設計原則）

軌跡/時刻表 = 每日一檔；**幾何（rail O-D 68MB、bus routes 187MB）= 日期無關的共用資產，抓一次、不進每日檔**。

### 9-4. Phase 0 結果（2026-08-08 完成）

| 項 | 結果 |
|---|---|
| **Spike：MapLibre × Three.js** | ✅ **PASS**，與 `map.project()` 數值比對誤差 ≤0.01px（z7–z10 / pitch 60 / bearing / altitude 全過）。關鍵差異：maplibre `render(gl, options)` 第二參數是物件，**必須取 `options.defaultProjectionData.mainMatrix`**（拿 `modelViewProjectionMatrix` 會靜默飛出畫面外）；`gl.canvas === map.getCanvas()` 成立，`WebGLRenderer` 掛法不變；blend 約定相同，`RailScene` 零修改。兩家 `MercatorCoordinate` 實測 bit-identical → `coordinates.ts` 改「顯式注入建構子」約 15 行（embed 不得 static import mapbox-gl；`toMercator` 手算 x 那行保留，換日線展開語意）。淺色底圖下 `AdditiveBlending` 會洗白，需換 NormalBlending。spike 檔：`spike-three-maplibre.html` + `src/spike/threeMaplibreSpike.ts` |
| **Rail 幾何瘦身量測** | 肥大主因 = 座標小數 14 位。量化 5 位 + RDP(≈11m) + 併單檔 gzip：**267 檔 68MB → 216KB；golden tracks 4.25MB → 18KB；合計 ~234KB**。採**一次性共用資產**（非每日子集：daily/master 引用的 od_track 高度重疊 177/184 檔，子集僅再省 ~60KB，CP 值低）。⚠️ **硬性約束：簡化後必須對新折線重算 `station_progress.json`**，否則列車位置系統性偏移。另：267 檔中 83 檔無任何時刻表引用（部署冗餘可清）；master_schedule 是 TDX 通用時刻表非單日真實表，凍結某日應改吃 `reference.daily_schedules` |
| **Nightly 匯出腳本** | `data-collectors/scripts/export_daily_trails.py` 完成 + dry-run 實測（2026-08-07）：ships 10,737 rows/22MB arrow、flights 4,059/0.47MB json.gz、bus 16,991/36MB arrow、intercity 4,865/12MB arrow ≈ **76MB/日、2.3GB/月**（滿一年 ~US$0.69/月，首年合計 ~US$4.5）。直連 `live.*_trails_daily`、keyset 分頁、rows=0 exit 1、today-guard、Arrow 不壓縮（arrow-js 限制）。排程建議 02:00 Taipei（依 `refreshed_at` 實測定版時間 01:00–01:20）。**未部署**（cron/requirements 待 owner 拍板） |

**Serving 鐵則（新增）**：`trails/` 前綴是**保存層**，不在 `deploy-assets/` 下、不經容器→nginx→Cloudflare。embed 只准讀「成品包」走既有 immutable CDN 路徑；**任何前端直讀 `s3://…/trails/` 都是錯的**（S3 egress $0.114/GB，一個 bus 日檔 36MB × 1,000 次載入 ≈ $4/月，超過一整年儲存費）。

**觀察項（待查）**：ships 日筆數 8 天內 17,500 → 10,737（−39%）單調下滑，可能 AIS collector 退化 → 建議開 DS-* 追蹤。

### 9-5. Phase 1 結果（2026-08-08 完成，`feat/embed-replay` 5 commits 未 push）

- **nightly 已部署**（data-collectors PR #47 squash merged）：每日 02:00 Taipei 匯出昨日 4 datasets 至 `trails/`，Telegram 🧊/🚨 告警。回補完成：ships/flights 各 8 天（07-31~08-07）、bus 系 3 天（08-05~08-07）；bus 08-04、ships/flights 07-30 已被 retention 吃掉救不回。漏跑晚上**不會自動補**，靠 Telegram 偵測 + 手動 `--backfill`。
- **前端共用件**：`coordinates.ts` 引擎注入（side-effect 模組，未注入即 throw）；`replayClock`（play/pause/speed/loop，28 tests）；`threeReplayLayer`（maplibre wrapper，mainMatrix）；three 全走 dynamic import——實測未帶回放圖層時 embed 不載 three/mapbox chunk（build grep 雙重驗證）。
- **flights pilot 上線（dev）**：`layers=flights&date=` → gzip JSON 快照 → FlightScene 回放，預設一天 ~90s loop，`h=` 起始、`p.speed` 倍速，404 靜默略過。淺色主題走 `setTheme(false)` 防 additive 洗白。tsc 過、全套測試 352/353（唯一紅為 pre-existing upstreamRegistry catalog ref，屬落雷雙源平行工作）。
- **視覺決策（owner 已接受預設）**：回放版**不畫整日靜態全軌跡**——5,718 班全路徑 additive 疊加整片白糊、同步建 mesh 阻塞數秒；只留動態尾跡（=主站 Live 模式）。若要全路徑背景，走預先烘焙的靜態 GeoJSON 疊層。
- **上生產前的兩個缺口**：(1) `embed-snapshots/flights/` 尚未接 deploy-assets/S3/nginx（快照目前僅本機、gitignored，正式站會 404 靜默跳過）；(2) flights 在 embed 無圖例 entry（Phase 2 已補）。另 follow-up：scrubber（`seek()` 已備好）。

### 9-6. Phase 2–3 結果（2026-08-08 完成，D-3 順序走完 flights→ships→rail）

| 圖層 | 快照（2026-08-06） | 型態 | 備註 |
|---|---|---|---|
| flights | 522 KB gzip JSON | 軌跡插值 | Phase 1 pilot |
| ships | **4.78 MiB** gzip JSON（12,305 列 / 738k 點） | 軌跡插值 | 座標量化 5 位（≈1.1m）為**無損**——實測量化前後 `filterGpsAnomalies` 保留/丟棄數完全相同。D-B 的 Arrow 是保存層格式；成品包以讀者下載體積與單一解析路徑為先，維持 gzip JSON |
| rail | **229 KB** gzip JSON（tra_daily 907 班 + thsr_daily 160 班 + 捷運 4 家 `*_fixed`） | **時刻表推算** | 幾何走日期無關共用資產 `public/embed-rail/rail_slim.json.gz`（358 KB）。捷運改吃 Supabase `*_fixed` 而非本地散檔：主站 fallback 實際顯示者，且實測與本地檔逐位元組相同 |

- **多層共時鐘**（Phase 2 修掉的 Phase 1 結構缺陷）：原 `startReplay` 只取第一個回放層且每次重設時鐘，`layers=flights,ships` 會讓第二層不啟動並互蓋。改為多層平行 fetch、時間範圍取**聯集**、`setRange` 只呼叫一次。實測三層共存 `speed 1038x`。
- **rail 時鐘語意**：取台北整日 00:00–24:00，**不取時刻表 min/max**——引擎是延長日制（05:50 分界，時間軸不連續），取 min/max 會漏掉整段凌晨。實測 00:30 有 52 車、08:00 有 417、18:00 有 472。
- **已知瑕疵（沿用主站，刻意不修）**：05:50 營運日分界瞬間，跨界仍在行駛的列車會閃一下消失（05:30 剩 62 車、06:00 回 99）。主站即此行為。
- **圖例**：ShipsLegend（6 類船種）、RailLegend（TRA 車種由 `TRA_TRAIN_TYPES` 推導）、FlightsLegend（單條——FlightScene 是 `idx % colors` 輪替配色無分類語意，不憑空發明分類）。三者同步移出 `layerConsistency` 的 `BASELINE_NO_LEGEND`。
- **色票單一出處**：ship 色票從 `ShipScene.ts` 移至 `src/data/shipTrails.ts`——LegendPanel 是 base bundle 的 static import，圖例若向 Scene 取色會把 three 拖進純靜態嵌入。
- **bundle 不變量持續成立**：build 後 `dist/assets/embed-*.js` 內 `WebGLRenderer`/`InstancedMesh` 出現 0 次，three 全在 lazy chunk。
- **示範頁** `demo-embed.html`：9 張卡（班機 3 變化／船舶／鐵路／兩兩與三層共存／共機快照／充電站）。rail 卡帶 `h=8`（凌晨僅 ~50–130 車，白天 400+，避免第一眼偏空）。
- **剩餘上生產缺口（三層共通，唯一阻擋文章實用）**：`embed-snapshots/{flights,ships,rail}/` 與 `public/embed-rail/` 皆未接 deploy-assets → S3 → nginx。需注意 `.json.gz` 的 `Content-Encoding: gzip` 設定，以及 `/embed-rail/` 需要自己的 nginx location。
