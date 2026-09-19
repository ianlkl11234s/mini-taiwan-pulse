# 資料生命週期與輕量化 Backlog

最後更新：2026-09-20。完成證據與既有決策見 [README](./README.md)、[completion ledger](./completion-ledger.md) 與 [cold archive](./cold-archive.md)。

| ID | Priority | State | Outcome | Next action / blocker | Acceptance |
|---|---|---|---|---|---|
| DL-1 | P1 | in_progress | 完成三張歷史表的實際 Deep Archive 還原演練。 | 2026-09-20 已對三個物件發出 Standard restore，暫存可讀期 1 天；目前等待 S3 完成取回。隔離環境 `PostgreSQL 17 + PostGIS 3.5`、三表 schema、12 個索引、RLS、policy、trigger 與驗證腳本已備妥。heartbeat `automation-3` 每小時檢查，完成後接續下載、匯入、文件、PR 與一般 merge。 | 三份 gzip bytes/SHA-256 全部相符；隔離 DB 精確還原 172,304／346,229／3,081,386 列；欄位型別、PK、unique、索引、RLS、policy、trigger、sequence、NULL 與時間範圍通過；原 CSV 與 DB COPY 回出的完整 bytes/SHA 一致。 |
| DL-2 | P1 | conditional | 在可還原證據成立後，制定新聞、YouTube 與水利署線上歷史保留期限。 | Trigger：DL-1 完成。盤點前端／RPC 實際歷史查詢邊界、rollback 需求與新增資料量，再提出 dry-run；目前 `news_events`／`yt_live_history` 維持 HOLD，水利署原始歷史不刪。 | 有逐表 retention proposal、受影響查詢、預估回收 bytes、回復方式及 owner 核准；正式刪除另行授權，不由封存存在自動推導。 |
| DL-3 | P2 | ready | 降低 GFW failed spool 的重複儲存與中間產物容量。 | 先以一個 failed run 驗證 SQLite 能由 NDJSON、`shared-fetch.json` 與同版程式完整重建；再設計按日期＋來源版本共用 normalized 資料。相鄰七日窗口的抽樣重疊率不能作為刪除依據。 | 重建後 row/schema/hash 或已定義的 canonical 等價檢查通過；列出精確可回收 bytes 與逐檔清理名單；來源修訂、衝突與 provenance 保留，任何刪除另行授權。 |

## Guardrails

- 不刪正式 DB、S3 原物件、GFW spool 或平行工作。
- Deep Archive restore 完成只證明可取回；必須通過隔離 PostgreSQL reload 才能關閉 DL-1。
- CDN／browser cache 不是備份；歷史封存不供前端直接讀取。
