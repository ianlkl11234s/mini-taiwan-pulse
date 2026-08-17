# Backlog — Mini Pulse GIS MCP

## 進行中

- 無。

## 待辦

- [ ] **MCP-2**：加入由 `LAYER_MANIFEST` / `LAYER_PARAMS_SPEC` 派生的 catalog tools。
- [ ] **MCP-3**：建立 selection SSOT 與 analysis result overlay renderer。
- [ ] **MCP-4**：加入 screenshot / render summary 驗證工具。
- [ ] **MCP-5**：串接 PostGIS proximity / overlap / accessibility 白名單 RPC。

## 已完成（近期）

- [x] **MCP-1**：完成網站 browser bridge、MapScene controller、project-scoped `.mcp.json` 與 MCP client 端到端驗收（2026-08-17）。
- [x] **MCP-0**：建立獨立 MCP repo、protocol v1、三個 map tools 與 localhost bridge。

## 已放棄 / 延後

- 通用 `opacity`：各圖層目前沒有 canonical opacity mapping；第一版改用已登記的明確 param 名稱，避免猜測錯誤欄位。
- 通用 selection：現況 feature selection 分散於 React local state，待建立統一 SSOT。
