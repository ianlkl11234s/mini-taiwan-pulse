# Changelog

## 2026-09-18

- 移除已被 PMTiles 取代的林業保護區公開 GeoJSON（46,783,425 bytes），停止 upload 與 pull 回流；保留有分析用途的林道輸入。
- 醫療安裝改為驗證後同 filesystem 搬移；成功後僅清理 manifest allowlist staging，支援中斷續跑並保留未知檔／舊 release。
- 公開 fallback 統一 cache；GIS MIME／GeoJSON gzip 保留一般 MIME、PMTiles Range 與既有 Ookla dist 來源契約。
- 新增欄位精簡、來源保存、版本淘汰與前端預算的決策文件與否定結果，避免為精簡新增通用框架。

## Continued lifecycle implementation — 2026-09-18

Medical adaptive grid counts with explicit full-points mode and source cleanup; Legend lazy loading; Global Events 5-page/1000-row budget and cancellation; CDN static RPC fails visibly instead of automatic DB fallback; immutable R2 forest pilot; installer missing-byte headroom gate. Collectors PR 92 verifies raw archive contents before cleanup; platform PR 113/migration 412 protects history and exposes unresolved retention. See completion-ledger.md for evidence and outstanding access gates.

## Aggregate family label correction

Production acceptance found coincident medical/care grid centers hiding one family. Split screen-space markers and explicit family labels preserve both counts without changing geometry or count grain. Recorded final CI/deployment results and existing capacity-report rollout.

## 2026-09-18 歷史冷封存

- 三表 3,599,919 列完整快照無損壓縮至 193,854,480 bytes；私有 S3 全檔 SHA 讀回及 Deep Archive HEAD checksum 驗收完成。
- 記錄 schema／manifest／receipt、索引與重複字串體積來源、GFW 重疊窗口；未刪除來源，未完成實際 DB restore，HOLD 保持。

## 2026-09-20 歷史冷封存還原演練

- 三個 Deep Archive 物件完成 Standard restore 與完整 SHA-256 下載驗證。
- 在隔離 PostgreSQL 17／PostGIS 3.5.2 reload 3,599,919 列；schema、PK/unique、12 indexes、RLS/policy、trigger、sequence、NULL、時間範圍通過。
- 原 CSV 與 COPY 回出資料的未排序 row multiset canonical hash 三表一致；order-sensitive SHA 因封存未定義列順序而不同，明確記錄為契約限制。
- 發現 pg_dump 17.7 `\restrict` 控制行與 psql 17.5 不相容；演練副本移除兩行後成功，原始封存未改。
