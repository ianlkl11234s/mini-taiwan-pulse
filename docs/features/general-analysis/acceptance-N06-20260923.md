# N06：先裁資料，再做相同分析

本地驗收通過；production 仍使用既有 canonical source，未發布 shards。對應 A01/A08 與 S5。

固定資料 `/education/schools.geojson`，SHA `7ab34ec23180077bcd32f4617ff31404f1a21c68706d36b2a74a3c4b079377c3`，4315 rows／2504719 bytes。builder 按 0.25 度分為82個 immutable shards，原 feature 不變，只加 sourceOrdinal；manifest SHA `a531452a19ddb104634096baf99f13065479630bf6443063602eb9e7999da09b`。無位置資料另保留，不補零、不丟失。

| 同一 bbox [120.42,23.1,120.66,23.32] | 整包 | 分片 cold | 分片 warm |
|---|---:|---:|---:|
| 下載 bytes | 2504719 | 123196 | 0 |
| 載入候選 rows | 4315 | 261 | 261 |
| 網路 requests | 1 | 5 | 0 |
| 精確 bbox 結果 | 12 | 12 | 12 |
| 距震央10km | 3 | 3 | 3 |

首次傳輸減少95.08%；4 shards + manifest。Python 對整包原始檔獨立計算，12個 IDs／順序完全相同；source checksum不變。7步事件鏈3814ms、單次warm bbox query577ms；不是受控前後速度比較，也不含模型或完整回答。只主張傳輸量下降與答案等價。

通用能力：QueryExecutor 將已驗 bbox 傳入 reader，沒有配置分片時維持原載入方式。loader 驗證 SHA/bytes/count/ordinal、同源路徑、shard scope；上限8MB／20000 features、4並行、15秒共同期限、32MB LRU。單一 caller abort 不取消其他共享下載。精確 bbox filter 仍由 Executor 完成，分片不能冒充最終篩選。

驗證：builder 3 tests；point/query focused 16 tests；真實stdio→Gateway→browser 7-step、ready/readback4點、獨立oracle。真實鏈暴露底線路徑拒絕，dcdf8306 修正，未掩蓋失敗。

限制：只接一份 schools local DEV fixture，未聲稱778圖層通用分片已部署；線、面、raster、路網另需契約。原始縣界目前仍一次讀14.7MB，屬下一項可量測優化，不以簡化面替代精度。

重現：`python3 scripts/research/test-point-partitions.py`；`npx vitest run src/research/__tests__/pointDatasetAdapter.test.ts src/research/__tests__/queryExecutor.test.ts`；runtime `n06-partition-browser-oracle.json` 保留來源hash、逐筆ID與cold/warm成本。builder `--help` 列出實際輸入輸出參數；runtime fixtures不提交、不自動發布。

原子提交：653e6a2c builder、441336ec bounded loader、dcdf8306 local path修正、2c0553a1 local接線。


07:50 取消生命週期補驗（fbca8862）：共享下載採subscriber計數，最後caller取消會abort底層fetch，取消請求不得寫cache；另一caller仍等待時保留下載。已abort但尚未settle的entry不供新caller重用，identity cleanup不會刪新請求。focused12/12、tsc通過；本項為fetch signal回歸測試，沒有冒稱瀏覽器人工取消驗收。
