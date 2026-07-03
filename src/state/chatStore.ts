/**
 * Chat Store — BYOK 對話面板的外部 store（照 satelliteConsoleStore pattern）
 *
 * 用 useSyncExternalStore 訂閱；ChatPanel / KeySettings 跨元件共享狀態，不靠 prop drilling。
 */
import { useSyncExternalStore } from "react";
import type { ChatMessage, ChatProviderId } from "../chat/types";

export type ChatStatus = "idle" | "streaming" | "error";
export type PersistChoice = "memory" | "session" | "local";

interface ChatState {
  /** 對話浮層是否開啟 */
  open: boolean;
  messages: ChatMessage[];
  status: ChatStatus;
  provider: ChatProviderId;
  model: string;
  /** key 儲存位置偏好（KeySettings 選取，套用到下一次 keyVault.set） */
  persistChoice: PersistChoice;
  /** 是否顯示 KeySettings 頁（內嵌在 ChatPanel 內） */
  settingsOpen: boolean;
}

let state: ChatState = {
  open: false,
  messages: [],
  status: "idle",
  provider: "anthropic",
  model: "",
  persistChoice: "session",
  settingsOpen: false,
};

const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export const chatStore = {
  getState(): ChatState {
    return state;
  },
  subscribe(cb: () => void): () => void {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },
  open() {
    if (state.open) return;
    state = { ...state, open: true };
    emit();
  },
  close() {
    if (!state.open) return;
    state = { ...state, open: false };
    emit();
  },
  setSettingsOpen(settingsOpen: boolean) {
    if (state.settingsOpen === settingsOpen) return;
    state = { ...state, settingsOpen };
    emit();
  },
  setProvider(provider: ChatProviderId) {
    if (state.provider === provider) return;
    state = { ...state, provider };
    emit();
  },
  setModel(model: string) {
    if (state.model === model) return;
    state = { ...state, model };
    emit();
  },
  setPersistChoice(persistChoice: PersistChoice) {
    if (state.persistChoice === persistChoice) return;
    state = { ...state, persistChoice };
    emit();
  },
  setStatus(status: ChatStatus) {
    if (state.status === status) return;
    state = { ...state, status };
    emit();
  },
  appendMessage(message: ChatMessage) {
    state = { ...state, messages: [...state.messages, message] };
    emit();
  },
  /** streaming 增量用：patch 最後一則訊息（呼叫方負責算好新內容，例如舊 content + delta） */
  updateLastAssistant(patch: Partial<ChatMessage>) {
    const { messages } = state;
    const lastIdx = messages.length - 1;
    const last = messages[lastIdx];
    if (!last) return;
    const nextMessages = messages.slice();
    nextMessages[lastIdx] = { ...last, ...patch };
    state = { ...state, messages: nextMessages };
    emit();
  },
  /** 清空對話（不影響 provider / model / persistChoice 等使用者偏好） */
  reset() {
    state = { ...state, messages: [], status: "idle" };
    emit();
  },
};

export function useChatStore() {
  return useSyncExternalStore(chatStore.subscribe, chatStore.getState);
}
