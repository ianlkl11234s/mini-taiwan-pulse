# 架構總體改造計畫（AR 系列）

> 依據：`docs/research/architecture-audit-2026-07-02.md`（5 面向審計）
> 目標：把系統從「數十人」撐到「數百人」，同時讓圖層翻倍不炸、預留會員與對話介面。
> 建立：2026-07-02。狀態欄由各 session 更新。
> **2026-08-10 稽核對帳**：見 `docs/research/architecture-audit-2026-08-10.md`，**AR-21~26 為當前最高優先結構工程**（07-02 藥方還沒吃，`useTransportParams` 病灶又長了 60%：2,104→3,161 行）。

---

## 0. 成功指標（全計畫驗收）

| 指標 | 現況 | 目標 | 量測方式 |
|---|---|---|---|
| DB 讀取 QPS（N 個用戶開重圖層） | O(N)，300 人估 30–75 QPS | O(1)，與用戶數無關（只剩 D 類查詢） | Supabase Reports / API Gateway 圖 |
| 重 payload 重複下載 | ship 27MB × N 人 | edge cache HIT ≥ 95% | Cloudflare Analytics |
| 衛星影像 DB egress | ~90MB/日/人 | 0（全走 CDN） | Supabase egress 圖 |
| toggle 單一圖層 re-render | App 全樹 reconcile | 只 render 該層相關元件 | React DevTools Profiler |
| 新增一層的接線成本 | 5–7 檔 ~20 行 + 5 個靜默失敗點 | 1 個 manifest entry + 實質邏輯檔 | 實際新增一層驗證 |
| ship + flight + 衛星同開播放 | 主執行緒滿載 | desktop ≥ 50fps | Chrome tracing |
| Collector 在 DB outage 下 | VM 端直接丟資料 | 全部 buffer + 補寫 | 模擬斷線測試 |

---

## 1. 全景：Phase 依賴關係

```
P0 止血 ──────────────┐
                      ├──> P1 讀取去 DB 化（3 軌並行）──┐
                      ├──> P2 圖層架構（前端內部）──────┼──> P4 新功能
                      │         └──> P3 渲染效能 ───────┘
```

- P0 全部是小 PR，隨時可插隊，先做。
- **P1 與 P2 互相獨立，可交錯進行**（P1 動 data-collectors + gis-platform + loader 層；P2 動 React 層）。
- P3 依賴 P2 的部分拆檔（renderer 合併要先有乾淨的 hook 收口），但 P3-1（triggerRepaint gate）可提前。
- P4 依賴 P2 的 manifest（對話介面）與 P1 完成後的 DB 餘裕（會員）。

---

## 2. 待拍板決策（啟動對應項目前確認）

| # | 決策 | 選項 | 建議 | 影響項目 |
|---|---|---|---|---|
| D-A | C 類 snapshot 的 serving 路徑 | (1) Cloudflare R2 + custom domain（zero egress、CF 原生 cache、boto3 相容只換 endpoint）(2) nginx `proxy_pass` 反代 S3（沿用同源，最小改動）(3) CF Worker 反代 | **R2**：分鐘級更新檔案不能走現有「部署時 sync 進容器」路徑，R2 成本與整合最優 | AR-11~13 |
| D-B | B 類歷史檔格式 | (1) gzip JSON（格式同現有 RPC 回傳，前端改動最小）(2) Arrow IPC（pulse-api 已有先例，parse 快、體積小） | **混合**：ship/bus trails（8–27MB）用 Arrow；小型 per-day 資料用 gzip JSON | AR-14~15 |
| D-C | P2 manifest 遷移方式 | (1) 一次性 codemod (2) 按 sidebar section 分批 PR | **分批**：每批 tsc + test + browser 抽查全綠再下一批，風險可控 | AR-22~23 |

> 註：原審計提到「RPC 改 GET 吃 Cloudflare」的過渡手段，經確認**不可行**——`*.supabase.co` 不在自家 CF zone，要 cache 必須加反代層，成本高於直接做 snapshot-to-CDN。故從計畫移除，直接做正解。

---

## 3. Phase 0 — 止血（估 2–3 sessions，全部可立即開始）

| # | 內容 | Repo / Branch | 驗證 | 狀態 |
|---|---|---|---|---|
| AR-01 | `lib/supabase.ts` 加 fetch wrapper：timeout（30s）+ 指數退避 retry（最多 2 次，僅冪等讀取）+ 全域併發上限（~8）。失敗回 loadingRegistry 錯誤態，禁止靜默 | pulse `fix/supabase-client-resilience` | 模擬慢 RPC（devtools throttle）：不雪崩、UI 有錯誤態 | ✅ PR #46 merged 2026-07-02 |
| AR-02 | 23 個無快取 loader 套 `loaderCache`（第一批：audit 標紅 freeway / temperature / youbikeH3；第二批：其餘機械式） | pulse `perf/loader-cache-batch1`、`-batch2` | Network tab：toggle off→on、重切同日期零重複請求 | ✅ batch1 PR #47 + batch2 PR #49，均 merged |
| AR-03 | G009：16 處 Supabase RPC 補 loadingRegistry（busLoader 3 處優先） | pulse `fix/loading-registry-gaps` | `pnpm test` + 手動開層看 loading UI | ✅ PR #48 merged（實測 17 處非 16） |
| AR-04 | VM collectors 補韌性：把主 repo buffer/retry 抽成單檔可攜模組（或最小內嵌版），ship_ais / waste / cdc 三隻套上：DB 失敗 → 本地 buffer → 下輪補寫 | data-collectors `fix/vm-collector-buffer` | VM 上模擬 DB 斷線一輪：buffer 檔生成、恢復後補寫成功、無資料洞 | ✅ PR #28 merged + VM 部署驗證完成 2026-07-02（ship 三步驗證過、waste 一輪過、cdc smoke 過） |
| AR-05 | `cross_layer_map.yaml` 改由 `config.py` 自動生成（腳本 + CI/pre-commit 檢查 drift），消滅 22 個 collector 監控盲區；README 數字同步修正 | data-collectors `chore/collector-registry-sync` | 生成結果 diff 人工過目一次；daily report 跑通含新 collector | ✅ PR #30 merged（DB 實測校正 19 個 enabled + realtime_tables 補 16 表；correctional + npa_a1 於 2026-06-27 同時停寫，已用戶確認） |
| AR-06 | 驗證 `statement_timeout` 經 transaction pooler 是否生效；不生效則改 per-transaction `SET LOCAL` | data-collectors `fix/pooler-statement-timeout` | psql 實測：故意跑 35s query 確認被砍 | 🔃 PR #29 待驗收（實測原保護在 pooler 下無效——SHOW=0、pg_sleep(35) 不被砍；改 16 處寫入走 SET LOCAL，live 驗證通過）+ 後續小項：with_conn() 自訂 SQL 與長任務仍無保護 |

---

## 4. Phase 1 — 讀取去 DB 化（核心，3 軌並行，估 3–4 週的 sessions）

> 跨 repo 鐵則：**上游先動**。每軌先在 `taipei-gis-analytics/docs/handoff/<slug>.md` 開契約，再動 collector / migration，最後前端接線。

### Track A：衛星影像 → CDN（最大單項收益）

> **AR-11 全鏈 done**（2026-08-10 對帳 BACKLOG AR-11：`pulse #50 + data-collectors #32`，`data.itsmigu.com`，browser 驗收過）。AR-11e 刻意延後，見下方。

| # | 內容 | Repo | 驗證 | 狀態 |
|---|---|---|---|---|
| AR-11a | 契約：handoff doc 定義 frame 檔案路徑規則（`imagery/<dataset>/<yyyymmdd>/<hhmm>.png`）、manifest RPC schema、保留天數 | taipei-gis-analytics | handoff 三要素齊 | ✅ 2026-07-03 `docs/handoff/read-path-cdn-imagery.md`（R2 bucket mini-tw-pulse + r2.dev 開發網址已實測） |
| AR-11b | `cwa_satellite` collector 改雙寫：PNG 上 R2/S3 + DB 只寫 metadata（時間、URL、bbox）；歷史 bytea 回填腳本（DB 匯出 → 上傳 → 驗證筆數） | data-collectors `feat/imagery-cdn` | 新 frame 出現在 CDN、URL 可拉；回填後抽查 10 frames 像素一致 | ✅ PR #32 merged；backfill 21,548 張完成；Zeabur R2_* env 設定已完成（AR-11d 端到端驗收通過，實質前提成立） |
| AR-11c | migration：新 RPC `get_cwa_imagery_manifest`（薄 SELECT metadata）；舊 batch RPC 保留一版過渡 | gis-platform | `/check-rpc` < 100ms | ✅ 2026-07-03 直接 apply（image_key 欄 + RPC + GRANT）；SQL 留檔 data-collectors `docs/sql/cwa_imagery_cdn.sql`（migration 編號同步狀態以 BACKLOG AR-11 標 done 為準） |
| AR-11d | 前端 `cwaImageryLoader` 改吃 manifest + URL 直餵 `updateImage()`；LRU/prefetch 邏輯保留改 preload `<img>`；確認 loading UI | pulse `feat/imagery-cdn` | Network：全部 cache HIT、零 RPC 大 payload；timeline 播放順暢 | ✅ **完整上線 2026-07-03**：custom domain `data.itsmigu.com`（CF edge cache HIT）+ Zeabur 前端設 `VITE_IMAGERY_CDN_BASE` rebuild + browser 端到端驗收：影像走 CDN、走 `get_cwa_imagery_manifest`、舊 `get_cwa_imagery_frames_batch` 0 呼叫 |
| AR-11e | 收尾：舊 RPC 下架 + DB bytea 欄位清理（確認前端全量切換一週後） | gis-platform | egress 圖歸零 | ☐ |

### Track B：C 類即時快照 → snapshot-to-CDN

| # | 內容 | Repo | 驗證 | 狀態 |
|---|---|---|---|---|
| AR-12 | 基建：R2 bucket + custom domain + CF cache rule（TTL 按 dataset 配置表）；data-collectors 加通用 `snapshot_writer`（寫 DB 成功後上傳 JSON，failure 不阻塞 DB 寫入） | data-collectors + CF | curl snapshot URL：`cf-cache-status: HIT`、TTL 正確 | ☐ |
| AR-13a | 第一批切換（最高頻輪詢）：bus current（30s）、bus intercity current | 兩端 | 開 bus 層 5 分鐘：DB 零讀取 RPC；資料新鮮度 ≤ interval | ☐ |
| AR-13b | 第二批：Intel panel 系（60s tick 的 4–8 RPC）、sewer/pumb/evacuate、news、alerts | 兩端 | 同上，逐層驗 | ☐ |
| AR-13c | 第三批：5min/10min 級（microSensors、nuclear、powerDashboard、energyPlant、airportPax、floodIsochrone、LiveWall、satelliteConsole/maneuvers） | 兩端 | 同上 | ☐ |
| AR-13d | 前端 loader 統一抽 `snapshotLoader(url, ttl)` helper（含 loaderCache 整合），輪詢 hook 共用 | pulse | tsc + test；後續層只填 URL | ☐ |

### Track C：B 類歷史 per-day → 靜態檔

> **2026-08-10 對帳**：AR-14 匯出端 **done 2026-08-08**（data-collectors PR #47 `scripts/export_daily_trails.py`，每日 02:00 寫 `s3://…/trails/`，見 DATA_SCOPE + PB-35）。AR-15/16 供檔端**仍 open**。⚠️ **保存層 ≠ 供檔層** —— 2026-08-08 session 已明確定調「前端直讀 `trails/` 是錯的」（egress $0.114/GB）；要完成 AR-14~16 的讀取去 DB 化，仍需把日檔加工成成品包放進 CDN 供檔路徑，不是讓前端直接打保存層。

| # | 內容 | Repo | 驗證 | 狀態 |
|---|---|---|---|---|
| AR-14 | 契約：per-day 檔路徑（`trails/<dataset>/<yyyy-mm-dd>.arrow`）+ nightly export job（**collector 端直連跑**，避開 pooler 2min timeout；跑完上傳 + 校驗筆數）；回填近 30 天 | taipei-gis-analytics + data-collectors `feat/trails-static-export` | 抽 3 天：Arrow 檔筆數 = RPC 回傳筆數 | ✅ **匯出端 done 2026-08-08**（PR #47，四 dataset ships/flights/bus/bus_intercity；ships/flights 各回補 8 天、bus 系 3 天） |
| AR-15 | 前端：ship / bus / flight trails loader 改「歷史日走靜態檔（Arrow parse 進 worker，見 AR-35 可先同步 parse）、今日走 RPC」；hook LRU 保留 | pulse `feat/trails-static-load` | 切歷史日期：零 RPC、體積 < 原 payload 1/3；今日行為不變 | ☐ **供檔端未動**——`trails/` 只是保存層，前端仍不可直讀，需先補「日檔加工成 CDN 成品包」這一步 |
| AR-16 | 順手收割：youbikeH3 / freeway / temperature 歷史日同模式（audit 標紅的即時聚合就此免除） | 兩端 | `/check-rpc` 確認殘餘 RPC 只服務今日 | ☐ 依賴 AR-15 供檔層落地後才有範本可抄 |

**P1 完成定義**：模擬 50 個併發 tab 開「衛星 + 船舶 + 公車 + 新聞」，Supabase Reports 讀取 QPS < 5、egress 曲線平坦、Cloudflare HIT ≥ 95%。

---

## 5. Phase 2 — 圖層架構重構（前端內部，與 P1 交錯，估 2–3 週的 sessions）

| # | 內容 | Branch | 驗證 | 狀態 |
|---|---|---|---|---|
| AR-21 | `layerVisibilityStore`：照 `timeStore.ts` 模式建細粒度訂閱 store（`getVisibility(key)` / `subscribeKey(key, cb)` / `useLayerVisible(key)`）。過渡期與現有 App state 雙向 bridge，元件逐步改訂閱 | `perf/visibility-store` | React Profiler：toggle 單層 commit 不含無關元件；行為零變化（All Off → 逐層開抽查） | 🔃 試點分支 `perf/visibility-store`（store + bridge + 2 consumer），全量遷移待 AR-22/23 |
| AR-22 | Layer Manifest schema 定義（key/section/color/dataClass/source/polling/legend/popup/params/description/topics）+ 試點 5 層（挑近期熟悉的：real-estate、fire、bloom 系） | `feat/layer-manifest-pilot` | 試點層全部行為不變；layerConsistency 測試新增 manifest 完整性檢查 | ☐ |
| AR-23 | 全量遷移（按 sidebar section 分批，每批一 PR）：App.tsx 55 個手寫 hook 呼叫改 manifest 驅動迴圈；LAYER_COLORS / SECTIONS 從 manifest 派生，消滅三處平行清單 | `feat/layer-manifest-s1..sN` | 每批：tsc + test + browser 抽查；批間可暫停 | ☐ |
| AR-24 | params 遷移：per-layer param spec 進 manifest，`useTransportParams` 退役為 generic param store + renderer（同 AR-21 訂閱模式） | `perf/params-store` | slider 拖動只 render 該層控件 + 地圖 diff；2104 行檔刪除 | ☐ |
| AR-25 | 巨檔機械拆分（G008 收割）：overlayRegistry 按 domain 拆、LegendPanel / featureInfo 子檔化；`/new-layer` command 與 layer-onboarding skill 同步改為 manifest 流程 | `chore/split-registry` | tsc + test；`/new-layer` 產出新格式骨架 | ☐ |
| AR-26 | 護欄升級：layerConsistency 測試改以 manifest 為 SSOT 驗「loader 有接、hook/overlay 有掛、click 有註冊、dropdown ≥4 轉 select」——消滅 5 個靜默失敗點 | 併入 AR-23 各批 | 故意漏接一項 → 測試紅 | ☐ |

**P2 完成定義**：新增一個測試層只動「manifest entry + loader/hook 檔」；toggle 任一層 Profiler commit < 5ms；237 keys 三處平行清單歸一。

---

## 6. Phase 3 — 渲染效能（P2 中後段開始，估 2 週的 sessions）

| # | 內容 | Branch | 驗證 | 狀態 |
|---|---|---|---|---|
| AR-31 | **可提前**：triggerRepaint gate——暫停 / 無動畫層時停 RAF（flight/ship/rail 的無條件 `triggerRepaint()` 加條件） | `perf/repaint-gate` | 暫停時 Chrome tracing GPU 近 idle；播放行為不變 | ☐ |
| AR-32 | Renderer 合併：以 `useThreeJsLayers.ts` 為收口，flight/ship/rail 併入單一 CustomLayer multi-group（一 gl context 一 renderer，符合 PRINCIPLES L810）；其餘 17 個 Scene 分批跟進 | `perf/renderer-merge` | 三層同開：無黑屏 / blend 錯亂；每幀 `gl.getParameter` 呼叫數下降；先讀 pitfalls | ☐ |
| AR-33 | FlightScene 重構：全日靜態軌跡改 Mapbox 原生 line layer（擴 2D 既有路徑）消滅 5–10s 首開阻塞；per-flight 三物件改 InstancedMesh；glow 捨 `geometry.clone()` | `perf/flight-scene` | 首開 < 1s；3000 航班 draw call 降兩個數量級；視覺驗收 | ☐ |
| AR-34 | GPU 時間過濾（TripsLayer 模式）：ship 先行——trail 頂點帶 timestamp attribute，`currentTime` 改 shader uniform，消滅每幀 CPU interpolate + 200k 頂點重寫；flight 跟進 | `perf/gpu-time-filter` | 播放中主執行緒 scripting 時間下降 ≥ 70%；拖 timeline 零卡頓 | ☐ |
| AR-35 | Web Worker：Arrow/trail parse、imagery 預處理移出主執行緒（配合 AR-15） | `perf/parse-worker` | 載入大檔時主執行緒無 >50ms long task | ☐ |
| AR-36 | 順手：G010 FireStationScene 每幀 `new THREE.Matrix4()` 修掉 | 併入 AR-32 | — | ☐ |

**P3 完成定義**：衛星 + 船舶 + 飛航 + 新聞同開且播放，desktop ≥ 50fps、mobile 不掉出 30fps。

---

## 7. Phase 4 — 新功能（P1 + P2 完成後，估 3 週的 sessions）

| # | 內容 | 依賴 | 驗證 | 狀態 |
|---|---|---|---|---|
| AR-41 | D3 收窄 Exposed schemas：先盤點確認無其他站直讀 reference/spatial → Supabase 設定收窄為 `public` only | P1（讀取已走 CDN，收窄無痛） | 前端全功能回歸；anon REST 直讀 404 | ☐ |
| AR-42 | Supabase Auth 會員：email/OAuth 登入、`user_profiles` 表（RLS）、偏好 = manifest keys 序列化（自選圖層組、預設視圖）；sessionTracker 掛 user id | AR-41、P2 manifest | 登入/登出/偏好還原 e2e 手動流程 | ☐ **已由 BC 系列先行交付大半**——會員 P0（Google OAuth + profiles + UserAvatar，BC-1 `done`，pulse PR #52）已上線；本項未完成部分是「偏好 = manifest keys 序列化」，卡在 P2 manifest（AR-21）地基尚未落地 |
| AR-43 | 對話介面 MVP：獨立後端（Supabase Edge Function 或擴充 pulse-api）——manifest 生成 tool schema（`show_layers` / `set_view` / `query_layer`）+ 分析 RPC 白名單（Monitor Mode pre-aggregate 表為底座）；LLM key 不進 bundle | P2 manifest、AR-42（可選登入牆） | 「最近哪裡地震多」→ 自動開層 + 文字分析；白名單外 RPC 不可達 | ☐ **已由 BC 系列先行交付大半**——BYOK 對話 MVP + 資料問答（`done`，pulse PR #51；三家直連 + 白名單 tools + 13 dataset/RPC）已上線；本項未完成部分是「manifest 生成 tool schema」這條路徑，同樣卡在 AR-21 manifest 依賴 |
| AR-44 | 對話 × Monitor Mode 整合：提問結果可 pin 成 monitor 面板 | AR-43 + Monitor Mode Phase 1 | — | ☐ |

---

## 8. 執行節奏與治理

- **建議起手順序**：AR-01 → AR-02 → AR-04（止血三件套）→ 拍板 D-A → AR-11（衛星，單項收益最大）→ 之後 P1 Track B/C 與 P2 交錯。
- 每個 AR 編號 = 一個 PR（AR-23 例外，按 section 多 PR）。全部走 GitHub Flow：feat branch → `npx tsc -b` + `pnpm test` → PR 模板 → squash。
- 跨 repo 項目一律**先開 handoff**（taipei-gis-analytics/docs/handoff/），遵守上游先動順序。
- 功能檔案：P1 建 `docs/features/read-path-cdn/`、P2 建 `docs/features/layer-manifest/`、P3 建 `docs/features/render-perf/`（沿用 _TEMPLATE）。
- 本計畫狀態欄（☐→✅）由各 session 完成時更新；階段收尾跑 `/wrap-up` 同步 BACKLOG.md（AR 系列）與 STATUS.md。
- **風險控管**：P2 每批遷移保持「行為零變化」原則，發現視覺 diff 立即停批回報；P1 每軌保留舊 RPC 一版過渡，前端切換穩定一週後才下架上游。
