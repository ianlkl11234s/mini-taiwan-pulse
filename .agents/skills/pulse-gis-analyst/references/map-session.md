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

## 結果與取景

現行 tool surface 可用 `pulse_get_result_bounds → pulse_fit_bounds` 對結果範圍取景，但沒有 `pulse_present_result`／`pulse_apply_scene`。fit bounds 只移動相機：

- 不會把 resultId 變成 filtered overlay。
- `set_layers` 開的是完整來源圖層。
- 回答必須分別說明「分析結果」與「地圖目前顯示內容」。

地址、地名或明確座標是空間分析中心時，除非使用者明確要求不要動地圖，完成分析後要把取景視為同一條工作鏈，而非額外裝飾：

1. 有 eligible resultId 時先 `pulse_get_result_bounds`，再以最新 revision `pulse_fit_bounds`，讓中心與結果範圍都可見。
2. result bounds 不可用但中心座標已驗證時，讀最新 map context 後 `pulse_set_camera`；街址建議 zoom 14–16，不以未驗證文字猜座標。
3. `pulse_wait_scene_ready` 後重新讀 map context／study state，確認 camera center 或 bounds 已套用。
4. 若沒有 result overlay tool，只能說「鏡頭已移至分析範圍」；不得說最近 N 筆已顯示為獨立點層。
