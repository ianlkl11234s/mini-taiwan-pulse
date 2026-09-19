# 歷史保留與失敗暫存確認（2026-09-18）

本次為唯讀確認，尚未刪除檔案、資料列，未變更保留政策。明細見 [retention-spool-review.json](./retention-spool-review.json)。

## 歷史資料

| 資料 | 本次 DB 讀回 | 目前政策／消費方式 | 建議 |
|---|---|---|---|
| news_events | 約 114,333 列；140.3 MB；2026-06-07 至 2026-09-18 | HOLD；前端按歷史日期讀新聞聚合；未驗證可還原封存 | 保留完整事件歷史，不因即時畫面窗口刪除 |
| yt_live_history | 約 248,430 列；133.7 MB；2026-06-17 至 2026-09-18；13 handles | HOLD；前端目前消費 current，history 供稽核／debug | 暫時完整保留；有可還原封存後才討論線上期限 |
| iot_wra_measurements | 約 3,027,907 列；1.410 GB；2020-09-01 至 2026-09-18 | 永久保留，旧 raw cleanup cron inactive／function no-op；前端另讀 daily/latest | 完整保留原始量測；daily 7 天政策不等於 raw 可刪 |

列數為估計，日期為 indexed boundary 查詢；MB／GB 使用十進位換算 pg_total_relation_size（含索引）；不能當作可回收或壓縮收益。三表合计 1,683,611,648 bytes。查詢 READ ONLY，SET LOCAL statement_timeout 12 秒。這三張表並非目前 GFW 暫存的主要空間來源，不能把「不用每次送到前端」推論為「原始歷史可刪」。

## GFW 暫存（精確 bytes）

10 個 run 共 12,677,983,647 bytes（12.68 GB 十進位）。

| run release date | bytes | 本次判斷 |
|---|---:|---|
| 2026-08-20 | 1,971,475,171 | failed，原因為 immutable S3 release 已存在；legacy public root 仍指向同一天。清理器拒絕舊版 grid .geojson，不能放寬成 broad delete。需 legacy manifest/hash 逐檔驗證。 |
| 2026-08-28 | 13,034,137 | DB／本地均 running，最後檔案寫入 9/2；本次未見 /proc fd 引用。不是 current，但無 completed，不直接當 failed 刪除。 |
| 2026-09-06 | 1,147,089,168 | failed 已超過既有 7 天；exact file whitelist 通過；DB is_current=false，兩個 S3 root 均未引用。符合技術清理候選，但無可還原 archive，刪除等於放棄此輪未完成 normalized 資料。待使用者決定保留恢復或丟棄。 |
| 2026-09-07 至 09-13（7 runs） | 9,546,385,171 | 尚未滿各自 failed_at 起 7 天，不提前清除。 |

所有判斷只對本次 readback 時點有效；真正刪除前須重新檢查 status、mtime、檔案集合、active process 與 current/rollback references，不對父目錄執行遞迴刪除。

## 為何堆積

9/6 起這批 failed 訊息均為缺少 tippecanoe／pmtiles，發生於抓取之後。現在 runtime 兩個執行檔已存在，且 preflight 在 network fetch 前執行；尚未觀察到修正後的新一輪成功，不能宣稱恢復收集。S3 legacy root latest_complete_date 為 2026-08-20；v3-shadow 為 2026-08-21，與 DB current release 一致。

## 後續決策

1. 使用者已授權保留唯一歷史至冷層；三表完整快照已完成，見 [cold-archive.md](./cold-archive.md)。線上保留期限尚未變更，以上初次盤點估計列數由冷封存實際匯出列數補充。
2. 9/6 的 1.15 GB 未完成 run：保留恢復，或明確接受丟棄後做逐檔清理。

未授權放棄 GFW 唯一資料，故仍保留；未啟動新的抓取／消耗 GFW API 配額。
