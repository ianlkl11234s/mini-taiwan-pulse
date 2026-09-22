# N05 穩定版本速度量測

2026-09-23 本地 paired stdio→Gateway→browser。Mini runtime `41bc0c7b`、MCP `d0f79e5`、Gateway `3f269ef`；量測期間未修改已載入模組，未發布的人口materializer不在runtime registry。

## 固定輸入及結果

固定6步：住宅鄉鎮來源→中山/大安比較→bounds；114學年生師比來源→臺北/新北比較→bounds。來源選版、filters、samples固定；獨立已核對原值：住宅107888／111460；生師比12.053068333162585／13.01270053475936。

| 範圍 | 成功/執行 | median | p95 nearest rank | max |
|---|---:|---:|---:|---:|
| 首次住宅來源載入＋接續19次 | 20/20 | 4399.5ms | 5625ms | 12285ms |
| 首次載入後的20次warm | 20/20 | 4399.5ms | 5625ms | 5740ms |

两表重疊19次，合計21次；不宣稱40次獨立樣本。首輪12285ms單獨留存，縣市資料此前已載入，不能稱完全cold。所有成功結果的rows fingerprint一致；失敗分母不刪除。工具執行、配對、模型思考、地圖呈現與最後答覆是不同時間範圍，這不是完整90秒SLA。

## 可觀測的分段

| 步驟 | median Gateway total |
|---|---:|
| 鄉鎮query_records | 1244.5ms |
| 鄉鎮compare_regions | 1202ms |
| 鄉鎮bounds | 400.5ms |
| 縣市query_records | 459ms |
| 縣市compare_regions | 433.5ms |
| 縣市bounds | 405ms |

本次單一client依序送出，各步queuedMs最大0。這證明此樣本沒有Gateway queue等待，不證明多client或長分析時queue不會阻塞。Gateway total仍混合browser polling、資料物化、計算與回傳，不能把全部差值歸因資料下載或clone。統計reader的downloadedBytes/cacheHit仍是null，不能當成0或cache hit。

學校周邊案例有實際cost：bbox最後12所，仍下載全國2,504,719 bytes、掃4315列。N06因此選擇資料分片實驗：用同一source SHA、保留原record ordinal與精确geometry，先選相交分片再由同一query filter精算。須比較下載bytes、掃描列、source refs與相同答案；沒有量測不填加速百分比。

## 90秒整題策略

1. 已知問題一次batch plan，descriptor/version同題重用；資料bbox/欄位/回傳頁面都明示。Jev只用於含糊候選分類，一次失敗即deterministic fallback。
2. 先做query/analysis，最後collection+framing一次呈現、一次ready、一次readback。單一browser query/presentation狀態機保留，不強行平行覆蓋。
3. 預算以整題計：候選與規劃、資料及分析、呈現及答案各留時間。現有6步warm約4.4秒，剩餘延遲須量模型與編排，而非宣稱換成更小模型必然更快。

下一次應從固定自然語言問題開始，記錄首次有用回覆及最終來源/畫面回覆，才可判定完整warm<90秒。此報告保留資料失敗與語意不相容的拒絕，不以省略檢查換速度。

## 重現

- ignored runtime：`n05-stable-window.json`、`n05-stable-benchmark.json`、`n05-warm-window.json`、`n05-warm-benchmark.json`、`n05-step-breakdown.json`、`stdio-receipts.jsonl`。
- `python3 scripts/research/summarize-plan-benchmark.py --receipts ../runtime/stdio-receipts.jsonl --window ../runtime/n05-warm-window.json --output ../runtime/n05-warm-benchmark.json`
- 原始baseline在同時修改程式期間取得，僅診斷，不與本輪硬稱優化A/B。


## N07 修正後固定版本重測

Mini `2c0553a1`（raw boundary／partition local接線）；MCP `d0f79e5`、Gateway `3f269ef`未變。2026-09-23 00:28起完成20次，07:46重新彙總收據。20/20成功、數值oracle及row fingerprints全部一致；median **4186ms**、p95 **6534ms**、max **7864ms**。首次prewarm6882ms另列，不稱完全cold。這組包含所有20次結果，不排除較慢樣本；不可與舊版宣稱受控速度提升，因時間窗及cache背景不同。

`runtime/n07-warm-window.json`／`n07-warm-benchmark.json`；以同一summarize-plan-benchmark.py重現。來源統計query與比較仍正確，generalized面僅供展示。仍未量完整模型→最終答覆90秒SLA。
