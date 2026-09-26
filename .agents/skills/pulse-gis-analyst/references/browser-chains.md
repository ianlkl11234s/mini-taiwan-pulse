# 瀏覽器端 typed 分析鏈（逐字自 SKILL.md §2 搬出，2026-09-26）

適用：倉庫工具之外、已驗證的單一 dataset 瀏覽器查詢與既有流程。複雜分析先看 [recipes](recipes/README.md)。

## 選最小可回答的分析鏈

每個 dataset/version 首次使用時以 `describe_dataset` 確認 grain、欄位、geometry、CRS、coverage、version/time、license、missingness、access 與 supported operations。同題可重用已讀過的 descriptor，不必重複 describe。描述可以搜尋到，不代表有權讀、適合分析、最新或 production healthy。

統計選版使用 `parameters: {releaseId: descriptor 中的合法 release_id}`；缺必填參數是可修正的輸入錯誤，不代表資料無權讀取。`plan_data_access` 不用作查詢失敗後的盲目重試。

工具清單含 `pulse_run_analysis_plan` 時，把已知查詢、距離篩選、分類計數、品質檢查與 bounds 合成最多 16 步。每步的 args 沿用原工具 schema；相依 resultId 寫成 `{step: "前一步id", output: "resultId"}`。計劃回 partial 時保留已完成 resultIds，pending 用 requestId 接續，僅提交尚未執行步驟。sample rows 不是完整母體；以 total/summary/receipt 判讀，已有充分摘要時不用再 get_analysis_result。

使用已宣告的 typed chain，不用舊 layer summary 代替 dataset analysis 驗收：

- 分組統計：`query_records → aggregate_records`
- 行政統計面圖：查詢 `regional-statistics:<layer_key>` 的 exact release；確認 values receipt 與同版 boundary receipt，再 `present_result`／`set_result_collection`
- 附近／距離：`query_records → spatial_query`
- 地圖中心行政區：讀取同版行政統計面後，用 `spatial_query(predicate="contains_center", areaResultId, center)`；display scope 不能當作 actual Point。邊界線上的點要保留未唯一匹配，不猜行政區。
- 點落在哪些面：`query point/area → spatial_query(within|intersects)`
- 有界環域／面交集／度量：live schema 提供時使用 `spatial_query` 的 `line_buffer`、`surface_intersection`、`measure_geometry`；完整單一 eligible feature、半徑 1–500m，方法與預算見 [分析配方](analysis-recipes.md#有界幾何分析)。新 derived 面可接點位 within/intersects；環域不是可及性。
- 完整線與面相交：`query line/area → spatial_query(predicate="line_intersects", lineResultId, areaResultId)`；只使用 declared actual EPSG:4326 LineString/MultiLineString，保留完整路徑、holes、multipart與邊界接觸。遇計算預算上限先縮小已知source範圍，不可改用端點、中心點或擅自簡化。
- 地震背景：`cwa-earthquake-replay-events` 使用 `parameters.eventId`，或互斥的 `occurredAfter`＋`occurredBefore`（含時區 ISO、左閉右開、最長七天）。時間窗最多接受 50 筆；來源第 51 筆是密度 sentinel，超過即縮小時間窗，不靜默截斷。震央與周邊設施另查，不把相近設施稱為受災設施。發生時間、取得時間與背景年份分開；來源未提供更新／撤回狀態，unknown freshness 不可宣稱即時。
- 道路事件：`tdx-road-events-current` 必填 allowlisted `source`；用 `parameters.eventType` 與 `unexpiredOnly`（預設 true）在既有 RPC 縮小資料。未到期不等於正在發生：空到期與未來生效仍可能返回；以 `lifecycle_status` 區分 active/scheduled/expired/unknown。`filters.event_type` 與時間 filters 是取得後篩選，不能避開來源 51 筆密度拒絕；遇 dense 不可只調小 limit 或反覆重試；既有 RPC 先 LIMIT，不能在外層新增 filter 後宣稱完整。exact-ID/updated-window SQL 草案尚未上線，不可呼叫假定可用的新 RPC。取得時間不等於來源更新，current 缺席不等於撤回；source geometry 尚不可做距離/相交。
- 經驗證的 Point 子集：`tw-nursing-homes-upstream` 僅含固定來源 SHA 中自帶 WGS84 座標的 1,499/1,611 筆紀錄；排除的 112 筆與原始全圖層仍分開，不推論唯一機構數、營運現況或建物精度。觀測日期未知，不搭人口直接算同期密度。
- 各區點位數：`query point/area → aggregate_by_area`
- 跨資料比較：`describe A/B → query A/B → 相容性檢查 → join_records → calculate_metric`
- 行政區／縣市同期比較：`query_records → compare_regions(areaCodes, baselineAreaCode)`；工具只比較相同指標、維度、期間、單位、層級與邊界版本。使用原生比率時不要加總；可選人口分母必須有明確人口指標證據，不能以教師/學生等人數冒充人口。缺值、抑制、零分母各自保留，不製造排名。
- 本地人口占比：DEV owner preview 的 `population_statistics`、`:male`、`:female` 使用 descriptor 固定 release；同 SEGIS 2025-12 男/女數可除以 total，再用 `compare_regions` 的 per=100 得到占比。只有 total 口徑可作人口分母；`normalizedValue` 是占比，`absoluteDifference`/`ratio` 仍比較原始人數。這證明同來源同期比較，不證明設施觀測時間已對齊，也不代表已公開發布。
- 公開地標步行：先 local geocode，確認候選與精度，再逐次 consent 呼叫 `route_distance` 或 `walking_isochrone`；外部 provider 不放進一般 batch plan。等時圈是模型推估，不是實測時間。
- 時序比較：`read_series → get_data_quality → compare_series`

詳細輸入選擇、分頁與停止條件見 [分析配方](analysis-recipes.md)。

