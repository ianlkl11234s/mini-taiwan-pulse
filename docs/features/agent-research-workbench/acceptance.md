## 2026-09-15 最新增量驗收：Open-ended local research（以本節為準）

- 可驗證鏈：`explore_data → canonical/generic registered same-origin GeoJSON Point subset reader → query → compare_neighborhoods`（每個 source 個別 count）`→ resultId` 呈現。generic metadata/readability 不等於 spatial approval；其他 PMTiles／RPC 尚無通用 reader（已接專用 adapter 除外）。
- 有界性：asset 8 MiB、reader 20,000 rows、neighborhood candidates 2,000、最多 5,000,000 次點對比較、半徑 100–5,000 m。schools 4,315（臺北 345）、libraries 634；這些是來源 record counts，不是獨立機構、服務品質、全域 hotspot 或步行分析。
- 本地檢查：Pulse tests 61 pass／1 skip（既有 optional grid）、`tsc` pass；MCP 23 pass＋build pass；gateway 37 pass。來源 hash／讀取證據在 [驗收 receipt](./evidence/open-ended-acceptance.json) 與 [Agent 實際回答](./evidence/open-ended-agent-answer.txt)。
- 真 Codex offline v2 在補 lineage scope 後，自行跑 explore、describe×2、query×2、compare×2；`answer-v2.md` 明示半徑、345 candidates、臺北 libraries 64、未計跨市界及 freshness unknown。這是 offline data/reasoning 驗收，非 paired browser 驗收。
- 診斷 browser 已 render 345 actual points 並讀回 opacity 與清除無殘留；主站登入配對待使用者，production、主站 E2E、來源 freshness／coverage 都未由此驗收證明。

## 2026-09-14 Semantic Registry／Research Library／Schools Grid 本地驗收

本節是本輪最新證據；下方保留歷史驗收。

- Canonical semantic cards：schools、news、paddy；observed／derived／proxy／hypothesis 分開，confidence 不提升 hypothesis。缺少證據、錯誤來源版本、重複／衝突 evidence、missing／suppressed／zero 均有負向測試。
- Library：SQLite 本地 search／describe／promote／mark-stale、不可覆寫的版本化 bundle 與原始 Point archive。來源 SHA readback、時間與授權證據是 promote gate；目前 schools 維持 HOLD，未知來源時間不使用檔案 mtime 代替。
- 真實格網：4,315 筆來源 place records → 4,061 個有紀錄的 150 m 方格，計數加總 4,315。EPSG:3826 計算，EPSG:4326 呈現；未輸出格子不代表零。這不是去重學校數、教育品質、學區或可達性。
- 原始來源 SHA-256 `7ab34ec23180077bcd32f4617ff31404f1a21c68706d36b2a74a3c4b079377c3`；bundle SHA-256 `6243c6e1c9129202157741c2ed22ab457421430dfe6fac96f9e0553de4521f2d`，3,016,574 bytes。完整來源、grid definition、geometry 重算與計數守恆通過後才產生前端固定 receipt。
- 本地 pipeline 為 Python assign → aggregate → materialize；前端固定 dataset adapter → query → session resultId → 主地圖暫時 Polygon overlay。不是任意輸入的通用 grid executor。來源、方法、版本、unknown 時間／coverage 隨 lineage 保留；持久 asset 與暫存 resultId 分開。
- Browser 1280×720 實際驗證 4,061 格、來源 popup、圖例、透明度 0.55→0.25→0.55、清除結果；guide 新進度文字已讀回。截圖：`/private/tmp/pulse-research-workbench/evidence/grid-foundation/main-map-popup.png`。
- Pulse research＋layer consistency：64 pass／1 skip；analytics Python：27 pass／1 skip；semantic Node：8 pass；MCP research：23 pass。Pulse `tsc -b`／build 與 MCP build 通過。Python JSON Schema 依賴缺少的略過不列為成功，契約 invariant 由現有驗證器及測試覆蓋。
- 實體 bundle 留在 analytics ignored `data/intermediate/research-library/schools-grid-v3/`，只經 loopback DEV allowlist 讀取；stale／不合格 lifecycle 回拒絕。build 未包含 bundle。
- 缺口：本輪未重做登入配對 MCP 端到端或 mobile 驗收；未 push／deploy／migration／production 變更。Network HOLD：缺 engine/profile、graph 版本與 topology／unreachable 證據；school district／real estate 缺合格真實輸入，未建立假資料或空殼 operation。

# 地圖探索與附近查詢驗收

## 本輪範圍

在原本 Mini Taiwan Pulse 主地圖，以本地 `pulse-research` 配對操作。圖層目錄來自現有 manifest/search index；實際資料讀取與附近查詢第一批只允許 schools，其餘圖層回明確不支援，不把 metadata 當可計算資料。

## 使用者驗收問題

1. 「有哪些學校圖層？哪個可以查資料？」應搜尋到 schools、描述來源與 read support、保留 unknown 時間／覆蓋／授權標記。
2. 「學校資料有哪些欄位？先讀三筆。」應回三筆有限欄位、總有效點位4315、明確截斷；null 保留 null。
3. 「找到台北並移動地圖。」find_places 只搜尋既有具名鏡位，台北候選是 city viewpoint，不是地址定位；有候選才設定座標／zoom。不存在的精確地名不得亂猜。
4. 「以 [121.5170,25.0478] 為中心，一公里內有哪些學校？放到原地圖。」以這份固定 hash 資料應命中9筆，地圖只顯示半徑虛線，原始圖層點位保留分類顏色；清單可點選 popup、調透明度、清除。
5. 同位置 limit3：總命中9、returned3、truncated true；清單顯示回傳的3筆與截斷說明；地圖只畫範圍圈，原始圖層不受查詢篩選。
6. [123,25] 半徑1000m：成功零筆，但仍附來源／方法／限制；不可說現地沒有任何學校。
7. 讀取非白名單 medHospital：LAYER_READ_UNSUPPORTED，不能回成功零筆。上鎖圖層：LAYER_DENIED。
8. 本地 UI：「在地圖選位置」→點地圖→「查點選位置附近」；選取座標要可見，與計算 origin 相同。

## 計算與資料界線

- Haversine，球半徑6371008.8m，未四捨五入距離做包含邊界比較（1e-9m浮點容差）。回傳距離為公尺；不是路網／步行時間／服務可達範圍。
- 4315是此檔案的紀錄，不是 dedup 後學校數；code有重複，row ID 使用來源hash＋原feature index。
- 固定檔案 `/education/schools.geojson`，SHA-256 `7ab34ec23180077bcd32f4617ff31404f1a21c68706d36b2a74a3c4b079377c3`，2,504,719 bytes。沿用原工作區檔案，不重新下載全部資料。
- 首次本頁資料讀取至多5MiB、15秒、10000features；之後同頁重用同一hash記憶體快取。重新載頁可重新讀取；沒有宣稱已做磁碟版本管理／S3查詢／Supabase分析。
- sourceTime/license/coverage未知；observedAt是本頁讀取時間。manifest登記的verified不等於本輪驗證上游來源現況。
- 無geometry／非Point／無效座標分別計數；讀取失敗／未支援與成功零筆分開。

## 工具流程

`pulse_search_layers` → `pulse_describe_layer` → `pulse_read_layer` → `pulse_find_places` / `pulse_get_map_context` → `pulse_get_study_state` → `pulse_set_camera` → `pulse_wait_scene_ready` → `pulse_query_nearby` → `pulse_get_study_state` → `pulse_present_nearby` → `pulse_wait_scene_ready`。

Query回傳receipt可能pending；以 `pulse_get_query_result(requestId)` 繼續讀結果。present 使用成功結果的 queryId（與requestId相同）。查詢本身不改地圖，呈現另經revision command。`pulse_present_nearby(queryId:null)` 清除結果。

## 安全與結果生命週期

固定operation與資料來源白名單，不接受URL／SQL／程式碼。配對綁定帳號、tab、session。每study最多32次query、同時1筆pending、30秒到期；結果24KiB、最多保留4筆，淘汰回expired並保留requestId防重播。暫停／撤銷後不得再交付pending結果。

來源為本地已存在的公開展示資料；未進行S3／Supabase資料掃描。LLM驗收使用既有Codex額度，與來源讀取成本分開。未部署正式站。

## 檔案責任

- `src/research/discovery.ts`：沿用catalog及camera presets的探索。
- `nearbyData.ts`：有界讀取、快取、白名單欄位與Haversine計算。
- `QueryResponder.ts` / `bridgeClient.ts`：tab側唯讀request處理與傳輸。
- `MainMapConnection.tsx`：原地圖adapter、配對與使用者操作。
- `NearbyResults.tsx` / `nearbyOverlay.ts`：暫時性結果清單／圖例／popup／透明度／地圖呈現，不冒充永久來源圖層。
- gateway `relay-service.mjs` / `server.mjs`：scoped query lifecycle。
- MCP `relayClient.ts` / `server.ts`：Agent工具與有界輪詢。

## 證據

`/private/tmp/pulse-research-workbench/evidence/nearby-independent.json`：獨立Python計算。
`nearby-live-result.json` / `nearby-live.mjs`：真登入＋實際browser＋built MCP stdio client的端到端驗收。
`nearby-codex-final.txt` / `nearby-codex.log`：真正Codex自然語言驗收已完成，9筆與browser读回一致；曾撞到單pending限制後依序重試，錯誤提示已另補回歸修正。

## 本輪驗收結果

2026-09-11：前端34／Gateway34／MCP23相關測試通過；型別與build通過。真登入＋MCP SDK＋真正Codex CLI的nearby結果與獨立計算一致。原站browser驗證9筆、limit3截斷說明、popup、地圖選點與結果列定位；學校資料時間／授權／覆蓋仍unknown，不因測試通過升級。正式站尚未部署。

## 2026-09-13 資料分析閉環

本輪先由目前 Codex task 透過已載入的research MCP完成 `search_datasets → describe_dataset → query_records → query_nearby → present_nearby → wait_scene_ready`，Browser逐筆讀回臺北車站座標 `[121.5170,25.0478]` 直線1公里內9筆學校。接著以目前source build啟動獨立MCP SDK host驗證完整37項tool schema與組合流程；這一段是SDK host驗收，不冒充另一個自然語言Codex task。

完整流程為 `tw-schools → query resultId → spatial resultId → aggregate → quality/evidence → present_result → fit_bounds`。來源共4,315筆、2,504,719 bytes、SHA-256 `7ab34ec23180077bcd32f4617ff31404f1a21c68706d36b2a74a3c4b079377c3`；1公里結果9筆，依來源 `school_level` 計為高級中等學校3、國民中學2、附設國民中學1、國民小學3。這是9筆來源place records，包含同代碼不同學制，不宣稱是9個獨立機構，也不是步行可達性。Browser回報revision 2 ready，DOM可讀到「1組分析結果／9筆點位」與resultId／datasetId摘要。

另以同一executor完成兩類來源readback：

- 新聞：2026-09-12、`minRelevance=0/eventsOnly=false/minSeverity=0` 合法回傳0筆，仍有Supabase RPC source receipt與checksum；0筆只適用這個selector。descriptor標示township cluster proxy，精確半徑空間查詢回 `SPATIAL_ANALYSIS_INELIGIBLE_GEOMETRY`。strict reader另拒絕未設定來源、非陣列payload、缺cluster events，以及缺event id/title/published timestamp，避免來源異常被收斂成成功0筆。非空新聞紀錄仍需另一個真實日期補證。
- 行政統計：固定release `2024-2025-paddy_land_area_hectare-1287362dfee3` 讀到368／368鄉鎮，boundary `TOWN_MOI_1140318`，狀態STALE，彙總158,701.13公頃；observed 0保留為0，`source_status/source_token` 的null不補成0。統計結果無geometry，未經版本相符邊界join不得直接上圖。

驗收期間也驗到兩個負向邊界並修正：來源build完成但舊dist只列21項，重新build後為37項；撤銷／重配對改為更換整個analysis session instance，避免舊的在途查詢晚到後進入新session。未push、未部署，學校／新聞license與freshness未知仍保留unknown。

本地證據：`/private/tmp/pulse-research-workbench/evidence/full-analysis-live-result.json`、`full-analysis-live-news.json`、`full-analysis-live-statistics.json`。截圖含研究登入資訊，不作可分享證據；Browser DOM與SDK receipt分開驗證。
