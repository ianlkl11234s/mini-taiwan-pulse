# Global Maritime handoff

## Full-fidelity v3 shadow handoff status (2026-08-26)

| boundary | status |
|---|---|
| frontend/collector contract, tests, production build | complete |
| migrations 376 / 377 | applied to production |
| v3 shadow release assets | generated for 2026-08-15..21 UTC |
| production S3/Supabase full audit | complete: schema3/full_fidelity root release 2026-08-21 bytes/hash; run e00 schema3 shadow and 3,311 counters/assets; HEAD 3,311/3,311 with zero missing/head_errors/bytes/SHA mismatches and timed_out=false |
| push, deploy, browser acceptance | not yet performed |
| canonical v2 | unchanged rollback path |

Generated metrics: 1,426,359 points; 226,830 features; 64,051 vessels; 168,936
segments; 57,894 singleton nodes; 1,105,448 grid cells; SAR 0; about 995 MB.

Do not infer physical-vessel completeness from these counts. GFW HIGH values are hourly
grid-center observations; inferred polygon footprints and same-segment linear interpolation
are visualization semantics, not official cell boundaries or raw AIS positions. A failed
S3 hash/bytes/cache, Supabase ledger/count, sidecar-detail, deploy, or browser check must
leave canonical v2 selected; immutable releases are never patched in place.

## Downstream contract

`mini-taiwan-pulse` 已接好兩個獨立 source/layer，但資料生命週期仍由上游 repo 負責：

| source | owner | required contract | cadence |
|---|---|---|---|
| AISStream | `data-collectors` | `AISSTREAM_API_KEY`、常駐 WebSocket、S3 cold archive（無 expiration） | live ingest |
| GFW | `data-collectors` | `GFW_ACCESS_TOKEN`、每日 snapshot、原始 dataset/license/noncommercial metadata | daily |
| public RPC | `gis-platform` | migration `371_aisstream_gfw_independent_contract.sql` | frontend read |

前端只呼叫：

- `public.get_aisstream_vessels_current(p_min_lon, p_min_lat, p_max_lon, p_max_lat, p_max_age_minutes, p_limit)`
- `public.get_gfw_vessel_presence_current(p_min_lon, p_min_lat, p_max_lon, p_max_lat, p_max_age_days, p_limit)`

兩個 RPC 必須維持 provider/quality/freshness 欄位，且不可在 SQL 或 collector 端把 AISStream 與 GFW union 成同一資料源。前端依 viewport 查詢，limit 目前為 3000。

## Hard dependencies

### AISStream

必須存在且可轉成有效資料的欄位：

`provider`, `mmsi`, `ship_name`, `ship_type`, `imo`, `call_sign`, `destination`, `nav_status`, `speed_knots`, `course_over_ground`, `true_heading`, `longitude`, `latitude`, `observed_at`, `received_at`, `age_seconds`, `position_quality`, `quality_flags`, `coverage_zone`。

`longitude` / `latitude` 非數字會被前端 loader 丟棄。`destination` 是船方自報，popup 不得當作已驗證目的地。

### GFW

必須存在且可轉成有效資料的欄位：

`provider`, `vessel_id`, `mmsi`, `ship_name`, `vessel_type`, `flag`, `longitude`, `latitude`, `source_snapshot_date`, `observed_at`, `received_at`, `age_hours`, `presence_quality`, `quality_flags`, `source_dataset_id`。

沒有 `GFW_ACCESS_TOKEN` 或 snapshot 尚未產生時，RPC/loader 可回空集合；不得用空集合冒充「沒有船」，也不得把 presence 推論為 dark vessel。

## Cross-repo references

- Platform contract：`../../../gis-platform/migrations/371_aisstream_gfw_independent_contract.sql`
- Platform source catalog / lifecycle：`../../api-platforms/`、`../../DATA_LIFECYCLE.md`
- Collector handoff：`../../../data-collectors` 的 AISStream/GFW collector 文件與 S3 cold archive policy
- UI implementation：`src/data/globalMaritimeLoader.ts`、`src/hooks/useGlobalMaritimeLayers.ts`

## Historical v2 production evidence boundary (2026-08-24)

- migration 371 已完整套用至 production；full-fidelity migration 376 與 audit migration
  377 亦已套用 production。v3 shadow full S3/Supabase audit 已完成；push/deploy/browser
  仍未完成。
- AISStream 的 9 個相關 tables、5 個 RPCs、cron 與 retention 已存在；feed healthy，archive 已以 backend read-only 證據驗證。
- GFW tables/RPC 已存在；當時 token gate 下 collector runs 為 0，尚無 production snapshot 可做資料驗收。2026-08-25 後加入的本機 token 僅供 POC，不改寫此 production 證據。
- 本次證據不包含 PostgREST 公開 RPC 回應或 browser 真實點位驗證。

## Historical local GFW trajectory POC contract (2026-08-25)

以下 POC/browser 數據不是 v3 shadow deploy 或 browser acceptance 證據；current release
status、metrics 與 rollback gate 以本文開頭的 2026-08-26 表格為準。

### Scope and safety boundary

- 框選 bbox：`122.43400, 23.22953, 132.85274, 34.35812`。
- 查詢：GFW vessel presence `HOURLY` / `HIGH`，最新可用完整日往回 7 日。
- 語意：每船每小時一個格網化近似位置；不冒充原始 AIS 點或 10 分鐘觀測值。
- 融合：可與 AISStream current layer 並置，但不把 GFW 最後點連到約 96 小時後的 AISStream 現況。
- 憑證：`GFW_ACCESS_TOKEN` 僅 backend 可讀；禁止經由前端、URL、log 或 artifact 洩露。
- 狀態：**local-only POC**，未寫 production DB、未部署，raw archive 仍為 **disabled**。

### 2026-08-25 probe / browser evidence

| evidence | result |
|---|---|
| API frontier | `2026-08-15..2026-08-21` UTC，`public-global-presence:v4.0` |
| API reports | 16/16 tiles 成功、16 個 200；0×429、0×524、0 retry/error |
| normalized data | 1,426,361 rows、57,726 vessels、2 duplicates、0 invalid |
| track candidates | 168,936 segments、1,368,465 segment points |
| browser artifact | schema v2；989 vessels / segments、150,000 points、8,687,132 bytes（含逐頂點 observed_times） |
| finalize resource | 69.27 秒、peak RSS 456,278,016 bytes；完整 API wall time 未在首次 run 保存 |
| local browser | 日期／統計／線段／端點／popup／toggle／attribution 可見，console 0 error |
| safety | frontend/artifact credential scan 無 token；GeoJSON gitignored 且 production build 移除 |

一次 interrupted in-flight POST 是為了將 1.3M rows 的 finalize 從 RAM 累積改成 SQLite disk-backed，14 個完成 tiles 由 normalized checkpoints resume，因此本機已知 POST 是 17 次。rate header 最後顯示 daily `12/50000`、monthly `12/1500000`；server header 計數有延遲，容量規劃應使用本機 request ledger 與 headers 兩者，不只看單一 header。

### Main-site hourly grid artifact and layer

第二次 live run 重新取完整資料，不使用 capped track artifact：16/16 reports HTTP 200，產生 168 個 UTC hour files、1,426,359 個 unique vessel-presence observations 與 1,105,448 個 hour-grid cells；2 duplicates、0 invalid、0 same-vessel-hour position conflicts。總目錄約 579 MiB，最大單一小時 5,030,556 bytes。

主站 layer key 是 `gfwHourlyGrid`。它訂閱 `timeStore.subscribeThrottled(250)`，將 unix time 向下取整為 UTC hour；同 hour 不重抓、找不到 exact hour/file 就清空。每格一個 feature，圓半徑與 count symbol 取 `vessel_count`，popup 解析 `vessels_json` 列出全部 members。資料與 token 都不上 production：artifact gitignored，Vite production build 移除目錄。

### Main-site sampled track layer

主站 layer key `gfwHourlyTracks` 在 production 與標準 Vite dev 都先讀同源 unified root manifest；DEV 的 `/global-maritime/gfw-hourly` proxy 轉送 production origin。只有 `VITE_GFW_HOURLY_USE_LOCAL_POC=true` 才使用 `gfw_hourly_tracks_poc/manifest.json`。再依 timeStore 選定 UTC 日讀取 `tracks.days[].path` 指向的 immutable daily GeoJSON。前端不 fallback 到舊的七日整包；日期越界或契約違反即清空。每個 feature 必須有與 LineString coordinates 等長的 `observed_times`，而且是明確 UTC、嚴格遞增，`start_at/end_at` 必須等於首末時間；任一 feature 違約即該日 fail closed。

Production 供應契約為 S3 `deploy-assets/global-maritime/gfw-hourly/` → 同域 `/global-maritime/gfw-hourly/`。前端 production 未設 env 時預設讀 `/global-maritime/gfw-hourly/manifest.json`；`VITE_GLOBAL_MARITIME_CDN_BASE` 僅在 production 作可選 CDN origin override。Vite dev 非 local POC 時固定讀同源 URL，經 proxy 避免 CORS；`VITE_GFW_HOURLY_USE_LOCAL_POC=true` 才使用 fixture。`gis-up` 若需與目前 v3 production path parity，必須明確設 `VITE_GFW_HOURLY_V3_SHADOW_ENABLED=true`，未設仍走 canonical root。Root manifest cache 為 60s + `stale-while-revalidate=300`；release assets 為 7 日 `max-age/s-maxage=604800, immutable`。Container 每 6h 只 re-sync GFW prefix，先落地 release assets，再以 tmp+mv 原子切換 root manifest。

schema v2 artifact 已 live 重建；frontend parser 實測接受 989 tracks。以 `2026-08-21T23:00:00Z`、12h 拖尾產生 727 lines 與 645 個 exact-observation endpoints。主站 browser 另以 300x 播放至 00:32，endpoint popup 顯示 `08/21 16:32（線性內插）`，console 無 error/warning。

hook 採 Vessel Watch 的純 Mapbox line + endpoint 模式，不新增 Three.js CustomLayer。它訂閱 `timeStore.subscribeThrottled(100)`，同小時內每個不同 tick 都重算 frame，但完全相同的 ms + 拖尾參數不重算。使用者可選 0.5/1/2/3 小時，預設 0.5 小時。相鄰 hourly observations 之間依選定時間比例做線性經緯度內插；拖尾視窗起點也以相同方式裁切。裁線永遠留在 exporter 既有 segment 內，不跨缺訊／跳點切口，也不在 segment 外外插 endpoint。`selected_time` 和 `interpolated=0/1` 寫進 runtime properties，明確分開觀測與動畫估計。這層是 capped 抽樣，不代表範圍內全船。

本階段刻意不導入 PMTiles。正式效能版再拆成 PMTiles/vector-tile overview 幾何與以 hour+cell/vessel key 查詢的 detail contract，避免把完整 identities 重複烤進多層 zoom tiles。

### SAR unmatched 獨立圖層

相同 bbox 的 `public-global-sar-presence:v4.0`、`matched='false'` 已 live-verified，wrapper schema 與空 tile 契約都通過；七日範圍可能仍為 0 detections。因此 `gfwDarkVessels` 已正式加入 Global Maritime catalog（預設 off），依時間軸 exact UTC hour lazy-load `dark_vessels.hours[]`。圓點位置固定說明為 GFW HIGH grid cell center；popup 及 legend 固定告知「SAR 偵測未與 AIS 匹配，非違法認定／非確認關 AIS」。它不與 AIS gaps 或 presence union。Vite dev 預設同源 proxy；僅 local POC opt-in 才可能因未提供 SAR fixture fail closed，且不借用 grid 假裝 SAR。

### Track construction contract

1. 依 `source_dataset_id + vessel_id + observed_hour + grid_lon + grid_lat` 去重。bbox 分片的重疊區不得產生重複點。
2. 每船依 UTC 小時排序；一旦遇到時間缺口、非單調時間、跨界跳點或不合理推算速度，即切斷 segment。
3. 只將有至少兩個有效點的 segment 建成 `LineString`；原始 hourly points 仍保留時間與 quality metadata。
4. 不用 Catmull-Rom、spline 或海上路由重塑路徑。動畫只能在同 segment 的相鄰 hourly observations 之間做時間比例線性內插，並以 `interpolated=1` 明示「非觀測位置」。
5. popup / legend 固定標示「GFW 每小時格網化近似路徑」、dataset version、時區、最新觀測與 attribution。

## Globalization roadmap

### Partition and collection architecture

- 將全球分成固定、具版本的 tile grid。POC 可先用經緯度 tiles；正式版在高緯度容量差異太大時，改用等面積 tiles 或緯度帶調整 tile 寬度。tile id 必須穩定，邊界用 canonical ownership 加全域去重處理。
- API report 必須經序列 worker 或 durable queue，不同時發送大量 report。每次記錄 rate-limit limit / remaining / reset headers，統一調度每日與每月額度。
- `429` 尊重 reset / retry 時間，不立即緊密重試；遇 report `524` 時，先依 GFW `last-report` 機制回收已完成結果，再決定縮小 tile / time window，避免重複計費與負載。
- 每個 dataset / tile 維護「最新已完整日」frontier，日常只拉 frontier 之後的新 partition；保留小幅 overlap window 給遲到更正，以新 partition version 取代，不就地改寫已發佈原始檔。
- 原始與 processed 資料用 immutable `dataset_version/date/tile_id` partitions，並存 request body hash、response metadata、license/attribution 與 checksum。raw archive 只有在條款審查、容量預算與 lifecycle policy 通過後才能啟用。

### Serving architecture

- processed SSOT 先以上述去重鍵清理 hourly points，再產生可重建的 per-vessel / per-day segmented `LineString`。不把前端當成全球分組與連線引擎。
- 全球縮小尺度用 overview 層（路徑簡化、密度或日級 aggregate）；高縮放才取 detail hourly tracks。產品上保持兩個 source/layer，避免一包全球細節。
- 靜態、可版本化的 overview 優先走 object storage + CDN，並評估 PMTiles / vector tiles；detail 用 tile-aware API/RPC，必須同時依 viewport、time range、zoom 與上限查詢。
- cache key 至少包含 dataset version、tile/viewport、time window、zoom/detail level；CDN 設 immutable cache headers，frontier 只更新最新 partitions 與 manifest。
- SAR unmatched 是另一種資料語意，必須作為獨立 source / layer / legend / attribution，只稱「AIS-unmatched SAR detection」，不與 AIS presence track union，不直接判定暗船或非法活動。

### Gates and phases

| phase | scope | exit gate |
|---|---|---|
| POC | 當前 bbox、7 日 HOURLY/HIGH、local browser | **本次已完成**；尚缺完整 API wall-time telemetry，不影響 local visual POC，但全球容量 gate 前必補 |
| Regional production | 台灣—琉球—九州固定 tiles，每日增量 | DB/RPC、retention、queue/retry、cache、browser、license/attribution 與 rollback 均驗收 |
| Global | 全球 tile catalog、overview/detail 分發 | 先通過每日/每月 API 額度、report 時間、raw/processed 儲存、DB/CDN egress、tile build 與前端記憶體的容量/成本 gate，再逐區啟用 |

全球化不以「API 可回資料」當作 production-ready。每個 phase 都要單獨報告 API、archive、DB/RPC、browser、deploy 與 license 證據。

## Remaining PostgREST/browser acceptance

1. 先透過 production PostgREST 分別驗證 AISStream 與 GFW 的 bounds、limit、空資料與 freshness；本機 token / POC 不能取代 production snapshot 驗收。
2. 開啟 AISStream，確認 cyan circle、MMSI popup、30 分鐘 age 與 attribution。
3. 開啟 GFW，確認 amber circle、snapshot date、daily/延遲文案與 attribution。
4. 切換底圖，確認 `style.load` 後兩個 source/layer 重新建立並重新餵資料。
5. GFW 歷史路徑另驗收 segment 切斷、時間範圍、大範圍效能與格網化文案；不與 AISStream 跨延遲 gap 連線。
6. 若要接 AIS trail，另立選取 MMSI 的請求策略；不可把 current 點位直接連成連續航跡。
