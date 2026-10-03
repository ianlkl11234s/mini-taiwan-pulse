import type { AgentTokenSummary, BridgeClient, CreatedAgentToken } from "./bridgeClient";
import { classifyConnectionFailure } from "./connectionReliability";

/**
 * P3 agent-token management state (SPEC-prod-connect §2.5). The secret lives only in
 * `created` — never in the list — and is gone for good once dismissed, revoked or the
 * panel unmounts; the gateway stores only its hash.
 */
export type AgentTokenState = { tokens: AgentTokenSummary[]; created: CreatedAgentToken | null; busy: boolean; loaded: boolean; message: string | null };
export const DEFAULT_AGENT_TOKEN_LABEL = "Claude Code";
export const TOKEN_SAVE_COMMAND = "pbpaste | npm run token:save";

export function agentTokenErrorMessage(error: unknown): string {
  const failure = classifyConnectionFailure(error);
  if (failure.code === "TOKEN_LIMIT") return "已達 10 個，請先撤銷不用的金鑰。";
  if (failure.code === "TOKEN_NOT_FOUND") return "這把金鑰已不存在，清單已更新。";
  if (failure.kind === "auth") return "登入驗證已失效，請重新登入後再管理金鑰。";
  if (failure.kind === "rate") return "操作太頻繁，請稍後再試。";
  return "金鑰服務暫時無法使用，請稍後再試。";
}

type TokenClient = Pick<BridgeClient, "createAgentToken" | "listAgentTokens" | "revokeAgentToken">;

export class AgentTokenController {
  private value: AgentTokenState = { tokens: [], created: null, busy: false, loaded: false, message: null };
  constructor(private readonly client: TokenClient, private readonly onChange: (state: AgentTokenState) => void = () => {}) {}
  get state(): AgentTokenState { return this.value; }

  private set(patch: Partial<AgentTokenState>): void { this.value = { ...this.value, ...patch }; this.onChange(this.value); }

  async refresh(): Promise<void> {
    try { this.set({ tokens: await this.client.listAgentTokens(), loaded: true }); }
    catch (error) { this.set({ loaded: true, message: agentTokenErrorMessage(error) }); }
  }

  async create(label = DEFAULT_AGENT_TOKEN_LABEL): Promise<void> {
    if (this.value.busy) return;
    this.set({ busy: true, message: null, created: null });
    try {
      const created = await this.client.createAgentToken(label);
      this.set({ created, message: "金鑰只會顯示這一次，請現在複製。" });
      await this.refresh();
    } catch (error) { this.set({ message: agentTokenErrorMessage(error) }); }
    finally { this.set({ busy: false }); }
  }

  async revoke(tokenId: string): Promise<void> {
    if (this.value.busy) return;
    this.set({ busy: true, message: null });
    try {
      await this.client.revokeAgentToken(tokenId);
      this.set({ message: "已撤銷；使用這把金鑰的 Agent 會立即斷線。", ...(this.value.created?.tokenId === tokenId ? { created: null } : {}) });
    } catch (error) { this.set({ message: agentTokenErrorMessage(error) }); }
    finally { await this.refresh(); this.set({ busy: false }); }
  }

  /** Hides the one-time secret; it cannot be shown again. */
  dismiss(): void { this.set({ created: null }); }
  reportCopy(ok: boolean): void { this.set({ message: ok ? `已複製；在 MCP 目錄執行 ${TOKEN_SAVE_COMMAND}。` : "無法自動複製，請手動選取金鑰。" }); }
}
