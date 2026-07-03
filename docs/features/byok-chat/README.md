# BYOK AI 對話助手

> **Slug**：`byok-chat`
> **狀態**：shipped（BYOK chat + 會員 P0）
> **Owner**：migu
> **上線日期**：2026-07-03
> **相關 PR**：#51（chat）#52 `pending`（member P0）

## 一句話說明

使用者自帶 LLM API key（Anthropic / OpenAI / Google 三選）在瀏覽器直連對話，
LLM 透過白名單 tools 操作地圖（開圖層 / 飛行 / 標記）與查資料（靜態 geojson 統計 /
H3 人口 join / 薄 RPC），key 零經手我方伺服器。

## 架構要點（詳見 `docs/proposal/member-byok-chat-plan.md`）

- **BYOK 直連**：Anthropic 帶 `anthropic-dangerous-direct-browser-access` header；
  三層儲存（memory / sessionStorage 預設 / localStorage opt-in）；CORS 被封則揭露不做 proxy
- **Agent loop**：Vercel AI SDK v7（`streamText` + `stopWhen: stepCountIs(10)`），瀏覽器內執行
- **安全邊界**：LLM 只能呼叫白名單 tools；`supabase.rpc` 全 codebase 單一出口
  （`rpcTools.callWhitelistedRpc`，白名單外拒絕）；tool 回傳一律過 `capToolResult` 截斷鐵則
- **Agentic 人體工學**：查詢 0 筆 / 欄位不存在回 availableFields + 樣本值 + hint 供模型自我修正

## 圖層 / 元件

| 元件 | 類型 | 說明 |
|---|---|---|
| ChatPanel | 浮層 panel | 桌機右上錨定 max 55vh（popup 開啟時讓位縮 45vh）；手機底部上拉 60vh |
| KeySettings | 面板內頁 | provider/model 選擇 + key 三層儲存 + 測試連線 |
| chatHighlight | featureInfo 條目 | AI 標記點的 popup + halo |

## 關鍵檔案

- 契約：`src/chat/types.ts`（MapBridge / RunChatTurn / KeyVault，改動需同步 UI+邏輯兩側）
- 引擎：`src/chat/agent.ts`（loop + abort/finish/空回覆防護）、`providers.ts`、`systemPrompt.ts`
- Tools：`src/chat/tools/`（mapTools / catalogTools / dataTools / rpcTools / datasets / truncate）
- UI：`src/components/chat/`、`src/state/chatStore.ts`、`src/lib/keyVault.ts`
- 接線：`src/App.tsx`（chatBridge useMemo + 觸發按鈕）

## 資料契約摘要

無上游新契約——全部使用既有靜態 geojson（13 個白名單 dataset）與既有 anon RPC
（10 支白名單）。無 taipei-gis-analytics handoff。詳見 [handoff.md](./handoff.md)。

## 已知限制 / 注意

- 輕量檔模型（Haiku/Flash）在多步任務可能偷懶，設定頁已加提示引導進階檔
- `police_stations` URL 帶日期戳（`_20260626`），上游換版需同步 `datasets.ts`
- 掩埋場等廢棄物設施是 RPC 動態資料，計數走 `get_waste_facility_counts`
- IME（注音）Enter 已守門（isComposing / keyCode 229）
- 部署前置：CSP header `connect-src` 需含三家 LLM 域名；隱私頁 BYOK 揭露
