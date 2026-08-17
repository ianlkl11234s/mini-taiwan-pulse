# Mini Pulse GIS MCP

> **Slug**：`mini-pulse-gis-mcp`
> **狀態**：completed（Phase 1 local map control）
> **Owner**：migu
> **上線日期**：—
> **相關 PR**：—

## 一句話說明

讓本機 Claude Code 透過獨立 MCP server，讀取並控制目前開啟的 Mini Taiwan Pulse 地圖分頁。

## 元件

| 名稱 | 類型 | 狀態 |
|---|---|---|
| Browser bridge client | Local WebSocket client | 已完成 |
| Map scene controller | Camera / layers / params / time adapter | 已完成 |
| `mini-pulse-gis-mcp` | Local stdio MCP server | 已完成 Phase 1 |

## 關鍵檔案

- Protocol：`src/agentBridge/protocol.ts`
- Browser client：`src/agentBridge/browserClient.ts`
- Controller：`src/agentBridge/mapController.ts`
- App 接線：`src/App.tsx`
- 架構規劃：`docs/proposal/pulse-gis-mcp-plan.md`

## 安全邊界

- 網站端只在 Vite development mode 且明確設定環境變數時啟用。
- WebSocket 固定連線 `127.0.0.1`，不接受任意 host。
- 指令只支援具型別的 `get_map_state` / `apply_scene`，不接受任意 JavaScript、SQL 或 URL fetch。
- 圖層寫入沿用 App 既有 member gate；被鎖定或未知的操作必須回報 `denied`。

## 相關文件

- [架構與實作規劃](../../proposal/pulse-gis-mcp-plan.md)
- [前端交接](./handoff.md)
- [待辦](./backlog.md)
- [變更紀錄](./changelog.md)
