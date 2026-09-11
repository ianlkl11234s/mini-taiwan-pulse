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
