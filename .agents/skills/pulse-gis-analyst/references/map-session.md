# 地圖與 Session

## 配對與生命週期

- `pulse_pair_session` 只 claim ticket；取得 phrase 後等待使用者在網站確認，再用 `pulse_get_session` 交換並確認 `active`。
- credential 只存在該 stdio process 記憶體。新 task、MCP reload 或 process 結束後不得假設仍配對。
- `SESSION_REVOKED`、expired result 或 unpaired 必須停止；不可沿用舊 resultId、pairing ticket 或 receipt。

## Query receipt

- Gateway 同一時間只接受有界 pending query。依序執行分析鏈。
- query 回 pending 時，以 `pulse_get_query_result(requestId)` 接續；不要重送原查詢造成重複工作。
- 回傳頁的 limit 是傳輸頁面，不必然是 resultId 保存的完整分析母體；以 receipt 的 total/returned/truncated 判斷。

## 地圖 mutation

1. mutation 前讀 `pulse_get_study_state`／map context 與最新 revision。
2. `set_layers` 是完整 desired override set；保留使用者現有 overrides，只修改本題需要的 key。
3. accepted/applied 後用 `pulse_wait_scene_ready`；需要視覺結論時再做 browser readback。
4. 使用者手動操作造成 revision conflict 或 following=false 時停止自動移動，不覆蓋新狀態。

## 結果呈現與取景

`pulse_present_result` 只接受目前 paired browser session 的 0–8 個 `resultId`；空陣列清除 overlay。Browser 會重新檢查權限、TTL、geometry role 與筆數上限，再將結果轉成暫時 GeoJSON source/layer。它不會開啟完整來源圖層，也不會寫入 Supabase。

有 map-eligible result 時的最短閉環：

1. `pulse_get_result_bounds(resultIds)` 取得有界範圍，不解讀為來源 coverage。
2. 讀最新 study revision。已知 bounds 且允許移圖時，只呼叫一次 `pulse_set_result_collection(collection, framing, expectedRevision)`；不要先呼叫 `pulse_present_result` 再重送相同 collection。
3. 不需要移圖時用 `pulse_present_result(resultIds, expectedRevision)`，或不帶 framing 的 collection。現行 `pulse_present_result` schema 不接受 framing；以實際工具 schema 為準。回 accepted/applied 才用一次 `pulse_wait_scene_ready(commandId)`；若已 ready 不必再等，pending 則接續同 command。
4. 已呈現但本題後續才要求取景時，才用新 revision 呼叫 `pulse_fit_bounds`，不重跑分析。
5. `pulse_get_map_context` 讀回 `resultPresentation.resultIds`、`featureCount`、`sourceIds`、`layerIds` 與 `ready:true`，才可說分析結果已高亮。

`set_layers` 仍開啟完整來源圖層，不可與 result overlay 混為一談。若 `present_result` 失敗或讀回不一致，只能說分析已完成或鏡頭已移動。

地址、地名或明確座標是空間分析中心時，除非使用者明確要求不要動地圖，完成分析後要把取景視為同一條工作鏈，而非額外裝飾：

1. 有 eligible resultId 時取 bounds，再把 collection 與 framing 一起呈現，讓中心與結果範圍都可見。需要中心／半徑提示時可加入 display scope，但不得拿它作分析輸入。
2. result bounds 不可用但中心座標已驗證時，讀最新 map context 後 `pulse_set_camera`；街址建議 zoom 14–16，不以未驗證文字猜座標。
3. `pulse_wait_scene_ready` 後重新讀 map context／study state，確認 camera center 或 bounds 已套用。
4. 若 result overlay 不可用或 readback 未 ready，只能說「鏡頭已移至分析範圍」；不得說最近 N 筆已顯示為獨立點層。

## 同題操作最小化

- 已知來源使用本 session 已讀 descriptor；只有未知來源或版本改變才重新 describe。不要為每個分析步驟再次搜尋來源或路由。
- 將 query → spatial/compare → bounds 放在一個 `pulse_run_analysis_plan`，用 step refs，不手抄 resultId。取景 mutation 和 readback 仍在 plan 外。
- `query_records.limit` 依 descriptor；`spatial_query.limit` 最多50。座標／bbox是數字陣列；統計 `parameters.releaseId` 用 descriptor 提供的版本。
- 不同空間 predicate 的輸入欄位不同：`contains_center` 用 `areaResultId`；`nearest`／`within_distance`／`measure_geometry` 用 `resultId`；點面關係用 `pointResultId`＋`areaResultId`。未用過的 predicate 先看 live schema，不從另一個 predicate 猜參數。
- 每個錯誤先分類：參數錯誤修正一次；來源缺失保留不可用；預算過大縮小真正分析範圍；pending接續requestId。不得原封重送、以縮小回傳limit假裝分析資料較少，或把失敗步驟前的成功步驟全部重跑。
- 當 ready readback 已核對本次結果，停止輪詢；不要額外呼叫同義的list/results/quality/evidence，除非答案缺少該項證據。
