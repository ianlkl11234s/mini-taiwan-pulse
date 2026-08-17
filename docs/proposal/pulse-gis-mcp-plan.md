# Pulse GIS MCP — 架構與實作規劃

> 建立：2026-08-16
>
> 狀態：Phase 1 已完成（MCP server、網站 browser bridge、MapScene controller 與 project-scoped 接線）
>
> 決策：建立獨立 sibling repo `mini-pulse-gis-mcp`，並在既有 `mini-taiwan-pulse` 加入受控的本機 Agent Bridge；不建立第二套地圖網站。

---

## 0. 一句話結論

**Mini Taiwan Pulse 繼續負責顯示與互動；新建 `mini-pulse-gis-mcp` 當 Claude Code 的翻譯／協調層；正式空間計算留在 `gis-platform` PostGIS。**

```text
Claude Code
  → mini-pulse-gis-mcp（MCP tools + localhost bridge）
      ├→ mini-taiwan-pulse（開圖層、移動鏡頭、呈現分析結果）
      └→ gis-platform / PostGIS（距離、疊合、排名、路網分析）
```

MCP 不直接操作 Mapbox instance、不畫地圖，也不保存另一份圖層邏輯。

---

## 與既有文件的關係

| 文件 | 本計畫如何沿用 |
|---|---|
| [`member-byok-chat-plan.md`](./member-byok-chat-plan.md) | 沿用白名單 tools、LLM 不生 SQL、輸出截斷與既有 MapBridge 經驗 |
| [`architecture-overhaul-plan.md`](./architecture-overhaul-plan.md) | 接續 AR-43 對話介面與 Layer Manifest 架構，不另造圖層目錄 |
| [`worldmonitor-deep-dive-2026-07.md`](../research/worldmonitor-deep-dive-2026-07.md) | 延續既有 MCP／discovery／freshness 研究 |
| [`docs/features/byok-chat/README.md`](../features/byok-chat/README.md) | 外部 MCP 與已上線 BYOK chat 共用 controller，不取代內建 chat |
| [`docs/features/layer-manifest/README.md`](../features/layer-manifest/README.md) | `LAYER_MANIFEST` 與 `LAYER_PARAMS_SPEC` 繼續作為圖層能力 SSOT |

本檔是 architecture／implementation SSOT；實際交付狀態由 `docs/features/mini-pulse-gis-mcp/` 四檔追蹤。

---

## 1. 目標與非目標

### 1.1 目標

讓使用者可在 Claude Code 直接輸入：

- 「打開魚塭圖層，移動到高雄沿海。」
- 「找出污染源一公里內魚塭最密集的地區。」
- 「把污染源、距離帶與命中的農地疊在一起，調整成看得清楚的畫面。」
- 「把目前結果整理成可重現、可分享的資料故事場景。」

系統必須能：

1. 查詢圖層目錄與 metadata。
2. 控制已開啟的本機地圖頁面。
3. 回讀實際狀態，確認指令真的成功。
4. 執行具型別、白名單的 GIS 分析。
5. 自動找出值得觀察的區域並調整鏡頭。
6. 保存分析參數、資料版本、場景與限制，讓結果可重現。

### 1.2 非目標

- 不建立第二套地圖前端。
- 不讓 LLM 直接生成並執行任意 SQL。
- 不提供 `execute_js`、任意 shell、任意 URL fetch。
- 不以 Computer Use／滑鼠點擊作為主要控制方式。
- 第一版不處理多使用者遠端 MCP 服務。
- 第一版不宣稱「距離接近」等於污染因果。

---

## 2. 為什麼是獨立 MCP repo

建議的 workspace：

```text
GIS/
├─ mini-taiwan-pulse/   # 現有地圖 runtime
├─ mini-pulse-gis-mcp/  # 新 repo：本計畫主體
└─ gis-platform/        # Supabase / PostGIS / RPC
```

獨立 repo 的理由：

| 理由 | 說明 |
|---|---|
| 執行生命週期不同 | Vite 網站由瀏覽器執行；MCP 是 Claude Code 啟動的本機 subprocess |
| 安全邊界不同 | MCP 接觸本機 port、credential 與工具權限，不應混入前端 bundle |
| 可獨立測試 | 可用 MCP Inspector 測 tools，不必啟動完整前端 build |
| 可服務其他 client | 未來可供 Claude Desktop、Codex 或其他 MCP host 使用 |
| 避免前端膨脹 | MCP SDK、WebSocket server、analysis client 不進 Vite bundle |

代價是跨 repo contract 可能漂移，因此 Phase 0 必須先決定共用 schema 的 SSOT 與版本策略，不能各自手寫一份。

---

## 3. 現有地基

Mini Taiwan Pulse 已有可重用能力：

| 能力 | 現有位置 | MCP 化方向 |
|---|---|---|
| 瀏覽器內 agent loop | `src/chat/agent.ts` | 保留 BYOK chat；與外部 MCP 共用 controller |
| 地圖控制 facade | `src/chat/types.ts` 的 `MapBridge` | 擴成有回執的 `MapController` |
| 地圖工具 | `src/chat/tools/mapTools.ts` | tool 語意可沿用，執行改走共用 controller |
| 圖層查詢 | `src/chat/tools/catalogTools.ts` | 改由 manifest 產生 schema/catalog |
| 資料查詢 | `src/chat/tools/dataTools.ts`、`rpcTools.ts` | 保留白名單原則，逐步搬到 MCP adapter |
| 圖層 metadata | `src/data/layerManifest.ts` | 作為圖層目錄 SSOT |
| 圖層參數 | `src/data/layerParamsSpec.ts` | 產生 `set_layer_params` input schema |
| visibility / params / time SSOT | `src/state/*Store.ts` | controller 直接讀寫 store |
| 可重現 URL | `src/lib/urlState.ts`、`src/embed/EmbedApp.tsx` | 第一版優先產生 deterministic embed URL |

目前主要缺口：

1. `MapBridge` 多數方法回傳 `void`，Agent 無法確認實際套用結果。
2. permission gate 可能擋下圖層，但 tool 仍回報成功。
3. camera、selection、popup 與部分 UI state 尚未形成完整外部狀態契約。
4. 缺 `set_layer_params`、完整 time control、`fit_bounds`、`apply_scene`、screenshot。
5. 缺跨圖層 proximity／overlap／accessibility 分析 API。
6. URL 能重現單一畫面，但尚無多步 Story schema。

---

## 4. 目標架構

```text
┌──────────────── Claude Code / MCP Host ────────────────┐
│ 使用者自然語言                                         │
│ GIS Skills：分析 SOP、限制、故事流程                    │
└──────────────────────┬─────────────────────────────────┘
                       │ stdio / JSON-RPC
┌──────────────────────▼─────────────────────────────────┐
│ mini-pulse-gis-mcp                                      │
│                                                        │
│ MCP tools                                               │
│  ├─ Catalog tools                                       │
│  ├─ Map control tools                                   │
│  └─ Analysis tools                                      │
│                                                        │
│ BrowserBridge                 AnalysisClient            │
│  └─ 127.0.0.1 WebSocket       └─ public allowlisted RPC │
└───────────────┬──────────────────────────┬──────────────┘
                │                          │
┌───────────────▼──────────────┐  ┌────────▼──────────────┐
│ mini-taiwan-pulse            │  │ gis-platform         │
│ AgentBridge                  │  │ PostGIS / pgRouting  │
│ MapController                │  │ pre-aggregate RPC    │
│ MapScene / result overlay    │  │ spatial indexes      │
│ Mapbox / MapLibre renderer   │  └───────────────────────┘
└──────────────────────────────┘
```

### 4.1 控制迴圈

每次操作一律遵守：

```text
observe → bounded action → acknowledge → read back → verify
```

例如：

1. MCP 先讀目前 map revision。
2. 呼叫 `pulse_apply_scene(scene, expectedRevision)`。
3. 網站以共用 controller 套用狀態。
4. 網站回傳 `{ applied, denied, actualState, newRevision }`。
5. Agent 再讀狀態或 screenshot 驗證。

不得只回「command received」就當作成功。

---

## 5. 責任邊界

| 系統 | 負責 | 不負責 |
|---|---|---|
| `mini-pulse-gis-mcp` | MCP tools、schema validation、browser bridge、RPC client、context 截斷、錯誤訊息、audit | Mapbox rendering、React state、任意 SQL |
| `mini-taiwan-pulse` | 真實地圖狀態、圖層、相機、時間、selection、popup、分析結果呈現 | LLM orchestration、PostGIS 全量 join |
| `gis-platform` | 權威空間運算、索引、聚合、資料版本、read-only RPC | UI、自然語言理解 |
| Skills | Tool 使用 SOP、領域限制、驗證步驟、敘事格式 | 執行程式或保存即時資料 |

### 5.1 Client / Server GIS 分工

| 工作 | 執行處 |
|---|---|
| hover、click、popup、camera、feature highlight | Browser / Mapbox |
| viewport 內少量臨時 geometry | Browser / Turf.js（可選） |
| 全臺 spatial join、正式統計、排名 | PostGIS |
| 路網服務圈與最短路 | pgRouting |
| 大型結果呈現 | server-side simplify / vector tiles；browser 只 render |

`queryRenderedFeatures` 只可作 UI picking／視覺驗證，不可當正式統計母體。

---

## 6. 共用控制契約

### 6.1 MapScene

所有內建 chat、MCP、分享 URL 與未來 Story 都應使用同一個 declarative scene：

```ts
type MapScene = {
  camera?: {
    center?: [number, number]
    zoom?: number
    pitch?: number
    bearing?: number
    bounds?: [number, number, number, number]
    padding?: number
  }
  layers: Array<{
    id: string
    visible: boolean
    opacity?: number
    params?: Record<string, string | number | boolean>
  }>
  time?: {
    at?: string
    from?: string
    to?: string
    playing?: boolean
    speed?: number
  }
  selection?: {
    layerId: string
    featureIds: string[]
  }
  resultOverlay?: {
    analysisId: string
    stylePreset: string
  }
  narration?: string
  citations?: DatasetReference[]
}
```

### 6.2 Command Result

所有 mutation 必須回傳結構化結果：

```ts
type MapCommandResult = {
  commandId: string
  success: boolean
  previousRevision: number
  newRevision: number
  applied: string[]
  denied: Array<{ target: string; reason: string }>
  warnings: string[]
  actualState: MapStateSummary
}
```

### 6.3 版本與相容性

- command envelope 必帶 `protocolVersion`。
- 新增 optional field 不升 major version。
- 刪除／改義既有 field 才升 major version。
- 未知 command／field 必須回 actionable error，不可靜默成功。
- `expectedRevision` 不一致時拒絕寫入，避免 Agent 覆蓋使用者剛做的操作。

---

## 7. MCP Server 設計

### 7.1 技術選型

| 項目 | 決策 |
|---|---|
| 語言 | TypeScript |
| MCP SDK | 官方 TypeScript SDK |
| Claude Code transport | stdio |
| Browser bridge | `127.0.0.1` WebSocket |
| Schema | Zod + structured output schema |
| Remote transport | 第一版不做；未來再評估 Streamable HTTP + OAuth |

### 7.2 v0 Tools

命名一律以 `pulse_` 開頭，避免與其他 MCP server 衝突。

| Tool | 性質 | 用途 |
|---|---|---|
| `pulse_search_layers` | read-only | 依文字、主題、data class 搜尋圖層 |
| `pulse_get_layer_details` | read-only | 讀 metadata、來源、參數、資料日期與限制 |
| `pulse_get_map_state` | read-only | 讀目前 camera、layers、params、time、selection、revision |
| `pulse_apply_scene` | reversible mutation | 原子套用完整 MapScene |
| `pulse_focus_results` | reversible mutation | 依分析 bbox／feature refs 調整鏡頭 |
| `pulse_capture_view` | read-only | 取得 screenshot 與 render summary |

### 7.3 v1 Analysis Tools

| Tool | 用途 |
|---|---|
| `pulse_analyze_proximity` | 距離帶、最近距離、count／area aggregation |
| `pulse_analyze_overlap` | Polygon 衝突／覆蓋面積 |
| `pulse_analyze_accessibility` | 路網服務圈與可達性 |
| `pulse_get_analysis_result` | 取得非同步 job 的統計、bbox 與結果圖層 reference |
| `pulse_render_analysis` | 把分析結果轉成 MapScene 並呈現在網站 |

### 7.4 MCP Resources

```text
pulse://catalog/layers
pulse://layer/{id}/schema
pulse://dataset/{id}/metadata
pulse://map/{sessionId}/state
pulse://analysis/{analysisId}/result
```

列表與 feature query 必須支援 `limit`／cursor、bbox 與欄位投影；禁止把全量 GeoJSON 放進 LLM context。

### 7.5 Tool annotations

- Catalog／query／capture：`readOnlyHint: true`。
- `pulse_apply_scene`：`destructiveHint: false`、`idempotentHint: true`。
- 外部下載、檔案輸出或未來資料寫入：必須要求人工確認。
- annotations 只作提示；server 仍必須自行驗證 permission。

---

## 8. Mini Taiwan Pulse 修改範圍

### 8.1 共用 MapController

將現有 `chatBridge` 收斂成可被兩條入口共用的 controller：

```text
內建 BYOK Chat ─┐
                ├→ MapController → stores / Mapbox
外部 AgentBridge ┘
```

第一版最低能力：

- `getMapState()`
- `searchLayers()`
- `applyScene()`
- `setLayerParams()`
- `setTimeState()`
- `fitBounds()`
- `selectFeatures()`
- `showAnalysisResult()`
- `captureView()`

### 8.2 AgentBridge

網站主動連線本機 bridge；MCP 不可直接注入 DOM 或呼叫任意 JS。

最低要求：

- session ID 與隨機 token。
- Origin allowlist。
- command ID、timeout、cancel。
- protocol version handshake。
- reconnect 與「目前沒有網頁連線」的明確錯誤。
- 一次只控制使用者明確選定的 tab/session。

### 8.3 Result Overlay

分析結果不得混回來源 layer；使用獨立暫存 overlay，至少支援：

- source features。
- distance bands／service areas。
- matched targets。
- hotspot highlight。
- legend、method、data timestamp。
- clear／replace previous analysis。

---

## 9. 第一條垂直案例：污染源 × 農地／魚塭

### 9.1 使用者問題

> 顯示污染源和一公里內的魚塭，找出最明顯的地區。

### 9.2 執行流程

1. `pulse_search_layers` 找污染源與魚塭 layer ID。
2. `pulse_get_layer_details` 驗證資料日期、geometry、欄位與可用範圍。
3. `pulse_analyze_proximity` 使用 500／1,000／3,000 公尺距離帶。
4. PostGIS 用 `ST_DWithin` + GiST index 找候選；需要面積時再算 intersection area。
5. 依命中數、魚塭面積或風險分數排名 hotspot。
6. 分析 API 回傳 aggregate、top N、bbox、simplified result reference、method 與 warnings。
7. `pulse_render_analysis` 建立 MapScene。
8. 網站開啟來源／目標／結果 overlay，自動 fit bounds。
9. `pulse_capture_view` 驗證圖層、legend 與畫面清晰度。
10. Agent 回答數字、資料時間、方法與限制。

### 9.3 語意限制

- 距離分析只代表 proximity／exposure screening。
- 不得直接推論污染因果。
- 若要討論傳播，必須另納入污染物種類、時間、風向、水系、地形或地下水。
- count 應使用穩定實體 ID 去重，不可直接數 vector tile fragment。

---

## 10. 分階段實作

### Phase 0 — Repo 與契約（MCP-00～04）

| ID | 工作 | Repo | 驗收 |
|---|---|---|---|
| MCP-00 | 建立 `mini-pulse-gis-mcp` repo、TypeScript、lint/test/build | 新 repo | clean install + build 綠 |
| MCP-01 | 定義 command envelope、MapScene、MapCommandResult、版本策略 | 新 repo + pulse | 兩端 contract tests 綠 |
| MCP-02 | 建立 stdio MCP server 與 health tool | 新 repo | MCP Inspector 可連線 |
| MCP-03 | 建立 localhost WebSocket server、token、Origin、timeout | 新 repo | unauthorized connection 被拒絕 |
| MCP-04 | Claude Code 專案設定與開發 runbook | 新 repo | 新環境照文件可啟動 |

Phase 0 完成定義：MCP Inspector 能連 server；瀏覽器尚未控制地圖也可以正確回報「無 active session」。

### Phase 1 — 地圖控制 MVP（MCP-10～16）

| ID | 工作 | Repo | 驗收 |
|---|---|---|---|
| MCP-10 | 現有 MapBridge 收斂成有回執的 MapController | pulse | BYOK chat 行為零退化 |
| MCP-11 | AgentBridge handshake / reconnect / session selector | pulse | reload 後自動重連 |
| MCP-12 | `pulse_search_layers`、`pulse_get_layer_details` | 兩端 | 結果由 manifest 產生 |
| MCP-13 | `pulse_get_map_state` | 兩端 | 回傳 actual state + revision |
| MCP-14 | `pulse_apply_scene` | 兩端 | atomic、冪等、gate denial 可見 |
| MCP-15 | `pulse_capture_view` | 兩端 | screenshot + render summary |
| MCP-16 | deterministic embed URL fallback | 兩端 | 無 active tab 時仍可產生 URL |

Phase 1 成功情境：

> 「打開魚塭圖層，移動到高雄沿海。」

Claude Code 必須能完成操作、讀回狀態，且使用者在已開啟的頁面看到同步結果。

### Phase 2 — Proximity 分析（MCP-20～26）

| ID | 工作 | Repo | 驗收 |
|---|---|---|---|
| MCP-20 | 定義 proximity RPC contract 與資料語意 | analytics / platform | handoff 完整 |
| MCP-21 | PostGIS RPC、GiST index、timeout／row limit | gis-platform | EXPLAIN + 固定 fixture 正確 |
| MCP-22 | `pulse_analyze_proximity` tool | MCP | structured output + warnings |
| MCP-23 | analysis result overlay | pulse | 可清除、可替換、不污染 source |
| MCP-24 | hotspot ranking + recommended camera | platform / MCP | fixture 排名穩定 |
| MCP-25 | `pulse_render_analysis` closed loop | 兩端 | render 後 read-back 成功 |
| MCP-26 | Pollution × agriculture Skill | MCP repo | 真實題目走查通過 |

跨 repo 順序遵守既有規則：上游資料／handoff → `gis-platform` RPC → `mini-pulse-gis-mcp` tool → `mini-taiwan-pulse` 呈現。

### Phase 3 — Storytelling 與擴充分析（MCP-30～35）

| ID | 工作 |
|---|---|
| MCP-30 | `MapStory = MapScene[]` schema、step narration、citations |
| MCP-31 | proximity／overlap／accessibility workflow tools |
| MCP-32 | Story preview、save、share／embed URL |
| MCP-33 | OSM 固定日期 PBF → PostGIS／pgRouting |
| MCP-34 | progress、cancel、long-running analysis job |
| MCP-35 | 10 題以上 MCP evaluation suite |

---

## 11. 安全要求

### 11.1 Local bridge

- 只 bind `127.0.0.1`，禁止預設監聽 `0.0.0.0`。
- 每次啟動產生高 entropy session token。
- 驗證 WebSocket Origin。
- 使用者明確選定 active tab；不可廣播控制所有開啟頁面。
- MCP stdio stdout 只輸出 protocol，log 一律寫 stderr。

### 11.2 Tool／資料

- 不暴露任意 SQL、JS、shell、filesystem path 或任意 URL fetch。
- 所有 layer ID、RPC、filter field、aggregation 都走 allowlist。
- DB 使用 read-only／anon 可用的薄 RPC；加 statement timeout 與結果上限。
- feature query 強制 bbox、limit/cursor、欄位投影。
- 大 geometry 只回 simplified feature 或 tile reference。
- 敏感／owner-gated layer 由網站做最終 permission check，MCP 不得繞過。

### 11.3 Audit

每次 tool call 至少記錄：

- correlation ID／command ID。
- tool name 與 validated params。
- map state revision before／after。
- applied／denied／warnings。
- dataset IDs、版本／時間、分析參數。
- RPC 名稱、latency、result count；不得記 credential。

---

## 12. 測試與驗收

### 12.1 測試層級

| 層級 | 內容 |
|---|---|
| Contract | command／result schema、protocol version、unknown field |
| MCP unit | tool input validation、pagination、error message、annotations |
| Bridge integration | auth、reconnect、timeout、wrong revision、no active session |
| Frontend | MapController 對 visibility／params／time store 的真實 read-back |
| Spatial truth | 已知 point/polygon fixture 的距離、intersection、去重 |
| E2E | Claude／Inspector → MCP → browser → screenshot closed loop |
| Evaluation | 10 個獨立、唯讀、可驗證、穩定的真實問題 |

### 12.2 Phase 1 Definition of Done

- Claude Code 能發現 v0 tools。
- 能搜尋圖層、套用 scene、讀回實際狀態。
- locked layer 會回 `denied`，不會假成功。
- 沒有開網頁時回明確錯誤或 deterministic embed URL。
- 頁面 reload 能重連，不需要重啟 Claude Code。
- 既有 BYOK chat、URL state、embed 行為零退化。
- TypeScript build、現有 tests、MCP Inspector 與 browser E2E 全綠。

### 12.3 Phase 2 Definition of Done

- 污染源 × 魚塭／農地的固定 fixture 有可驗證答案。
- 正式統計不依賴 `queryRenderedFeatures`。
- 結果包含資料時間、距離模型、參數、count／area、warnings。
- 地圖能呈現來源、距離帶、命中目標與 hotspot。
- Agent 能自動 fit 到清楚的區域並以 screenshot 驗證。
- 回答明確區分 proximity 與 causality。

---

## 13. 主要風險

| 風險 | 對策 |
|---|---|
| MCP 與 frontend schema 漂移 | 單一 contract SSOT + generated schema + CI compatibility test |
| Tool 說成功但 UI 沒改 | mutation 必須 read-back actual state |
| 使用者操作與 Agent 互相覆蓋 | map revision + optimistic concurrency |
| 巨量 GeoJSON 灌爆 context／browser | aggregate、top N、simplify、vector tile |
| 任意 code execution | 完全不提供 `execute_js`／任意 SQL，typed allowlisted tools |
| 多個 tab 控錯畫面 | session picker + explicit active session |
| 分析被誤解為因果 | Skill、tool output 與 UI 固定加入方法／限制 |
| 公共 Overpass 被大量查詢 | 正式環境改用固定日期本地 OSM PBF |

---

## 14. 待拍板決策

| ID | 問題 | 建議 |
|---|---|---|
| D1 | 新 repo 名稱 | `mini-pulse-gis-mcp`（已拍板） |
| D2 | 跨 repo contract SSOT | MCP repo 保存 Zod/JSON Schema；pulse 使用 generated artifact 或版本化 package，開工前定案 |
| D3 | localhost WebSocket port | 支援 config／自動探測，不硬寫單一 port |
| D4 | screenshot 實作 | 優先使用既有 browser runtime capture；若受 Mapbox canvas 限制再加瀏覽器自動化 fallback |
| D5 | 第一個污染源 dataset | 開工前依授權、時間、geometry、欄位完整性選定 |
| D6 | 第一個目標層 | 建議魚塭 + 農地各一，先做一個、第二個驗證泛化性 |

---

## 15. 建議下一步

先開一個只做地基的小 PR／session，不碰空間分析：

1. 建立 sibling repo `mini-pulse-gis-mcp`。
2. 定案 D2 contract SSOT。
3. 完成 MCP-00～04。
4. 在 Mini Taiwan Pulse 將 `MapBridge` 改成有 structured acknowledgement 的 `MapController`。
5. 只做 `pulse_get_map_state` 與 `pulse_apply_scene` 的端到端閉環。
6. 確認「開魚塭圖層並移動鏡頭」穩定後，再進 Phase 2 SQL／PostGIS。

這個順序先證明控制鏈可靠，避免同時 debug MCP、WebSocket、React state 與空間 SQL。

---

## 16. 參考資料

- [MCP Architecture](https://modelcontextprotocol.io/specification/2026-07-28/architecture)
- [MCP stdio transport](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/stdio)
- [MCP Tools](https://modelcontextprotocol.io/specification/2026-07-28/server/tools)
- [Build with Agent Skills](https://modelcontextprotocol.io/docs/2026-07-28/develop/build-with-agent-skills)
- [Blender MCP](https://github.com/ahujasid/blender-mcp)
- [Anthropic Computer Use](https://platform.claude.com/docs/en/agents-and-tools/tool-use/computer-use-tool)
- [Mapbox queryRenderedFeatures example](https://docs.mapbox.com/mapbox-gl-js/example/queryrenderedfeatures-around-point/)
- [PostGIS ST_DWithin](https://postgis.net/docs/ST_DWithin.html)
- [PostGIS proximity query guidance](https://postgis.net/documentation/tips/st-dwithin/)
- [OpenStreetMap Overpass API](https://wiki.openstreetmap.org/wiki/Overpass_API)
- [osm2pgsql manual](https://osm2pgsql.org/doc/manual.html)
