> ⚠️ 歷史文件（已被 [PLAN-warehouse-20260926](../../PLAN-warehouse-20260926.md) 取代），只作查證，不作施工依據。

# P4「附近有什麼」Point-only 試片

2026-09-25。此片僅驗證既有兩個**已通過** Point 家族的組合呈現，不是 P4 的 Point＋Line＋Polygon 完成驗收。P1 polygon 含 geometry 的 query 遇 `RESULT_BYTE_BUDGET_EXCEEDED`；P2 已接固定版 line reader 並驗證單線地圖呈現，但沒有點到線距離 operation。兩者不能用本片結果冒充。

新地點烏來 `[121.55,24.86]`、10 km **地表直線距離**；無道路或步行可達性聲稱。獨立 Python haversine 全表 oracle：839 筆農業休閒 POI 中 3 筆（最近 8.206 km，含兩筆名稱相近的來源紀錄，未去重稱「場所」），150 筆溫泉露頭中 1 筆（烏來，約 423 m）。

正常 Codex→MCP→Gateway→3734 browser 配對 session `active`：`pulse_run_analysis_plan` 依序 query 兩個固定 SHA 來源，再以 `within_distance` 分別得到 3 與 1 筆；兩份來源各保留自己的 coverage/freshness/record grain。`pulse_set_result_collection` 以兩組呈現，`pulse_wait_scene_ready` 回 `ready` revision 1；`pulse_get_map_context` 回 `ready=true`、4 features、2 sources、2 layers、兩個 result IDs 都已 rendered，目視地圖有兩色點位。點位仍是來源紀錄／露頭座標，非入口或即時服務。

這裡沒有新增通用 P4 routing 程式；現有 typed plan 與 result collection 可完成兩個 Point 家族的手動組合。完整 P4 仍需 P1 有界 polygon geometry transport、P2 點到線距離及跨 bbox 完整性，再實作依 descriptor 選候選／Point、Line、Polygon 分流的薄流程，並在另一地點與問法變體驗收。P3 公司點因 118 個來源的逐檔授權尚未重驗，維持 RIGHTS_HOLD，不納入此組合。
