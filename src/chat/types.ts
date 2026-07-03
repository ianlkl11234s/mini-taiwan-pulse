// BYOK 對話功能 — UI 層（Task A）/ 邏輯層（Task B）共用契約
// 由 orchestrator 定稿：兩邊各自實作，不要擅改此檔；發現契約不足先在此檔加註 TODO。

export type ChatProviderId = "anthropic" | "openai" | "google";

export interface ChatModelOption {
  id: string; // 送 API 的 model id
  label: string; // UI 顯示名
  tier: "default" | "advanced";
}

export interface ChatToolCallSummary {
  name: string;
  /** 給 UI chip 顯示的一行摘要，例如「開啟 2 個圖層」「查詢 police_stations：2065 筆」 */
  summary: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string; // markdown
  toolCalls?: ChatToolCallSummary[];
  usage?: { inputTokens: number; outputTokens: number };
  error?: string;
  createdAt: number;
}

/** App.tsx 既有 handler 的注入面。整合時由 App.tsx 綁定，兩個任務都不要實作它。 */
export interface MapBridge {
  bulkSetVisibility(keys: string[], visible: boolean): void;
  allOff(): void;
  flyTo(lng: number, lat: number, zoom?: number): void;
  /** cameraPresets 具名地點；回傳 false 表示 preset 不存在 */
  jumpToPlace(presetId: string): boolean;
  highlightPoint(
    lng: number,
    lat: number,
    layerType?: string,
    properties?: Record<string, unknown>,
  ): void;
  getVisibleLayerKeys(): string[];
  getCurrentTimeISO(): string;
  getCamera(): { lng: number; lat: number; zoom: number };
}

/** key 只存瀏覽器：memory 永遠有；persist 決定是否落 sessionStorage / localStorage。絕不 log。 */
export interface KeyVault {
  get(provider: ChatProviderId): string | null;
  set(provider: ChatProviderId, key: string, persist: "memory" | "session" | "local"): void;
  clear(provider: ChatProviderId): void;
  presence(): Record<ChatProviderId, boolean>;
}

export interface AgentRunOptions {
  provider: ChatProviderId;
  model: string;
  apiKey: string;
  history: ChatMessage[]; // 不含本輪 user 訊息
  userText: string;
  bridge: MapBridge;
  /** streaming 文字增量 */
  onDelta?: (text: string) => void;
  /** tool 呼叫即時回報（UI 顯示 chip 用） */
  onToolCall?: (call: ChatToolCallSummary) => void;
  abortSignal?: AbortSignal;
}

/** Task B 在 src/chat/agent.ts 實作並 export const runChatTurn: RunChatTurn */
export type RunChatTurn = (opts: AgentRunOptions) => Promise<ChatMessage>;
