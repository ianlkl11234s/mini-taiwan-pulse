# Changelog

## Unreleased

- 新增 CWA 海洋觀測站與 ISOHE 港區海氣象站兩個獨立圖層。
- 新增 production RPC loader、站點 current 聚合、source-specific freshness/status 樣式。
- 新增站點 popup，以及 metric 選擇後才載入的 24 小時／7 天歷史曲線。
- 潮位的 `vertical_datum` 若上游未提供，UI 明確顯示「datum 未提供」，不猜測或跨 datum 比較。
- 新增 manifest、sidebar、hook registry、legend、loading 與契約回歸測試。
