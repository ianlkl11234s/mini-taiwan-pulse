# Global Maritime handoff

## East Asia v4 24-hour local shadow POC truth (2026-08-28)

The accepted bbox `115.93462,20.36314,134.73486,36.52495` is now wired into the
Mini Taiwan Pulse main map behind the DEV-only `?gfwV4Shadow=1` gate. This is still a
local immutable shadow POC: production v2/v3 resolvers and assets are unchanged; upload,
pull and deploy were not run.

| evidence | result |
|---|---|
| LOW vs HIGH identity | both contain exactly 799,771 canonical vessel-hours; zero missing identities and zero popup-member field mismatches |
| route decision | use private HIGH then local 0.1-degree aggregation: LOW assigns 565,964 vessel-hours to different 0.1-degree cells under the accepted canonical grid |
| upstream cost | LOW 372,435,396 response bytes / 90.35s / 1,292,402,688 B peak RSS; HIGH 375,200,404 B / 409.13s / 1,475,969,024 B peak RSS |
| Grid artifact | 24 hourly PMTiles (39,389,483 B) plus 293 complete detail shards (50,322,580 B); 99,155 semantic cells read back |
| Grid visual | v4-only six-step `vessel_count` scale: `1`, `2–3`, `4–7`, `8–15`, `16–49`, `50+`; fixed from the 24-hour distribution and shown in the legend; production v2/v3 styling is unchanged |
| Tracks artifact | five ship-type JSON day packs (10,900,081 B) and five typed-binary day packs (7,895,543 B); selected-day type toggles control download/attachment |
| Fishing Effort | independent 2026-08-21 daily sample, 2,887 polygons, 1,253,080 B, 138,297.72 apparent fishing hours |
| artifact readback | 328/328 assets, 109,760,767/109,760,767 B, SHA/JSON/binary/PMTiles structure and individual MVT semantics passed |
| browser | main-map Grid/Tracks/Fishing visuals and popups passed on desktop and 390x844 viewport; full 14-field members are visible for Grid and Tracks. This is visual acceptance, not a mobile-device performance claim |
| day-pack bench correction | the earlier DEFAULT run loaded only 149,827 / 799,771 points (18.7%) and 11,711 / 106,694 segments (11.0%); its 17.6ms RAF and heap values are not full-load release evidence |
| all-five JSON cold run | 799,771 points / 106,694 segments (100%); 10,900,081 B transfer; 1,464.5ms decode; RAF p95 80.5ms; frame-work p95/max 72.6/282.6ms; peak overflow 4,022 heads / 0 vertices |
| all-five typed cold run | 799,771 points / 106,694 segments (100%); 7,895,543 B transfer; 515.9ms decode; RAF p95 74.4ms; frame-work p95/max 66.9/150.5ms; peak overflow 4,019 heads / 0 vertices |
| heap evidence | unavailable: the in-app browser launch did not carry externally auditable `--enable-precise-memory-info` attestation, so the corrected exporter records null plus a warning |

The corrected 100% workload runs fail the current day-pack desktop target and head budget by
a wide margin. Typed binary reduces transfer and decode cost but does not fix the per-scrub
frame construction bottleneck. This is sufficient to enter a Phase 2 **shadow POC** for spatial
shards / viewport-time culling; it is not permission to change production. A real mobile-device
run and externally attested heap run are still missing, so no mobile or heap gate is passed.

The v4 shadow exporter currently groups raw `CARGO|CARRIER` as `cargo`, preserves `TANKER`,
`PASSENGER` and `FISHING`, and puts every remaining raw value (including `GEAR`, `OTHER`,
`NA`, null, `BUNKER` and `SEISMIC`) into `other`. The DEV-only legend now states this boundary
instead of reusing the production AIS six-class legend. Removing Tanker, excluding GEAR,
changing the default bucket set, or reassigning CARRIER are contract decisions still awaiting
explicit approval; production v2/v3 taxonomy remains unchanged.

## Full-fidelity v3 production truth (2026-08-27)

| boundary | status |
|---|---|
| frontend/collector contract, tests, production build | complete |
| migrations 376 / 377 | applied to production |
| v3 shadow release assets | generated for 2026-08-15..21 UTC |
| production S3/Supabase full audit | complete: schema3/full_fidelity root release 2026-08-21 bytes/hash; run e00 schema3 shadow and 3,311 counters/assets; HEAD 3,311/3,311 with zero missing/head_errors/bytes/SHA mismatches and timed_out=false |
| live manifest readback | complete: 2026-08-27 readback of `/global-maritime/gfw-hourly/v3-shadow/manifest.json` returned schema 3, release `2026-08-21`, bbox `122.434,23.22953,132.85274,34.35812`, 3,311 assets, 993,557,709 bytes |
| push / deploy | push/merge complete (`master == origin/master == 019f7f8`); production deployment was user-confirmed from the live page on 2026-08-26, not re-run by this 2026-08-27 docs-only handoff |
| browser acceptance | user-confirmed on production 2026-08-26 for Grid / Tracks / time axis / data-date notice; this is user acceptance, not a fresh agent browser run on 2026-08-27 |
| canonical v2 | live schema 2 root remains unchanged rollback path; v4 work below must not patch either live root in place |

Generated metrics: 1,426,359 points; 226,830 features; 64,051 vessels; 168,936
segments; 57,894 singleton nodes; 1,105,448 grid cells; SAR 0; about 995 MB.

Do not infer physical-vessel completeness from these counts. GFW HIGH values are hourly
grid-center observations; inferred polygon footprints and same-segment linear interpolation
are visualization semantics, not official cell boundaries or raw AIS positions. A failed
S3 hash/bytes/cache, Supabase ledger/count, sidecar-detail, deploy, or browser check must
leave canonical v2 selected; immutable releases are never patched in place.

## East Asia 0.1-degree v4 redesign (accepted contract; local POC complete)

> This section remains the accepted implementation contract. The 24-hour local shadow POC is
> summarized above, but nothing was uploaded or deployed. Current v2/v3 production and rollback
> assets remain authoritative until v4 passes every release gate below.

### Frozen product decisions

| item | accepted decision |
|---|---|
| collection bbox | `115.93462, 20.36314, 134.73486, 36.52495` |
| coverage semantics | East China Sea / Taiwan / Ryukyu / Kyushu / Shikoku / western Honshu corridor; Osaka, Tokyo, eastern/northern Japan are outside this bbox |
| Grid resolution | `0.1°` is the only published v4 presence-grid resolution; v4 does not require a published `0.01°` Grid |
| Grid and Tracks | remain two independent frontend layers, sources, loading states, legends and popups; never merge them into one layer |
| Tracks visual reference | reuse the existing Taiwan full-AIS `ships` layer mental model: selected-day preload, local timeline playback, Three.js instanced vessel heads and preallocated trail buffers |
| vessel-type filter | accepted; it must prevent asset/source loading, not merely hide already-downloaded features in Mapbox |
| Fishing Effort | add a third independent GFW layer based on apparent fishing effort; do not derive it by renaming vessel presence |
| SAR unmatched | remains a fourth independent layer and retains the existing “AIS-unmatched SAR detection, not illegal/dark-vessel proof” wording |
| production migration | build v4 as a shadow immutable release; do not mutate or delete v2/v3 until v4 upload/readback/deploy/browser/rollback gates pass |

The selected bbox is about 2.625 times the current v3 bbox by spherical-area ratio. With the
current bbox-origin 3-degree tiling algorithm it produces 42 report tiles (`7 × 6`), not a
globally aligned 3-degree catalog. It contains 30,618 theoretical `0.1°` cells (`189 × 162`),
but only occupied marine cells should be published.

### Layer contracts

#### 1. `gfwHourlyGrid` — hourly vessel-presence Grid

- Publish hourly `0.1°` polygon PMTiles plus a detail contract containing every unique vessel
  in the selected cell/hour.
- `vessel_count` is the count of unique `vessel_id` values in that parent cell/hour. Do not
  sum child-cell counts without cross-child deduplication.
- The displayed count and decompressed member list length must agree. No client cap, omitted
  members, or silent truncation is allowed.
- Keep H/H+1 loading and visual crossfade, but the selected hour must stay visible at 100% if
  H+1 is missing. Merge click/hit properties into the same PMTiles contract when practical so
  the Grid does not need an extra duplicate render source.
- The local shadow uses stable `vessel_count` bands (`1`, `2–3`, `4–7`, `8–15`, `16–49`,
  `50+`) instead of a per-hour auto-domain, so the same color remains comparable across hours.
- Re-shard detail sidecars by a measured compressed-payload target; do not assume the current
  fixed 16 buckets/hour remains suitable after parent-cell aggregation.
- First compare two upstream routes on the same 24-hour sample:
  1. GFW `LOW` (`0.1°`) report directly.
  2. GFW `HIGH` observations locally aggregated to `0.1°`.
- Direct `LOW` is preferred only if it preserves the hourly vessel identity set and all popup
  fields. Otherwise fetch HIGH privately and publish only the derived `0.1°` product.

#### 2. `gfwHourlyTracks` — approximate hourly Tracks

- Keep this as a separate sidebar layer from Grid.
- Replace the current full-bbox hourly GeoJSON-frame rebuild path with selected-day immutable
  track packs split by vessel-type bucket, for example:

  ```text
  tracks/<UTC-date>/cargo.daypack
  tracks/<UTC-date>/tanker.daypack
  tracks/<UTC-date>/passenger.daypack
  tracks/<UTC-date>/fishing.daypack
  tracks/<UTC-date>/other.daypack
  ```

- Enabling a vessel type is what attaches/downloads that asset. A client-only visibility
  filter does not satisfy the performance requirement.
- Render with a dedicated Three.js scene modeled on the Taiwan `ships` layer: `InstancedMesh`
  heads, preallocated `BufferGeometry` trails, viewport culling, fixed explicit render budgets,
  and browser-local time interpolation after the selected day loads.
- Default track types after enabling the Tracks layer: Cargo, Tanker and Passenger on;
  Fishing and Special/Other off. Fishing activity remains available through the independent
  Fishing Effort layer.
- Default trail window is 30 minutes; retain 1-hour and 3-hour options. Never draw future
  geometry. Only interpolate between valid adjacent observations in the same exporter segment;
  gaps, non-monotonic time, impossible speeds and boundary discontinuities must split tracks.
- Same-coordinate endpoints must aggregate visually: marker size represents member count and
  popup access preserves the complete member list.
- Selected-day playback must not perform a network request on every hourly timeline tick.
  Prefetch adjacent days, abort stale foreground requests and start with an LRU limit of 2–3
  GFW days, not the Taiwan layer's current 7-day default.
- Day-pack format is deliberately not frozen. The 24-hour POC must compare compressed JSON
  against a compact typed/binary representation and choose from measured transfer, decode,
  heap and render evidence.
- Spatial shards / time-sliced MVT are a conditional Phase 2 optimization, not a Phase 1
  requirement. Add them only if truthful full-data day packs cannot pass mobile and desktop
  gates without silent feature caps.

#### 3. `gfwFishingEffort` — apparent Fishing Effort

- New independent layer using GFW apparent fishing effort, preferably `LOW` / `0.1°` and UTC
  daily partitions for timeline playback.
- Primary metric is apparent fishing hours. Use a polygon sequential/log scale, not vessel-count
  circles. A later comparison mode may show change versus a fixed 7-day or 28-day baseline.
- Popup/legend must show selected UTC date, metric unit, dataset version, aggregation facets,
  latest available date, GFW attribution and the apparent/model-derived/non-realtime caveat.
- Fishing Effort does not share the Presence count contract, Grid member sidecars or SAR
  unmatched semantics.

### Capacity model for the accepted bbox

These values are planning estimates derived from the current 2026-08-15..21 v3 asset inventory,
not East Asia encoder measurements:

| scenario | relative workload | vessel-hours/day | occupied 0.1° cells/day | Grid-only 7-day storage |
|---|---:|---:|---:|---:|
| low density | 0.656× | about 134k | about 29,662 | 0.123–0.173 GiB |
| middle | 1.969× | about 401k | up to 30,617 | 0.189–0.378 GiB |
| high density | 3.937× | about 802k | up to 30,618 | 0.283–0.683 GiB |

If the old full-bbox hourly frame model were retained, the middle estimate would be about
1.195 MiB gzip/hour or 200.8 MiB/7 days. This is close enough to the existing Taiwan `ships`
day-transfer order of magnitude to justify a day-pack/Three.js POC, but gzip size is not browser
heap or frame-time evidence.

### Required implementation order

All implementation must use isolated worktrees because sibling repos have parallel sessions.
Do not sync, merge, reset or clean another session's branch/worktree.

1. **Read-only audit**: re-read this handoff, current v3 manifests/contracts, the Taiwan
   `ships` loader/cache/`ShipScene`, data-collector lifecycle and GFW official terms/API docs.
2. **24-hour upstream shadow POC** in `data-collectors`: exact accepted bbox, LOW versus
   HIGH-to-0.1 identity parity, Grid/detail build, vessel-type day packs and one daily Fishing
   Effort partition. No production upload.
3. **Contract decision**: freeze v4 manifest paths/schema only after POC evidence; document the
   cross-repo contract/ADR in `taipei-gis-analytics` from a clean worktree.
4. **Collector implementation**: daily scheduled immutable build, checksums, current+previous
   release retention, rollback pointer, cleanup ordering and regression tests.
5. **Frontend implementation** in `mini-taiwan-pulse`: independent Grid, Tracks and Fishing
   Effort layers; Three.js Tracks scene; type-aware day loading; timeline, loading, legend,
   popup and latest-data notice.
6. **Release**: upload shadow assets, checksum/HEAD readback, container pull/sync, Cloudflare
   Range/cache verification, HTTP manifest/asset verification and real desktop/mobile browser
   acceptance before any canonical switch.
7. **Cleanup**: retain v2/v3 rollback until the observation window and rollback test pass;
   deletion must follow the existing manifest-ledger/lifecycle policy and be recoverable.

Cross-repo ordering after the POC contract is frozen remains:

`taipei-gis-analytics → gis-platform (only if DB/RPC is required) → data-collectors → mini-taiwan-pulse`.

### POC evidence and acceptance gates

- LOW versus HIGH-to-0.1: unique vessel-hour identity parity, identity-field null rates,
  duplicate/conflict counts and missing-member report.
- Grid: no-drop PMTiles evidence; every cell count equals its full detail membership; invalid
  coordinates and omitted/capped records are zero.
- Collector: actual 42-tile report/page/request counts, wall time, response bytes, retries,
  429/524 handling, peak RSS, encode time and artifact bytes.
- Tracks: per-type bytes/counts/hash; segment/gap correctness; no future line; same-coordinate
  member aggregation; date-boundary playback.
- Fishing Effort: resolved dataset version, latest available date, nonnegative hours, UTC-day
  semantics, attribution and revision behavior.
- Browser: cold/warm load bytes and time, decode time, JS heap after 3-hour scrub, desktop p95
  frame under 16.7 ms, mobile p95 under 33 ms, no white frame and no unbounded cache growth.
- Release truth must be reported separately for build, contract/wire, stage, upload, readback,
  pull, deploy, HTTP and browser. Tests, HTTP and screenshots do not substitute for one another.

### Explicit non-goals and safety boundaries

- Do not preserve `0.01°` merely for backward compatibility if v4 `0.1°` fulfills the accepted
  Grid/popup contract.
- Do not merge Grid and Tracks, or substitute Grid centers for a complete Tracks interaction.
- Do not describe vessel presence as fishing effort, or SAR unmatched as confirmed dark/illegal
  vessels.
- Do not connect delayed GFW endpoints to current Taiwan AIS/AISStream as one continuous track.
- Do not meet performance gates by silently dropping vessels or retaining a hidden client cap.
- Do not delete or overwrite immutable v2/v3 production assets during POC or shadow rollout.

### Copy/paste prompt for the implementation session

```text
請先閱讀並以這份文件為 SSOT：
/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/mini-taiwan-pulse/docs/features/global-maritime/handoff.md

開始前請再讀各 repo 的 AGENTS.md / CLAUDE.md，並遵守 handoff 的「Next session: East Asia 0.1-degree v4 redesign」章節。請使用獨立 worktrees，保留其他 session 的 dirty files/branches，不要 reset、clean、同步或合併他人的平行變更。

本 session 第一個目標只做 24 小時 shadow POC，不切 production：
1. 固定 bbox 115.93462,20.36314,134.73486,36.52495。
2. 比較 GFW LOW 0.1° 與 HIGH→本地聚合 0.1° 的 vessel-hour identity、完整 popup members、bytes、wall time 與 peak RSS。
3. 產出 0.1° hourly Grid PMTiles/detail、依船種拆分的 selected-day Tracks day packs，以及獨立 daily Fishing Effort sample。
4. Tracks 視覺與時間載入基準請參考既有台灣全量 AIS `ships` 的 useShipData / shipLoader / ShipScene；Grid 與 Tracks 必須維持兩個獨立 layer，Fishing Effort 是第三個獨立 layer。
5. 不要沿用每小時整區 GeoJSON setData 作為既定答案；先以 POC 比較 day-pack 格式與 browser heap/frame time。Spatial shards 只有在 day-pack 不達標時才進 Phase 2。
6. 完成資料正確性、單元測試、artifact readback 與本機 desktop/mobile browser 效能驗收；分開回報 build、contract、upload、readback、deploy、HTTP、browser 狀態。POC 階段 upload/deploy 應維持 not run。

請由主 agent 負責契約、複雜決策、跨 repo 整合與最後驗收；依專案規則把 bounded 探索、機械工作與獨立實作分派給 task agents。先提出實際 task plan 與 worktree/ownership 配置，確認當前 repo 狀態後直接開始 POC。不要先改 production v2/v3，也不要刪除任何既有 S3/Supabase/Cloudflare 資產。
```

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
