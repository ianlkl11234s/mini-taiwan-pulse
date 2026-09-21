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

`pulse_present_result` 只接受目前 paired browser session 的 0–4 個 `resultId`；空陣列清除 overlay。Browser 會重新檢查權限、TTL、geometry role 與筆數上限，再將結果轉成暫時 GeoJSON source/layer。它不會開啟完整來源圖層，也不會寫入 Supabase。

有 map-eligible result 時的最短閉環：

1. `pulse_get_result_bounds(resultIds)` 取得有界範圍，不解讀為來源 coverage。
2. 讀最新 study revision，以 `pulse_present_result(resultIds, expectedRevision)` 呈現。
3. `pulse_wait_scene_ready(commandId)`；accepted/applied 均不是可視完成。
4. 如需取景，用新 revision 呼叫 `pulse_fit_bounds`，並再次等待 ready。
5. `pulse_get_map_context` 讀回 `resultPresentation.resultIds`、`featureCount`、`sourceIds`、`layerIds` 與 `ready:true`，才可說分析結果已高亮。

`set_layers` 仍開啟完整來源圖層，不可與 result overlay 混為一談。若 `present_result` 失敗或讀回不一致，只能說分析已完成或鏡頭已移動。

地址、地名或明確座標是空間分析中心時，除非使用者明確要求不要動地圖，完成分析後要把取景視為同一條工作鏈，而非額外裝飾：

1. 有 eligible resultId 時先取 bounds 並呈現 result overlay，再以新 revision `pulse_fit_bounds`，讓中心與結果範圍都可見。
2. result bounds 不可用但中心座標已驗證時，讀最新 map context 後 `pulse_set_camera`；街址建議 zoom 14–16，不以未驗證文字猜座標。
3. `pulse_wait_scene_ready` 後重新讀 map context／study state，確認 camera center 或 bounds 已套用。
4. 若 result overlay 不可用或 readback 未 ready，只能說「鏡頭已移至分析範圍」；不得說最近 N 筆已顯示為獨立點層。
