> **歷史 backlog（2026-09-14 起）**：保留原 Research Workbench 分階段工作，不作目前地圖探索優先順序或發布狀態。現在的能力、缺口與下一步以 [探索能力計劃](./exploration-capabilities-plan.md) 為準；新增來源應依 [分析能力 onboarding](./analysis-capability-onboarding.md) 驗收。

## 2026-09-21 後續：可保存的分析成果

> 順序：先完成 session-local result overlay 的 `accepted → applied → ready → browser readback`，再做持久化。目前 `resultId` 維持 browser session 內暫存，不自動寫入 Supabase。

- [ ] 定義「儲存分析」明確動作：只有使用者主動儲存時，才將 session-local `resultId` 晉升為持久、版本化的 `artifactId`；不保存每次探索與失敗嘗試。
- [ ] 定義 durable artifact contract：保留 schema/method version、query/filters/time/bbox、dataset/source version、CRS/geometry role、coverage/freshness、units、missing/suppressed/zero/exclusions、lineage、row/feature count、checksum 與建立時間。
- [ ] 做儲存選型與容量實測：優先評估 Supabase 儲存 metadata/index/RLS；小型、有界 JSON 才可直存，大型 geometry/result 改用 private R2/S3 immutable object，Supabase 只存 manifest/hash/pointer。
- [ ] 定義權限與生命週期：owner ACL/RLS、quota、TTL/retention、刪除與撤銷、來源權限變更、source version 過期，並確保撤銷後無法繼續讀取與呈現。
- [ ] 定義 restore/resume 路徑：以 `artifactId` 讀回時重新授權，明示 stale/source drift，恢復結果 overlay 與數量/範圍 readback，不把舊結果假裝成當前來源。
- [ ] 完成持久化驗收：頁面重載、重新配對、跨裝置授權、過期、撤銷、刪除、大小限制、checksum/count 與 browser 可視讀回均有實際證據。

## 2026-09-21 後續：正式服務拓樸

> 邏輯上需要網站、Gateway、MCP 與既有 Supabase；第一版只有網站與 Gateway 必須部署成伺服器，MCP 維持使用者端 stdio。Result overlay 仍是 session-local，不因部署自動持久化。

- [ ] Mini Taiwan Pulse 正式站保留同源 `/api/research/v1/`，由 TLS reverse proxy 轉送 Research Gateway；不得直接公開未加密的 loopback port。
- [ ] Research Gateway 以受管理的 sidecar/process 部署，負責 Supabase Auth、pilot ACL、pairing、session、revision、receipt、pause/revoke 與 rate limit；它只轉送 bounded declarative commands，不承載分析資料本體。
- [ ] `pulse-research` MCP 第一版以本機 stdio 安裝，連線正式 HTTPS Gateway；若未來改成 Remote MCP，需另設多使用者 auth、credential isolation、quota、監控及 offline-geocoder 資料部署。
- [ ] 少量 pilot 可採單節點 Gateway＋持久 SQLite volume；正式多 instance 前改用可共享且具交易語意的 Postgres/Redis 類 state store，或明確限制單節點與故障切換。
- [ ] 正式驗收需分開記錄：Gateway 部署、Supabase OAuth redirect／pilot allowlist、MCP 安裝、配對、accepted → applied → ready、browser readback、重啟／撤銷；任一項通過不得代替其他項。

## 2026-09-21 產品主流程：地址作為探索起點

> 目標體驗：輸入地址後，以該位置為中心搜尋、分析並高亮周圍各種已支援資料；不只回文字或移動鏡頭。地址精度、資料來源、分析方法與限制仍須可見。

- [ ] 建立 address → geocode precision → map center／result bounds → dataset search → bounded query／analysis → result overlay → browser readback 的共用流程，讓不同資料集可沿用，而不是每個圖層各做一條特殊路徑。
- [ ] 每新增呈現型 command／query operation，都同步檢查 MCP schema、Gateway allowlist／normalizer、browser `Scene`／`BrowserQuery` validator、renderer 與 readback；Gateway 應允許有界 declarative capability，不以舊白名單無聲阻斷已支援功能。
- [ ] 「分析成功但地圖沒顯示」的排查順序固定為：Gateway HTTP status／`INVALID_INPUT` → command 是否 accepted → browser 是否 applied → renderer 是否 ready → `map_context.resultPresentation` → dataset geometry/count/source；不得一開始就判定資料不存在。
- [ ] 周邊資料只對已支援、語意合格的 dataset 計算；未註冊、geometry role 不明、資料契約不足或需要路網／point-in-polygon 的問題，先說明目前不能做並提供可開啟的相關圖層。

## 2026-09-21 今晚 P0：通用 dataset 與空間分析底座

> 目標不是完成某個「地址附近教育資源」固定問句，而是讓 Agent 能把任意問題組合成可驗證的原子操作。任意圖層先能被搜尋、說明與回報 capability；只有 source contract、權限、geometry 與時間語意齊全的來源才開放對應計算。不建立每題、每 layer 各自一套工具。

### 2026-09-21 過夜實作 checkpoint

- [x] 45 個既有 social/regional statistics recipes 全部由同一個 compiler 產生 values-only dataset adapter；可搜尋、說明、以 exact release selector 查詢，並以 property/contract tests 保留 grain、period、unit、boundary version 與 missing／suppressed／zero。
- [x] 小型 session result 已有通用 Point → Polygon／MultiPolygon `within`、`intersects`、`spatial_join`、`aggregate_by_area`；holes、multipart、boundary rule、未匹配、多重匹配與 10,000,000 comparisons 上限都有測試。
- [x] transient result renderer 改為 geometry-driven Point／Polygon／MultiPolygon，移除學校 dataset 特例；MCP → Gateway → browser 同步支援最多 8 個 result IDs，並有 10,000 features／100,000 vertices／8 MiB 全局預算。
- [x] Google geocoder 已有 provider-neutral consent／policy adapter；沒有 key 時回 `disabled`／`sent=false`，有 key 也只有逐次明示同意才會送出。真實 provider E2E 與 Mapbox 顯示／儲存政策仍未完成，不能因 `.env` 有 key 就冒充 live。
- [x] Valhalla `route_distance`／`walking_isochrone` typed contract 已接通 MCP → Gateway → fixed public demo；每次必須 `externalConsent:true`，graph checksum／snap distance 仍未知，禁止 Haversine／synthetic isochrone fallback。Mock／contract tests 已完成，真實外部座標 E2E 尚未跑。
- [x] 45 組行政區 statistics 已用 exact boundary version／level／area_code 接同版 boundary，正規化為 EPSG:4326 MultiPolygon；missing／suppressed／zero 與 values／boundary receipts 保留。
- [x] Result collection 已支援最多 8 個畫面 results 的逐層開關、重排、分組與 browser readback；session 工作 store 提升到 16，避免分析中介結果逐出已顯示圖層。
- [x] Origin marker 與 straight-line typed scope 已實作為獨立可呈現 results；不可當行政邊界或 walking isochrone。
- [ ] 尚缺 line／raster kernel、自管版本化 Taiwan Valhalla graph、Google／Valhalla 真實 provider E2E、clear／expiry／revoke fresh-session 回歸。

### P0-A：capability compiler 與 source-family adapters

- [ ] 建立 `layerManifest`／statistics recipes → `DatasetDescriptor`／capability 的自動派生層，狀態至少分為 `searchable`、`describable`、`queryable`、`spatially_analyzable`、`presentable`，並附不支援理由。
- [ ] 以 source family 建 adapter，而不是以問句或 layer key 建 adapter：小型靜態 GeoJSON／GeoParquet、PMTiles＋sidecar index、regional-statistics recipe、Supabase／RPC、dynamic snapshot／event stream、raster／COG、network routing。
- [ ] 所有 manifest layers 都能做 metadata search／describe；記錄搜尋、全來源統計、空間分析與地圖顯示分別宣告，不用「地圖看得到」代替「完整資料可讀」。
- [x] 對現有 45 個 regional statistics recipes 自動產生 searchable／describable／queryable dataset contract，保留 selector tuple、縣市／鄉鎮 grain、period、unit、分子／分母、missing／suppressed／zero；descriptor transport 與代表性統計／boundary live readback 已驗證。
- [ ] 產出 runtime capability coverage report：各 source family 可搜尋、可讀、可計算、可呈現與 HOLD 數量及原因，讓新圖層能批次晉級，而不是每次重做 POC。

### P0-B：typed spatial kernel

- [ ] 定義少量通用原子運算：`nearest`、`within_distance`、`buffer`、`contains`、`within`、`intersects`、`clip`、`spatial_join`、`aggregate_by_area`、`area`、`length`、`route_distance`、`isochrone`；不提供任意 SQL／JavaScript／URL 執行。
- [ ] geometry contract 已覆蓋目前 POC 所需 Point／Polygon／MultiPolygon、holes、multipart、CRS 與 geometry role；MultiPoint、LineString／MultiLineString、validity repair、area／length 仍待補。
- [ ] 分成兩個執行 tier：小型、有界資料可在 browser／worker 執行；大型 PMTiles／RPC／raster／network 交給可重現的 server-side engine／sidecar index，不在瀏覽器下載全量再計算。
- [ ] 每個 result envelope 保留 input result IDs、operation／method version、filters、bbox／time、source versions、rows／bytes／vertices budgets、truncation、missing／unmatched／disconnected／warnings 與 provenance。

### P0-C：通用 result layer collection

- [x] 將固定少數特例改為 session-local result layer collection；最多 8 個畫面 results，每層可開關、重排、分組、清除、取得 bounds 與 readback。
- [ ] 「任意數量」指不被問句或固定四層寫死，仍需全局 features／bytes／vertices／GPU／visible-layer budgets；超限時分頁、cluster／sample、降階或要求縮小範圍，不讓 Gateway 無限載入。
- [ ] renderer 已由 geometry type 處理 Point／Polygon／MultiPolygon、行政區統計與 walking polygons；Line／raster／時序快照仍未完成，不能宣稱全 geometry family 通用。
- [ ] 單層失敗不終止整個分析 plan；Agent 回報已完成、降階、HOLD 與失敗層，地圖保留其他可用結果。

### P0-D：Google Geocoder 原子 provider

- [x] `pulse_geocode_address` 保持 provider-neutral，本機 exact／OSM／interpolation 為預設；Google 只有明示 `provider=google` 與逐次同意才會外傳，不建立領域專用 geocoder。
- [ ] Google adapter 現在由 MCP server-to-server 呼叫 v3 fixed endpoint，key 只在 server env，已有 timeout、response cap 與 normalized receipt；quota／cost ledger、rate limit、circuit breaker、v4 field mask 與正式 backend placement 仍待補。
- [x] 回傳統一 bounded candidate：provider、coordinates、location type、viewport、place ID、consent／sent、storage policy 與 limitations；raw provider response 不落盤。
- [ ] Google 內容儲存、attribution 與 map-display 政策 review 為啟用條件；目前 Mapbox 底圖不假定可直接呈現 Google geocode result，可長期保存的 identifier 與不可快取內容分開。

### P0-E：OSM walking 原子 network provider

- [x] 以 Valhalla 為第一個 pedestrian route／isochrone provider，保留通用 provider interface，沒有建立「學校步行圈」專用工具；目前是 fixed public demo POC，不是自管 production provider。
- [ ] 建立可重現 network build：Taiwan OSM extract 取得時間，extract／graph checksum，Valhalla version，pedestrian costing/profile 與 access／barrier／ferry 規則。
- [ ] `route_distance`／`walking_isochrone` 已有 strict schema、external consent、engine version／tileset receipt 與 Polygon materialization；snap distance、unreachable／disconnected、graph checksum 與真實外部 E2E 尚未驗證。
- [x] 成功的 isochrone contours 會成為一般 derived Polygon result，可進 collection，並可供合格 Point 做 `within`／`intersects`／`aggregate_by_area`；不能稱為 actual authoritative boundary。

### 今晚的驗收順序

1. 先鎖定 capability compiler、source-family adapter interface、spatial operation schema 與 result collection budgets；用 contract tests 防止 MCP → Gateway → browser 漂移。
2. 讓 45 個既有統計 recipes 自動可搜尋、可說明、可用 exact selector 查詢，並用行政區 boundary 的版本化 join 接成可呈現面圖層。
3. 完成小型資料的 Point／Polygon `within`、`intersects`、`spatial_join`、`aggregate_by_area` vertical slice，但契約不寫死教育資料。
4. 完成 Google provider adapter 與 consent／policy gate；若 key／billing／map-display 條款未齊，保持可測的 disabled capability，不冒充 live 已啟用。
5. 完成 Valhalla local provider contract 與一個已版本化路網 vertical slice；若 Taiwan graph 尚未 build，以 HOLD receipt 明示缺少 graph/profile 證據，不用 Haversine 代替。
6. 最後從至少三種不同問題（教育、生活機能、交通）驗證同一組原子工具能重組，並完成各 result layer 的 `accepted → applied → ready → browser readback`；驗收看 primitive 是否通用，不比對固定文案。

### 下一個可見成果：分析中心與範圍

- [x] 將地址／選點中心作為獨立 origin marker 呈現，不混入分析結果筆數；顯示 metadata 保留 label 與 geometry role。
- [x] 增加 straight-line typed scope：中心點與 geodesic radius 是兩個獨立 results；walking 只接受 provider 回傳 isochrone，不把 `nearest N` 或 Haversine radius 冒充步行範圍。
- [x] Origin／scope 經既有 result collection、dataset IDs、feature counts、source/layer readiness readback；popup 使用網站既有黑色不透明玻璃視覺。
- [ ] 已分別驗證 origin/scope implementation、5-layer collection、fit bounds、theme switch 與 style reload；仍需在同一個 fresh session 驗 address/current-center → origin → scope → multi-result overlay → clear／expiry／revoke readback。

### 地址定位 fallback：可選的 Google Geocoding

- [ ] 本機 TGOS／OSM exact 與 interpolation 仍是第一順位；只有 `no_match`／`unavailable` 且使用者同意將精確地址送往外部 provider 時，才允許 Google fallback，不得靜默外傳。
- [ ] Google Geocoding 現由 MCP server-side adapter 呼叫，key 不進網站 bundle 或 tool arguments，已有 timeout；正式化仍需移入受管 backend／Gateway 並加入 quota、rate limit、成本 ledger 與 circuit breaker。
- [x] 回傳契約保留 provider、place ID、location type、viewport、外傳 consent／sent 與 storage policy；不把 Google 結果和本機 exact 命中合併成同一種精度。
- [ ] 先完成 Google Maps Platform 儲存、attribution 與 map-display 條款 review；Google 回傳內容不可直接假設能長期存入 Supabase，持久層優先保存可允許長期保存的 identifier／consent／request metadata。

### OSM 步行範圍：有界 routing pilot

- [x] 第一個 isochrone POC 選 Valhalla fixed public demo；只有 route／isochrone typed endpoints，逐次同意後才外傳座標，不把 OSRM route/table 或直線半徑誤稱為等時圈。
- [ ] 固定 Taiwan OSM extract、抓取時間、engine/version、pedestrian profile、turn/access rules 與 build checksum；路網更新不可和舊分析結果混用。
- [ ] 定義 `route_distance`／`walking_isochrone` typed contract：origin、5／10／15 分鐘 cutoff、snap distance、unreachable、disconnected、excluded ways、units、network version 與 warnings。
- [ ] 第一個 vertical slice 只做單一地址：地址定位 → 5／10／15 分鐘步行圈 → 圈內已支援學校 → result/scope overlay → ready/readback；同畫面保留 Haversine 直線距離作比較但不混名。
- [ ] 以已知可步行／不可跨越案例驗證 topology、橋梁／隧道／人行限制與 disconnected behavior；在 graph/profile/coverage 證據完成前維持 HOLD，不擴大到全台大量 dataset adapters。

## 2026-09-14 本輪增量

- [x] M2 語意卡 schema／validator／schools、news、paddy 與負向測試。
- [x] 本地 Research Library 契約、immutable asset、search／describe／promote／stale。
- [x] 真實 schools 150 m assign／aggregate／materialize、固定 receipt、resultId 與主地圖驗收。
- [x] Routing 現況盤點：缺 graph／profile 證據，明確 HOLD。
- [ ] 新 grid 透過登入配對 MCP 的端到端及 mobile 驗收。
- [ ] 合格來源 licence／observed time 與第二個真實 library asset。
- [ ] Network engine／graph version／walking profile／topology／unreachable 證據。
- [ ] School district、real estate 真實可用資料；雲端 library 與跨使用者 ACL。

# Implementation backlog

完整目標以 spec.md 為準；證據以 handoff.md 為準。

- [x] 隔離 worktrees，保留原始並行工作。
- [x] Phase A synthetic result契約、共用驗證器與有界renderer。
- [x] `/lab`點／線／單外環面／表格、loading、opacity、legend、popup、clear。
- [x] 本地MCP驗證與列檔；bounded reads與symlink檢查。
- [x] Phase B配對domain安全核心及tests（非可部署gateway）。
- [ ] 完整v1 geometry（含holes/MultiPolygon）與參考底圖／圖層。
- [x] 真實登入verifier、SQLite durable store、pilot ACL、HTTP配對／relay程式與本地tests。
- [x] MCP session/scene tools、網站StudyController、manual優先與同revision ready。
- [ ] 正式HTTPS部署、pilot IDs、OAuth redirects、header readback與browser配對。
- [x] Codex全域MCP安裝、真Supabase登入、實際Codex CLI配對／操作／同revision ready驗收。
- [ ] 使用者重新載入桌面MCP後的日常操作驗收。
- [ ] 受授權的本地workspace快取／版本／pin／quota／eviction。
- [ ] S3/Supabase/R2共用catalog與receipt-aware acquisition。
- [ ] 估價、預算approval、reservation與受控reader。
- [ ] 私有artifacts、TTL、snapshot restore與ACL繼承。
- [ ] S3-only真實資料分析／方法基準／第二次payload零下載。
- [ ] 同revision inspect/capture、cancel/reconnect與production驗收。
