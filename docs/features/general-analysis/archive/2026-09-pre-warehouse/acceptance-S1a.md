> ⚠️ 歷史文件（已被 [PLAN-warehouse-20260926](../../PLAN-warehouse-20260926.md) 取代），只作查證，不作施工依據。

# S1a 驗收單：比較守門與查詢範圍

日期：2026-09-22。對應 [總計畫](./plan.md) S1a；這是第一個可獨立 review 的交付。

## 這一片解決什麼

比較前保留並檢查已知單位、時間欄位語意、日/週解析度、aggregation 與來源 grain。行政統計另外檢查指標、dimensions、行政層級、邊界版本與 SHA、資料期間。不同地區或 release 本身不構成拒絕理由；一般事件資料不要求行政邊界，但尚無跨 dataset 指標對照時採保守拒絕。

查詢結果保留實際正規化後的 filters、bbox、time、parameters 與完整符合筆數，以及 descriptor 的時間/geometry 契約。顯示頁 limit 不可改寫分析母體；後續操作透過 lineage 保留來源範圍。

## 工程驗收

狀態：本地工程驗收通過；使用者驗收待確認。

| 案例 | 實際結果 |
|---|---|
| 同事件來源；缺期與零分母 | 保留 missing_current / zero_baseline，未補零 |
| 單位不同、同結果混合單位、缺時間契約 | 拒絕比較 |
| 同指標同期間，不同行政區與 release | fixture 20 − 16 = 4；契約狀態 contract_verified |
| 邊界版本不同、日/週不同 | 拒絕比較 |
| 相同 dimensions 不同欄位順序 | 正常比較 |
| count 附帶 valueField | 仍為 records 單位 |
| bbox 查詢 limit=1 | 保存完整符合 2 筆與 bbox；未把顯示頁當分析母體 |

執行於隔離 mini worktree：

- `npx vitest run src/research`：40 files 通過，211 tests 通過、6 skipped，14.17 秒。skipped 不算通過。
- `analysisOperations.test.ts` 包含 16 tests；`researchAnalysisSession.test.ts` 包含 8 tests，均包含於上述結果。
- `npx tsc -b`：通過。
- `git diff --check`：通過。
- 執行記錄：`../runtime/general-analysis-research-tests.log`、`../runtime/general-analysis-typecheck.log`。測試環境有缺少 Supabase 設定的警告，未作正式資料庫連線驗收。

本輪使用本地 contract fixtures，沒有把 fixture 結果宣稱為真實統計結論或網站驗收。沒有重跑未修改的 MCP/Gateway；完整自然語言流程與本輪 browser 操作尚未驗收。

## 使用者如何驗收

先確認以下產品規則是否符合預期：

1. 可比時才計算；資料不完整時明示無法比較，不以 0 補洞。
2. 日資料與週資料、不同單位、不同時間定義不能直接相減。
3. 同指標、同期間、同邊界下不同地區可以比較；不因 release 名稱不同直接拒絕。
4. 周邊查詢能追溯實際 bbox/filter 與資料母體，不把只顯示的一頁當全部。

本階段可 review 的交付是程式與可重跑測試。自然語言提問 → 網站顯示 → 來源 readback 的操作驗收分別在 S2/S3；不能將本頁通過視為那些階段完成。

## 已知限制與下一步

- 目前 compare_series 仍按相同 UTC bucket 對齊；不支援把去年與今年自動平移比較。年度、學年與行政 snapshot 的正式比較留 S1b/S3。
- 契約檢查不等於完整分析正確性認證。人口分母、抽樣母體、coverage、歷史指標定義變更仍須正式建模與獨立數值 oracle。
- 一般事件跨 dataset 的共同指標對照尚未建立；保守拒絕不代表永遠不可比較。衍生結果若沒有直接可驗證的時間語意也可能被阻擋。
- 尚未提供完整的使用者可讀差異清單；下一步 S1b 應把 scope 與不相容原因經 MCP/Gateway/browser 一致呈現。
- 沒有新增 adapter、線幾何運算、資料分片或 Jev 整合。新修改尚未 commit、push 或部署。
