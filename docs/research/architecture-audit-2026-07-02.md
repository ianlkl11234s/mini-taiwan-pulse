# 全系統架構審計（2026-07-02）

> 範圍：data-collectors 寫入路徑 / mini-taiwan-pulse 讀取路徑 / 圖層架構可擴充性 / 重型圖層技術 / 未來功能（會員、對話介面）預留。
> 方法：5 個平行審計 agent 分頭調查後彙整。目標情境：**數百人同時使用**。

---

## 0. 總體診斷（TL;DR）

1. **上次 unhealthy 的根因已修，但結構性風險還在。** 2026-04-09 事故是「pg_cron 互撞 + Micro compute」三合一（見 INCIDENTS.md），已用 Small compute + cron 錯峰解決。但目前**所有動態資料讀取都是 client 直打 PostgREST RPC**，讀取負載隨用戶數 O(N) 放大，且讀與寫共用同一台 DB——用戶流量打掛 DB 時 collector 跟著死，這正是上線時經歷的連鎖。
2. **關鍵洞察：本站 9 成以上的「動態」資料其實是「共享快照」**——所有用戶在同一時刻要的是同一份 bus current / ship positions / 衛星 frame。這種資料本質是 broadcast，不該用 per-user DB query 服務，該走 CDN。
3. **處方核心：資料分四類（A 靜態 / B 歷史快照 / C 即時快照 / D 個人化查詢），只有 D 類允許直打 DB。** B、C 類全部搬到 S3 + Cloudflare（基建都已存在），讀取 QPS 從 O(N) 變 O(1)。
4. 圖層架構翻倍時最先炸的不是檔案行數，而是 **re-render 架構**（單一 237-key state + 無 memo）與 **App.tsx 手寫接線的靜默失敗**。解法是「layer manifest + 細粒度訂閱 store」，這個 manifest 同時就是未來對話介面的基礎。

---

## 1. 規模化數字盤點

### 讀取端（mini-taiwan-pulse）

- 46 個 loader 模組、全站 distinct RPC **123 個**（energyLoader 一檔 25 個）
- 首載設計良好：`useLayerVisibility.ts:12` DEFAULT_ON 空集合 → **訪客進站 0 RPC**
- 開層後輪詢：bus 30s、Intel tick 60s、sewer/pumb/evacuate 60s、microSensors 等 5min → **約 8–15 req/min/user**
- N=300 全開粗估 **30–75 QPS 直打 PostgREST**（Small compute：2GB RAM / 174Mbps IO）
- 重 payload：`get_ship_trails` ~27MB/date、`get_bus_trails` 8–15MB/date、衛星影像 base64 單日 ~90MB——**POST RPC 無法吃任何 CDN**，N 人 = 同份資料抓 N 次
- 快取現況：`lib/loaderCache.ts`（in-flight 去重 + TTL + LRU）僅 **22/46 loader 採用**；23 個無快取（含 audit 標紅的 freeway / temperature / youbikeH3）→ toggle off→on、切日期每次重打
- **無 client timeout / retry / backoff**：`lib/supabase.ts:41` 裸 `createClient`——DB 變慢 → 用戶重整 → 雪崩
- 靜態資產（PMTiles / GeoJSON）：S3 → nginx 同源 → Cloudflare edge cache，**可水平擴展，不是瓶頸**

### 寫入端（data-collectors）

- config 定義 **63 個 collector**（yaml 監控清冊只收 41、標 enabled 15 → **落後 ~22 個，silent fail 無人知**）
- Zeabur 主容器韌性佳：psycopg2 → Supavisor 6543、pool(2–15) + 斷路器指數退避 + 本地 buffer（3 天）+ watchdog 自殺重啟
- **VM collectors（ship_ais / waste / cdc）是無 pool、無 buffer、無 retry 的複製版**：`ship_ais_collect.py:196-208` DB 失敗只 log + exit → 該輪資料直接丟。unhealthy 情境下最先斷的就是這裡
- `supabase_writer.py` 2,246 行 god file、60+ transformer 集中一檔
- pg_cron 31 jobs 已錯峰（04-09 教訓落實）；`statement_timeout` 經 transaction pooler startup options 傳遞**是否生效待驗證**（`db.py:130-133`）

### 圖層架構

- LayerVisibility **237 keys**；App.tsx **2,631 行**（L435–1120 手寫 55 個 use*Layer 呼叫）；overlayRegistry **5,750 行 / 126 entries**；useTransportParams 2,104 行；LegendPanel 2,251 行；featureInfo 4,668 行
- 新增一層樣板成本：**5–7 個既有檔、~20 行接線** + 2–3 個新檔實質邏輯
- 護欄缺口：7 步 SOP 中 **5 步是靜默失敗**（App.tsx 漏 call hook / loader 未接 / overlayRegistry 漏 entry / click 註冊漏 / DEFAULT_ON 漏）——tsc + test 全綠但圖層永不出現

### 重型圖層

- **20 個檔案各自 `new THREE.WebGLRenderer` 包同一個 gl context**——直接違反 PRINCIPLES.md:810 自家規則（規則晚於程式碼），靠每幀 `resetState()` + 手動 blend state 存還苟活，bloom 實驗已實際踩爆過
- FlightScene：首開同步阻塞 5–10s（`customLayer.ts:9-11` 官方註解自認）、3,000+ 航班 × 3 物件 ≈ 萬級 draw call、glow `geometry.clone()` 記憶體 ×2
- ShipScene：播放時 memo key 是 `currentTime`（`ShipScene.ts:188`）→ 每幀全量 interpolate + 重寫 200k 頂點
- flight/ship/rail 可見時**無條件 `triggerRepaint()`**（暫停也逼整張地圖 60fps 重繪）
- 衛星影像：base64 經 RPC、無 CDN、主執行緒 decode
- 全 repo **零 Web Worker**

---

## 2. 圖層資料形式分類（四類 + 標準通道）

這是本次審計的核心建議：**每個 layer 必須聲明自己的資料類別，類別決定傳輸通道。**

| 類 | 特徵 | 例子 | 標準通道 | 快取 |
|---|---|---|---|---|
| **A. 靜態參考** | 不變或年更 | 行政區界、設施點位、等時圈 PMTiles | S3 + CDN（現況已達成） | immutable + `?v=` |
| **B. 歷史快照** | 按日封存後 immutable | ship/bus trails 歷史日、temperature/imagery 歷史 frames | **per-day 靜態檔（Arrow/binary/PNG）on S3 + CDN** | cache forever |
| **C. 即時快照** | 全用戶同一份、每 N 分鐘更新 | bus current、AIS current、news、alerts、衛星最新 frame、Monitor Mode 面板 | **snapshot 檔 on S3 + CDN，edge TTL = collector 頻率** | 短 TTL edge cache |
| **D. 個人化/查詢式** | 依用戶輸入而變 | click popup 明細、會員資料、對話式分析 | Supabase RPC（**唯一允許直打 DB 的類別**） | client LRU |

現況問題 = B、C 類全部走 D 類通道。搬移後：

- **C 類（snapshot-to-CDN）**：collector 寫 DB 的同時多寫一份 JSON/binary 到 S3（collector 手上本來就有資料，data-collectors 已有 S3 歸檔基建與 boto3 依賴）。Cloudflare TTL 設為更新頻率 → 300 人輪詢時 99%+ 由 edge 吃掉，**DB 只承受 collector 的寫入 + D 類查詢**。
- **B 類**：nightly job 匯出 per-day 檔上 S3。昨天的軌跡永遠不變 → cache forever。只有「今天」的資料走 RPC 或短 TTL snapshot。
- 留在 Supabase 的 RPC 儘量改 **GET**（PostgREST 對 stable function 支援 GET）讓 Cloudflare 可 cache，作為過渡手段。

**這一步是把系統從「數十人」撐到「數百人」的唯一結構解**；read replica 是最後手段，做完 B/C 搬移大概率不需要。

---

## 3. 圖層架構重構方向（回答「翻倍會出什麼問題」）

斷裂點排序（最先炸優先）：

1. **toggle 全樹 re-render**：`layerVisibility` 是 App 單一大物件 state（`useLayerVisibility.ts:27`），toggle 換 reference → App.tsx ~1,090 行內聯 JSX 全部 reconcile，MapView/Sidebar 無 memo。層數翻倍 = 線性惡化。
2. **useTransportParams 2,104 行**：每層 4 state + getControls case 全塞單 hook，任一 slider 拖動同樣全 App re-render。
3. **App.tsx 手寫接線**：55 個 hook 呼叫無註冊表驅動，「漏 call hook」無護欄。
4. **overlayRegistry 5,750 行單檔**：翻倍後破萬行。
5. types / LAYER_COLORS / SECTIONS 三處 237-key 平行清單。

重構方向（漸進、不需 big bang；G008 拆檔待辦與此對齊）：

1. **visibility / params 改細粒度訂閱 store**（照 `timeStore.ts` 已驗證的自家模式）：`useLayerVisible(key)` per-key 訂閱 → toggle 只 re-render 該層元件。**最高槓桿，先做這個。**
2. **Layer Manifest（單一真實來源）**：每層一個 declarative entry：

   ```ts
   {
     key: 'shipTrails',
     section: 'transport',
     color: '#4fc3f7',
     dataClass: 'B',            // A/B/C/D，決定傳輸通道
     source: { kind: 'perDayFile', url: ... } | { kind: 'rpc', fn: ... },
     polling?: { intervalMs: 30_000 },
     hook: useShipLayer,        // 或 overlay: registry entry
     legend?: ..., popup?: ..., params?: [...],
     description: '船舶 AIS 軌跡回放',   // 給對話介面 / LLM 用
     topics: ['海運', '交通'],
   }
   ```

   App.tsx 55 個手寫呼叫改 manifest 驅動迴圈；layerConsistency 測試改驗 manifest 完整性 → **一次消滅 5 個靜默失敗點**。新層成本從「7 步 5–7 檔」變「1 個 manifest entry + loader/hook 實質邏輯」。
3. **params 拆進 manifest**（per-layer param spec），useTransportParams 退役為 generic renderer。
4. **overlayRegistry 按 domain 機械拆檔**（低風險）。

---

## 4. 前端大量資料顯示優化（氣候手法泛化）

`climateParticleLineLayer.ts` 已驗證、可直接泛化的手法：

| 手法 | 出處 | 泛化對象 |
|---|---|---|
| Instanced rendering（每線段 8 float，上傳量 ↓87%） | :77-81, :559-579 | bus/ship trails |
| Typed array ring-history + mercator 投影快取 | :247-255, :331-339 | 任何軌跡層 |
| LOD 密度量化（zoom 自適應、4000 級距防每幀重配置） | :31-43 | 任何粒子/點層 |
| Viewport spawn culling（35% pad） | :470-494 | flight（ship 已有） |
| 預烤 RGBA UV texture + CPU 雙線性取樣（click 讀值零後端） | climateFieldSampler.ts:43-78 | real-estate 網格 |

新增（氣候層未做、重型層急需）：

1. **GPU 時間過濾（TripsLayer 模式）**：把 `currentTime` 變 shader uniform，消滅 ship/flight 播放時每幀 CPU 重建——ship-gis 已用 deck.gl TripsLayer 驗證此模式零延遲；主站不必引 deck.gl，自寫 shader 能力已存在（`src/three/shaders/`）。
2. **Renderer 合併**：常開組合（flight/ship/rail）併入單一 CustomLayer 多 group，收口點是現成的 `useThreeJsLayers.ts`。逐步淘汰 20 renderer 現況。
3. **triggerRepaint gate**：暫停/無動畫時停 RAF。
4. **FlightScene 重構**：全日靜態軌跡改 Mapbox 原生 line layer（2D 模式已有此路徑，`FlightScene.ts:102-107`）消滅 5–10s 阻塞；per-flight 物件改 instancing。
5. **Web Worker**：parse / decode / interpolation 移出主執行緒（目前全 repo 零 worker）。

---

## 5. 衛星圖層方案

現況是最該搬走的讀取路徑：base64 經 Postgres RPC、雷達單日 ~90MB、無任何 HTTP cache、主執行緒 decode。

**方案：frames 改由 collector 直接上 S3 為 PNG，DB 只存 metadata**（frame 清單 + URL + 時間戳）：

- 前端 `cwaImageryLayer.ts:93` 的 `updateImage()` 本來就吃 URL——前端幾乎零改動
- DB egress 歸零、瀏覽器原生 img decode（脫離主執行緒 base64 → Blob）、數百人共享 edge cache
- 歷史日 frames 是 B 類（immutable）→ cache forever；最新 frame 是 C 類 → TTL 10min
- 未來若要全球範圍 / 高解析：升級為 raster PMTiles 或 COG + titiler；**現階段台灣範圍全幅 PNG on CDN 就夠**，不要過早上 tile server

---

## 6. Collector 寫入端韌性修補

1. **VM collectors 補 local buffer + 下輪補寫**（最優先——unhealthy 情境下丟資料的實際位置）
2. **cross_layer_map.yaml 改由 config.py 自動生成**（消滅 22 個 collector 的監控盲區、README/yaml 兩份真相矛盾）
3. 驗證 `statement_timeout` 經 transaction pooler 是否實際生效（改為 per-transaction `SET LOCAL` 最穩）
4. supabase_writer.py transformer 按 domain 拆檔（低優先，重構週期順手做)
5. 讀寫隔離的另一半就是 §2 的 snapshot-to-CDN：讀取壓力離開 DB 後，寫入端自然安全

---

## 7. 未來功能預留

### (a) 會員功能

- **Supabase Auth 是現成路徑**（同專案、RLS、anon → authenticated 平滑升級），會員資料屬 D 類 → 唯一合理直打 DB 的流量，量小
- **前置作業：先做 D3（收窄 Exposed schemas）**——anon 目前可 REST 直讀 reference/spatial 靜態表，上 Auth 前不收窄，權限模型會亂
- 會員偏好（自選圖層組合、預設視圖）= user profile 表 + **manifest key 序列化**——manifest 再次成為基礎
- sessionTracker 已有寫入通道，會員化後沿用

### (b) 對話介面（提問 → 自動開層 + 分析）

- **Layer Manifest 就是 LLM 的 tool schema 來源**：manifest 的 `description` / `topics` / `dataClass` 欄位直接生成 function calling 定義（`show_layers(keys[])`、`set_view(...)`、`query_layer(key, filter)`）
- 分析類提問走「**分析 RPC 白名單**」：只暴露既有的 pre-aggregate 薄 RPC（Monitor Mode 的 `news_events_hourly_county_cat` 等正好是底座），**不讓 LLM 生 SQL 直打**
- 對話後端獨立部署（Supabase Edge Function 或擴充 pulse-api），LLM API key 不進 bundle；對話流量是 D 類，天然不與 broadcast 流量互擾

---

## 8. 路線圖

| Phase | 內容 | 性質 |
|---|---|---|
| **P0 止血**（天級） | supabase client 加 timeout/backoff/併發上限；23 個無快取 loader 套 loaderCache（freeway/temperature/youbikeH3 優先）；VM collector 補 buffer；G009 的 16 處 loadingRegistry | 防雪崩 |
| **P1 讀取去 DB 化**（週級） | 衛星 imagery → S3 PNG + metadata；高頻輪詢 C 類 → snapshot-to-CDN；歷史 B 類 trails → per-day 靜態檔；過渡期 RPC 改 GET 吃 Cloudflare | **O(N)→O(1)，數百人規模的結構解** |
| **P2 圖層架構**（週級） | visibility/params 細粒度訂閱 store；Layer Manifest + manifest 驅動接線 + 測試改驗 manifest；overlayRegistry/params 拆檔 | 翻倍不炸 + 對話介面地基 |
| **P3 渲染效能** | renderer 合併、FlightScene 重構、GPU 時間過濾、triggerRepaint gate、Web worker | 多層同開順暢 |
| **P4 新功能** | D3 schema 收窄 → Supabase Auth 會員 → 對話介面（吃 manifest + 分析 RPC 白名單） | 擴充 |

P1 與 P2 互相獨立可並行；P4 依賴 P2 的 manifest。

---

## 附：本次審計證據出處

- 事故史/容量：`.claude/memory/INCIDENTS.md`、`docs/supabase-optimization.md`、`docs/supabase_rpc_audit.md`、`docs/launch/00/03/08`
- 讀取路徑：`src/data/*Loader.ts`（46 檔）、`src/lib/loaderCache.ts`、`src/lib/supabase.ts:41`、`src/hooks/useLayerVisibility.ts:12`
- 寫入路徑：`data-collectors/config.py:202-268`、`storage/db.py`、`storage/supabase_writer.py`、`external/ship_ais_vm/ship_ais_collect.py:196-208`、`config/cross_layer_map.yaml`
- 圖層架構：`src/types/index.ts`（237 keys）、`src/App.tsx`（2631 行）、`src/map/overlayRegistry.ts`（5750 行）、`src/hooks/useTransportParams.ts`（2104 行）
- 重型圖層：`src/map/cwaImageryLayer.ts:59`、`src/three/ShipScene.ts:188,234,300-317`、`src/three/FlightScene.ts:205,322`、`src/map/customLayer.ts:9-11,121,203,269`、`src/map/climateParticleLineLayer.ts`
