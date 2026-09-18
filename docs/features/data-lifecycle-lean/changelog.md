# Changelog

## 2026-09-18

- 移除已被 PMTiles 取代的林業保護區公開 GeoJSON（46,783,425 bytes），停止 upload 與 pull 回流；保留有分析用途的林道輸入。
- 醫療安裝改為驗證後同 filesystem 搬移；成功後僅清理 manifest allowlist staging，支援中斷續跑並保留未知檔／舊 release。
- 公開 fallback 統一 cache；GIS MIME／GeoJSON gzip 保留一般 MIME、PMTiles Range 與既有 Ookla dist 來源契約。
- 新增欄位精簡、來源保存、版本淘汰與前端預算的決策文件與否定結果，避免為精簡新增通用框架。
