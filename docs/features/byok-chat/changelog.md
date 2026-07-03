# Changelog — byok-chat

> 逐 PR 變更紀錄。最新在上。

## 2026-07-03 — PR #TBD（待 squash 後補 hash）

- P1 對話 MVP：BYOK 三家瀏覽器直連（key 零經手）、AI SDK v7 agent loop、
  5 地圖 tools + 2 目錄 tools、ChatPanel/KeySettings（design token 全合規）、App.tsx 接線
- P2 資料問答：query_dataset（13 靜態資料集）/ rank_by_population（h3 res7）/
  call_rpc（10 支白名單）/ get_layer_details
- UX：高度讓位（popup 開啟縮 45vh）、chatHighlight popup 條目
- FX 驗收修正：IME composition 守門、tool 摘要進對話歷史、廢棄物計數 RPC、
  顧問式 system prompt、教學性工具錯誤（availableFields+hint）、filterContains op、
  abort part 正確處理（AI SDK v7 不 throw）、空回覆防護、maxSteps 10
- 測試：+29（truncate/geojsonQuery/h3/RPC 白名單/layerDetails/教學回饋），共 190
