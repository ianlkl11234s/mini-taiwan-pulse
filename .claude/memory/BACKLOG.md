# Backlog

優先級：**P0** = 阻塞中 / **P1** = 規劃期內 / **P2** = 穩定後再做 / **P3** = nice-to-have

## 進行中 / 待辦

### 資料源健康（DS 系列，2026-08-07 斷供調查後開）

> 背景見 [`.claude/pitfalls/2026-08-07-silent-upstream-outage.md`](../pitfalls/2026-08-07-silent-upstream-outage.md)。

| ID | 優先級 | 項目 | 狀態 |
|---|---|---|---|
| DS-01 | **P1** | **台電落雷恢復後把 `LIGHTNING_EVENTS_INTERVAL` 調回 `1`** —— 端點是 1 分鐘整檔覆寫，目前 30 分鐘會漏 29/30。collector 偵測到恢復會發 Telegram 提醒，收到就做 | open（等上游） |
| DS-02 | P1 | 警政署 A1 事故上游停更 6 週（`資料提供日期` 停在 115/06/22、最新事故 06-15）。要向來源反映或找替代資料集 | open |
| DS-03 | P2 | 台電落雷向來源反映斷供（data.gov.tw nid 61139，端點 200 但永遠空檔） | open |
| DS-04 | P2 | `public.taiwan_counties` 等縣市 polygon 表**都不存在** → `refresh_lightning_daily_summary` 一直走「全國一列 county=NULL」分支，落雷彙總沒有縣市維度（既有狀況，非本次引入） | open |
| DS-05 | P3 | 共機航跡 2024-08 起 588 天全量回填（目前只驗過 2026 年 181 天）。走 analytics 的批次腳本（中位數配準），不是每日 collector（回看窗只有 30 天） | open |
| DS-06 | **P1** | **ships 日筆數 8 天內 17,500 → 7,224 單調下滑（−39%）**，疑 AIS collector 退化。2026-08-08 做 nightly trails 匯出時發現（每天的檔案越來越小）。要查 collector 端（航港局 AIS 來源／解析／寫入）還是真的船變少 | open |

### 前端小坑（2026-08-07 發現）

| ID | 優先級 | 項目 | 狀態 |
|---|---|---|---|
| FE-01 | P2 | URL 的 `p.*` 參數 `parseUrlState` 有解析（`parseParams`）但**App 端沒有任何地方套用** → 分享連結帶不了 slider 值。要嘛接上、要嘛移除死碼 | open |

### 可嵌入地圖（EM 系列，2026-08-03~05 上線；**已部署驗證**）

> **SSOT 全部移到 [`docs/features/embeddable-map/`](../../docs/features/embeddable-map/)**
> （README／backlog／changelog／handoff 四件套）。本區只留索引，**不再更新細節**。
>
> 一句話：一條網址重現畫面（相機／圖層／底圖／日期）+ `/embed` 供文章 iframe 嵌入。
> 嵌入版走 MapLibre + 自託管 Protomaps 底圖 → **不論被讀幾次都不產生 Mapbox 費用**。
>
> 💰 最反直覺的一條：**Mapbox 計費 = `Map` 初始化 = 文章 PV 數，與圖磚來源無關** ——
> 只換 OSM tile 省不到錢，必須連函式庫一起換。

| ID | 優先級 | 項目 | 狀態 |
|---|---|---|---|
| EM-21 | — | 底圖（297MB）+ 快照上 S3 並部署 | **done**（2026-08-05；正式站驗證 Mapbox 0 / Supabase 0） |
| EM-13 | — | Cloudflare 快取規則 | **done**（2026-08-05；規則內容記於 feature handoff §0b） |
| EM-23 | P2 | 行動裝置實機驗收 | open |
| EM-01~06, 09, 10, 14, 15, 19, 20 | — | 規劃／底圖／URL／`/embed`／CDN 層／歷史快照／分享面板／popup | **done** |
| EM-16 | — | Three.js 圖層嵌入（**原結論「不做」已翻案**）：flights / ships / rail 三層動態回放 + `rsys=` 系統單選 + 多層共時鐘 + 三份圖例 + 上生產供檔 | **實作完成、PR #118 待審**（2026-08-09；bus 渲染 owner 拍板暫緩 → EM-24） |
| EM-07/08/11/12/17/18/22 | P2–P3 | 加油站快照補檔、更多歷史快照層、底圖改 R2、字型自託管、facade、嵌入碼防腐、popup 標籤 | open |
| EM-24 | P2 | **bus 回放渲染**（owner 2026-08-08 拍板暫緩）。資料已由 nightly trails 每日保存，未來要做隨時有料；引擎 `BusEngine`（741 行純 TS）可直接復用 | open（暫緩，非阻塞） |
| EM-25 | P2 | 回放 scrubber（拖曳時間軸）。`replayClock.seek()` 已備好，UI 加一條 range input 即可 | open |
| EM-26 | P3 | 回放版不畫整日靜態全軌跡 —— 5,718 班全路徑 additive 疊加會**整片白糊**淹沒動畫，且同步建 mesh 阻塞主執行緒數秒。要補得改走**預先烘焙的靜態 GeoJSON 疊層**，不是把主站那套搬過來 | open |
| EM-27 | P3 | 主站「全路徑靜態軌跡」的高度漸層配色（暖橘低空→冷藍高空）是**真語意但 Live 限定**，embed 不畫。要補得另開帶顯示條件的 legend entry | open |
| EM-28 | P3 | `UrlState.hour` 註解已過時（仍寫「只影響主站時間軸」，但 EM-16 後 `h=` 會影響 embed 起播時間） | open（純註解） |
| EM-29 | P3 | `fullUrl`（「在 Mini Taiwan Pulse 開啟」）**刻意不帶 `rsys`**（主站無單系統概念）。日後主站若要支援單系統篩選，需**兩處一起補** | open（現況正確，留紀錄） |

> ⚠️ EM-17 順帶發現的既有問題：`get_gas_station_layers` 的 loader 已改用 `staticRpc`，
> 但 `public/static-rpc/` **沒有該檔** → 主站一直靜默 fallback 打 RPC（非本功能引入）。
> **2026-08-09 覆核：仍未解，現在就在付 egress。** EM 系列裡優先級最高的一項。

### 架構改造（AR 系列，2026-07-03 — 全系統審計後五階段計畫）

> SSOT：`docs/proposal/architecture-overhaul-plan.md`（審計報告 `docs/research/architecture-audit-2026-07-02.md`）。核心洞察：站上 9 成「動態」資料是共享快照，不該 per-user 打 DB，該走 CDN。目標數百人規模：讀取 QPS O(N)→O(1)。

| ID | 優先級 | 項目 | 狀態 | 備註 |
|---|---|---|---|---|
| AR-01 | P0 | Supabase client 韌性（併發上限 8 + 30s timeout + 讀取 retry） | **done** | pulse PR #46 |
| AR-02 | P0 | 無快取 loader 套 loaderCache（batch1+2 共 7 loader；其餘有理由排除） | **done** | pulse PR #47/#49 |
| AR-03 | P0 | 補 17 處缺 loadingRegistry（含 G009；公車輪詢初次才顯 loading） | **done** | pulse PR #48 |
| AR-04 | P0 | VM collectors 本地 buffer + 連線 retry（DB outage 不丟資料） | **done** | data-collectors PR #28；已 scp 部署 3 台 VM 並實測 |
| AR-05 | P0 | 監控清冊 config↔yaml 自動同步 + 回填 23 collector（19 依實測校正 enabled） | **done** | data-collectors PR #30；drift test 護欄 |
| AR-06 | P0 | statement_timeout 改 transaction 內 SET LOCAL（pooler 丟棄 startup options） | **done** | data-collectors PR #29；見 INCIDENTS 2026-07-03 |
| AR-11 | P1 | CWA 衛星/雷達影像上 R2 CDN（雙寫 + manifest RPC + flag + 21,587 backfill） | **done** | pulse #50 + data-collectors #32；`data.itsmigu.com`；browser 驗收過 |
| AR-11e | P1 | 影像收尾（穩定一週後）：清 DB 3.2GB bytea + 補 pg_cron cleanup | open | 不可逆，刻意延後至 CDN 穩定 |
| AR-11f | P2 | AQI + precip raster imagery 同套 CDN 化 | open | 同構於 AR-11，aqiImageryLoader/precipRasterLoader |
| AR-12/13 | P1 | C 類即時快照（bus current/news/alerts…）snapshot-to-CDN | open | 需 R2 + collector snapshot_writer；讀取去 DB 化主體 |
| AR-14~16 | P1 | B 類歷史 trails（ship/bus/flight）per-day 靜態檔（Arrow） | **匯出端 done 2026-08-08 / 供檔端仍 open** | 匯出：data-collectors PR #47 `scripts/export_daily_trails.py`，每日 02:00 寫 `s3://…/trails/`（見 DATA_SCOPE + PB-35）。⚠️ **但那是保存層，不是供檔層** —— 本 session 明確定調「前端直讀 `trails/` 是錯的」（egress $0.114/GB）。要完成 AR-14~16 的讀取去 DB 化，仍需把日檔加工成成品包放進 CDN 供檔路徑 |
| AR-21~26 | P2 | 圖層架構：細粒度 visibility/params store + Layer Manifest（消滅 5 靜默失敗點 + 對話介面地基） | open | 翻倍到 100+ layer 的結構解 |
| AR-31~36 | P2 | 渲染效能：renderer 合併 + FlightScene 重構 + GPU 時間過濾 + worker | open | 多層同開順暢 |
| AR-41~44 | P2 | D3 schema 收窄 → Auth 會員 → 對話介面（吃 manifest + 分析 RPC 白名單） | 部分已由 BC 系列先行 | 會員/BYOK 已上線，manifest 地基待 AR-21 |
| — | — | 後續小項：`with_conn()` 自訂 SQL 與長任務（satellite_passes/waste_match）仍無 timeout 保護 | open | AR-06 附帶發現，各自 transaction 內 SET LOCAL |

### BYOK 對話 + 會員（BC 系列，2026-07-03 上線）

| ID | 優先級 | 項目 | 狀態 | Blocker / 備註 |
|---|---|---|---|---|
| BC-1 | P1 | 會員 P0：Google OAuth + profiles + UserAvatar | **done** | PR #52；migration 270（RLS+trigger+REVOKE 防 tier 自升）；OAuth 登入端到端實測過 |
| — | — | BYOK 對話 MVP + 資料問答 | **done** | PR #51；三家直連 + 白名單 tools + 13 dataset/RPC + 顧問式 |
| — | — | Supabase 資安：public 22 + reference 6 表補 RLS | **done** | migration 271/272；realtime/spatial 由 Dashboard 收窄 Exposed schemas |
| BC-2 | P1 | P3 會員加值：會員面板 icon + user_favorites（視圖快照收藏）+ member_visits 上站統計 + chat_logs（含匿名 session_id）+ 對話歷史跨裝置 | open | 依賴 BC-1（已完成）；**細部規劃已拍板 2026-07-03 → `docs/proposal/member-features-plan.md`**（M 系列；migration 用 273/274，271/272 已被 RLS lockdown 占用） |
| BC-3 | P2 | 對話預設模型檔位改中階（Flash/Sonnet 級） | open | 實測 Gemini 2.5 Pro 遠勝 Haiku；一行改 KeySettings MODEL_OPTIONS |
| BC-4 | P1 | 部署前置：CSP header + 隱私頁 BYOK 揭露 + OAuth 網域切換 | **partial 2026-07-05** | PR #56：nginx 加 X-Frame-Options/nosniff/Referrer-Policy（enforcing）+ CSP **Report-Only**（connect-src 白名單三家 LLM+Supabase+Mapbox+CDN）；BYOK 揭露本就在 `KeySettings.tsx:284`（金鑰只存瀏覽器/不經我方/建議低額度 key）。prod header 實測全在。**剩下 BC-4a/BC-4b** |
| BC-4a | P1 | OAuth 正式網域切換（dashboard，非程式） | open | `auth.ts` 已用 `window.location.origin`（程式正確）。手動：Supabase→Auth→URL Config：Site URL + Redirect URLs 加 `https://mini-taiwan-pulse.itsmigu.com/**`（保留 `localhost:3721`）；Google Console redirect URI 確認含 `…supabase.co/auth/v1/callback`。**不做則線上 Google 登入失敗** |
| BC-4b | P2 | CSP 從 Report-Only 轉 enforcing | open | 需先 agent-browser 打線上跑全功能（地圖/對話/CCTV/新聞/直播）收 console CSP violation → 零違規後把 nginx 那行 header 名 `Content-Security-Policy-Report-Only` → `Content-Security-Policy`（另開 PR）。img/frame-src 目前放寬 `https:` 因 CCTV/新聞/YT 動態多源，勿鎖死 |
| BC-5 | P2 | police_stations 日期戳 URL 改 manifest/latest 別名 | open | 上游換版免同步 datasets.ts |
| BC-6 | P3 | Anthropic 進階檔開 extended thinking（providerOptions） | open | 深度思考 |
| BC-7 | P3 | Phase 4：站方付費免費額度（Edge Function 單 key）/ 對話 pin 成 Monitor 面板 | open | AR-43/44 |
| BC-8 | P2 | 變電所/超高壓電力線圖層開多圖層時回 0 | **done 2026-07-04** | 根因非 Supabase（anon 實測後端回滿）而是韌性層併發上限 8 的 FIFO 佇列，靜態層排在動態層後 → 冷載暫態空窗（~16s→補），非 fetch 失敗。修法 = static-to-cdn（見 SC-1），電網搬 CDN 後 settle 16s→2s。PR #54 `325bae6`，merged+部署+prod 驗證 |
| SC-1 | P3 | static-to-cdn 延後項：`get_waste_stops`（193k/56MB → 需 per-city 拆檔）+ data_catalog（per-key）+ h3_demographics_yearly（per-year）+ reservoir_context/satellite_catalog（低衝擊/已 session cache）| open | 2026-07-04；模板已成熟（PLAYBOOKS PB-27），需要時 export 清單 append 即可。詳 `docs/features/static-to-cdn/` |

### 資料資產鎖定 / 治理（OG 系列，2026-07-07 上線）

> 敏感私有圖層真鎖 + 分層治理後台。SSOT：`docs/features/owner-gated-layers/`。migration 275/276/277/278/279（gis-platform）+ 前端 PR #60/#62。安全模型：DB REVOKE anon（唯一真防線）+ 前端 gating（體驗層）+ CDN 斷源。

| ID | 優先級 | 項目 | 狀態 | 備註 |
|---|---|---|---|---|
| — | P1 | 資料真鎖（畜牧/石化/電網/電廠 34 層）+ 分層治理後台 + lock_type 分型 | **done 2026-07-07** | 前端 #60/#62 + gis #28/#30；34 層 REVOKE anon + owner 守門 + 站內後台四分頁 |
| — | P0 | 電廠 public schema 洩漏修補（all_power_plants_v 等 4 個 anon 可讀）| **done 2026-07-07** | 安全審計掃出 → migration 279；見 INCIDENTS 2026-07-07 |
| OG-1 | P2 | anon key 濫用防護 / Supabase Spend Cap 確認 | open | 機密已 RLS 鎖死，殘餘僅額度濫用。⚠️ Supabase 在自己 Cloudflare 後、不經自站 zone → 自站 CF rate limit 無效，走 Supabase Spend Cap。詳 `docs/features/owner-gated-layers/backlog.md` OG-1 |
| OG-2 | P3 | 資料新鮮度後台可編輯（admin_upsert_freshness UI）| open | 目前唯讀 |
| OG-3 | P3 | UI 鎖首個實際圖層驗收 | open | lock_type='ui' 機制就緒但無實際 ui 圖層 |
| OG-4 | P3 | powerPlants owner 存取（若需要）| open | 279 REVOKE all_power_plants_v 後 owner 也讀不到；需 owner-gated RPC 包 view |

### 水資源系統（BL 系列 — 盤點 DB 有資料但前端沒用的 Quick Wins）

| ID | 優先級 | 項目 | 狀態 | Blocker / 備註 |
|---|---|---|---|---|
| BL-1 | P1 | `river_levees` 堤防 4,222 筆上線 | **done** | 2026-04-24 完成；overlayRegistry amber line，status=待建用 case expression 淡化 |
| BL-2 | P2 | `water_protection_zones` 水源保護區 107 筆 | **done** | 2026-04-24 合併 BL-3 為「管制區 Protection」單一 toggle |
| BL-3 | P2 | `groundwater_zones` 地下水管制區 21 筆 | **done** | 2026-04-24 與 BL-2 合併，zone_kind 四色 match expression |
| BL-4 | P2 | `flood_hazard_zones` 淹水潛勢**多情境** 17,303 筆 | open | dropdown 情境 slider，目前前端只用 650mm 單情境 |
| BL-5 | P1 | 水庫點選顯示 3D 進/出流雙排日柱 | **done** | 2026-04-23 完成（commit dae1c78 / 06116e7 / 52a56ba / 6600433）|
| BL-6 | P3 | 水庫 3D 柱顯示「最新日期」標記 | open | 討論中：panel ribbon 或 Marker「最新」小字；暫停 |
| BL-7 | P3 | `reservoir_daily_ops` 04-23 停擺診斷 | open | collector / cron 4-23 後沒進新筆，需查 Zeabur log（2026-04-25 盤點時發現）|
| BL-8 | P3 | Git history 清舊 water_*.geojson 大檔 | open | 5 個檔留在 history（最大 79MB water_flood_extreme），每次 push GitHub 警告但不影響功能。.gitignore + S3 機制已正確。需 git filter-repo + force push（風險高 → 暫不做）|

### 水資源擴展（新 collector / 新 RPC）

| ID | 優先級 | 項目 | 狀態 | 備註 |
|---|---|---|---|---|
| W001 | P2 | 警戒水位視覺化 | open | 需先 seed `public.river_stations`（目前空表），再回 055 RPC 加三級警戒欄位 |
| W002 | P2 | 地下水 RPC + 前端 | **done** | 2026-04-24 完成；migration 058（latest/day/timeseries）+ useGroundwaterLayer + timeline 驅動；739 站覆蓋 |
| W003 | P3 | 枯旱預警燈號 | open | WRA dataset 36695 |
| W004 | P3 | 洩洪訊息 | open | WRA dataset 58343 |
| W005 | P3 | 水權統計 | open | data.gov.tw 36696，**非空間**表格，做指標卡/長條圖，補「用水」最大缺口 |
| W006 | P3 | 集水區敏感區（內/外 0.5km） | open | WRA 129475 / 129476 |

### 廢棄物 / OSRM map-matching（BL-9~13 — 2026-05-09 上線後新待辦）

| ID | 優先級 | 項目 | 狀態 | Blocker / 備註 |
|---|---|---|---|---|
| BL-9 | P2 | 多城市擴展 OSRM map-matching | **partial** | 2026-05-09 台南上線；env var 加台南、SQL DISTINCT ON dedup（commit `d8297f9`）、trip-gap 600→900s（commit `e937383`）、DELETE 5/8+5/9 台南 attempt 重跑驗證。**待用戶前端視覺驗證**。台南 success rate baseline ~20-45%（低於高雄 5-25pt，採樣 5min vs 2min 的硬限制；BL-11 才能根本解）。新北未驗證但 plan §15 凍結式描述其實錯誤（採樣 p50=120s 跟高雄一樣穩定）。詳見 plan §14 + §15 |
| BL-14 | P2 | 查證高雄 5/9 success 30.3% vs 5/8 49% 落差 | open | trip-gap 改 600→900 後可能誤合「短停」邊界 → trip 內出現大跳 → OSRM fail。SQL 對比 5/8 同時段 13:00-18:00 高雄 success rate 即可分辨 daily variance vs trip-gap 副作用。若是後者，考慮 per-city dict（高雄 600s / 台南 900-1500s） |
| BL-15 | P2 | ETL UNIQUE constraint + ON CONFLICT DO NOTHING | open | `spatial.waste_positions_realtime` 無 unique 約束，台南 polling 每 ~2min 重複抓 endpoint「最近 N 分鐘 GPS」→ 同 (city, vehicle_no, observed_at) 重複寫 2-4 次（全表 56,934 dup groups / 114,182 row 該刪 / 台南 60% / 新北 7% / 高雄 0.09%）。每天約 50K dup row 累積。Migration 步驟：(1) DELETE dup 保留最早 ingested_at; (2) CREATE UNIQUE INDEX (city, vehicle_no, observed_at); (3) `storage/supabase_tables.py` waste_positions 加 `upsert_key` + `upsert_strategy='do_nothing'`。Hygiene only — 不影響當下 OSRM success rate（SQL 端已用 DISTINCT ON 防禦） |
| BL-16 | P2 | 前端 useWasteLayer.ts 加台南 default + city 切換 UI | open | 目前 `useWasteLayer.ts:41` cities 預設 `["高雄市"]`，要改 `["高雄市", "臺南市"]` 才看得到台南；UI 仿 BusGroup pattern 加 city 切換 toggle。設計上已支援多城（cities 是陣列參數），純改 default + UI |
| BL-10 | P3 | PBF 月更自動化（GitHub Actions cron 每月 1 號）| open | 目前要手動 push trivial commit 觸發 Zeabur redeploy。寫 `.github/workflows/refresh-pbf.yml` 自動跑 |
| BL-11 | P3 | 評估 stop-to-stop OSRM /route 取代 HMM /match | open | 預期 success rate > 90%，但要先解 `waste_collection_stops` 沒 `stop_sequence` 欄位的問題（用 `arrival_time` 推或從 GPS 反推）。1-2 天工程 |
| BL-12 | P3 | 評估刪除 `data-collectors-ship-only-aws` Zeabur project | open | Lightsail Tokyo 機器（IP 被高雄/台南政府 API 擋）目前完全沒用。月費 $X 可省 |
| BL-13 | P2 | LegendPanel 加「沿路網」說明 | open | 區分 matched（沿馬路）vs fallback（GPS 直線）兩種視覺，給用戶看圖例 |
| BL-17 | P2 | 表定動畫沿馬路（OSRM 路徑） | open | 目前 v1 是 stops 直線插值會「穿牆」。高雄/新北 DB 已有 1399+649 LineString 可投影 stops 到 polyline；北/基/宜需打 OSRM `/route` 補。仿 GPS matched trail progress-based interpolation。預估 2-3 天 |
| BL-18 | P1 | 22 城擴展前跑 schedule sanity SQL | **done** | 2026-05-12 完成；22 城 import 後 weekday/arrival 格式都被 migration 079/080 RPC parser 涵蓋，沒新 quirks。lng 截斷 4 + 出界 5 全部由 080 sanity filter 過濾掉（migration 080 跑 18 城 routes=2,646 / stops=66K 正常） |
| BL-19 | P3 | dwell=0 + gap=0 corner case | open | 兩個都 0（total=0）時 ratio NaN，車仍卡在 p0。改用「下一段挪用」邏輯，跨 stop 借時間。罕見 case，先放著 |
| BL-21 | P3 | hwms 5 城 overlap 合進 supabase 評估 | open | `waste_collection_stops_hwms_5city_overlap.geojson` (111K stops) + `..routes_hwms_5city_overlap.geojson` (3.5K routes) 是 hwms 在 5 城範圍的部分，**目前未 import**（既有 5 城 waste 路徑保留）。hwms 路徑某些城更詳細（新北 27K→64K、臺北 4K→12K），但宜蘭反而少（12K→5K）。要研究怎麼 dedup 合併（用 stop_name + coord 雙重 key？取較詳細？）。1-2 天 |
| BL-22 | P2 | hwms flat schedule routes OSRM 沿馬路升級 | **done** | 2026-05-12 完成；A 類 287 routes 跑 OSRM /route 取 stop-to-stop 沿馬路距離（1,721 calls, 6.4min, 0 fail），寫 `spatial.waste_route_inferred_segments`（migration 084）。RPC migration 085 LEFT JOIN 該表，NULL fallback 直線×1.4。竹北019 從 4hr4min → 4hr21min（+10% 更貼真實）|
| BL-24 | P1 | `get_waste_schedule_day` pre-aggregate（48s→<1s）| **done** 2026-07-22 | `/check-rpc` 2026-07-22 實測 48.06s、來源 193k stops → 2,978 route groups，前端 30s 逾時**圖層載不出**（用戶回報的 console timeout）。每呼叫即時重算（逐列 regex + 每列 3× ST_Distance geography + 多輪 window + jsonb_agg）。結果只依 `p_dow`（7）×`p_cities`、來源靜態 → 物化成表（dow, city, route_id, …, stops jsonb）+ refresh function（資料更新時重跑，未必需每日 cron），RPC 改薄 `SELECT … WHERE dow=X`。**已上線**：gis-platform **migration 301**（ALTER 原函式→`spatial._compute_waste_schedule_day`、`spatial.waste_schedule_day_agg` 7 dow 預算表 + per-dow refresh function + plpgsql 薄 RPC，dow 0-6 讀 agg / 其餘 fallback）。apply production + 7 dow refresh（Sun 321 / Tue 2,978 …）+ **anon REST 實測 0.5s**（原 48s）。無前端改動（簽名不變）。診斷詳見 INCIDENTS 2026-07-22 事件 B |
| BL-23 | P2 | Round 4 TGOS 18,005 normalized addresses | open | 從 91K 沒對到 stops 篩出地址正常可救的 18K (排除 landmark/intersection/no_number/offshore 31K)，normalize 剝重複前綴+環保局後拆 day_008+day_009 進 `upload/v2/`（commit 待 push）。**Round 4 收完後完整流程**：(1) 更新 `12_unified_callback.py` PAIRS 加新 (result, mapping) 對 → 跑 `--commit` 補座標 (2) 跑 `30_build_split_geojson.py` 重 build 17 城 geojson (3) `DELETE FROM spatial.waste_collection_stops WHERE city NOT IN ('5城')` + `05_import` reinsert (4) **重跑 `compute_waste_inferred_segments.py`** — resume-aware 自動補新增 flat routes 的 OSRM segments（新竹市/嘉義市先前 0% 現在可能新出現 A 類 routes）(5) RPC 自動接 OSRM 不用改。詳見 `_phase11_round4_README_*.md` |
| BL-25 | P2 | 上游死管線體檢（2026-07-28 transport 交付時實測發現，**pulse 正式站同受影響**） | open | 四條：(1) `get_youbike_h3_dates`/`_snapshots` mv 停更於 04-09（3.5 個月）——youbikeFullness replay 半殘；S3 raw `youbike/archives/` 新鮮可回填，refresh cron 疑似死掉 → gis-platform 查 (2) `get_waste_trails_matched_day` 全日期 0 rows（OSRM matched pipeline 停擺）——wasteTruck replay 靠 loader fallback 走 raw day 撐著 (3) `get_flight_dates` mv 稱 117 天但 `get_flight_trails` 07-19 以前全空（trails 源表 retention ≈9 天，dates mv 沒跟上）——與 `mv_freeway_dates` 死 mv 同款（該條前 session 已發現）(4) `get_h3_demographics_yearly` res8 有 20000 筆 LIMIT（55,758 網格僅回 1/3，popCount res8 年度圖破洞）+ 民國 108 res8 僅 2,636 cells。另：waste 城市參數必須中文；臺南市 GPS 長期 0 rows、新北市反而有（362/天，pulse 寫死高雄+臺南可考慮跟進改）。修法都在 gis-platform（mv refresh cron + RPC LIMIT + collector 檢查），詳 transport `docs/proposal/transport-lite-progress.md` New Layers 節 |

### 全球氣候 GLOBAL CLIMATE（GC 系列，2026-07-02 盤點後加 — 完整清單在 `docs/features/global-climate/backlog.md`）

| ID | 優先級 | 項目 | 狀態 | 備註 |
|---|---|---|---|---|
| GC-1 | P1 | GFS/CMEMS/CAMS collector 上雲 | **done** | data-collectors PR #24（補依賴）+ #25（CMEMS 爆量修）；已驗 S3 有新檔 |
| GC-2 | P1 | 烤圖排程化 + 前端 cache-busting | **done** | data-collectors PR #26（climate_bake collector 每 6h，取 f000 實況）+ 前端 entrypoint 每 6h re-sync + PNG ?v=valid_at（PR #42） |
| GC-2b | P2 | 沙塵改烤數值通道供 popup 讀值 | open | 現為預烤色階、數值不可逆，dust 無 click 讀值 |
| GC-4/5/6 | P1 | 風場速度色階 + 三層圖例 + click 讀值 + 粒子調校 | **done** | PR #42；色階 SSOT `climateRamps.ts` |
| GC-6b/6c/6d | P1 | 粒子引擎效能 | **done** | drape 分色桶批次 / WebGL instanced + 快取 mercator / 移除 drape + zoom 自適應密度（PR #42） |
| GC-7 | P2 | 海流 bbox 擴廣域（90-180E×-15-55N）| **done（CMEMS）** | data-collectors PR #27；CAMS bbox 擴域仍 open |
| GC-8 | P2 | GFS 預報時間序列（6 leadtime 接 timeStore） | open | 從快照變 Windy 式預報播放 |
| GC-9 | P2 | PRMSL 等壓線 / 250hPa 噴流 / SST / 波浪 quick wins | open | collector 已抓、前端零接線 |
| GC-10 | P3 | 颱風作戰室 preset | open | 對應 worldmonitor-taiwan-vision D-1 |
| GC-11 | P3 | 海流 × 船舶軌跡疊圖 | open | |
| TY-1 | P1 | 颱風 loader 欄位 center_pressure→center_pressure_hpa | **done** | 圖層本來全空的元凶（PR #42） |
| TY-2 | P3 | JMA 強度資料缺（氣壓/風速） | open | bosai 端點只有位置；需另接 JMA 強度來源（data-collectors） |
| TY-4/5/6 | P1 | 現在位置圈 + 跳點斷線 + 預測/實際差異 + 資料源選擇器 + 同時刻去重 | **done** | PR #42 |

### 微氣候 / 衛星遙測（MC 系列，2026-07-31 加 — 溫度三部曲後續）

> 已上線：溫度網格 2D（#92）/ LASS 三模式（#94）/ 都市熱島 LST（#96，年更靜態）。
> 方法論 SSOT：`taipei-gis-analytics/docs/topic-research/remote_sensing/urban-heat-lst-methodology.md`。

| ID | 優先級 | 項目 | 狀態 | 備註 |
|---|---|---|---|---|
| MC-1 | P2 | 接環境部 IoT 微感測（10,983 點 = LASS 22 倍） | open | 端點已遷 `sta.colife.org.tw`（2026-07-29 實測可通；collector 註解的 sta.ci.taiwan.gov.tw 已死）。SensorThings OData；每站 PM2.5+溫濕 ~1min/筆；上游只留 2.5h rolling window 須自落庫；`areaType` 部署情境分類（工業/交通/社區/敏感，部分縣市未填）。三 repo 8 步 SOP + **落庫聚合設計必先做**（10,983 點高頻勿無腦全存）；collector TODO `fetch_moenv_iot()` 現在可解 |
| MC-2 | P3 | ECOSTRESS 夜間熱島（70m，含夜間/午後過境） | open | 補 Landsat 只有上午 10:20 的缺口；日/夜熱島對比是敘事最有力部分。需用戶註冊免費 NASA Earthdata 帳號 |
| MC-3 | P3 | LST valid-count 診斷模式 | open | PMTiles B 通道還空著，可編每像元有效觀測數；回應「坑洞成因」FAQ（方法論 §8a）；前端多一個 mix 通道 + 色帶即可 |
| MC-4 | P3 | LASS collector 補 `SiteAddr` 完整地址 | open | 原始 feed 有、`_normalize()` 沒抓 + DB 缺欄；popup 細節用。死欄位（hcho/model/gps_alt/c_d0）已盤清不做 |
| MC-5 | P3 | LST 年更（2026-10 後） | open | 納入 2026 暖季重跑 median；檔名不帶日期 → 重跑 pipeline + S3 覆蓋 + redeploy 即可零程式改動；順手核對 P2–P98 色階值域有無漂移 |

### 一般待辦

| ID | 優先級 | 項目 | 狀態 | 備註 |
|---|---|---|---|---|
| G001 | P2 | 刪 `useTransportParams` 裡的 `reservoirBubbleOpacity/Glow/Size` 殘留 slider | done | 2026-04-22 已拆 |
| G002 | P3 | `[ReservoirLayer] render #N` 改 `DEBUG_RESERVOIR` env flag 控制 | done | 2026-04-23 render loop 修掉時順手移除 |
| G003 | P3 | `public/three-showcase.html` / `public/showcase/` 去留 | open | 2026-05-25 review 確認：獨立 Three.js demo，`src/` 未引用，從 unpkg 載 three@0.160（app 用 0.172）。用戶決定**暫留原地**（已 tracked）。未來可移 `examples/three-showcase/`（連同 `docs/three-showcase-library.md`）排除 build |
| CS-1 | P3 | Code Splitting / Dynamic Import 重型依賴 | open | 對象：`mapbox-gl` / `three` / `pmtiles` / `@deck.gl/*` / `satellite.js` / `h3-js` 全部 eager import。效益：首屏 JS bundle 變小、TTI 加快（次要瓶頸，主要瓶頸已由 perf ①+② 解決）。風險：Vite chunk 邊界 / Mapbox worker 註冊時機 / PMTiles protocol 註冊順序常踩坑，需完整回歸。工時：1-2 天。觸發時機：等到出現「首頁 JS bundle 過大」用戶抱怨，或 ①+② 完成後仍想再壓首屏。**規劃源**：`/Users/migu/.claude/plans/1-2-modular-rossum.md` |
| PT-1 | P2 | 大型 GeoJSON → PMTiles 轉換（13 檔） | **done 2026-07-05（上線+prod 驗證）** | 2026-06-26 批次轉檔（234.7→75.0 MB）。**2026-07-05 PR #56 修部署上線**：先前 code 已切 `.pmtiles` 但檔案上到 S3 扁平根、pull 端 include-filter 挑不到、反被 fire glob 誤抓進 `/data/fire/` → 線上 13 層全 404（點開空白，多為預設關的冷門層故沒人回報）。修法：13 檔改走鏡像子前綴（geo 8→`deploy-assets/geo/` + agri 4/forestry 1 進 AGRI/FOREST_FILES）；pull 加 geo/ 鏡像 sync + fire glob `--exclude geo/*`。**prod 實測 13/13 → 200**。教訓：新 PMTiles 一律走鏡像子前綴，勿上扁平根（見 PRINCIPLES 部署三處接線） |
| G011 | P2 | 船舶拖尾 LOD / 降載（保留近景品質） | open | 2026-07-01 先做 B+C：時間/資料未變跳過 ShipScene rebuild + 船型顏色快取。A 暫不動以免影響目前港口近景視覺；未來若船舶仍卡，做 zoom-based LOD：低 zoom/全台視角縮短 trail duration 或加大 step，高 zoom/港口保留 1800s/10s 細節。 |
| PI-1 | P2 | 警察 isochrone 5 區邊界斷裂修正 | **done 2026-07-02** | 收尾：真根因不是 bbox 截斷（實測 5 區已有 40km overlap），是每區獨立 dissolve → concat 造成同片區域多 count 疊層。修法：`10_police_isochrone.py` 拆兩段（`--polys-only` raw + `dissolve_polys_to_final` 全域）→ `16_merge_regions.py` concat 5 區 raw → dedup by entity_id → 全域 dissolve。**同 session 意外發現 bug 2（山區 nearest_node 拉錯 4-5km）**：drive PBF osmium 過濾掉 residential → 榮興/泰崗 附近沒節點 → nearest_nodes 找 3-5 km 外主幹道節點 → polygon 漂到隔壁山谷。修：`station_polygon()` 加 500m 閾值 + fallback 圓 buffer at station 座標。全掃「polygon 不含 station」raw features 從 100+ 降到 23（<1.5%）。詳 INCIDENTS 2026-07-01/02。taipei-gis-analytics `a44f6f3`（未 push） |
| PI-2 | P3 | 離島 60 顆 substation 無 isochrone | open | 2026-07-02 全掃缺失發現：澎湖 27 + 金門 6 + 馬祖 3 + 綠島 1 + 恆春末端 2 + 本島邊界誤切 3（卯澳 lng 121.988 north bbox 外、新豐分駐所 lat 24.901 north2 bbox 外、上游 geocode 錯的綠島分駐所座標 26.22）。主要問題：`TW_MAIN_BBOX (120-122.05, 21.85-25.35)` 排除離島，且 `taiwan-drive/walk.osm.pbf` 也不含離島 OSM。修法：另抓澎湖/金門/馬祖 OSM PBF 另跑一套 pipeline，或本島邊界 3 顆微調 south/east/north bbox 各 +0.05°（後者 30 min 內可修）。優先低（4% coverage gap） |
| PS-1 | P3 | police_stations upstream geocode bug | open | 2026-07-02 發現「航空警察局綠島分駐所」座標 (121.481, **26.226**) 位於馬祖北竿附近，明顯錯（綠島正確座標應是 22.6, 121.5）。屬 taipei-gis-analytics 上游 `data/processed/police_justice/police_stations/police_stations_20260626.geojson`，需追 collector geocode 邏輯。修完後 rerun isochrone pipeline stage 2/3/4 即可（<20 min） |
| G012 | P1 | tourism D 類 3 檔 + canopy 高度 pmtiles（80MB）上 S3 | done | 2026-07-24 部署 blocker → **已解**：canopy rgb + tourism D 類 3 檔上 S3 `deploy-assets/`、FOREST_FILES 對齊 rgb 檔名（#86）、Zeabur redeploy 開機 pull 進 /data，prod 4 層實測 206/200 上線；舊 canopy_height_taiwan.pmtiles S3 物件已清 |
| G013 | P1 | KHH collector 檔 SCP 上 HiCloud VM | open | 2026-07-26 KHH1/KHH5 端點修正已 push（data-collectors `a2f158a`），但生產實跑的是 VM（210.61.15.74）cron 版、手動 SCP 不接 git；未更新前 KHH 資料停在 7/26 一次性回填。照 `external/immigration_apis_airport_vm/README` 覆蓋 `/opt/immigration-apis-airport/immigration_apis_airport_collect.py` 即生效 |
| G014 | P1 | gis-platform migration 301/318/319/320 commit + push | **done 2026-07-29** | 318/319/320 以 gis-platform PR #42（merge `6937d2b`，保留兩顆 atomic commits）收納；301 查證早已在 main（`0f2b878` 含於先前 merge）。三支 RPC/policy 自 7/26 起即在 production 運行 |
| G015 | P3 | feat/monitor-grid-layout 分支（14 commits Monitor v2）復活評估 | open | 2026-07-26 靜態網格（PR #90）只取代了其中 2 個修 bug commit；RGL 可拖曳畫布 + widget registry + 版面持久化 + 會員 gating 未被取代。若要生產環境拖拉版面再議 rebase；沙盒 Artifact + monitorLayout.ts 流程（PB-30）已滿足目前需求 |
| G016 | P2 | weather_change/.env 明文 AWS S3 key 輪替 | open | 2026-07-29 探索時發現（未進 git、僅本機磁碟，.gitignore 有擋）。輪替該組 key + 清 .env；該 repo 的 S3 舊流程 2026-02 已廢，可能可直接註銷憑證。詳 INCIDENTS 2026-07-29/31 事件 D |
| G018 | P2 | **回饋軌道資料上游：折返幾何 artifact** | open | 2026-08-08 做 rail 幾何瘦身時發現原始軌道有「來回走同一段」的折返子路徑（RDP 會壓垮、弧長系統性縮短）。具體案例：`SK-TT-ZY-0` rawIdx 1822–1828（989m→683m）、`YL-SL-ZY-0`、**`trtc/LB-1-0` rawIdx 443–448（182.7→93.9m）**。最後這條是**單一系統來源軌道**，代表問題不只出在多來源 merge 接縫 → 值得回饋 `od-batch-generator` / 軌道資料上游。另：原始 TRA 幾何含 ~0.15–0.2% 次公尺級數位化雜訊長度，簡化後折線長度反而更接近真值 |
| G019 | P3 | 267 個 `od_track` 檔中 **83 個（31%）無任何時刻表引用** | open | 2026-08-08 盤點發現。是**部署冗餘**不是使用者頻寬浪費（loader 只抓 schedule 出現的）。清理前要先確認不是「時刻表缺班次」而非「軌道多餘」 |
| G017 | P3 | CF purge 憑證入 .env（CF_ZONE_ID + Cache Purge 權限 API token） | open | 2026-07-30 人均磚換新後 edge 快取供舊 pmtiles（range request 同吃），1d TTL 才自然過期；`purge-cloudflare-cache.sh` 現成但全機無憑證。設定後換磚 SOP 尾端補跑即可立即生效。詳 INCIDENTS 2026-07-29/30 事件 B |

### 結構 / 部署 Review（2026-05-25 全專案結構審查 — G004~G010）

| ID | 優先級 | 項目 | 狀態 | 備註 |
|---|---|---|---|---|
| G004 | P1 | Docker image 瘦身：`.dockerignore` 排除 nginx 已走 /data volume 的 dist 目錄 | open | nginx.conf 把 `/geo`(280M)/`/h3`(22M)/`/rail`(101M)+根層 aviation/ship/temperature json 指向 `/data` persistent volume（`pull-deploy-assets.sh` 從 S3 拉），**dist 內這些目錄線上永遠不被讀** = 死重量，但 `.dockerignore` 沒排 `public/` → Docker image 白扛 ~400MB。安全做法：`.dockerignore` 加 `public/geo public/h3 public/rail`。⚠️ `agriculture`(254M)/`bus`(196M) **無** /data location、是從 dist 載的，要排除需先改 nginx 走 volume + S3 deploy-assets。**未動因影響部署正確性，需用戶確認** |
| G005 | P2 | waste 圖層底圖切換 (dark/light) 後消失 | open | `MapView` styledata 重建段落（~181-187）重建了 H3/pop/youbike/agriculture，但**沒重建 waste source/layer**，又被 `wasteMapboxSetupRef` flag 擋住不重跑 → 切底圖後垃圾清運圖層消失。2026-05-25 修 waste listener 洩漏時附帶發現 |
| G006 | P3 | 手機版 sidebar 多顯示項產品取捨 | open | 2026-05-25 統一 `sidebar/layerCatalog.ts` 後，手機版補上原本只桌機有的 FACILITY(學校/超商)/NEWS/海纜/雲圖雷達（修漏的副作用）。確認手機是否要全顯示，否則用 `labelMobile`/SECTIONS 過濾隱藏 |
| G007 | P3 | 移除 `@deck.gl/*` 4 套件死依賴 | open | `deckOverlay.ts` 刪除後 `@deck.gl/core,geo-layers,layers,mapbox` 已無任何 import。沒 import 不進 bundle，只影響 node_modules 大小。2026-05-25 發現 |
| G008 | P2 | 巨型檔案按 domain 拆分 | open | `App.tsx`(1945)/`overlayRegistry.ts`(1992)/`FeatureInfoPanel.tsx`(1703)/`useTransportParams.ts`(1031)/`InfoModal.tsx`(1111)。建議順序：先拆 FeatureInfoPanel（最規律低風險，按 domain 切子檔+色票進 `data/*Types.ts`）→ App.tsx（抽 `useAllLayers`/`useAppUiState`/map lifecycle hook）→ overlayRegistry（domain 片段+circle/line/fill paint 工廠）。2026-05-25 架構 review |
| G009 | P2 | 16 處 Supabase RPC 補 `loadingRegistry`（違反規則 B）| open | 優先 `busLoader.ts:69/121/211`（公車核心動態層初次/切日無 loading UI）；其餘 `*_dates`/`*_years`/`*_counts` 13 個 metadata RPC 危害低但字面違規；`railScheduleLoader.ts:26/62` 裸 fetch 同樣無 loading。2026-05-25 效能 review（規則 A time store + 規則 C realtime schema 全合規）|
| G010 | P3 | `FireStationScene.ts:180` 每幀 `new THREE.Matrix4()` | open | `animate()` 每幀分配 Matrix4，其他 Scene 都用 `this.lastMatrix` 快取；提升為 instance field 重用。2026-05-25 效能 review |
| G011 | P2 | Monitor wall mode 暫停地圖 engine | open | PR #21 效能優化跳過項。wall mode 下地圖全被蓋住但 rail / ship / Three.js 仍跑 RAF 吃 CPU。需在 `src/engines/` + `src/three/` 加 `setActive(false)` 介面，App.tsx 偵測 `monitorOpen && wall` 呼叫暫停。風險：地圖視覺凍結需 PM 確認可接受。2026-06-18 perf review |
| G012 | P3 | Monitor alertSeries24h 改增量抓 | open | 目前 cachedOnce(5min TTL)，每次重抓 24h × 6 group。理想：累積式只抓最近 5min。需動 gis-platform RPC。2026-06-18 perf review |

### Design System 未抽 token 範圍（DS 系列，2026-06-18 加 — 設計系統 6-phase 完成後刻意延後項）

詳細 rationale 見 `docs/design-system.md` §8。原則「沒有真實痛點就不抽 token」。

| ID | 優先級 | 項目 | 狀態 | 觸發時機 |
|---|---|---|---|---|
| DS-1 | P2 | Z_INDEX scale | open | 出現「panel 被 X 蓋掉」bug 時開。目前 Mapbox / panel / modal / loading 層級散在 inline 未集中 |
| DS-2 | P3 | transition / duration / easing tokens | open | 兩個動畫應該同節奏但目前不同（如所有 panel slide-in），出現一致性訴求時開 |
| DS-3 | P2 | 互動狀態色（hover / focus-ring / disabled / pressed）+ CONTROL.* 控件背景 | open | 做 button family / form UI 時自然浮現。Phase 1 codex 抓到 control bg 不該收進 SURFACE（10 處還原），未來開 CONTROL.* 群組統一 |
| DS-4 | P3 | Breakpoint tokens | open | 出現需第 3 種 viewport（平板 / 窄寬）時開。目前用 JS `isMobile` 布林分流，動態 detection 比 CSS breakpoint 靈活 |
| DS-5 | P3 | Control sizing scale（button height / icon size / hit-area） | open | 出現「為什麼這個按鈕比那個高」抱怨時開。Phase 6 抽 CloseButton 順手定 24×24 / 28×28 兩個，沒擴大為全域 scale |
| DS-6 | P3 | intelTokens.ts 退役 → designTokens 收編 | open | 目前 designTokens 單向 import intelTokens。未來要把 COLORS / FONT_DATA / GIS_LEVELS / SEV_LEVELS 等常數搬進 designTokens，intelTokens 改為純 re-export，最後刪除。⚠️ 不可反向 re-export（會 circular dep） |
| DS-7 | P3 | LayerSidebar 雙 theme 亮側套 token | open | Phase 3 只套暗側 token，亮側流量低 + 未驗證視覺保留 inline。當行動版有實際使用回饋時再做 |

### 農業（Phase 3 Batch 1，feat/water-extensions 分支）

| ID | 優先級 | 項目 | 狀態 | 備註 |
|---|---|---|---|---|
| AG-1 | P3 | Wave D 公司登記點位 3 集（45640+45618+45655） | **done 2026-05-25** | TGOS geocode 完成（60,326 點 / 562 失敗）→ 前端 3 獨立 layer 接線完成（見已完成區）。後續驗收/部署拆到 AG-6 |
| AG-6 | P2 | 農企業登記 3 layer 驗收 + 部署 | **done 2026-06-02** | (a) browser 視覺驗收（先 All Off；retail/produce zoom≥8、市場 zoom≥6）(b) `upload-deploy-assets.sh` 推 3 geojson 上 S3（gitignore）(c) Supabase import `spatial.agri_business_registrations`（overwrite，走 gis-data-onboard SOP）(d) 程式 commit。⚠️ ~34MB eager 載入，若要瘦身（座標 17 位小數 + 冗欄位）**在 taipei-gis-analytics 上游做**別在前端分叉 artifact |
| AG-2 | P3 | FTW 田區 click popup | open | 目前 38 萬 polygon 只有 confidence 屬性，單格無實用資訊故未接。若要接需要 spatial JOIN 賦予地理資訊（縣市、土壤類）才有意義 |
| AG-3 | P3 | Soil/SoilFertility 完整欄位重出評估 | open | 目前 soil_map_national 已含 8 欄、soil_fertility 含 5 欄。如果要全欄位（土壤分類 18 raw / 肥力 21 raw）PMTiles 會明顯變大（fertility 14MB → 32MB 已是部分欄位的結果）。先看是否有用戶反饋需要更多細節再決定 |
| AG-4 | P3 | crop_suitability 跨作物 overlay 視角 | open | 目前 dropdown 只能看一個作物；若要看「這塊地適合幾種作物」需要 aggregate query。屬於 nice-to-have |
| AG-5 | P2 | 分支重命名 feat/water-extensions → feat/agriculture | open | 本 session 主要做的是農業，但分支名仍寫水資源。建議重新命名或新開 feat/agriculture-batch-1 |

## 已完成（近期 10 筆）

- 2026-08-08 ✅ **nightly trails 保存層上線**（data-collectors PR #47 merged + 已部署）：四 dataset（ships/flights/bus/bus_intercity）每日 02:00 Asia/Taipei 匯出到 `s3://…/trails/`。日總量 ~76MB、首年 ~US$4.5。`rows=0` 硬性 exit 1（因 dates matview 會謊報）、today-guard、HEAD 驗證。回補 ships/flights 各 8 天、bus 系 3 天；bus 08-04 與 ships/flights 07-30 已永久救不回。詳 DATA_SCOPE §保存層 + PB-35
- 2026-08-09 ⏳ **EM-16 embed 動態回放**（PR #118 **待審**，14 commits）：翻掉 proposal §6-1「Three.js 圖層不做」的舊結論 —— 實測三顆引擎皆純 TS 零渲染依賴、MapLibre × Three.js spike 與 `map.project()` 誤差 ≤0.01px。上線 flights / ships / rail 三層回放（快照皆 2026-08-06：522KB / 4.78MiB / 229KB）+ rail 幾何 68MB→367KB（縮 190x）+ `rsys=` 系統單選 + 多層共時鐘 + 三份圖例。驗收 `tsc -b` 過、vitest **399 passed / 1 skipped / 0 failed**、bundle 內 `WebGLRenderer`/`InstancedMesh` 出現 **0** 次

- 2026-05-25 ✅ **農企業登記 3 layer 接線**（AG-1）：retail 37,430 / produce_wholesale 22,843 / wholesale_market 53（共 60,326 點 / ~34MB）。**走 `overlayRegistry`（宣告式，MapView 不用改）非 agricultureLayerFactory** — 大型 geojson 散點比照 fireHydrants。3 獨立 toggle 進 AGRICULTURE 區；色 #e91e63/#3f51b5/#ffd600；新建 `src/data/agriCompanyTypes.ts`（色/標籤 SSOT）；UX 四鐵則：opacity+scale slider / 合併圖例 AgriCompanyLegend / click popup AgriCompanyPanel（公司名稱/統編/負責人/地址/資本額/狀態，bracket notation 讀中文欄位）。`npx tsc -b` 綠（補了 IconRailSidebar LAYER_ICONS 隱藏 Record）；dev server 3 資產 HTTP 200。⏳ 驗收/S3/Supabase import/commit 見 AG-6
- 2026-05-23 ✅ **農業 Phase 3 Batch 1 完整上線**（6 PMTiles + 1 GeoJSON POI 部署到 public/agriculture/ ~215MB / FTW 既有 + agriSoil/agriSoilFertility/agriLeisureFarmZones/agriRuralRegen/agriCropSuitability/agriPOI 共 7 layer / 132 種作物 dropdown 切換 / 6 個可選取 layer 全部接 click popup [FTW 田區除外，僅 confidence 屬性無意義] / agriPOI 三類 + agriCropSuitability 4 級配色雙圖例 / 土壤肥力 6 metric 著色切換 [health/pH/OM/CEC/M3_P/M3_K] + 健康度綜合算法 + 數值分級註解 / sidebar select dropdown 門檻 > 6 → > 3 解橫向溢出 / 圖層 UX 鐵則升級 3 → 4 條完整寫進 docs/CLAUDE.md/memory）

- 2026-05-12 ✅ **22 城 hwms stops 補座標 + INSERT 進 supabase**（v1+v2 TGOS 共 7 csv ~65K 地址 callback → 補 192K stops 座標 [TGOS 103K + pre_geocoded city-match 89K]，仍 91K 缺座標。寫 12_unified_callback.py + 30_build_split_geojson.py 拆 17 城 [104K stops + 4.7K routes] + 5 城 overlap 備份 [111K stops + 3.5K routes]。05_import_to_supabase 加 --stops-file/--routes-file 參數。INSERT 不 truncate → supabase stops 77K → 182K / routes 2K → 6.7K / 5 城 → 18 城。前端 wasteScheduleLoader+useWasteScheduleLayer 預設改 ALL_22_CITIES。Migration 080 sanity filter 對新加 17 城資料一樣有效（0 出界）。RPC 跑 dow=4 共 67K stops 健康）
- 2026-05-12 ✅ **migration 080 stop coord sanity filter**（5 城 stops 中 87 outlier + 4 lng 整數截斷 + 5 出界 → RPC 三道 filter [整數 / Taiwan bbox / route 內 outlier] 自動跳過。tooltip 5min 寫死 → import Scene TRIP_BREAK_S=1500s 對齊）
- 2026-05-11 ✅ **垃圾車表定動畫 視覺統一 + expandable**（顏色淡紫 → 琥珀同 GPS、加 WasteMusicNoteScene 音符特效、wasteScheduleNote 獨立 sub-toggle、主 toggle expandable 展開 3 slider 共用 GPS paramRefs）
- 2026-05-10 ✅ **垃圾車表定動畫 (Phase 3 prototype) 上線**（5 城 1281 routes / 77K stops / dow 驅動 / 淡紫 #a78bfa 跟 GPS 圖層獨立 toggle 並存。RPC migration 079 grouped JSONB 避 PostgREST 20K cap / 7 種 source data quirks 修法 / 視覺打磨 7 方案 try-error 收斂。OSRM 整合計畫 BL-17，22 城擴展 sanity check BL-18，corner case BL-19）
- 2026-05-09 ✅ **廢棄物 OSRM map-matching pipeline 完整上線**（osrm-taiwan + osrm-proxy 兩 service / migration 074+075 / waste_match collector / 5/4-5/9 共 6 天 backfill / 1,510 success match / attempt marker 解 retry 死循環 + drain。多城市擴展計畫進 BL-9~13）
- 2026-04-26 ✅ **iot_wra 重複度檢核 SOP**（座標 + 名字 sample，不信編號系統；發現 groundwater 95% 重複 / river 16% 互補）
- 2026-04-26 ✅ **Migration 063 iot_wra 雙表 pre-aggregate**（latest 4k snapshot + daily timeline 字串編碼，仿 freeway pattern）
- 2026-04-26 ✅ **iot_wra collector 停 groundwater 子端點**（避重複；iot 5 年歷史保留在 DB）
- 2026-04-26 ✅ **前端 iotWraRiver + iotWraStructure 兩 layer**（含細項 toggle 即時/預測 + 5 類型 + LegendPanel +2 段）
- 2026-04-26 ✅ **研究報告區 docs/research/**（iot 整合研究 + 水資源 layer 故事 cookbook 兩篇）
- 2026-04-25 ✅ **Toggle 設定 4 水層 × 2 滑桿**（rain/river/groundwater/wells 的 scale + opacity，支援 setPaintProperty 熱更）
- 2026-04-25 ✅ **河川水位改 delta 著色**（跨站可比；解「timeline 拖不動 + 中南部看似沒資料」）
- 2026-04-25 ✅ **Migration 060b 河川水位降頻**（44K → 8K rows，解 PostgREST 20K cap 導致南部 103 → 1 站）
- 2026-04-25 ✅ **Migration 060 地下水井降頻 + delta_24h**（78K → 16.5K rows）
- 2026-04-25 ✅ **地下水井拆兩 toggle**（groundwaterWells 靜態 + groundwater 動態 delta 著色）
- 2026-04-25 ✅ **底圖切換 throw 修復**（styleReady helper + 6 處 guard；H3 res9/res8 loader fallback）
- 2026-04-24 ✅ **W002 地下水井**（migration 058 + useGroundwaterLayer + GroundwaterPanel，timeline 驅動，739 站）
- 2026-04-24 ✅ **BL-2+BL-3 水資源管制區**（合併 toggle，zone_kind 四色 match expression，128 polygon）
- 2026-04-24 ✅ **BL-1 堤防**（4,222 筆 MultiLineString，amber line，status=待建 case-expression 淡化）
- 2026-04-23 ✅ **BL-5 水庫 3D 進/出流雙排日柱**（初版雙柱 → 雙排 N 日柱 → 位置/高度修正）
- 2026-04-23 ✅ **Phase 2.3 Timeline 回放**（rain/river/reservoir 三層走 timeStore）
- 2026-04-23 ✅ **雨量 Mapbox heatmap**（擴散視覺 + zoom 分工）

> 更早完成項目見 git log 與 REFLECTIONS.md

### 消防 FIRE & RESCUE（feat/fire-rescue 分支，2026-05-24 上線；5/26 加救援等時圈）
- ✅ 4 layer（火災歷史/最新年度/分隊3D/消防栓）+ 分隊階級大小 + 散點/3D toggle
- ✅ **F-3 屏東補座標 done**（2026-05-26）：39 隊 Mapbox geocode 補齊 → fire_stations 677→**716**、22 縣市全。`scripts/fetch/geocode-pingtung-fire-stations.py`（門牌近似精度，見 F-6）
- ✅ **救援等時圈 `fireIsochrone` done**（2026-05-26）：路網 5/10/15 分 PMTiles + 全國聚合 + 縣市 `<select>` filter，做法見 PB-16
- ✅ **F-1 S3 deploy done 2026-07-05（prod 實測）**：backlog 舊述過度悲觀 — fire_stations.geojson(200) + fire_isochrone_coverage.pmtiles(9.7M,200) **早已在線上**；唯一真缺的是消防栓改切 `.pmtiles` 後沒上傳（前端要 `/geo/fire_hydrants.pmtiles` 卻 404），已由 PR #56 修好（見 PT-1，prod 200）
- ⏳ **FR-hydrants-expand**（P3）：消防栓資料**只有臺北市+高雄市 69,839 點**（`overlayRegistry.ts` 註解），其他縣市待補上游資料。非 bug，是 coverage gap
- ⏳ F-2（可選）分隊 3D 光柱接 pick → 點柱體也能跳 popup（目前靠底下 circle）
- ⏳ **F-5 等時圈 Phase B**：點選某分隊 → 高亮該隊個別等時圈（資料已備 `build/fire_isochrone/fire_isochrone_stations.geojson`，需切 PMTiles + setFilter by `station_id`）
- ⏳ F-6（可選）等時圈精修：pmtiles 9.3M 可調 tippecanoe 參數瘦身；屏東 geocode 為門牌近似，精度可回上游 TGOS 重做
- 💤 F-4（已移除，可選復活）火災火焰特效 FireBlazeScene（git 歷史 feat/fire-rescue 中段）

### 上線 / 部署（2026-06-02 mini-taiwan-pulse 正式上線後）

| ID | 優先級 | 項目 | 狀態 | 備註 |
|---|---|---|---|---|
| LA-1 | — | 正式上線 Zeabur（feat/fire-rescue→master，itsmigu.com + Cloudflare）| **done 2026-06-02** | 部署鏈：entrypoint 背景pull + pull改sync + agriculture接鏈 + /geo/h3/bus dist fallback + 移除/api死碼。本地 git-archive docker 攔下 4 雷。docs/launch/ 8 份 |
| LA-2 | — | 4 UI 改 + flight/ship loading + 農路/國土綠網 2 新層 + 預設視角 | **done 2026-06-02** | 全部已部署上線並驗證 |
| LA-3 | — | D1 唯讀 S3 key + Mapbox URL 限制 | **done 2026-06-02** | 用戶執行；Zeabur runtime S3 改唯讀 key |
| LA-4 | — | Cloudflare 靜態檔快取 + 404/5xx no-cache | **done 2026-06-02** | Cache Rule /geo /h3 /bus /agriculture /fire /rail + Status Code TTL |
| D3 | P1 | 收窄 Supabase PostgREST Exposed schemas（資安） | open | 移除 reference/spatial/fire/maritime/rail/safety/demographics/opendata/metadata，只留 public+graphql_public，擋 anon 直讀表（realtime 已不曝光）。**前置**：掃其他共用 gis-platform 的站（mini-taiwan-info 等）確認無 REST 直讀這些 schema。**不可撤 table grant**（74/81 RPC 是 INVOKER 會掛）。秒級可逆（加回 schema）。詳見 docs/launch/08 |
| LA-5 | P2 | deploy-assets 扁平 → 鏡像結構 + manifest 總帳 | open | 三邊同名（S3/data/nginx）+ 整夾 sync，加新大檔 0 改腳本。雙軌可逆，最後才清舊扁平物件。計畫見 docs/launch/06 |
| LA-6 | P3 | pulse-api 評估關閉省錢 | open | 前端已全走 Supabase、nginx /api 死碼已移除。確認無其他消費者後可停 pulse-api service |
| LA-7 | P2 | 上線後觀察 Supabase Dashboard + Zeabur/Mapbox 帳務 | open | 公開流量下的連線數/CPU/egress 成本；memory 有 spend cap + IO 爆表前科。設帳單警報 |

### 衛星 SPACE（SAT 系列，2026-06-13 上線後新待辦）

| ID | 優先級 | 項目 | 狀態 | Blocker / 備註 |
|---|---|---|---|---|
| SAT-1 | P2 | Satellite Intel Console panel（Phase A）| open | docs/proposal/satellite-console.md §3。右側 340px panel：§A 變軌警報區（紅 banner + 卡片 + 飛到衛星）+ §B 中國 6 群 accordion + §C 台灣 15 顆 hero 卡 + §D 即時統計（覆蓋台灣中 / 未來 6h 過台時刻）。入口取代現有 Satellite icon 行為（與 5 toggle 並存）。預估 4-6h |
| SAT-2 | P2 | §E 衛星百科卡 + §D 啟發式變軌預測（Phase B）| open | UCS catalog 完整欄位 + tle_history 30 天變軌列表 + 「下次變軌約 N±N 天，信心 X%」（必標「估算 ± 信心區間」警語，2026-06-13 拍板）。預估 3-4h |
| SAT-3 | P3 | §F 變軌前後覆蓋對比 modal（Phase C，OSINT 核心）| open | 兩張並排 mini-map：左=從 tle_history 取 prev_epoch TLE 跑 SGP4 7 天 + 右=最新 TLE 7 天。下方算「過台灣頻次 5→7 次/日 +40%」量化威脅變化。預估 3-5h，最有戲劇性 |
| SAT-4 | P3 | gis-platform migration：satellite_classified view category 對齊（Yaogan→china_yaogan etc.）| open | 目前前端 regex 拆群，view 仍只有 military/earth_obs 粗分。後端對齊後 loader 切 view 查詢即可，前端 regex 可拆掉。**並行進行不阻塞 Phase A** |
| SAT-5 | P3 | 離軌（decay）預測 | open | 用 TLE B* 拖曳係數 + 高度衰減模型，對老衛星很有戲（哪顆快燒）。Phase D 選做 |
| SAT-6 | P3 | §G 變軌串 newsEvents 故事卡 | open | 「Yaogan 12 變軌時當日新聞」交叉比對，新聞 layer by-day 接口可用。Phase D 選做 |
| SAT-7 | P3 | RAF + 線性插值補幀（10 Hz → 60 Hz 視覺）| open | 在兩次 SGP4 之間用 lerp 補幀，視覺更貼真實流動。目前 10 Hz 點移動 ≈ 0.1px/frame 已肉眼滑順，非必要 |

### 新聞事件 NEWS（NE 系列，2026-06-13/14 三輪升級後）

| ID | 優先級 | 項目 | 狀態 | 備註 |
|---|---|---|---|---|
| NE-1 | — | 階段 A 分類上色 + 圖例 + popup 中文 | **done 2026-06-13** | commit b50f6ba。7 類 (accident/crime/disaster/traffic/health/policy/other) |
| NE-2 | — | 階段 B 同鄉鎮聚合 paint + popup | **done 2026-06-13** | commit 295ca15 + migration 163。max event_count 51 (臺北市) |
| NE-3 | — | v2 三維度（gis_relevance/severity/is_event）+ 10min 排程 | **done 2026-06-13** | migration 164 + collector 9fc0c60。LLM 多判 3 欄、cron 改 10min |
| NE-4 | — | v2.5 Filter dropdown + critical 視覺強化 | **done 2026-06-14** | migration 165 + commit 292b884。4 級篩選、critical-halo、ripple 強化 |
| NE-5 | P2 | POI 級精度（北科大/台大醫院等具體場所）| open | 路線 A+B 混合（gazetteer + LLM 順手判 place_name），預估覆蓋 30-50% 新聞；工程量約 1.5 天；session 紀錄有完整規劃。先做 C-1 覆蓋率分析半天 → > 40% 才繼續 |
| NE-6 | P2 | timeline 整合 get_news_event_dates RPC | open | 目前 disasterAlerts 也沒接，比照 pattern 一起做。讓 timeline 顯示有新聞的日期 |
| NE-7 | P3 | PTT 地方板（Atom feed 共用 LLM 管線）| open | 研究報告已標 Phase 2。一手目擊訊號獨特，但訊噪比低、需更嚴去重 |
| NE-8 | P3 | sidebar「臺灣即時新聞」清單區塊 | open | 仿 docs/research 的 storyboard。critical 級事件 timeline 列表，不只地圖點 |
| NE-9 | P3 | 地方政府新聞稿 RSS（桃/中/南/高市府）| open | 補強官方第一手資訊（Google News 抓不到的）。需逐一驗證 RSS 是否還活著 |
| NE-10 | P3 | 觀察自由時報 RSS Zeabur IP 403 | open | 持續 1 週看是否改善；若不變則改走 Google News 間接（UDN/TVBS 模式） |
| NE-11 | P3 | newsEvents Telegram daily report 加 token 花費 | open | 每天日報加當日 LLM 成本 + critical 事件數 + filter 級分布，便於監控偏離 $5/月 上限 |

### Monitor Mode（MO 系列，2026-06-14 加 — 完整在 `docs/proposal/monitor-mode.md`）

**定位**：與 Explore Mode 並存的第二種 UX，從頂部 toggle 切入，底部拉起浮動面板：
左 News Feed / 右 Indicators+Live / 底部 Timeline Dock 三區。Phase 1 主吃既有
`news_events` 管線 + 新一支 pre-aggregate RPC。Phase 2+ 接國防/能源/地震/匯率等
通用信號表。

| ID | 優先級 | 項目 | 狀態 | 備註 / 估時 |
|---|---|---|---|---|
| MO-1 | P1 | **Monitor Mode 前端整體（Phase 1）** | **done** | 2026-06-16 上線（PR #18）：右上 Monitor button + 底部上拉 + Wall mode + TimelineDock + IntelCard column + IndicatorPanel |
| MO-2 | P1 | **Monitor 後端 pre-aggregate RPC** | **done** | 既有 `get_news_trending` + `get_source_health` 已足；新聞 hourly breakdown 在前端用 events array bucket（資料量小不需 pre-agg）|
| MO-3 | P2 | 信號接入 — 共機擾台 | **done** | 2026-06-17 上線：data-collectors `pla_activity_daily` + gis-platform migration 205 + `get_pla_activity_latest()` RPC（migration 210）+ 前端 SituationCards PlaCard。30 min cron |
| MO-4 | P2 | 信號接入 — 電網備轉容量 | open | 台電 Open Data，⭐⭐⭐。已進壓力指數 power signal，獨立 widget 待做 |
| MO-5 | P2 | 信號接入 — 地震即時 | **partial** | earthquake_events 已進壓力指數 signal；獨立 monitor widget 計入 AI-1 警訊整合的「地震卡」 |
| MO-6 | P3 | 信號接入 — 加權指數 / 匯率 | **done (TWSE)** | 2026-06-17 上線：TWSE 加權指數 ticker（collector twse_market_index + migration 204 + `get_market_index_now()` RPC）。匯率仍 open |
| MO-7 | P3 | 信號接入 — Cofacts 假訊息 | open | TimelineDock 「Phase 2 多軌」預留位有提到 |
| MO-8 | P3 | 信號接入 — Cloudflare Radar 連通性 | open | ⭐ |
| MO-9 | P3 | 信號接入 — 疾管署公衛週報 | **done** | 2026-06-17 上線：collector cdc_public_health_weekly + migration 206 + `get_public_health_weekly()` RPC（migration 210）+ 前端 DiseaseCard ×3。週四 11:00 跑 |
| MO-10 | P3 | 通用信號表 + Phase 2 schema 設計 | **done** | migration 207 `realtime.signals_hourly` + `pressure_index_now` + `compute_pressure_index('disaster')` cron 5min |
| MO-11 | P3 | 新聞直播嵌入 (iframe widget) | **done** | 2026-06-17 上線 LiveWall 4 格 + 14 家頻道下拉 + B1 yt_live_video_resolver collector + migration 209 + `get_yt_live_videos()` RPC。embed/<videoId> 路徑。9/13 家當下可播 |
| MO-12 | P3 | Realtime push 升級（Phase 3）| open | polling 30s → Supabase Realtime channel。仍待 |

### Monitor Mode Phase 2+ 衍生待辦（2026-06-17 加）

| ID | 優先級 | 項目 | 狀態 | 備註 |
|---|---|---|---|---|
| MO-13 | P2 | 補 3 家 YT live handle | open | 鏡新聞 @MnewsTw / 非凡 @ustvnews 目前 /live 404；中天移除。找到正確 @handle 後改 `data-collectors/collectors/yt_live_video_resolver.py` HANDLES + `LiveWall.tsx` LIVE_CHANNELS |
| MO-14 | P3 | TWSE turnover 格式漂亮化 | **done 2026-08-01** | 查證推翻原假設：`value_thousands`（上游 MIS `m` 欄）**根本不是金額而是成交股數**（千股=張；對官方 FMTQIK 四交易日 98-99% 吻合），原「應顯示 1.22 兆」是誤解，7/31 官方成交金額實為 8,877 億無任何整數單位可對上。migration 325 改為成交量顯示「1365.1 萬張」+ 前端 label「額」→「量」。`volume_lots`（`r` 欄）語意不明（vs 官方筆數比值 0.50-0.69 浮動）兩支 RPC 均不採用 |
| MO-15 | P3 | LiveWall 被擋頻道 fallback | open | 部分台後台可能關 embed（TVBS / 三立 / 東森常見），iframe 仍會跳「無法播放」。candidates：(a) 拿掉、(b) 改「另開分頁觀看」占位卡片 |
| MO-16 | P3 | 加權指數 turnover 修 + 匯率接入 | **partial** | turnover 已由 MO-14/migration 325 修畢（2026-08-01）；匯率（央行）仍未接 |
| MO-17 | P2 | 台股加權指數卡加「近 30 交易日走勢」sparkline | **done 2026-08-01（未 commit）** | 2026-08-01 盤點：資料**已夠且免新 collector** — `live.market_index_tick` 自 2026-06-16 累積 32 交易日（11,437 筆、無 retention、~400 筆/交易日雙 code）。**後端**：gis-platform 新薄 RPC `get_market_index_daily(p_days int DEFAULT 30, p_code text DEFAULT 't00.tw')` — `DISTINCT ON (台北日) … ORDER BY observed_at DESC` 取每日最後一筆當收盤（`t00.tw` 有 13:33 正式收盤 tick，勿用 IX0001.tw 停在 13:30；每列自帶 open/high/low/prev_close 可直接出日 K）。EXPLAIN 實測 7.1ms/3,816 rows 走 index → **不需 pre-aggregate**；比照 210/316 慣例 GRANT anon+authenticated + pin search_path（live.* 禁前端直打）。**前端**：`intelLoaders.ts` 加 `fetchMarketIndexHistory`（withLoading + 長 TTL，比照 power 10min 慢速 tick 勿掛 60s tick）→ `TwseTicker`（`PressureRing.tsx:91-158`）複用同檔 `Sparkline`(:160) 或 `TimeseriesSparkline` → `SituationOverview`/`MonitorPanel` 傳線 → `monitorLayout.ts:55` situationOverview 高度可能 +1。⚠️ X 軸用**交易日序列**非日曆日（週末無資料列；06-19/07-10 兩缺日容忍 gap）；歷史上限 = 2026-06-16 資料起點。順手修 MO-14 turnover 格式。**已落地 2026-08-01**：gis-platform migration 325（已 apply prod；anon 30 列 / EXPLAIN 19.9ms；close+change 對官方 FMTQIK 吻合）+ 前端 4 檔（intelLoaders 加 fetchMarketIndexHistory 10min TTL / TwseTicker open-gate 自抓 + 30D Sparkline 150×24 / SituationOverview+MonitorPanel 傳 panelOpen）。tsc 綠 + 212 test 過 + agent-browser 驗收（30 點、06-18～07-31、30 日跌綠著色正確、版面未撐壞）。已 commit 於兩 repo `feat/market-index-30d`（pulse `d1ee986`+`fcd5f32` / gis-platform `d852752`），**未 push** 待用戶拍板 |
| MO-18 | P2 | PlaCard 加「近 30 天擾台趨勢」sparkline | **done 2026-08-03（PR #104 merged）** | **已被戰情板取代** —— 30 天 sparkline 小卡整個拆成 `PlaBoard.tsx`（w5 h15，比照 erCongestion），改用近 120 天滾動百分位分級。詳 `docs/proposal/pla-situation-board.md`（原狀態：open）｜ 2026-08-01 盤點：資料**已夠免新 collector** — `live.pla_activity_daily` 每日一列 PK=report_date，2026-06-11 起 51 天**零缺日**、表僅 208 kB 無 retention → 不需 pre-aggregate。缺一支 window RPC：`get_pla_activity_range(p_days int DEFAULT 30)` 回 report_date + aircraft_sorties + plan_vessels + official_ships（⚠️ **勿 COALESCE 0**：sorties 有 4 天解析失敗 NULL，前端要畫斷點、區分「0 架次」vs「未解析」；現行 `_latest` 無差別 COALESCE 0 就在謊報）。前端照 MO-17 四檔模式：intelLoaders 型別 + loader（TTL_DAILY）/ `SituationCards.tsx` PlaCard 加 open-gate 自抓 + `Sparkline w=62 h=20`（DiseaseCard :168-184「yoy 文字＋spark 左右分置」pattern 可照抄，架次升紅降綠）/ MonitorPanel :548 傳 open / `monitorLayout.ts:57` situationCards **h 5→6**（⚠️ 下方 erCongestion :58 / prison / airportPax :61-62 的 y 要順推否則 grid 重疊）。可畫欄位：aircraft_sorties（主線，近 30 天 avg 9 / max 30 / 5 天真 0）+ plan_vessels（0 NULL 最乾淨的第二條線）；「逾越中線」與 ADIZ 分區**修好 MO-19 前不可畫**（資料全空/語意錯）。估 0.5 天 |
| MO-20 | P2 | 共機圖片版時代（~2025-02-02 以前）VLM 補數值 | **superseded 2026-08-03** | **改由表格 OCR 解決、不需 VLM**：`table_items.py`（tesseract `-l eng`，表格為中英雙語）已能抽機型與架次 → `live.pla_activity_items`（mig 333，2026 年 399 項次/178 天）。2025 以前需先跑 PA-1（原狀態：open）｜ 2026-08-01 回填實測發現：國防部通報**分兩個時代**，2025-02-03 為界。之前的通報**網頁內文是空的**，架次/共艦等數值全在「臺海周邊海、空域活動」JPG 表格圖裡（regex 無解）。已存 S3 `pla/activity_charts/` + DB `activity_chart_url`（migration 327）。待處理清單 = `activity_chart_url IS NOT NULL AND raw_text IS NULL`。**這是趨勢圖往 2025-02 以前延伸的唯一解**，併入 PT-0 Phase 4（VLM），估 <$10 / ~400 張 |
| MO-19 | P2 | pla collector 解析 bug + 歷史回填（data-collectors，跨 repo） | **done 2026-08-02（PR #41 merged 並已部署）** | **已部署止血**：Zeabur 新版上線後資料自行修復、不需回填（730 天 0 筆舊版截斷）。⚠️ 驗證部署是否生效不能看 `updated_at`（只在 INSERT 寫），要看 `raw_text` 長度 — INCIDENTS 2026-08-03 事件 A（原狀態：**done 2026-08-02（未 push）**）｜ 實際修了 **11 個** bug（原盤點 3 個）：括號句尾數字／ADIZ 頓號列舉／單架寫「1架」／第二日期無年份／無括號子句 crossed 記 0 非 NULL／raw_text 存 chrome／圖片下載 406（Accept header）。回填 **729 天零缺日**（2024-08-02～2026-07-31，正好近兩年）：文字版 544 天（架次 537/544、逾越中線 532/544、共艦 542/544 填充；adiz_central 由 **0/51 → 76 天** true）＋圖片版 185 天（待 OCR）。588 天航跡圖上 S3。近兩年統計：平均 12.4 架次/日、最高 **130 架次（2025-12-29，逾越中線 90、共艦 14）**、52 天零架次。commit 在 data-collectors `feat/pla-parse-fix-backfill` | 2026-08-01 對 mnd.gov.tw 線上頁實測發現：(1) `crossed_median_line_cnt` **51/51 全 NULL** — regex 期待「N架次逾越…中線」，實際句型「偵獲共機27架次（逾越中線進入北部、中部、西南及東部空域**22架次**）」數字在後（`pla_activity_daily.py:47`）(2) ADIZ 四布林系統性漏標 — 頓號列舉只有緊貼「空域」二字的最後一區被標 true（DB 佐證 adiz_central **0/51** 命中、7/30 四區入侵只標 eastern；:49-54）(3) `report_date` 抓第一個 ROC 日期＝「起算日」，非 migration 205 註解的「截止日」→ 前端 as_of **早一天**（:91-95）。回填：`raw_text` 只存前 2000 字全是頁面 chrome **回填不出來**，需重爬 mnd 詳細頁（plaactlist 翻頁取 nid）補 51 天。修完解鎖 MO-18 的「逾越中線」+ ADIZ 分區趨勢（軍事上最有價值維度）。歷史 report_date 修正屬不可逆資料變更需拍板 |
| PT-0 | P2 | 共機航跡圖向量化 → 5 年歷史回放圖層 | **Phase 5 done 2026-08-03（四 repo 全 merged）** | **全鏈上線**：向量化通過率 69.9% → **85.4%**（表格項次分流＋氣球圖徽抑制＋已知目標數引導重試）；migration 330~333；pulse `plaActivity` 圖層（疊加 30/60/90/120 天＋累積回放＋歷史模式）＋ Monitor 戰情板。**後續一律看 `docs/features/pla-activity/backlog.md`（PA-1~PA-8）**，本列不再更新（原狀態：**Phase 0-2 done（2026-08-02）；Phase 5 規劃完成待動工**）｜ **計畫 SSOT：`taipei-gis-analytics/docs/topic-research/defense_pla/pla-track-vectorization-plan.md`**（2026-08-01 拍板：範圍 B 全量 5 年 + 向量化為主體）。官網保存 2020-09-17 起 ~1,940 則（216 頁）；同時代底圖像素級一致 → 配準一次 + 中位數背景相減分離箭頭。Phase 0 資料保全（全量爬文 + 航跡圖上 S3 ~300-600MB）→ P1 配準 → P2 向量化 POC（**80% 正確率閘門**）→ P3 `spatial.pla_tracks` 全量 → P4 VLM 機型表 `pla_activity_types` → P5 pulse 回放圖層（比照地震回放 by-day）。MO-18/19 為其前置子集。**進度 2026-08-02**：Phase 0 完成（729 天入庫零缺日、588 航跡圖＋185 數字圖上 S3）；**Phase 2 向量化 POC 通過** —— `taipei-gis-analytics/scripts/pla_tracks/vectorize_pla_chart.py`（PIL+numpy+scipy+shapely，無 OpenCV），2024-11-08 實測反投影疊圖與原始走廊幾乎重合。配準關鍵：圖上經緯網格 + RANSAC 等距篩選 + **物理錨點 `y每度 ≈ x每度/cos(lat)`**（緯線常被台灣島/ADIZ 遮擋且混入標題筆畫與表格橫線，前三種做法都導致緯度整組偏移一格）。走廊幾何確定為 **Polygon 非 LineString**（官方畫矩形走廊）。**2026 全年批次已跑**：181 天有圖、守門通過 **116 (69.9%)**，未達上線水準。失敗隨形狀數遞增（1 項 92% → 5 項 17%）。⚠️ 守門的 ground truth 本身有瑕疵（表格「項次」不全是封閉多邊形，如空飄氣球為虛線軌跡）→ 改進方向：(a) 表格項次依類型分流（工程小效益大）(b) 用已知目標數引導密集區分割。**接手入口**：`docs/features/pla-activity/handoff.md`；方法演進與失敗紀錄：`taipei-gis-analytics/docs/topic-research/defense_pla/`（含 `_status.md`）|
| PL-1 | P2 | 共機活動區圖層上線 + 情報群組改組 | open | 規劃完成 → `docs/proposal/pla-activity-layer.md`。A 建 `spatial.pla_tracks` + 2 RPC / B 群組改名（**只需 4 處**：`layerCatalog.ts:1374` + `InfoModal.tsx:363/365-370/726-730`，theme title 無硬編碼複本）/ C 圖層本體（範本用 `useDisasterAlertLayer` 非地震回放；共機無 intraday → 只需 subscribeDate；10 個註冊點會被 tsc 或 5 支測試擋）/ D 瀏覽器驗收。**待拍板 4 項**：群組名稱（即時消息/情勢/情報）、資料範圍（先 2026 或全 588 天）、needs_review 65 天是否入表、災害示警是否搬家 |

| EQ-1 | P3 | 地震回放後續 7 項（海嘯註記/flyTo/ripple↔回放銜接鈕/沙灘球平滑化/A 修訂解驗證/town autovacuum 觀察/清單成長 UX） | open | SSOT：`docs/features/earthquake-replay/backlog.md`。回放素材自動累積已實證（每起有感 1~2 個 15min cycle 進庫，官方源只留最新 → 本庫唯一歷史）；PL-1/PT-0 寫的「比照地震回放」範本即本 feature（`docs/features/earthquake-replay/`）|

### AI 警訊整合（AI 系列，2026-06-17 加 — 規劃完整在 `docs/proposal/alerts-integration-impl.md`）

**定位**：把 NCDR 災害示警（5 群組）+ CWA 地震整合進 IntelPanel + Monitor。設計師 v2 已交稿，5 個新元件（AlertSummaryBar / FeedTabs / AlertCard / AlertBoard / AlertsTrack）+ migration 211（3 RPC）+ alertsLoader.ts。**handoff doc 自帶 task list、設計 URL、Verification walkthrough — 另一 session 接手即用**。

| ID | 優先級 | 項目 | 狀態 | 備註 / 估時 |
|---|---|---|---|---|
| AI-1 | P1 | **警訊整合 Phase 1（NCDR + 地震）** | open | impl doc 12 顆 task：migration 211 + tokens + loader + 5 元件 + 4 檔接線 + browser walkthrough。**估 4-5 hr** |
| AI-2 | P2 | 地圖警報點 visual 重整（B2 方案）| open | alert 圓點 +60% size + 白邊 2.5px + active pulse 動畫，避免跟新聞圓點混淆。`useDisasterAlertLayer.ts` paint 微調 + earthquakes layer 對齊 |
| AI-3 | P3 | 警報統計接 pressure index signal | open | 已有 signals_hourly framework，加 alert_count + alert_severe signal |

### 規劃文件總覽（2026-06-17 更新）

| 文件 | 對應 backlog | 狀態 |
|---|---|---|
| `docs/proposal/satellite-console.md` | SAT-1~7 | Phase 0 衛星圖層已上線，Phase A-D 規劃完成待動工 |
| `docs/proposal/monitor-mode.md` | MO-1~12 | Phase 1 + Phase 2 大半已上線（PR #18） |
| `docs/proposal/monitor-mode-phase2-handoff.md` | MO-3/6/9/11 | 3 個 collector + LiveWall 全部上線 ✅ |
| `docs/proposal/alerts-integration-handoff.md` | AI-1 | 設計需求說明，設計師已交 v2 ✅ |
| `docs/proposal/alerts-integration-impl.md` | AI-1 | 完整實作交接，待另一 session 接手 |
| `docs/energy-v2-plan.md` | E-A~E-F | Energy v2 6 大塊完整規劃（2026-06-19 PR #24） |

### 能源 ENERGY v2（E 系列，2026-06-19 加 — 完整在 `docs/energy-v2-plan.md`）

> v1.0~v1.3.5 已 merged（PR #23 + #10）：4 layer 上線（電廠 / 機組即時出力 / 變電所 / 充電站）+ popup + 24h sparkline + timeline scrub + sliders + retired 標記。下波 6 大塊：

| ID | 優先級 | 項目 | 狀態 | Blocker / 備註 |
|---|---|---|---|---|
| E-A | **P1** | Monitor 整合 — HUD 燈號 + 4 區 bars + 14 廠 sparkline 都搬 monitor PowerCard | **done** | 2026-06-19 feat/energy-v2-A commits d6a2db3 + 24026c4。PowerCard 三層（燈號頂卡 / KPI strip + 4 區 mini-bars / 14 廠 grid）+ MonitorPanel 5min/10min dual poll + powerCardData 純函式抽離 + 13 unit test。timeline isolation contract test：buildPowerCardModel 不收 time 參數 |
| E-B | **P1** | HAZARD 群組：閃電 + 核安輻射 | **done** | 2026-06-19 feat/energy-v2-A commits 857871b + b7d6154。lightning + nuclear 兩 loader + Legend + featureInfo Panel + useTransportParams + overlayRegistry + useHazardLayer + App.tsx + GIS_LAYERS + 17 unit test。NuclearStationPanel is_stale 警告塊（背景灰）+ alarm 警示塊（背景紅）。**cluster 暫不接**（v1 用 5~360min slider 控 payload）→ E-G |
| E-G | P2 | 落雷 cluster + zoom-gate（雷雨季升級項） | open | E-B v1 用「時間窗 slider 預設 60min」控 payload 量；雷雨季 1h 上萬筆時走 mapbox cluster。需先擴 OverlayConfig schema 加 `cluster?: { maxZoom: number; radius: number }` 欄、然後 overlayManager 建 source 時帶過去。實測卡再升 |
| E-C | P2 | 高壓電網 — osm_power_lines 2,305 + osm_power_towers 26,589 | open | 用戶「之前盤點漏的最重要」。voltage 345/161/69 kV 分色（含 ";" 雙迴路格式）。tower 走 minzoom 13。把電網 spine 接起來後可疊 §5.2 cascade flowline |
| E-D | P2 | OSM 風光電 + offshore polygon + 離島海纜 + 化石/地熱 | open | 8 表：osm_wind_turbines 812 / osm_solar_farms 734 / osm_power_plants 513 / offshore_wind_zones 36 polygon / island_power_grid 14 + 海纜 / fossil_fuel 9 (3D cylinder 油槽) / geothermal_wells 36 (3D cone 倒置) / renewable_permits_taipei 438 |
| E-E | P3 | 加油站 3 表 + ~~power_poles 2.96M PMTiles~~ | partial | 加油站段 open。**power_poles ✅ 2026-06-28**：tippecanoe -Z8 -z14 + cluster + drop-densest 壓到 26MB 單檔 PMTiles → S3 deploy-assets/coverage/ + 前端 6 處接線（usePowerPolesLayer + pole_type 5 類分色圖例 + opacity/size slider + 預設 OFF）。零 DB 負擔，純靜態 PMTiles。 |
| E-F | P3 | KPI 統計面板 — 縣市風光生質 + 光電月趨勢 | open | analytics.solar_daily_generation 3,992 + county_wind 211 + county_biomass 188 + county_small_hydro 188 + geothermal_potential 27。non-spatial chart |

**已存在的 RPC 不要重做**（PR #10 內）：
- Monitor 用：get_power_dashboard / get_power_generation_24h / get_power_plant_output_24h
- Map layer 用：get_power_plants_with_output / get_power_generation_at / get_osm_substations / get_ev_charging_stations
- Hazard 用：get_lightning_recent / get_nuclear_radiation_status

### 加油站 / EV 30km 路網覆蓋（CV 系列，2026-06-22 加）

> A 版（motorway-tertiary 全台）已上線 commits 702e382 → 8b0faf2 → 3376314 → afbf15d。
> B 版（+ unclassified / residential 深山部落道路）兩次失敗 — 留下路線給未來。

| ID | 優先級 | 項目 | 狀態 | Blocker / 備註 |
|---|---|---|---|---|
| CV-1 | **done** | A 版上線（motorway-tertiary 全台）| done | 2026-06-21 commit afbf15d。5 layer PMTiles（CPC/FPCC/台糖/all_gas/ev）各 ~5 MB。osmnx graph_from_bbox + custom_filter 5 類 → multi-source dijkstra → tippecanoe。雲林 POC commit 8b0faf2 + 3376314 已 swap 為全台 |
| CV-2 | P2 | B 版加密 — 加 unclassified（鎮內次要街道 + 深山部落道路）| **blocked** | 兩次失敗：①Overpass 全台 bbox + unclassified 切 32 subquery 卡死 8h（kumi.systems mirror）②pyrosm 讀 309MB PBF 吃 50GB RAM + 磁碟 5GB free 觸發 swap thrash。等磁碟 ≥ 50 GB free 再試 |
| CV-3 | P3 | B 版加密 — 用 osmium 預過濾 PBF（救援路徑）| open | `brew install osmium-tool` ✅ 已裝（2026-06-22）→ `osmium tags-filter w/highway=motorway,trunk,primary,secondary,tertiary,unclassified taiwan-latest.osm.pbf -o filtered.pbf` 得 ~60-80 MB 小檔 → pyrosm 讀。仍需 ~10 GB RAM。磁碟 free 已升至 25 GB 但建議再清到 50 GB+ 再跑 |
| CV-7 | **done** | multi-bucket + whitelist 修正（雙品牌 + false positive）| done | 2026-06-22 commit 7f8f005。台糖 13→86 站（+73 雙品牌，覆蓋率 50%→59%）/ 其他 665→292 站（whitelist 過 374 false positive）/ 全加油站 3,010→2,612。鐵則寫入 SKILL §⚠️ |
| CV-8 | P3 | 第 6 個 layer「私營 最近距離」(`gasCoverageOther`)| open | `taiwan_other_nearest.pmtiles` 已備（292 站 whitelist），但前端尚未接 toggle。仿 5 既有 layer pattern，加 1 個 sourceUrl + 1 個 paint + 1 個 panel + LegendPanel +1。預估 30 min |
| CV-9 | **done** | accessibility-analysis SKILL 落地 | done | 2026-06-22 commits 02a6bd8 + 17c148b + df3f72a。`.claude/skills/accessibility-analysis/` 含 SKILL.md（10 章 + 兩大鐵則 + troubleshooting 入口）+ scripts/pipeline-template.py + references/{pitfalls,mode-comparison,mirror-fallback,troubleshooting}.md。alias `service-coverage` 商業視角 |
| CV-4 | P3 | B 版加密 — 用 osrm-taiwan service grid sample（雲端跑）| open | 既有 osrm-proxy-gis.zeabur.app + OSRM_TOKEN 雲端跑 /table → 不吃本機 RAM。但 OSRM 無原生 isochrone，要 grid sample + concave_hull（雲林 POC pattern）。5,000 站 × ~5 batch call = 1.5h on zeabur free tier |
| CV-5 | P3 | C 版超密集 — + residential（巷弄全染）| open | 視覺像救援等時圈。edges 估 80 萬-100 萬，PMTiles ~300-500 MB / 檔。極不建議用本機跑，須 CI / cloud worker。視覺 ROI 對加油站分析有限（加油站不會藏巷弄裡）|
| CV-6 | P3 | Pipeline 自動化 — 月更 PBF + 跑 dijkstra + 上 S3 | open | 仿 osrm-taiwan 月更 PBF 模式。CI 跑 + 結果 push S3 deploy-assets。可順帶解決 CV-2/3/5 的本機 RAM/磁碟限制 |

**關鍵檔案位置（給未來 session 接手用）**：
- A 版 script：`taipei-gis-analytics/scripts/road_isochrone/taiwan_nearest_distance.py`（osmnx + Overpass，A 版用 custom_filter motorway-tertiary）
- B 版 PBF script（失敗版）：`taipei-gis-analytics/scripts/road_isochrone/taiwan_pbf_pipeline.py`（pyrosm + 本機 PBF，吃爆 RAM）
- 309MB PBF：`taipei-gis-analytics/data/raw/osm/taiwan-latest.osm.pbf`（Geofabrik，2026-06-22 抓）
- 雲林 POC script：`taipei-gis-analytics/scripts/road_isochrone/yunlin_nearest_distance.py`（osmnx + Overpass，~2 min 成功）
- 線上 PMTiles：`mini-taiwan-pulse/public/coverage/taiwan_{cpc,fpcc,taisugar,all_gas,ev}_nearest.pmtiles`
- 前端接線：`overlayRegistry.ts` `gasCoverageOverlay()` helper（PMTiles + 5 級色階）+ `LegendPanel CoverageLegend`
- OSRM 環境：`taipei-gis-analytics/.env` `OSRM_TOKEN` + `OSRM_UPSTREAM`；public domain `https://osrm-proxy-gis.zeabur.app`

**A 版限制與已知 trade-off**：
- ✅ 涵蓋 motorway / trunk（橫貫公路 台 7/8/9/14/18/20/21）/ primary / secondary / tertiary
- ❌ 缺 unclassified（深山部落最後一哩，如司馬庫斯 / 那瑪夏內里 / 霧台原鄉道路）
- ❌ 缺 residential（市區巷弄）
- ❌ 缺 service / track（產業道路、林道、登山口前山徑）
- 實務影響：加油站本身就分布在主要道路上，「最近加油站」分析誤差小；但「視覺覆蓋密度」會比 fire/medical isochrone（路網全染）稀疏

### 房地產 REAL ESTATE（RE 系列，2026-06-25 加 — 點圖層 CustomLayer + 資料補抓 + city 修正）

> 點圖層改 WebGL CustomLayer + GPU fade（PR #32 已 merge master）；同步補抓缺口資料 + 修 city 分類。
> 前端時間軸 = **交易/訂約日期**（trade_ts），範圍寫死 RANGE_START 2024-07-01 ~ RANGE_END 2026-03-31（2024Q3~2026Q1）。
> 資料管線 runbook：`taipei-gis-analytics/docs/systems/real_estate_sync_runbook.md`；打包 buffer：`scripts/pack_real_estate_points_buffer.py`。

| ID | 優先級 | 項目 | 狀態 | Blocker / 備註 |
|---|---|---|---|---|
| RE-1 | — | 點圖層改 WebGL CustomLayer + GPU fade | **done** | 2026-06-24 PR #32（master `b4bb90c`）。每幀對 365k 點重設 circle-opacity → GPU uCursorTs uniform。fade 窗調俐落（週 2+3 / 月 6+10 天）。點 hover/click 暫放棄 → RE-3 |
| RE-2 | — | 補抓租賃+預售 2025-09/10 缺口 | **done** | 2026-06-25。下載官方 114S3/S4 季 zip（`DownloadSeason?season=114S3`）→ convert mirror → 離線 geocode（L1 cache 97%）→ 02b → 06 → build → S3。租賃 0→13,290/12,431、預售 0→2,164/2,993。ALL_points 365k→423,404 |
| RE-3 | P2 | 點 hover/click picking 待補 | open | CustomLayer 無 `queryRenderedFeatures`。需自建 GPU/空間索引 picking（或保留隱形 PMTiles 點層供 query）。grid hover 不受影響仍正常 |
| RE-4 | P2 | TGOS 934 筆批次離線補座標 | open | 離線 geocode 解不到的 1.6%（262 地號 + 672 地址）。批次檔已備 `taipei-gis-analytics/data/intermediate/tgos/real_estate/tgos_batch_rental_gap_2025Q3Q4.csv`（cp950, 5 欄）。用戶離線跑 TGOS → 拿 `Address_Finish*.csv` 放 `results/` → `_build_geocode_cache.py` → 重跑 02b/06/07/09/build。262 地號 TGOS 地址定位可能解不到，走 NLSC 地段地號 |
| RE-5 | P2 | 補 115S1 季回填 2026 年初 + 收登記延遲尾巴 | open | 2026-02（458）/2026-03（5）幾乎空 = 近月登記延遲，下載 115S1 季可回填。⚠️ 若要顯示 2026Q2 以後，需同步延伸前端 `realEstateTime.ts` 的 `RANGE_END`/`RE_PERIODS`/`Q_START_TS` 三處（buffer epoch 仍是 RANGE_START 不動） |
| RE-6 | P3 | 2024 上半邊界偏少補齊 | open | 2024-07~10 偏少是**資料邊界**（缺 113 年更早季檔，那些交易早就登記在我們沒下載的季）。非市況。需更早季檔才補得齊，ROI 低 |

**資料品質結論（2026-06-25 盤查，已查證）**：
- ✅ 2025-04~09 **買賣**量縮（2025-06 谷底 2,296）是**真實市況**：央行 2024-09 第七波信用管制，2025 全年買賣移轉年減 23~25%、創 1991 來最大跌幅（六都八年新低）。只買賣崩、租賃高檔 = 打房貸特徵。**非資料問題，不需處理**。
- ⚠️ city="?" 36,354(8.8%)→77(0.02%)：根因地號地址無縣市前綴，06_merge 只解地址 → 改**優先用 MOI 來源權威 `city` 欄位**（避 district 名稱歧義如信義/東/中正區）。96% 來自單一檔 sale_moi_B5_B6_extended。analytics commit `a5f98c7`（本地 master 未 push，依慣例）。
- ⚠️ "?" 點有少量段-中心疊點（地號無門牌 geocode 落地段中心，最多 196 點疊一處，但 83% 唯一座標），屬地號精度正常現象。

### Base Map 擴展（BM 系列，2026-06-27 加 — 4 個新底圖 dataset）

> PR #37 已上線 6 個 base_map PMTiles（county/township/village_boundary、contour_25k、contour_dtm20、osm_road_drive）。此區段為下一批 4 個 dataset。
> 來源 SSOT：`taipei-gis-analytics/data/processed/base_map/{hillshade,slope,aspect}/` + `data/processed/transportation/osm_expressway/`
> Catalog：`taipei-gis-analytics/docs/data-catalog/base_map/{hillshade,slope,aspect}.md` + `transportation/osm_expressway.md`

| ID | 優先級 | 項目 | 狀態 | Blocker / 備註 |
|---|---|---|---|---|
| BM-1 | P1 | osm_expressway 快速道路 vector PMTiles（1.9 MB） | open | EPSG:4326 PMTiles 直接走現有 base_map PMTiles 模式，橘色粗線 #FF8C00 stroke 3px，z6-14。最簡單，先做 |
| BM-2 | P1 | hillshade 山體陰影 raster（烤 PNG 路線） | open | 上游烤成單張 PNG（灰階、~4096²、~2-5MB）→ 前端複用 `createCwaImageryLayer`。EPSG:3857 已轉好。opacity 0.5 疊 contour 下方 |
| BM-3 | P1 | slope 坡度 raster（烤 PNG 路線） | open | 上游 `gdaldem color-relief` 烤綠黃紅 colormap → 單張 PNG。前端同 BM-2 pattern。建議 ramp 0-45°（>45 不顯著）|
| BM-4 | P1 | aspect 坡向 raster（烤 PNG 路線） | open | 上游烤環狀 HSV 色盤（N=紅 E=黃 S=綠 W=藍）→ 單張 PNG。⚠️ aspect 環狀資料，烤時注意跨 0/360 不可算術平均 |
| BM-5 | P3 | **改走 deck.gl COG 路線**（未來再做） | open | 換掉 BM-2/3/4 烤 PNG 改 deck.gl `@deck.gl/geo-layers` TileLayer + GeoTIFF loader，**讓使用者拉 slider 動態調 ramp / 色盤 / opacity**。trade-off 詳見下方 |

**BM-2~4 烤 PNG vs BM-5 deck.gl COG 決策對照（2026-06-27 討論結論）**：

| 面向 | 烤 PNG（採用） | deck.gl COG（BM-5 待做） |
|---|---|---|
| Colormap 動態調整 | ❌ 重烤 | ✅ shader 即時調 |
| 解析度 | 固定 4096²，高 zoom 糊 | COG overview，任何 zoom 銳利 |
| 前端程式碼 | 三個 hook 各 ~40 lines（複用 createCwaImageryLayer） | ~300 lines + GeoTIFF loader + deck.gl mapbox interleave |
| 既有先例 | ✅ CWA / AQI / 雨量 | ❌ 專案無 raster COG / deck.gl 先例 |
| Frame time 額外成本 | 接近 0 | 1 個 raster ~3-7ms / 3 個 ~20-40ms |
| 適合場景 | 視覺底圖 | 分析工具（即時調 ramp 看坡度分級） |

**BM-5 改走 deck.gl 觸發條件**：用戶想做「地形分析互動」（拉 slider 看 slope 0-15° / 15-30° / 30-45° 分級變化、量點實際坡度、找全台 > 30° 山坡）。

**BM-5 加速三招（屆時必做）**：
1. COG 必有 overview（`gdaladdo -r average tif 2 4 8 16 32`）— 沒 overview 慢 5-10×
2. Web Worker decode（`@loaders.gl/geotiff` `loadOptions: { worker: true }`）
3. UI 強制 hillshade/slope/aspect 三選一（radio 而非 checkbox），避免 3 個同開掉 30fps
