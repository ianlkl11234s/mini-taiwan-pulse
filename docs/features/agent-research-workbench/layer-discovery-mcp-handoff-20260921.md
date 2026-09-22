# Layer Discovery／MCP／GIS 分析完整接手文件

> 日期：2026-09-21
> 狀態：P0 camera scene-ready、analysis scope、result overlay 與 5-layer grouped collection 的 paired-browser readback 已完成；45 組統計已接同版 boundary 成可呈現 MultiPolygon。Google 真實 geocode、Valhalla 真實外部 routing，以及 production／持久化仍未驗證
> 白話導覽：[pulse-research-system-guide-20260921.md](./pulse-research-system-guide-20260921.md)
> 互動架構圖：[pulse-research-system-map.html](./pulse-research-system-map.html)

## 1. 新 session 先讀這裡

這輪已把 Mini Taiwan Pulse 從「能搜尋／開關圖層」推進到「有 Dataset／Access 契約、可做有界查詢與基礎 GIS 分析、可保留 receipt、可控制配對網站」的階段。

目前真正的下一個 blocker 不是再增加 tools，而是把分析結果與畫面做成完整閉環：

1. `set_camera`／`fit_bounds` 已完成 accepted → applied → ready → browser readback 本機驗收。
2. Mini、MCP 與 Gateway 已接通 bounded `pulse_present_result`，並由 paired browser 讀回 10 筆結果、source/layer IDs 與 `ready:true`；dark/light popup 視覺也已實測。
3. 小型、actual geometry 的 Point→Polygon／MultiPolygon `within`／`intersects`／`aggregate_by_area` 已支援；45 組 social statistics recipe 也已用 exact `boundary_version + level + area_code` 接成 MultiPolygon。路網／等時圈已有逐次同意的公共 Valhalla demo POC adapter，但真實外部 E2E、自管 graph 與 raster 分析仍未完成。

下一步先在新 Codex process 載入最新 48-tool schema，重跑一題「目前中心 2 公里教育資源」的完整 agent workflow；之後才在逐次明示同意下，分別測 Google geocode 與公共 Valhalla demo。Production 若要穩定路網，仍需 build／登記版本化 Taiwan Valhalla graph；Google 仍需完成目前 Mapbox 底圖的 display/storage policy review。不要先繼續手寫大量 dataset adapters。

### 2026-09-22 session close checkpoint

- Paired browser 已完成真資料的 5-layer collection：臺北市師生比行政區面、便利商店、學校、圖書館、醫院，共 428 features；關閉 healthcare group 後 readback 為 413 features，逐層／逐組 visibility、排序、dataset IDs 與 `ready:true` 一致。
- 同一 bbox 的來源結果為 schools 54、public libraries 12、hospitals 15、convenience stores 346；54 個學校點對 22 個縣市面完成 1,188 次比較，54 matched、0 unmatched、0 multiple。這是該次有界 result，不是全台總量。
- 臺北市 `area_code=63000` 的教育統計值為 `12.053068333162585` students/teacher，period `2025-08-01`–`2026-07-31`，boundary `COUNTY_MOI_1140318`；來源 freshness 為 stale，回答不可稱為即時或最新現況。
- Result session store capacity 由 8 提升到 16；畫面 collection 仍最多 8 層。加入 3 個分析中介結果後，既有 5 層仍保持 ready，證明工作結果不再過早逐出畫面結果。
- `pulse_create_analysis_scope`、origin marker 與 straight-line geodesic radius 已接通；它是顯示用範圍，不是行政邊界或 walking isochrone，也不能冒充 authoritative analysis geometry。
- Google adapter 已支援 `GOOGLE_MAPS_API_KEY`、逐次 `externalConsent:true`、bounded normalized receipt 與不持久化政策；Valhalla 已改為固定公共 demo 的 consented POC proxy。兩者都只有 local/mock contract 證據，本輪未把使用者地址或座標送往外部 provider。
- Transport 修正允許 browser result 256 KiB、agent query-status 288 KiB、單字串 32 KiB；其餘一般 endpoint 仍為 32 KiB。真 fresh stdio client 已成功讀回 17,495-byte、33-version 的 statistics descriptor；不能把舊 Codex process 的 schema 當成最新 schema。
- 最新驗證：Mini research slice 40 files，197 passed／5 skipped（202），`npx tsc -b` 通過；Gateway 55/55；MCP 54/54、typecheck、build 通過。這些是 local tests，不是 production 證據。
- 最新 commits：Mini `03a6bf59`、`1ecdefb7`、`a1fabc65`、`47382e90`、`93e70b1a`、`df9d9a6c`；Gateway `dca622e`、`3756ba1`、`5f5b236`、`68b3408`、`cc3e824`；MCP `6678d0e`、`1093ad0`、`c0d0bf2`、`44efc6e`。均 local only，未 push／PR／merge／deploy。

### 2026-09-22 boundary／collection checkpoint

- Statistics boundary adapter：45 個 `regional-statistics:<layer_key>` dataset 改用正式 `loadRegionalStatistics`，values 與 immutable boundary 必須同 release boundary version／level，並依 `area_code` join；Polygon 統一正規化為 EPSG:4326 MultiPolygon、actual、spatial-analysis eligible。
- Coverage／semantics：以同版 boundary 全體為 rows；沒有 observation 的行政區仍保留 `status=missing`，suppressed／zero／source token 不變。每個結果分別帶 values receipt 與 boundary SHA/version/resource receipt。
- Result collection：canonical scene 為 ordered `items[{resultId,visible,groupId}] + groups[{groupId,label,visible}]`；effective visibility 為 item 與 group 同時可見。Mini 面板可逐層／逐組開關與上下排序，Gateway 保留舊 `{resultIds}` 入站相容並正規化。
- Browser readback：`resultPresentation` 除既有 rendered result IDs、datasets、features、sources/layers readiness，另回傳完整 collection 與 effective rendered IDs；hidden result 也會在 ready 前驗 session access／expiry。
- 驗證：Mini 核心／跨 Gateway 47/47、`tsc -b`、production build、排除既有 sibling catalog gate 的全套 1,787 pass／8 skip；MCP 48/48、typecheck／build，real built stdio 47 tools 且含 `pulse_set_result_collection`；Gateway 50/50。
- commits：Mini `658b20fa`、MCP `4cd3aa3`、Gateway `128e5a0`；均 local only，未 push／PR／merge／deploy。
- 尚未取得此 checkpoint 的真人 paired-browser readback；下一步登入／配對後要用真統計 recipe 與至少兩個分組 results 驗證 accepted → applied → ready → `map_context.resultPresentation`。

### 2026-09-21 過夜實作 checkpoint

- Statistics compiler：`SOCIAL_ENABLED_STATISTICS_RECIPES` 的 45 個 recipe 全部派生成 `regional-statistics:<layer_key>` dataset；目前是 values-only，exact release whitelist、dimensions、boundary version、period、unit、missing／suppressed／zero 都保留。
- Spatial kernel：支援 actual Point 對 actual Polygon／MultiPolygon 的 `within`／`intersects`，另有 `aggregate_by_area`；holes、multipart、boundary excluded/included、unmatched／multiple matches 與 comparison/output budgets fail closed。
- Result collection：renderer 依 geometry type 處理 Point／Polygon／MultiPolygon，不再綁 `tw-schools-grid-150m`；三端上限一致為 8 logical results，總量上限 10,000 features／100,000 vertices／8 MiB。
- Google：`pulse_get_provider_capabilities` 與 `pulse_geocode_address(provider=google, externalConsent=true)` 有可測 receipt；目前固定 `disabled`、`sent=false`，沒有讀出或傳送 key／地址。
- Walking：`pulse_route_distance`／`pulse_walking_isochrone` 已通過三端 strict schema；browser 回 `HOLD/VALHALLA_GRAPH_NOT_REGISTERED`，不以直線距離或合成圓替代。
- 驗證：Mini 聚焦 55 pass／1 integration skip、跨 Mini↔Gateway 11/11、`tsc -b` pass；MCP full 48/48、typecheck/build pass；真 built stdio 列出 46 tools 並驗 local geocoder、Google disabled／Valhalla HOLD 與負向 schema；Gateway 50/50 pass。Mini 排除已知 sibling catalog gate 後全套 1,785 pass／8 skip；含該 gate 的完整結果為 1,790 pass／8 skip／1 fail，唯一 failure 是 sibling catalog 缺 19 個既有日本 dataset IDs。
- 尚未取得本 checkpoint 的真人 paired-browser live readback；現有 camera/result overlay live 證據仍沿用前一 checkpoint，不能拿本輪 unit/contract tests 冒充新 browser 證據。
- 本地 commits：Mini code `0dd45e2f`、Mini docs/Skill `4ea8df60`、MCP `4f0a3e5`、Gateway `3f84d7a`。均未 push／PR／merge／deploy。

## 2. Repo／branch／基線

### Mini Taiwan Pulse

- 路徑：`/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/mini-taiwan-pulse`
- branch：`feat/layer-discovery-mcp-contract`
- intended base：`6464004ad3c55b805de817fd51810dd49844467b`
- base 同時是本輪開始時的 `master`／`origin/master`
- 本輪不做 squash、rebase merge 或歷史改寫。

### MCP server

- 路徑：`/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/mini-pulse-gis-mcp-layer-discovery`
- branch：`feat/layer-discovery-mcp-contract`
- intended base／upstream：`origin/main` at `cd23db5b25f06856f85e73b91fc72d434ba61b7f`
- 這是獨立 Git repo，必須有自己的 commit；不能由主 repo commit 代替。

### Research Gateway

- 路徑：`/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/gis-platform-layer-discovery`
- branch：`feat/layer-discovery-gateway-contract`
- 本輪只修改既有 dirty working tree 中的 `services/research-gateway/relay-service.mjs` 與對應測試；不得覆蓋原有 dataset/query contract 變更。
- Gateway 不是 MCP：它負責 auth、pairing、session、revision、receipt 與 bounded command relay，不讀取或渲染分析資料。

## 3. 本輪完成的核心架構

```text
自然語言問題
  -> pulse-gis-analyst Skill
  -> （開放式問題才用一次 Jev 路由）
  -> pulse-research MCP typed tools
  -> paired Research Gateway
  -> Mini Taiwan Pulse research canvas
  -> Dataset / Access contract
  -> bounded query / session-local analysis
  -> Result + Receipt
```

契約鏈固定為：

```text
LayerDescriptor
  -> DatasetDescriptor
  -> AccessDescriptor
  -> Query Result
  -> Receipt
```

必須保持的邊界：

- layer 可被搜尋，不代表 dataset 可讀。
- dataset 可讀，不代表資料最新、完整或 production healthy。
- analysis 完成，不代表結果已在地圖呈現。
- map command accepted／applied，不代表 scene ready。
- missing、null、suppressed、zero、stale、closed 不得合併。
- guest 不得搜尋、描述或查詢未授權資料；owner 也只能讀實際被授權的資料。
- catalog entry 不得解鎖 private loader、visibility 或 release gate。

產品主流程固定以「地址作為探索起點」：地址定位後，應能依使用者問題搜尋多種周邊資料、執行目前支援的有界分析、將結果高亮並讀回畫面狀態。若分析成功但畫面沒有呈現，先查 MCP → Gateway → browser 的 operation／patch allowlist、HTTP 400／`INVALID_INPUT` 與 accepted／applied／ready receipt，再查 renderer 與 dataset；不要直接把問題歸因為資料不存在。Gateway 應以允許有界、declarative、可撤銷、可 readback 的呈現為主，同時保留 auth、session、revision、size 與 executable-input 邊界。

## 4. 48 個 MCP tools

### 路由

- `pulse_route_request`

### Session／配對

- `pulse_pair_session`
- `pulse_get_session`
- `pulse_disconnect_session`
- `pulse_get_study_state`

### Layer／dataset 探索

- `pulse_search_layers`
- `pulse_describe_layer`
- `pulse_get_layer_details`
- `pulse_list_layer_capabilities`
- `pulse_search_layer_records`
- `pulse_describe_layer_statistics`
- `pulse_summarize_layer`
- `pulse_get_layer_controls`
- `pulse_set_layer_control`
- `pulse_search_datasets`
- `pulse_describe_dataset`

### 有界讀取

- `pulse_query_records`
- `pulse_plan_data_access`
- `pulse_materialize_data`
- `pulse_get_query_result`

### 分析與證據

- `pulse_spatial_query`
- `pulse_create_analysis_scope`
- `pulse_aggregate_by_area`
- `pulse_aggregate_records`
- `pulse_join_records`
- `pulse_calculate_metric`
- `pulse_read_series`
- `pulse_compare_series`
- `pulse_get_data_quality`
- `pulse_get_record_evidence`
- `pulse_get_analysis_result`
- `pulse_get_result_bounds`
- `pulse_list_results`
- `pulse_remove_result`

### 地址／地圖／時間

- `pulse_geocode_address`
- `pulse_get_provider_capabilities`
- `pulse_route_distance`
- `pulse_walking_isochrone`
- `pulse_find_places`
- `pulse_get_map_context`
- `pulse_set_layers`
- `pulse_set_camera`
- `pulse_present_result`
- `pulse_set_result_collection`
- `pulse_fit_bounds`
- `pulse_get_time_context`
- `pulse_set_time`
- `pulse_wait_scene_ready`

## 5. Jev 定位

- OpenRouter model：`typesafe/jev-1.13`。
- 只對開放式且跨 discovery／query／analysis／presentation 的問題呼叫一次。
- 精確 dataset ID、layer key、tool、result continuation、pagination 或 pending receipt 不呼叫 Jev。
- 回傳 capability、surface、candidate tools、confidence 與 routing receipt。
- `executed` 必須永遠是 `false`；Jev 不執行、不授權、不判定資料健康。
- 低信心、provider error 或非法候選立即回 deterministic fallback，同一題不重試 Jev。
- `.env` 只要求 `OPENROUTER_API_KEY` 存在；不得將值寫入文件、log 或 commit。

主要檔案：

- MCP：`src/research/jevRouter.ts`、`src/research/server.ts`
- Gateway shadow：`scripts/research/jev-routing-shadow.ts`
- 文件：`jev-routing-accelerator.md`
- Skill reference：`.agents/skills/pulse-gis-analyst/references/jev-accelerator.md`

## 6. GIS Skill

主入口：`.agents/skills/pulse-gis-analyst/SKILL.md`

它負責：

- 依問題決定 discovery、query、analysis、presentation 路線。
- 必要時先用 Jev 縮小候選。
- 地址問題使用 `pulse_geocode_address`，區分 `exact_cache`、`exact_osm`、`interpolated`、`no_match`、`unavailable`。
- 要求先查 dataset 的 grain、geometry role、CRS、coverage、version、license、missingness 與 access。
- 分析後保留 source、version、coverage、missingness、limits 與 receipt。
- 若只取得 bounds，僅能說相機已取景，不能說結果 overlay 已呈現。

本輪依使用者要求暫停 `pulse-map-story` 自動啟用；相關 OpenAI skill 設定已關閉 implicit invocation。

## 7. Dataset／Access SSOT

主 repo 的 canonical 來源是 `src/research/researchDatasets.ts` 及其 validator／schemas，不再新增第三份手寫索引。

重要檔案：

- `src/research/dataContracts.ts`
- `src/research/researchDatasets.ts`
- `src/research/contracts/dataset.schema.json`
- `src/research/contracts/access.schema.json`
- `src/research/contracts/query-result.schema.json`
- `src/research/queryExecutor.ts`
- `src/research/researchAnalysisSession.ts`

契約涵蓋：

- canonical dataset ID、grain、schema
- geometry role、CRS
- source、provenance、time／version、coverage、license
- missing／null／suppressed／zero／stale semantics
- access method、auth／tier、supported operations
- pagination、bbox、time、field projection
- rows／bytes／cost limits
- query result receipt、validation 與 truncation

## 8. Layer 讀取能力

`pulse_summarize_layer` 不再只支援 legacy schools／police registry：

- 已明確 ready：schools、policeStation、medHospital、publicLibraries。
- 單一 same-origin static Point GeoJSON 可進 `on_demand_validation`。
- on-demand 仍須通過 same-source lock、8 MiB、20,000 rows、Point geometry 與 receipt 限制。
- PMTiles、raster、RPC、scene、mixed／custom 維持 fail-closed，直到有同版 sidecar 或專用 adapter。
- 統計使用完整已驗證來源快照，不以 viewport rendered points 冒充總數。

## 9. 目前分析能力

已支援：

- bounded query：limit、cursor、bbox、time、field projection、rows／bytes limits
- Point nearest／within-distance，距離是 Haversine 直線距離
- actual Point 對 actual／derived Polygon 或 MultiPolygon 的 `within`／`intersects` 與 `aggregate_by_area`，保留 unmatched／multiple matches
- 顯示用 origin marker 與 straight-line radius scope；scope 不可當 authoritative boundary 或 walking result
- group count、sum、average、min、max
- result-to-result key join，含 cardinality 檢查
- ratio／difference，保留 null 與除零語意
- UTC day／week time series 與比較
- data quality、record evidence、paged result readback
- result bounds、result listing／removal
- ordered／grouped result collection，逐層與逐組 visibility；最多 8 個畫面 results，session store 最多 16 個工作 results
- consented Google geocode adapter 與公共 Valhalla pedestrian route／isochrone POC adapter；真實外部 E2E 仍未跑

未支援：

- 面積、密度、clip、任意 spatial predicate 與 geometry repair
- production-grade／自管版本化路網；車行 routing 尚未提供，公共 Valhalla demo 沒有 SLA 或 graph checksum
- raster／zonal statistics
- 任意 SQL、URL、檔案路徑、expression 或 code
- 任意 GeoJSON／style overlay；只允許 session-local result IDs

## 10. 本機地址定位

MCP 的 `pulse_geocode_address` 預設透過本機 worker 查詢既有 TGOS／OSM 衍生索引，不把地址送往外部 geocoder。只有明確指定 `provider=google` 且該次帶 `externalConsent=true`，才會從 MCP server 將地址送到固定 Google Geocoding endpoint；raw response 不落盤，normalized receipt 也不寫 Supabase／R2。

重要檔案：

- MCP `src/research/offlineGeocoder.ts`
- MCP `scripts/offline-geocoder-worker.py`
- MCP `src/research/offlineGeocoder.test.ts`

語意：

- `exact_cache`／`exact_osm`：標準化地址命中，但仍應回報來源。
- `interpolated`：道路門牌內插，只能說估計位置，不能說精確門牌。
- `no_match`：目前本機索引未命中，不代表地址不存在。
- `unavailable`：adapter 或本機資料不可用，不代表 no match。

本機地址 live E2E 已完成：地址定位 → 教育 dataset query → 最近 10 所學校直線距離 → receipt。Google 真實 provider call 尚未執行。

## 11. Gateway／網站接線

主 repo：

- `scripts/research/start-gateway.mjs`：啟動 gateway。
- `scripts/research/local-stack.mjs`：detached local stack start／status／stop。
- `src/research/MainMapConnection.tsx`：paired commands、result／receipt、camera／time／layer readback。
- `src/map/cameraPresets.ts`：補充可用地圖鏡位。

本機命令：

```bash
npm run research:local:start
npm run research:local:status
npm run research:local:stop
```

runtime state／log 不寫入 repo；Email 與 secret 只存在 process environment。

本機 persistent 設定可放在 Mini repo 根目錄的 `.env.local`（已 gitignore）；`local-stack.mjs` 只額外載入 `PULSE_RESEARCH_*` prefix，且 shell environment 優先。至少設定：

```dotenv
PULSE_RESEARCH_PILOT_EMAILS=已授權的測試帳號 email
PULSE_RESEARCH_GATEWAY_ENTRY=/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/gis-platform-layer-discovery/services/research-gateway/server.mjs
```

不得提交實際 email、token 或 credential；`VITE_SUPABASE_URL`／`VITE_SUPABASE_ANON_KEY` 仍沿用網站既有 development env。

## 12. 實際 E2E 與已知缺口

已成功：

- fresh built stdio MCP client 讀取 48-tool catalog 與 structured schemas；舊 Codex process 必須重啟才能載入新增 schema。
- guest／owner／revocation／超限與錯誤參數負向案例。
- Jev live routing，receipt `executed:false`。
- 地址查詢與最近 10 所學校分析。
- result paging、quality、evidence、bounds 與 receipt。
- 5-layer collection paired-browser readback、group hide/show、排序與 428→413 feature readback。
- 大型 statistics descriptor 經 Mini → Gateway → MCP fresh stdio 完整回傳，不再因 4,000-char string limit 逾時。

已完成 P0 follow-up：

- 首次 live 回答算出最近學校後沒有主動移動地圖；Skill 已補強，要求有 presentation intent 時必須走 camera／bounds。
- `set_camera` 假 error 的根因是 Mapbox 可能錯過 `moveend`、主地圖持續 render 而不進入全域 `idle`，以及實際 zoom 會有約 `0.003` 的正規化差異。現以最終 camera readback、下一個 render frame 與 `0.01` zoom 容差驗證。
- `fit_bounds` 不再比對 implementation-dependent camera，改驗證四個 bounds 角點是否落在扣除側欄、timeline 與 padding 後的 safe viewport。
- live receipts：`set_camera` command `728a9d82-c4ad-4747-80fb-714c9b34927e` ready at revision 2；`fit_bounds` command `1c5d1cc7-7cc8-4616-a75c-7bde429b6c77` ready at revision 4。Browser DOM 最終讀回 `25.0231, 121.5646 z11.1`，console 無 error／warn。

Result overlay 完成進度：

- Mini 已用 session-local `resultId` 產生 bounded transient GeoJSON source/layer，支援 Point／Polygon／MultiPolygon、opacity、popup、style reload、過期／撤銷／清除，以及 ordered items／groups 的逐層與逐組 visibility。
- MCP 保留簡單 `pulse_present_result`，另新增 `pulse_set_result_collection`；最多 8 個唯一 session result IDs 與 8 groups，不接受任意 GeoJSON 或 style。
- `map_context.resultPresentation` 會讀回完整 collection、effective rendered result IDs、dataset、feature count、source/layer IDs 與 ready；安裝前先驗證所有（含 hidden）result 與 geometry，避免部分更新或用 hidden 繞過 expiry。
- Gateway canonical scene 使用 `results: { items, groups }`，並把舊 `{ resultIds }` 正規化；`results: null` 清除。任意 GeoJSON、URL、style、code、孤兒 group、重複／超量 IDs 仍拒絕。
- Gateway 完整測試 50/50 通過；Mini 對實際 Gateway 的 pairing／pending-command contract test 11/11 通過。
- paired browser 已完成 highlight E2E：`analysis-nearest-mubavd3z-1` 的 10 個學校點位進入 `analysis_result` mode，`resultPresentation` 讀回 result ID、10 features、source/layer IDs 與 `ready:true`；相機最後讀回約 `121.5647, 25.0330, z14.51`。
- popup 已改為網站同系統的近黑不透明玻璃，dark/light theme 與 theme switch 後 overlay 保留均已目視驗證；持續 HMR session 曾保留歷史 dev warning，因此這不是 fresh-load clean-console 證據。

## 13. 提交前驗收

### MCP repo

- `npm run typecheck`：通過。
- `npm run build`：通過。
- `npm test`：54/54 tests 通過。

### Mini Taiwan Pulse

- `npx tsc -b`：通過。
- 最新 research slice：40 files，197 passed／5 skipped（202）。
- 更早 boundary／collection checkpoint 的 production build 與排除 sibling catalog gate 全套測試通過；不要把不同 commit 時點的結果合併成一個最新全套驗收。
- `git diff --check`：提交前必跑。

### 架構文件

- interactive HTML 及 source spec 已通過 Archify validate／deliver。
- 1440×900、1600×1000、1920×1080、2048×1320 亮暗模式 visual-check 通過。
- 已人工檢視 1440×900 light，節點、標籤、線路與 viewer chrome 可讀。

## 14. 下一階段 roadmap

### P0：畫面閉環

1. ✅ 重現 `pulse_wait_scene_ready` error。
2. ✅ 查明 gateway command revision、browser applied／ready 與 render completion 的差異。
3. ✅ 加 focused regression：`set_camera`／`fit_bounds` 後 accepted → applied → ready。
4. ✅ browser readback 確認中心、zoom 與 bounds safe viewport，不以 state 更新冒充視覺完成。
5. ✅ bounded、session-local result overlay：Mini／MCP／Gateway 實作、contract tests、paired browser highlight 與 readback 已完成。
6. ✅ 地址 origin 與 straight-line analysis scope 已成為獨立 result，可分組／排序／開關。
7. 🟡 補 live browser clear／expiry／revoke 回歸，以及 origin/scope 與 5-layer collection 同場的 fresh-session readback。

### P1：行政區 GIS

1. ✅ 建立版本固定、來源明確的行政區 boundary adapter。
2. ✅ 將 generic point-in-polygon／aggregate-by-area kernel 接到同版行政區 boundary，保留 boundary mismatch／unmatched 證據。
3. 正確投影、面積與 density，明示 CRS／unit。
4. 擴充教育、醫療、Statistics snapshot 與 owner-only adapters；逐一驗證，不批次開放。

### P2：可達性與複雜分析

- 目前已有固定公共 Valhalla demo 的 consented POC adapter，但尚未做真實外部 E2E；production 仍應先 build／登記版本化 Taiwan graph，再做單一地址 5／10／15 分鐘 walking isochrone vertical slice。
- 版本化路網、network distance、travel time、isochrone；OSM 是來源資料，不等於 routing engine。
- accessibility／service coverage／service desert。
- 多圖層 suitability，權重與標準化必須可見。
- raster／zonal statistics，保留 resolution、NoData、time、coverage。

### P3：智慧呈現

- viewport suitability、zoom／bounds 建議。
- clutter、clustering、sampling、opacity 與 label 建議。
- 建議必須可驗證、可覆寫，Jev 不直接操控畫面。

## 15. 下一個 session 的第一個驗收題

先用不需外傳地址／座標的題目驗證最新 schema 與通用循環：

> 請以目前地圖中心為準，分析周圍 2 公里內的教育資源分布。列出附近的學校與圖書館數量及類型，判斷它位於哪個行政區，加入該區可用的教育統計資料。請把分析範圍、學校、圖書館與行政區統計各自呈現在地圖上，分成可獨立開關的結果圖層，最後用白話整理這一帶的教育資源概況，並註明資料時間與限制。

驗收必須同時滿足：

1. 使用目前 map center，不呼叫外部 geocoder；中心與 2 公里 straight-line scope 分開呈現。
2. query／spatial result 有 source、version、coverage、missingness、access、limits receipt。
3. camera command 到 ready。
4. browser readback 與目標範圍一致。
5. 只有 Gateway 接受 command、browser 回報 ready，且 `map_context.resultPresentation` 讀回 collection、effective IDs、feature count、sources 與 layers 一致後，才可宣稱結果已高亮。

### Next-session entry

- Repos／branches：Mini 與 MCP `feat/layer-discovery-mcp-contract`；Gateway `feat/layer-discovery-gateway-contract`。
- 第一個動作：重啟 Codex 讓最新 48-tool MCP schema 生效，重新配對，執行上面的 2 公里教育資源題。
- 驗收：query／join／statistics／scope／collection 全部有 receipt，結果可逐層／逐組開關，accepted → applied → ready，最後由 browser readback 對上。
- 外部 provider gate：Google 地址與 Valhalla 座標各自需要當下明示同意；沒有同意就不送出，也不以直線圓冒充步行圈。
- 暫緩：Supabase／R2 result persistence、PMTiles／raster／RPC 大量 adapters、production deployment。

## 16. Release truth

| release unit | build | contract/wire | stage | upload | readback | pull | deploy | HTTP | browser |
|---|---|---|---|---|---|---|---|---|---|
| Mini Taiwan Pulse research runtime | done：tsc；較早 checkpoint Vite build | done：45-recipe same-version MultiPolygon、Point→Polygon/MultiPolygon、origin/scope、ordered/grouped 8-result renderer、16-result work store | done：latest through `df9d9a6c` | N/A | done：latest research slice 197 pass／5 skip | not run | not run | local only | done：5-layer 428 features，group hide 413，ready/readback |
| Research Gateway | N/A | done：collection normalize、spatial、analysis scope、public Valhalla consent proxy、bounded rich result relay | done：latest `cc3e824` | N/A | done：55/55 tests | not run | not run | local only | done via paired Mini collection；真外部 Valhalla 未跑 |
| pulse-research MCP | done：typecheck／dist | done：48 tools、scope、collection、Google consent adapter、walking schemas、288 KiB query readback | done：latest `44efc6e` | N/A | done：54/54＋fresh built stdio descriptor readback | not run | not run | N/A | done via paired Mini collection；真 Google／Valhalla 未跑 |
| Jev routing | done | done：non-executing route + fallback | local commit only | N/A | done：OpenRouter live receipt | N/A | not run | external provider call only | N/A |
| Offline geocoder | done | done：local worker | local commit only | N/A | done：address E2E | N/A | not run | no external geocoder | used in paired local E2E |

本輪沒有 push、PR、merge、deploy、production 啟用或 Supabase 寫入。Local test 與 paired browser 證據不能延伸成 production 完成宣稱。

## 17. Git 安全邊界

- 不得 reset、clean、stash 或 amend。
- 不得代為提交其他 worktree／session 的改動。
- 三個 repo 分開 commit，使用 exact-path staging。
- 後續整合只能使用普通 merge commit；禁止 squash、rebase merge 或改寫歷史。
- push、PR、merge、deploy 仍需另外授權。

## 18. 相關文件

- [白話系統導覽](./pulse-research-system-guide-20260921.md)
- [互動架構圖](./pulse-research-system-map.html)
- [tool foundation plan](./tool-foundation-plan.md)
- [bridge contract](./bridge-contract.md)
- [analysis capability onboarding](./analysis-capability-onboarding.md)
- [Jev routing accelerator](./jev-routing-accelerator.md)
- [前一版 handoff](./layer-discovery-mcp-handoff-20260920.md)
