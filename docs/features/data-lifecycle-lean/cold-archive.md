# 三張歷史表冷封存

此工作將三表中主鍵相異的完整歷史資料做私有 S3 副本，資料庫來源、共享 bucket lifecycle 與公開政策都不變。三表含索引共 `1,683,611,648 bytes`；profiling 為：

| 表 | heap | index |
| --- | ---: | ---: |
| `live.news_events` | 88.9 MB | 51.2 MB |
| `live.yt_live_history` | 71.0 MB | 62.7 MB |
| `live.iot_wra_measurements` | 526.2 MB | 883.3 MB |

三表沒有 JSONB，但時間欄位、主鍵與每筆觀測的語意仍不可省略；相同值不能用來刪除不同列。全欄位 CSV.gz 以 READ ONLY REPEATABLE READ 一致快照匯出；首輪主鍵排序匯出未完成，未上傳不完整檔，改用有界順序掃描。主鍵相異的觀測均保留，不依數值相同刪列。最終物件、SHA 與 receipt 另列。含索引的 DB 體積不能直接推論壓縮後 S3 bytes。

## 封存契約

資料物件使用 `history-cold/v1` 下的內容 SHA-256 位址。先以 `STANDARD` PUT（僅在 key 不存在時）、完整 authenticated GET 比對 bytes/SHA，再以同 key CopyObject 轉為 `DEEP_ARCHIVE`，最後 HEAD 驗證 storage class、bytes 與 checksum。`schema.sql`、`dependencies.sql`、manifest 與 receipt 本次寫入 `STANDARD`（仍受共用 bucket 後續 lifecycle 約束）。內容位址只消除 byte-identical 匯出的重跑；順序掃描在 DB 維護後可能改變輸出順序，因此不保證邏輯相同但重新排序的快照仍有同一 SHA；本次沒有啟用重複全表封存排程。全表已有變更時，不做跨版本列去重。

此流程不刪來源、不釋放 DB 空間、不調整共享 lifecycle，也不開放 `history-cold/v1`。Deep Archive 最短保存期為 180 天，取回需等待且會產生費用；不估算未驗證的 Sydney 節費金額。[AWS S3 Glacier storage classes](https://docs.aws.amazon.com/AmazonS3/latest/userguide/glacier-storage-classes.html)

選擇先暫存 `STANDARD` 的原因是必須在可立即讀取時完成全檔驗證；轉冷後不能把 HEAD 或物件存在視為內容可讀證據。若既有同 SHA key 的 metadata、bytes 或 checksum 不一致，流程應停止並保留本地匯出，不得覆寫或以名稱相近的物件替代。

## 還原前置與限制

以相容的 PostgreSQL 17、PostGIS、`live` schema 與 extensions 還原；補回 `anon`、`authenticated` 角色及 schema SQL 所列權限。依 `dependencies.sql` 與 `schema.sql` 為準，匯入 `news_events` 時暫停 user triggers，避免重算 geom。CSV 保留 `CSV_NULL='\N'`、timezone、PK、型別 metadata；匯入 identity 值後執行序列 `setval`。2026-09-20 已完成實際 Deep Archive restore 與隔離 PostgreSQL reload，結果見下節。實際 DB 的 IoT FK 數為 0，與 repo 舊假設不同；沒有 parent export，`pg_dump` 實測結果優先。

## GFW spool 不是本次刪除範圍

9/6–9/13 八個 failed GFW run 都是 rolling 7 UTC days，相鄰窗口重疊六天。單一同名 tile 前 10,000 canonical-row SHA 的交集為 80.3–86.9%，只是樣本，不等於全量重複，也不能據此按 vessel/time 刪除。SQLite 是可由對應 NDJSON、`shared-fetch.json` 與同版程式重建的中繼；failed spool 仍依既有 known-tree 驗證與 7 日保留契約處理，不能宣稱可整批刪除。

## 全量實測

READ ONLY snapshot：`2026-09-18T13:56:37.450575Z`。全部欄位、NULL 與主鍵皆保留；COPY 回報列數與逐列 CSV 解析一致。先前盤點列數是 catalog 估計，本表為實際匯出數。

| 表 | 實際列數 | DB 含索引 | CSV bytes | gzip bytes |
|---|---:|---:|---:|---:|
| `live.news_events` | 172,304 | 140.34 MB | 88.71 MB | 31.24 MB |
| `live.yt_live_history` | 346,229 | 133.76 MB | 69.29 MB | 2.81 MB |
| `live.iot_wra_measurements` | 3,081,386 | 1409.69 MB | 573.35 MB | 159.81 MB |

三表合計 DB `1,683,783,680` bytes；CSV `731,351,270` bytes；gzip `193,854,480` bytes，比 CSV 小 `73.49%`。DB 與封存差額包含不搬索引，不能稱為純壓縮率，也沒有釋放線上 DB 空間。

匯出 schema／PK／型別／SHA 詳見 [history-cold-manifest.json](./history-cold-manifest.json)。雲端驗收於 `2026-09-18T14:08:56Z` 完成，三份資料皆已完整 GET 比對 SHA，再由 HEAD 確認 `DEEP_ARCHIVE`、bytes 與 AWS checksum；schema、dependencies 與 manifest 亦完整讀回。證據見 [history-cold-receipt.json](./history-cold-receipt.json)。bucket 為 `migu-gis-data-collector`、region 為 `ap-southeast-2`；既有公開 policy 僅開放其他 prefix，未公開此封存。原始 DB 尚未刪除，因此線上容量尚未降低。

## 下一步瘦身順序

1. 已先完成無損壓縮，沒有裁掉歷史欄位。YouTube 重複頻道／標題非常適合壓縮；不同觀測時間的相同影片仍是不同歷史。
2. IoT 約 62.7% DB 體積是索引；封存不搬索引頁面，還原時依 schema 重建。線上索引須另查真實查詢與使用率，不能直接刪除。
3. GFW 八個失敗窗口合計含 SQLite 3,423,789,056 bytes、NDJSON 2,456,829,518 bytes。優先驗證 SQLite 可重建，再將按日／來源版本相同的 normalized 資料共用；來源修訂或衝突需保留 provenance。樣本重疊率不能換算可回收全量 bytes。
4. 刪除 DB 歷史前仍需實際還原演練、前端歷史查詢邊界與明確線上保留政策；本次不因有冷副本就啟動 cleanup。

## 實際還原演練（2026-09-20）

三個 `DEEP_ARCHIVE` 物件以 Standard tier 正式取回，建立 1 天暫存可讀副本；S3 回報完成後，三份 gzip 再次完整下載並核對原始 bytes／SHA-256。資料載入專用 Docker volume 中的 PostgreSQL 17／PostGIS 3.5.2，沒有連線正式 DB。

| 表 | 還原列數 | 結果 |
|---|---:|---|
| `live.news_events` | 172,304 | schema、PK、NULL、時間範圍、row multiset 通過 |
| `live.yt_live_history` | 346,229 | schema、PK/unique、RLS/policy、sequence、row multiset 通過 |
| `live.iot_wra_measurements` | 3,081,386 | schema、複合 PK、NULL、時間範圍、row multiset 通過 |

共 3,599,919 列；12 個預期索引、新聞 trigger、兩個 identity sequence 均通過。原始 CSV 與 DB COPY 回出的 byte length 相同，但 order-sensitive SHA 不同；這符合 manifest 已明示的「無排序 sequential scan」契約。為排除資料遺失或改值，兩端均以 CSV parser 解出完整資料列，再用每列 length-prefixed SHA-256 組成無序 multiset，逐表比較 row count、header、digest sum、sum-of-squares 與 XOR，三表全數相符。這證明內容等價，不宣稱未定義的列順序被保留。

演練另發現 `pg_dump 17.7` 輸出的 `\restrict`／`\unrestrict` 不被容器 `psql 17.5` 接受；只在演練副本移除兩個 client control lines，原始封存 `schema.sql` 未變。正式 runbook 應優先使用 psql 17.7+，或在較舊 17.x client 做同一個有記錄的相容處理。

證據：[restore download](./history-cold-restore-download.json)、[restore validation](./history-cold-restore-validation.json)、[roundtrip diagnosis](./history-cold-roundtrip-diagnosis.json)。還原通過不等於已授權刪除線上資料；前端歷史查詢邊界、逐表 retention、預估回收量與 rollback 窗口仍須另行決定。
