/**
 * BYOK Key Vault — 使用者 LLM API key 的三層瀏覽器儲存
 *
 * L1 module 記憶體：永遠寫，分頁/App 存活期間有效
 * L2 sessionStorage：persist === "session" 時額外寫，分頁存活期間有效
 * L3 localStorage：persist === "local" 時額外寫，永久（需使用者主動刪除）
 *
 * 鐵則：key 值絕不進 console.log / 錯誤訊息 / telemetry。本檔任何 catch 一律靜默，
 * 不把 error 物件（可能夾帶呼叫參數）印出。
 *
 * 見 src/chat/types.ts 的 KeyVault 介面（契約，不可改）。
 */
import type { ChatProviderId, KeyVault } from "../chat/types";

const STORAGE_PREFIX = "mtp_llm_key_";
const PROVIDERS: ChatProviderId[] = ["anthropic", "openai", "google"];

function storageKey(provider: ChatProviderId): string {
  return `${STORAGE_PREFIX}${provider}`;
}

// L1：module 記憶體
const memory = new Map<ChatProviderId, string>();

function safeGet(storage: Storage, provider: ChatProviderId): string | null {
  try {
    return storage.getItem(storageKey(provider));
  } catch {
    // 隱私模式 / storage 被封鎖時靜默略過
    return null;
  }
}

function safeSet(storage: Storage, provider: ChatProviderId, value: string): void {
  try {
    storage.setItem(storageKey(provider), value);
  } catch {
    // 配額滿 / storage 被封鎖時靜默略過，key 仍留在 memory 可用
  }
}

function safeRemove(storage: Storage, provider: ChatProviderId): void {
  try {
    storage.removeItem(storageKey(provider));
  } catch {
    // ignore
  }
}

export const keyVault: KeyVault = {
  get(provider) {
    const inMemory = memory.get(provider);
    if (inMemory) return inMemory;
    const fromSession = safeGet(sessionStorage, provider);
    if (fromSession) return fromSession;
    const fromLocal = safeGet(localStorage, provider);
    if (fromLocal) return fromLocal;
    return null;
  },

  set(provider, key, persist) {
    memory.set(provider, key);
    // 只留使用者這次選擇的持久層，避免切換選項後殘留舊層的複本
    if (persist === "session") {
      safeSet(sessionStorage, provider, key);
      safeRemove(localStorage, provider);
    } else if (persist === "local") {
      safeSet(localStorage, provider, key);
      safeRemove(sessionStorage, provider);
    } else {
      safeRemove(sessionStorage, provider);
      safeRemove(localStorage, provider);
    }
  },

  clear(provider) {
    memory.delete(provider);
    safeRemove(sessionStorage, provider);
    safeRemove(localStorage, provider);
  },

  presence() {
    const result = {} as Record<ChatProviderId, boolean>;
    for (const provider of PROVIDERS) {
      result[provider] = keyVault.get(provider) !== null;
    }
    return result;
  },
};
