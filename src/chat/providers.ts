// 供應商工廠 — 全部瀏覽器直連（BYOK），不經任何我方 proxy。
// key 只在此處交給官方 SDK，絕不落 log。

import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { LanguageModel } from "ai";
import type { ChatProviderId } from "./types";

/**
 * 依 provider 建立 AI SDK LanguageModel。
 * anthropic 需 `anthropic-dangerous-direct-browser-access` header 才能從瀏覽器直打。
 */
export function createChatModel(
  provider: ChatProviderId,
  model: string,
  apiKey: string,
): LanguageModel {
  switch (provider) {
    case "anthropic":
      return createAnthropic({
        apiKey,
        headers: { "anthropic-dangerous-direct-browser-access": "true" },
      })(model);
    case "openai":
      return createOpenAI({ apiKey })(model);
    case "google":
      return createGoogleGenerativeAI({ apiKey })(model);
    default: {
      const exhaustive: never = provider;
      throw new Error(`未知的供應商：${String(exhaustive)}`);
    }
  }
}
