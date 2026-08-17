# Handoff — Mini Pulse GIS MCP（網站端）

> **MCP repo**：`../mini-pulse-gis-mcp`
>
> **架構 SSOT**：[`docs/proposal/pulse-gis-mcp-plan.md`](../../proposal/pulse-gis-mcp-plan.md)

## 本機接線

網站與 MCP server 以 browser WebSocket protocol v1 溝通：

```text
Claude Code → MCP stdio server → ws://127.0.0.1:4731 → Mini Taiwan Pulse
```

兩端使用相同 token；網站只允許 development mode 啟用。

網站 `.env.local`：

```dotenv
VITE_MCP_BRIDGE_ENABLED=1
VITE_MCP_BRIDGE_PORT=4731
VITE_MCP_BRIDGE_TOKEN=<same-random-token>
```

MCP repo `.env`：

```dotenv
PULSE_BRIDGE_PORT=4731
PULSE_BRIDGE_TOKEN=<same-random-token>
PULSE_ALLOWED_ORIGINS=http://localhost:3721,http://127.0.0.1:3721
```

專案根目錄已提供 `.mcp.json`，用 `${CLAUDE_PROJECT_DIR:-.}` 定位 sibling MCP repo，
不在設定檔放 token。Claude Code 第一次載入 project-scoped server 時會要求批准；修改設定後需重新啟動 Claude Code，並可用 `/mcp` 檢查連線。

## 第一版能力

- `get_map_state`：回讀 revision、camera、目前 visible layers、已登記 params 與 time。
- `apply_scene`：以 patch 語意套用 camera、layer visibility、params 與 time。
- `expectedRevision`：不一致時拒絕寫入。
- unknown / locked / unsupported target：保留其他可執行項目，並在 `denied` 明確回報。

## 已知不對稱

- `scene.layers` 是 patch，不會自動關閉未列出的圖層。
- 通用 `opacity`、selection、result overlay、`time.from/to` 第一版不支援，會回 `denied`。
- Browser contract 目前由 protocol version + 雙邊 contract tests 防漂移；後續應抽成可發布的 browser-safe shared package。

## 驗收指令

```bash
# terminal 1
cd ../mini-pulse-gis-mcp && npm run build && npm start

# terminal 2
npm run dev
```

接著在 MCP host 依序呼叫 `pulse_list_map_sessions`、`pulse_get_map_state`、`pulse_apply_scene`，並再次讀取 state 確認實際結果。

## 2026-08-17 驗收結果

- 網站：`npx tsc -b`、`npm test`（47 files / 633 tests）、`npm run build` 通過。
- MCP：typecheck、20 tests、production build 通過。
- 正式 MCP client 經 stdio → WebSocket → 網站 `PulseMcpBrowserClient` 完成三個 tools 的端到端測試。
- 實測 scene：高雄 camera、`aquaculturePonds`、`aquaculturePondsOpacity=0.8`；state read-back 正確，revision 由 0 增至 1。
- stale `expectedRevision` 會被拒絕；owner-only layer 會回 `denied`。
