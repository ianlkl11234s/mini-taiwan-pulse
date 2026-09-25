# P3 公司點 gzip 分片收據

日期：2026-09-25；狀態：`RIGHTS_HOLD`，未接入 `researchDatasets`，未開放 Gateway／MCP 查詢。

## 固定本機來源與輸出

- analytics 中繼 `company_points.geojsonseq`：SHA-256 `d099446600d98c26330b9193102d00fead822eb9ae6e3be1cf3eae24c605272b`、224,396,693 bytes、654,165 行。
- 上游 202608 `company_stock` receipt：657,882 列；先排 `dead_or_abnormal` 1,152、再排其餘無效座標 2,565，發布 654,165 點。來源母表有 2,586 筆無座標；兩個排除數的交集不可相加成母表缺值。
- `public/research/company-points/manifest.json`：`pulse-point-partitions/2`，SHA-256 `e97f18a4e6f15dbecc64c911d48dacddf65d88d4839c009378251388cfaaa519`；354 gzip shards，654,165 features，compressed total 21,663,717 bytes，單 shard 最多 288,907 compressed bytes／2,981,580 decoded bytes。
- manifest receipt SHA-256 `e56774e05c7ade1f4ece4f3b1e158db47d088a93ab5269e635c53282d2409c67`。source reference 是 SHA virtual identity，不能當作瀏覽器可 GET 的 raw NDJSON URL。

## 語意與限制

- geometry 是營業地址（財政資訊中心）經 offline/TGOS 地理編碼的 WGS84 Point；不是工廠、入口或道路可達性。座標精度包含 cached、exact、interpolated；發佈 sidecar 未逐筆帶回精度欄。
- 只保留公開 11 欄：公司名稱、資本額／分位、製造 flag、分類、行業、設立年、縣市與三個公開 flag。統編、地址、負責人未寫入任何 shard。
- 118 個「區域×大類」來源家族不含金門／馬祖約 1,868 家。analytics catalog 記錄 OGDL-Taiwan-1.0 與實際 matrix IDs，但此片未逐一重驗 raw dataset license receipt；`data.gov.tw/dataset/166152` 僅是六都製造業 subset，不能當完整 657,882 母體的唯一 provenance。因此維持 `RIGHTS_HOLD`／公開接線停用。
- analytics 原始目錄有 118 份帶 dataset ID、metadata/license、下載 SHA/bytes/rows 的 `*_202609.source.json`，但沒有 `*_202608.source.json`。這些 202609 receipt 不可倒推為本片 202608 的授權與版本證據；須找回或重建對應 118 份 202608 receipt，並對照合併 input 與發布 QA。

## 有界讀取與 oracle

- v1 manifest 仍相容；v2 對壓縮 bytes SHA 與解壓 bytes SHA 都驗證。讀取先用解壓後 bytes 預算篩選，selected shards 總 decoded bytes 超過 8 MiB 直接拒絕；沒有 bbox 回 `BBOX_REQUIRED`，不下載 214 MB 原 NDJSON。
- full-source 獨立 oracle：花蓮中心 `[121.60, 23.99]` 2 km 為 1,257 筆／190 製造業；臺東中心 `[121.15, 22.76]` 為 658／163。兩個 bbox 的 cold read 都在 8 MiB、20,000 rows 限制內；warm read `downloadedBytes=0`、`requests=0`、`cacheHit=true`。回傳頁上限 100，因此兩例皆明確 `displayTruncated=true`。

## 本地檢查

- `python3 scripts/research/test-company-point-partitions.py`：2 passed。
- `npx vitest run src/research/__tests__/companyPointsDataset.test.ts src/research/__tests__/pointDatasetAdapter.test.ts`：15 passed（含上述 full-source oracle）。
- `npx tsc -b`、`npm run build`：passed。此為本機 build 證據；因 `RIGHTS_HOLD` 未接入公開 `researchDatasets`，沒有 MCP/Gateway/browser 查詢或 readback 聲稱。
