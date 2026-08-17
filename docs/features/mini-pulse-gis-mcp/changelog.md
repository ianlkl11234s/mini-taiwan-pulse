# Changelog — Mini Pulse GIS MCP

> 逐 PR 變更紀錄。最新在上。

## 2026-08-17 — Phase 1 完成

- 建立網站端 protocol、WebSocket client 與 MapScene controller。
- 支援 camera、圖層 visibility、已登記 params、時間點／播放／速度。
- 加入 revision conflict、member gate、未知操作 denied 與 read-back 驗證。
- 加入 project-scoped `.mcp.json` 與 dev-only loopback/token 設定。
- 端到端驗證正式 MCP client 可列出 session、讀取 state、套用高雄魚塭 scene，並拒絕 stale revision 與 owner-only layer。
