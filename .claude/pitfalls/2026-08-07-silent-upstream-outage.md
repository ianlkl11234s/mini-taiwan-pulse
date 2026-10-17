# 上游靜默斷供：程序每次都「成功」，產出永遠是空的（2026-08-07）

三個資料源（共機航跡、台電落雷、警政署 A1）同時被上游靜默斷供，collector 都在跑、HTTP 200、沒有告警；heartbeat 只在有資料寫入時更新，「0 筆」又常是合法結果，所以監控看不出來。判準與診斷法：ledger 表、交叉驗證第二資料源、用第三方訊號反證，以及 S3 archive 檔案大小的時間軸。

全文已搬到 data-collectors `.claude/pitfalls/2026-08-07-silent-upstream-outage.md`（https://github.com/ianlkl11234s/gis-data-collectors/blob/main/.claude/pitfalls/2026-08-07-silent-upstream-outage.md）。
