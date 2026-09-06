// 對話引擎只在第一次送出訊息或驗證金鑰時載入，避免首屏載入 AI SDK 與工具集合。

import { withLoading } from "../lib/loadingRegistry";
import type { AgentRunOptions, ChatMessage, ChatProviderId, RunChatTurn } from "./types";

type ChatEngine = Pick<typeof import("./agent"), "runChatTurn" | "testKey">;

const LOAD_TASK_ID = "chat-agent";
const LOAD_TASK_LABEL = "載入 AI 對話引擎";
const LOAD_ERROR = "對話引擎載入失敗，請稍後再試";

let enginePromise: Promise<ChatEngine> | null = null;

function abortError(): DOMException {
  return new DOMException("對話已中斷", "AbortError");
}

function loadEngine(): Promise<ChatEngine> {
  if (!enginePromise) {
    enginePromise = withLoading(LOAD_TASK_ID, LOAD_TASK_LABEL, import("./agent")).catch((error) => {
      enginePromise = null;
      throw error;
    });
  }
  return enginePromise;
}

function waitForEngine(abortSignal?: AbortSignal): Promise<ChatEngine> {
  if (!abortSignal) return loadEngine();
  if (abortSignal.aborted) return Promise.reject(abortError());

  return new Promise((resolve, reject) => {
    const onAbort = () => reject(abortError());
    abortSignal.addEventListener("abort", onAbort, { once: true });
    loadEngine().then(
      (engine) => {
        abortSignal.removeEventListener("abort", onAbort);
        resolve(engine);
      },
      (error: unknown) => {
        abortSignal.removeEventListener("abort", onAbort);
        reject(error);
      },
    );
  });
}

function loadFailureMessage(): ChatMessage {
  return {
    id: `lazy-${Date.now().toString(36)}`,
    role: "assistant",
    content: "",
    error: LOAD_ERROR,
    createdAt: Date.now(),
  };
}

/** 與 agent.runChatTurn 型別相容的延遲載入入口。 */
export const runChatTurn: RunChatTurn = async (opts: AgentRunOptions) => {
  try {
    const engine = await waitForEngine(opts.abortSignal);
    if (opts.abortSignal?.aborted) throw abortError();
    return await engine.runChatTurn(opts);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    return loadFailureMessage();
  }
};

/** 與 agent.testKey 型別相容的延遲載入入口。 */
export async function testKey(
  provider: ChatProviderId,
  model: string,
  apiKey: string,
): Promise<{ ok: boolean; message: string }> {
  try {
    const engine = await loadEngine();
    return await engine.testKey(provider, model, apiKey);
  } catch {
    return { ok: false, message: LOAD_ERROR };
  }
}
