// 對話引擎 — streamText + tool loop（上限 10 步），瀏覽器直連。
// 錯誤一律轉成固定的中文訊息，絕不把 apiKey / 原始錯誤細節外洩。

import { streamText, generateText, stepCountIs } from "ai";
import type { ModelMessage } from "ai";
import type {
  AgentRunOptions,
  ChatMessage,
  ChatProviderId,
  ChatToolCallSummary,
  RunChatTurn,
} from "./types";
import { createChatModel } from "./providers";
import { buildSystemPrompt } from "./systemPrompt";
import { buildTools } from "./tools/registry";

const MAX_STEPS = 10;

function genId(): string {
  return `a-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * 把任意錯誤轉成使用者可讀、且不含機敏資訊的固定訊息。
 * 只有 401/403 判為金鑰問題；網路 / CORS 判為直連失敗；其餘為通用錯誤。
 */
function classifyError(err: unknown): string {
  const e = err as { statusCode?: number; status?: number; name?: string; message?: string };
  const status = e?.statusCode ?? e?.status;
  const msg = String(e?.message ?? "");
  const name = String(e?.name ?? "");

  if (
    status === 401 ||
    status === 403 ||
    /\b401\b|\b403\b|unauthorized|invalid[\s_-]?api[\s_-]?key|permission denied|authentication/i.test(msg)
  ) {
    return "金鑰無效或無權限";
  }
  if (
    name === "TypeError" ||
    /failed to fetch|load failed|network error|networkerror|fetch failed|\bcors\b|econnrefused|err_network/i.test(msg)
  ) {
    return "無法直連該服務商（可能為網路或 CORS 限制），請改用其他家";
  }
  return "對話發生錯誤，請稍後再試";
}

/** 使用者主動中斷（AbortController.abort）產生的錯誤，不當成失敗。 */
function isAbortError(err: unknown): boolean {
  if (err instanceof DOMException && err.name === "AbortError") return true;
  const name = (err as { name?: string } | null | undefined)?.name;
  return name === "AbortError";
}

/**
 * 只保留有內容的歷史訊息，並轉成 AI SDK 的 ModelMessage。
 * assistant 訊息若有 toolCalls，把摘要併進 content 尾端（例如
 * 「[已執行工具：開啟 2 個圖層；搜尋「掩埋場」找到 2 筆]」），讓模型追問
 * 時知道前輪已經做過什麼、不必重跑工具；只有 toolCalls、content 為空的
 * 訊息也保留（否則整輪工具執行紀錄會從歷史消失）。刻意不塞工具原始回傳，
 * 保持歷史輕量。
 */
function toModelMessages(history: ChatMessage[], userText: string): ModelMessage[] {
  const msgs: ModelMessage[] = [];
  for (const m of history) {
    const hasToolCalls = m.role === "assistant" && !!m.toolCalls?.length;
    if (!m.content.trim() && !hasToolCalls) continue;

    let content = m.content;
    if (hasToolCalls) {
      const toolNote = `[已執行工具：${m.toolCalls!.map((c) => c.summary).join("；")}]`;
      content = content.trim() ? `${content}\n${toolNote}` : toolNote;
    }

    msgs.push(
      m.role === "assistant"
        ? { role: "assistant", content }
        : { role: "user", content },
    );
  }
  msgs.push({ role: "user", content: userText });
  return msgs;
}

export const runChatTurn: RunChatTurn = async (opts: AgentRunOptions): Promise<ChatMessage> => {
  const { provider, model, apiKey, history, userText, bridge, onDelta, onToolCall, abortSignal } = opts;

  const toolCalls: ChatToolCallSummary[] = [];
  let content = "";
  let errorMsg: string | undefined;
  let aborted = false;

  try {
    const result = streamText({
      model: createChatModel(provider, model, apiKey),
      system: buildSystemPrompt(bridge),
      messages: toModelMessages(history, userText),
      tools: buildTools(bridge),
      stopWhen: stepCountIs(MAX_STEPS),
      abortSignal,
    });

    for await (const part of result.fullStream) {
      switch (part.type) {
        case "text-delta": {
          content += part.text;
          onDelta?.(part.text);
          break;
        }
        case "tool-result": {
          const out = part.output as { summary?: unknown } | null | undefined;
          const summary =
            typeof out?.summary === "string" ? out.summary : `已執行 ${part.toolName}`;
          const call: ChatToolCallSummary = { name: part.toolName, summary };
          toolCalls.push(call);
          onToolCall?.(call);
          break;
        }
        case "tool-error": {
          const call: ChatToolCallSummary = {
            name: part.toolName,
            summary: `工具 ${part.toolName} 執行失敗`,
          };
          toolCalls.push(call);
          onToolCall?.(call);
          break;
        }
        case "error": {
          errorMsg = classifyError(part.error);
          break;
        }
        // AI SDK 在 abortSignal 觸發時不會 throw，而是正常收尾並送一個 abort part
        // （見 node_modules/ai/dist/index.js pull() 的 abort() helper）；漏接這個
        // part 會讓中斷後的部分內容被當成「正常完成」回傳，使用者看不出是中斷的。
        case "abort": {
          aborted = true;
          break;
        }
        // finishReason 可能是 'error'（模型端出錯但沒有先送 error part），這裡兜底
        // 確保這種錯誤形態也會 surface，不會被當成一般正常結束。
        case "finish": {
          if (part.finishReason === "error" && !errorMsg) {
            errorMsg = classifyError(undefined);
          }
          break;
        }
        default:
          break;
      }
    }

    let usage: ChatMessage["usage"];
    try {
      const u = await result.usage;
      usage = { inputTokens: u.inputTokens ?? 0, outputTokens: u.outputTokens ?? 0 };
    } catch {
      // usage 取不到不影響主回覆
    }

    if (aborted) {
      content = content ? `${content}（已中斷）` : "（已中斷）";
    } else if (!content.trim() && !errorMsg) {
      // 空回覆防護：不能讓使用者看到完全空白的回覆卻不知道發生什麼事。
      if (toolCalls.length) {
        content = "（模型未提供文字總結，以下為工具執行結果）";
      } else {
        errorMsg = "模型未產生回覆，請重試或改用進階檔模型";
      }
    }

    return {
      id: genId(),
      role: "assistant",
      content,
      toolCalls: toolCalls.length ? toolCalls : undefined,
      usage,
      error: errorMsg,
      createdAt: Date.now(),
    };
  } catch (err) {
    // 使用者主動中斷：保留已累積內容，不視為錯誤（尾端標記已中斷）
    if (isAbortError(err)) {
      return {
        id: genId(),
        role: "assistant",
        content: content ? `${content}（已中斷）` : "（已中斷）",
        toolCalls: toolCalls.length ? toolCalls : undefined,
        createdAt: Date.now(),
      };
    }
    return {
      id: genId(),
      role: "assistant",
      content,
      toolCalls: toolCalls.length ? toolCalls : undefined,
      error: errorMsg ?? classifyError(err),
      createdAt: Date.now(),
    };
  }
};

/** 用最小成本 ping 驗證金鑰是否可用。回傳結果不含任何機敏資訊。 */
export async function testKey(
  provider: ChatProviderId,
  model: string,
  apiKey: string,
): Promise<{ ok: boolean; message: string }> {
  try {
    await generateText({
      model: createChatModel(provider, model, apiKey),
      prompt: "ping",
      maxOutputTokens: 1,
    });
    return { ok: true, message: "金鑰驗證成功" };
  } catch (err) {
    return { ok: false, message: classifyError(err) };
  }
}
