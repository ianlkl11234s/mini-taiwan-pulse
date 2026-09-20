# 資料生命週期與輕量化 Backlog

最後更新：2026-09-20。完成證據與既有決策見 [README](./README.md)、[completion ledger](./completion-ledger.md) 與 [cold archive](./cold-archive.md)。

| ID | Priority | State | Outcome | Next action / blocker | Acceptance |
|---|---|---|---|---|---|
| DL-2 | P1 | ready | 在可還原證據成立後，制定新聞、YouTube 與水利署線上歷史保留期限。 | DL-1 已完成。盤點前端／RPC 實際歷史查詢邊界、rollback 需求與新增資料量，再提出 dry-run；目前 `news_events`／`yt_live_history` 維持 HOLD，水利署原始歷史不刪。 | 有逐表 retention proposal、受影響查詢、預估回收 bytes、回復方式及 owner 核准；正式刪除另行授權，不由封存存在自動推導。 |
| DL-3 | P2 | ready | 降低 GFW failed spool 的重複儲存與中間產物容量。 | 先以一個 failed run 驗證 SQLite 能由 NDJSON、`shared-fetch.json` 與同版程式完整重建；再設計按日期＋來源版本共用 normalized 資料。相鄰七日窗口的抽樣重疊率不能作為刪除依據。 | 重建後 row/schema/hash 或已定義的 canonical 等價檢查通過；列出精確可回收 bytes 與逐檔清理名單；來源修訂、衝突與 provenance 保留，任何刪除另行授權。 |

## Guardrails

- 不刪正式 DB、S3 原物件、GFW spool 或平行工作。
- Deep Archive restore 完成只證明可取回；必須通過隔離 PostgreSQL reload 才能關閉 DL-1。
- CDN／browser cache 不是備份；歷史封存不供前端直接讀取。

## Completed

- **DL-1（2026-09-20）**：三個 Deep Archive 物件完成 Standard restore、完整下載 SHA 驗證及 PostgreSQL 17／PostGIS 3.5.2 隔離 reload。3,599,919 列、schema／PK／unique／12 indexes／RLS／policy／trigger／sequence／NULL／時間範圍均通過；無序 row-multiset canonical hash 三表一致。證據見 [cold archive](./cold-archive.md)。
