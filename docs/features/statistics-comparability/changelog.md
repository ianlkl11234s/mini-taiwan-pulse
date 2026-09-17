# Changelog

## 2026-09-17 — 安全整合 PR

- 保留復原提交 `656e6cbe`、`0ddd5fdc`、`e08be17a`。
- 以 merge commit 整合 master `e58d4208`，保留日本醫療與珊瑚的平行變更；743 個 manifest keys。
- 正式 CDN readback 仍為 3,590 selectors，manifest SHA `d8aefb0375568a57126283e7fbd3901ee0c46cbb25c68af2c12647a14d35165a`。
- Production 預設不顯示未發布的 188 個比較指標；資料發布後以 `VITE_STATISTICS_COMPARISONS_ENABLED=true` 啟用。DEV 保留全部本地指標，教育 12 個視圖及原始統計在 production 保留。
- 本 PR 不上傳 CDN 或改寫 current.json。PR 編號、檢查結果與 merge SHA 記錄於後續同步證據。
