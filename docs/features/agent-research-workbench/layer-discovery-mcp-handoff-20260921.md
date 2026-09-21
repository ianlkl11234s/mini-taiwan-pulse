# Layer Discovery／MCP／GIS 分析完整接手文件

> 日期：2026-09-21
> 狀態：P0 camera scene-ready 與 result overlay paired-browser highlight/readback 已完成；45 組統計 values contract、Point→Polygon/MultiPolygon 空間 kernel、8-result collection 與 provider gates 已完成；同版 boundary、live Google／Valhalla graph、origin/scope 與 clear／expiry／revoke live 回歸仍待補
> 白話導覽：[pulse-research-system-guide-20260921.md](./pulse-research-system-guide-20260921.md)
> 互動架構圖：[pulse-research-system-map.html](./pulse-research-system-map.html)

## 1. 新 session 先讀這裡

這輪已把 Mini Taiwan Pulse 從「能搜尋／開關圖層」推進到「有 Dataset／Access 契約、可做有界查詢與基礎 GIS 分析、可保留 receipt、可控制配對網站」的階段。

目前真正的下一個 blocker 不是再增加 tools，而是把分析結果與畫面做成完整閉環：

1. `set_camera`／`fit_bounds` 已完成 accepted → applied → ready → browser readback 本機驗收。
2. Mini、MCP 與 Gateway 已接通 bounded `pulse_present_result`，並由 paired browser 讀回 10 筆結果、source/layer IDs 與 `ready:true`；dark/light popup 視覺也已實測。
3. 小型、actual geometry 的 Point→Polygon／MultiPolygon `within`／`intersects`／`aggregate_by_area` 已支援；但行政統計尚無同版 boundary geometry，所以不能把 values-only recipe 直接升格成面分析。路網／等時圈目前只有 Valhalla HOLD contract，raster 仍不支援。

下一步應先補行政區同版 boundary adapter 與分析 origin／scope 呈現，再 build 一份版本化 Taiwan Valhalla graph；Google 需先完成目前 Mapbox 底圖的 display/storage policy review 與 server runtime。不要先繼續手寫大量 dataset adapters。

### 2026-09-21 過夜實作 checkpoint

- Statistics compiler：`SOCIAL_ENABLED_STATISTICS_RECIPES` 的 45 個 recipe 全部派生成 `regional-statistics:<layer_key>` dataset；目前是 values-only，exact release whitelist、dimensions、boundary version、period、unit、missing／suppressed／zero 都保留。
- Spatial kernel：支援 actual Point 對 actual Polygon／MultiPolygon 的 `within`／`intersects`，另有 `aggregate_by_area`；holes、multipart、boundary excluded/included、unmatched／multiple matches 與 comparison/output budgets fail closed。
- Result collection：renderer 依 geometry type 處理 Point／Polygon／MultiPolygon，不再綁 `tw-schools-grid-150m`；三端上限一致為 8 logical results，總量上限 10,000 features／100,000 vertices／8 MiB。
- Google：`pulse_get_provider_capabilities` 與 `pulse_geocode_address(provider=google, externalConsent=true)` 有可測 receipt；目前固定 `disabled`、`sent=false`，沒有讀出或傳送 key／地址。
- Walking：`pulse_route_distance`／`pulse_walking_isochrone` 已通過三端 strict schema；browser 回 `HOLD/VALHALLA_GRAPH_NOT_REGISTERED`，不以直線距離或合成圓替代。
- 驗證：Mini 聚焦 55 pass／1 integration skip、跨 Mini↔Gateway 11/11、`tsc -b` pass；MCP full 48/48、typecheck/build pass；真 built stdio 列出 46 tools 並驗 local geocoder、Google disabled／Valhalla HOLD 與負向 schema；Gateway 50/50 pass。Mini 排除已知 sibling catalog gate 後全套 1,785 pass／8 skip；含該 gate 的完整結果為 1,790 pass／8 skip／1 fail，唯一 failure 是 sibling catalog 缺 19 個既有日本 dataset IDs。
- 尚未取得本 checkpoint 的真人 paired-browser live readback；現有 camera/result overlay live 證據仍沿用前一 checkpoint，不能拿本輪 unit/contract tests 冒充新 browser 證據。

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

## 4. 46 個 MCP tools

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
- group count、sum、average、min、max
- result-to-result key join，含 cardinality 檢查
- ratio／difference，保留 null 與除零語意
- UTC day／week time series 與比較
- data quality、record evidence、paged result readback
- result bounds、result listing／removal

未支援：

- point-in-polygon、面積與密度
- 任意 spatial predicate
- 路網距離、步行／車行 routing、isochrone
- raster／zonal statistics
- 任意 SQL、URL、檔案路徑、expression 或 code
- 任意 GeoJSON／style overlay；只允許 session-local result IDs

## 10. 本機地址定位

MCP 新增 `pulse_geocode_address`，透過本機 worker 查詢既有 TGOS／OSM 衍生索引，不把地址送往外部 geocoder。

重要檔案：

- MCP `src/research/offlineGeocoder.ts`
- MCP `scripts/offline-geocoder-worker.py`
- MCP `src/research/offlineGeocoder.test.ts`

語意：

- `exact_cache`／`exact_osm`：標準化地址命中，但仍應回報來源。
- `interpolated`：道路門牌內插，只能說估計位置，不能說精確門牌。
- `no_match`：目前本機索引未命中，不代表地址不存在。
- `unavailable`：adapter 或本機資料不可用，不代表 no match。

實際 live E2E 已完成：地址定位 → 教育 dataset query → 最近 10 所學校直線距離 → receipt。

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

- 真 stdio MCP client 讀取原 41-tool catalog 與 structured schemas；working tree 新增 `pulse_present_result` 後為 42 tools。
- guest／owner／revocation／超限與錯誤參數負向案例。
- Jev live routing，receipt `executed:false`。
- 地址查詢與最近 10 所學校分析。
- result paging、quality、evidence、bounds 與 receipt。

已完成 P0 follow-up：

- 首次 live 回答算出最近學校後沒有主動移動地圖；Skill 已補強，要求有 presentation intent 時必須走 camera／bounds。
- `set_camera` 假 error 的根因是 Mapbox 可能錯過 `moveend`、主地圖持續 render 而不進入全域 `idle`，以及實際 zoom 會有約 `0.003` 的正規化差異。現以最終 camera readback、下一個 render frame 與 `0.01` zoom 容差驗證。
- `fit_bounds` 不再比對 implementation-dependent camera，改驗證四個 bounds 角點是否落在扣除側欄、timeline 與 padding 後的 safe viewport。
- live receipts：`set_camera` command `728a9d82-c4ad-4747-80fb-714c9b34927e` ready at revision 2；`fit_bounds` command `1c5d1cc7-7cc8-4616-a75c-7bde429b6c77` ready at revision 4。Browser DOM 最終讀回 `25.0231, 121.5646 z11.1`，console 無 error／warn。

Result overlay 完成進度：

- Mini 已用 session-local `resultId` 產生 bounded transient GeoJSON source/layer，支援 Point 與已註冊的學校格網 Polygon、opacity、popup、style reload、過期／撤銷／清除。
- MCP 已新增 `pulse_present_result`；只接受 0–4 個唯一 session result IDs，不接受任意 GeoJSON 或 style。
- `map_context.resultPresentation` 會讀回 result IDs、dataset、feature count、source/layer IDs 與 ready；安裝前先驗證全部 geometry，避免部分更新。
- Gateway 已允許 `results: { resultIds }`：限 1–4 個唯一、安全格式的 session reference；`results: null` 清除。任意 GeoJSON、URL、style、code、額外欄位、空／重複／超量 IDs 仍拒絕。
- Gateway 完整測試 50/50 通過；Mini 對實際 Gateway 的 pairing／pending-command contract test 11/11 通過。
- paired browser 已完成 highlight E2E：`analysis-nearest-mubavd3z-1` 的 10 個學校點位進入 `analysis_result` mode，`resultPresentation` 讀回 result ID、10 features、source/layer IDs 與 `ready:true`；相機最後讀回約 `121.5647, 25.0330, z14.51`。
- popup 已改為網站同系統的近黑不透明玻璃，dark/light theme 與 theme switch 後 overlay 保留均已目視驗證；持續 HMR session 曾保留歷史 dev warning，因此這不是 fresh-load clean-console 證據。

## 13. 提交前驗收

### MCP repo

- `npm run typecheck`：通過。
- `npm run build`：通過。
- `npm test`：5 files、47 tests 全通過。

### Mini Taiwan Pulse

- `npx tsc -b`：通過。
- `npm run build`：通過；只有既有 chunk-size warning。
- `npm test`：235 files／1,767 tests 通過、1 file／1 test 失敗、8 tests skipped。唯一失敗是既有 `upstreamRegistry.test.ts` 缺 19 筆 Japan accommodation／medical catalog refs；與本輪 research 變更無直接關係，但正式整合前仍須修正或由其 owning workstream 補齊。
- scene-ready focused tests：4 files、24 tests 全通過。
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
6. 🟡 補 live browser clear／expiry／revoke 回歸，並將地址 origin 與分析 scope 作為獨立、可讀回的視覺物件。

### P1：行政區 GIS

1. 建立版本固定、來源明確的行政區 boundary adapter。
2. 將已完成的 generic point-in-polygon／aggregate-by-area kernel 接到同版行政區 boundary，保留 boundary mismatch／unmatched 證據。
3. 正確投影、面積與 density，明示 CRS／unit。
4. 擴充教育、醫療、Statistics snapshot 與 owner-only adapters；逐一驗證，不批次開放。

### P2：可達性與複雜分析

- 先 build／登記一份版本化 Taiwan Valhalla graph，再做單一地址 5／10／15 分鐘 walking isochrone vertical slice；固定 OSM extract、engine、pedestrian profile、snap／unreachable 與 checksum。目前只有 HOLD contract。
- 版本化路網、network distance、travel time、isochrone；OSM 是來源資料，不等於 routing engine。
- accessibility／service coverage／service desert。
- 多圖層 suitability，權重與標準化必須可見。
- raster／zonal statistics，保留 resolution、NoData、time、coverage。

### P3：智慧呈現

- viewport suitability、zoom／bounds 建議。
- clutter、clustering、sampling、opacity 與 label 建議。
- 建議必須可驗證、可覆寫，Jev 不直接操控畫面。

## 15. 下一個 session 的第一個驗收題

建議仍用已跑過的基準題，方便比較：

> 請定位「臺北市信義區市府路45號」，列出最近 10 所學校，說明地址定位精度、資料來源、直線距離與限制，並把地圖移到能看清這批結果的範圍。等畫面 ready 後，再讀回中心、zoom 與已開圖層。

驗收必須同時滿足：

1. 地址來源與 exact／interpolated 語意正確。
2. query／spatial result 有 source、version、coverage、missingness、access、limits receipt。
3. camera command 到 ready。
4. browser readback 與目標範圍一致。
5. 只有 Gateway 接受 command、browser 回報 ready，且 `map_context.resultPresentation` 讀回一致後，才可宣稱 10 筆結果已高亮；本輪已取得這份 paired-browser 證據。

## 16. Release truth

| release unit | build | contract/wire | stage | upload | readback | pull | deploy | HTTP | browser |
|---|---|---|---|---|---|---|---|---|---|
| Mini Taiwan Pulse research runtime | done：tsc／Vite | done：descriptor、analysis、Skill、transient result overlay、Gateway contract | done：camera baseline＋overlay `7888f37a` | N/A | done：camera／bounds；result overlay focused＋cross-repo contract | not run | not run | local only | done：camera／bounds／highlight readback；live clear／expiry／revoke pending |
| Research Gateway | N/A | done：bounded results refs、clear、revision/session relay | done：local commit `05f6ecb` | N/A | done：50/50 tests；Mini cross-repo 11/11 | not run | not run | local only | highlight readback done；live clear pending |
| pulse-research MCP | done：tsc／dist | done：42 tools | done：camera baseline＋present tool `ffe1d25` | N/A | done：real stdio／47 tests；Gateway command contract pass | not run | not run | N/A | paired highlight readback done |
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
