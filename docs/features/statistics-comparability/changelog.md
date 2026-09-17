# Changelog

## 2026-09-17 — 安全整合 PR #255

- 保留復原提交 `656e6cbe`、`0ddd5fdc`、`e08be17a`。
- 以 merge commit 整合 master `e58d4208`，保留日本醫療與珊瑚的平行變更；743 個 manifest keys。
- 正式 CDN readback 仍為 3,590 selectors，manifest SHA `d8aefb0375568a57126283e7fbd3901ee0c46cbb25c68af2c12647a14d35165a`。
- Production 預設不顯示未發布的 188 個比較指標；資料發布後以 `VITE_STATISTICS_COMPARISONS_ENABLED=true` 啟用。DEV 保留全部本地指標，教育 12 個視圖及原始統計在 production 保留。
- 本 PR 不上傳 CDN 或改寫 current.json。PR：https://github.com/ianlkl11234s/mini-taiwan-pulse/pull/255；merge SHA 以 GitHub PR 與本地同步 receipt 為準。

### 合併前驗證

- 最新 master 整合後：前端 1,426 passed／4 skipped；珊瑚後端 19 passed。
- Production build 通過（正式 CDN、比較開關 false），僅既有 chunk size 警告。
- Production browser：國小學生 22/22，醫院病床 159/368 PARTIAL；未發布比較選項未出現，console errors 0。
- 新證據：`evidence/pr-255/`；先前 DEV 全功能與手機證據仍在 recovery 目錄。

## 2026-09-17 — 正式環境啟用

- CDN 新 manifest `8e4511ef4627d6a511b8208e05ab6cd2787e2319df17252c749d01e0005f5efe` 已公開，244 新 selectors 與 256 次正式 loader 驗證通過。
- Docker build stage 明確接收 `VITE_STATISTICS_COMPARISONS_ENABLED`，預設仍為 false；正式服務設定為 true 後重新建置。
- 關閉時設定 false 並重建即可回復原始量顯示，CDN immutable 資料不需刪除。
