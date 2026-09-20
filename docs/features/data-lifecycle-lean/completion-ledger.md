# 本次計畫與驗收狀態

| 原計畫 | 已落地 | 證據與剩餘條件 |
|---|---|---|
| 1. 供應／快取 | nginx MIME/gzip/public cache，公開 R2 單層；Cloudflare UI rule 已補醫療 JSON eligibility | production-304.json、r2-pilot.json、[cloudflare-console-readback.json](./cloudflare-console-readback.json)：current HIT、catalog MISS→HIT、PMTiles 206 HIT；API token 仍不能管理 zone |
| 2. 儲存生命週期 | streaming archive＋verified receipt、installer headroom、6 表 registry／歷史保護 | collectors PR 92、platform PR 113；GFW failed/running 不符合刪除條件，news/yt HOLD 明示 |
| 3. 日本醫療大小與LOD | 使用既有 aggregate，完整點位保留；屬性抽樣及 consumer 盤點 | medical-overview.md、attribute-budget.md、medical-byte-budget.json；未新建資料服務／詳情 shards |
| 4. 前端負載 | Legend lazy、Japan tourism 穩定參數、map sources All Off/unmount 回收 | bundle-budget.json、hook regression 與 browser；不宣稱零記憶體／FPS 提升 |
| 5. 動態預算 | Global Events 5頁/1000列、partial/continuation/abort；staticRpc 不自動回DB | dynamic-budget.md、static-rpc-coverage.json；其他不同動態來源仍需各自量測，沒有宣稱全站都改成snapshot |
| 6. 公開R2試點 | 林業完整檔 SHA回读，206/CORS/HIT，前端接線 | r2-pilot.json；原路徑可回復，未全站大量搬移 |
| 7. 擴國准入／成本 | 本頁入口＋既有 registries，容量／請求／資料預算與操作門檻；Cloudflare UI 已讀 R2 usage/billing | [cloudflare-console-readback.json](./cloudflare-console-readback.json)：R2 8.8 GB、mini 7.75 GB、本期 $0、4.5 GB-month；$10 alert 非 cap。AWS／Zeabur 帳單未驗證 |

## 保留而非誤刪

Collector /data 69G；filesystem 共用 125G used/25G free，不能混算。GFW 10 runs（1 running、9 failed）需專屬 ledger/manifest recovery；CWA 9/16–18 raw 還在既有保留範圍。沒有證據的 raw、分析輸入、rollback release 不在清理清單。

## 已知阻塞／後續界線

1. Cloudflare authenticated UI 已補 rule／R2／billing readback，但既有 API token 仍不能管理 itsmigu.com zone；AWS／Zeabur 帳單未驗證。請勿在聊天貼 secret。
2. news_events/yt_live_history/iot_wra_measurements 已完成一致快照私有 Deep Archive，共 193,854,480 bytes；2026-09-20 已完成 Standard restore、三份完整 SHA 下載與隔離 PostgreSQL/PostGIS reload，3,599,919 列及 schema/PK/index/RLS/trigger/sequence/NULL/時間範圍/無序 row multiset 全數通過，見 [cold-archive.md](./cold-archive.md)。尚未決定線上保留期限；news/yt 保持 HOLD，正式刪除另行授權。
3. GFW failed/running spool 不是本批可清理完成項；恢復 pipeline／對帳後才有精確候選，無 broad-prefix 刪除。
4. S3 共用 bucket policy、其他大圖層視窗化與全國資料搬遷屬後續分層遷移；本次以一層實測建立基線，避免一次重構所有 consumer。

正式部署與 browser 最後讀回已補於 README「正式整合與後續顯示修正」。未通過的格子不以本地 build 代替。
