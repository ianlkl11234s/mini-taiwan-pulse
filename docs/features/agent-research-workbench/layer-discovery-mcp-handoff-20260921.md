# Layer Discovery／MCP／GIS 分析完整接手文件

> 日期：2026-09-21
> 狀態：P0 scene-ready 本機閉環已完成並分 repo commit；尚未 push、merge、deploy 或 production 啟用
> 白話導覽：[pulse-research-system-guide-20260921.md](./pulse-research-system-guide-20260921.md)
> 互動架構圖：[pulse-research-system-map.html](./pulse-research-system-map.html)

## 1. 新 session 先讀這裡

這輪已把 Mini Taiwan Pulse 從「能搜尋／開關圖層」推進到「有 Dataset／Access 契約、可做有界查詢與基礎 GIS 分析、可保留 receipt、可控制配對網站」的階段。

目前真正的下一個 blocker 不是再增加 tools，而是把分析結果與畫面做成完整閉環：

1. `set_camera`／`fit_bounds` 已完成 accepted → applied → ready → browser readback 本機驗收。
2. 有分析 `resultId` 與 bounds，但沒有通用 `pulse_present_result`；只能移動相機，不能宣稱 filtered result 已成為地圖 overlay。
3. 行政區 point-in-polygon、面積密度、路網、等時圈、raster 仍明確不支援。

下一個 session 的第一步應是重現並修復 scene-ready readback，不要先繼續擴充大量 adapters。

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

## 4. 41 個 MCP tools

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
- `pulse_find_places`
- `pulse_get_map_context`
- `pulse_set_layers`
- `pulse_set_camera`
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
- 通用 result overlay

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

## 12. 實際 E2E 與已知缺口

已成功：

- 真 stdio MCP client 讀取 41-tool catalog 與 structured schemas。
- guest／owner／revocation／超限與錯誤參數負向案例。
- Jev live routing，receipt `executed:false`。
- 地址查詢與最近 10 所學校分析。
- result paging、quality、evidence、bounds 與 receipt。

已完成 P0 follow-up：

- 首次 live 回答算出最近學校後沒有主動移動地圖；Skill 已補強，要求有 presentation intent 時必須走 camera／bounds。
- `set_camera` 假 error 的根因是 Mapbox 可能錯過 `moveend`、主地圖持續 render 而不進入全域 `idle`，以及實際 zoom 會有約 `0.003` 的正規化差異。現以最終 camera readback、下一個 render frame 與 `0.01` zoom 容差驗證。
- `fit_bounds` 不再比對 implementation-dependent camera，改驗證四個 bounds 角點是否落在扣除側欄、timeline 與 padding 後的 safe viewport。
- live receipts：`set_camera` command `728a9d82-c4ad-4747-80fb-714c9b34927e` ready at revision 2；`fit_bounds` command `1c5d1cc7-7cc8-4616-a75c-7bde429b6c77` ready at revision 4。Browser DOM 最終讀回 `25.0231, 121.5646 z11.1`，console 無 error／warn。

剩餘缺口：

- 沒有 `pulse_present_result`／`pulse_apply_scene`；目前只能取景，不可宣稱 filtered points 已顯示。

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
5. 設計 bounded、session-local、可撤銷的 result overlay。

### P1：行政區 GIS

1. 建立版本固定、來源明確的行政區 boundary adapter。
2. point-in-polygon 與行政區 aggregation。
3. 正確投影、面積與 density，明示 CRS／unit。
4. 擴充教育、醫療、Statistics snapshot 與 owner-only adapters；逐一驗證，不批次開放。

### P2：可達性與複雜分析

- 版本化路網、network distance、travel time、isochrone。
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
5. 在 result overlay 尚未完成前，明說只是取景，不宣稱 10 筆結果已高亮。

## 16. Release truth

| release unit | build | contract/wire | stage | upload | readback | pull | deploy | HTTP | browser |
|---|---|---|---|---|---|---|---|---|---|
| Mini Taiwan Pulse research runtime | done：tsc／Vite | done：Gateway、descriptor、analysis、Skill | local commit only | N/A | done：local stdio／gateway；camera／bounds scene-ready 閉環 | not run | not run | local only | done：camera／bounds browser readback；result overlay 仍未實作 |
| pulse-research MCP | done：tsc／dist | done：41 tools | local commit only | N/A | done：real stdio／47 tests | not run | not run | N/A | paired local session only |
| Jev routing | done | done：non-executing route + fallback | local commit only | N/A | done：OpenRouter live receipt | N/A | not run | external provider call only | N/A |
| Offline geocoder | done | done：local worker | local commit only | N/A | done：address E2E | N/A | not run | no external geocoder | used in paired local E2E |

本輪沒有 push、PR、merge、deploy、production 啟用或 Supabase 寫入。Local test 與 paired browser 證據不能延伸成 production 完成宣稱。

## 17. Git 安全邊界

- 不得 reset、clean、stash 或 amend。
- 不得代為提交其他 worktree／session 的改動。
- 兩個 repo 分開 commit，使用 exact-path staging。
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
