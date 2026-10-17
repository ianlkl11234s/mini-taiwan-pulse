import type { AgentTokenSummary, BridgeClient, CreatedAgentToken } from "./bridgeClient";
import { classifyConnectionFailure } from "./connectionReliability";
import { localeStore, type LocaleSnapshot } from "../state/localeStore";

/**
 * P3 agent-token management state (SPEC-prod-connect §2.5). The secret lives only in
 * `created` — never in the list — and is gone for good once dismissed, revoked or the
 * panel unmounts; the gateway stores only its hash.
 */
export type AgentTokenState = { tokens: AgentTokenSummary[]; created: CreatedAgentToken | null; busy: boolean; loaded: boolean; message: string | null };
export const DEFAULT_AGENT_TOKEN_LABEL = "Claude Code";
export const TOKEN_SAVE_COMMAND = "pbpaste | npm run token:save";

/** 顯示用訊息：存進 state 時依當下語系翻譯（i18n 預設取目前語系）。 */
export function agentTokenErrorMessage(error: unknown, i18n: LocaleSnapshot = localeStore.getSnapshot()): string {
  const failure = classifyConnectionFailure(error);
  if (failure.code === "TOKEN_LIMIT") return i18n.t("research.token.errLimit");
  if (failure.code === "TOKEN_NOT_FOUND") return i18n.t("research.token.errNotFound");
  if (failure.kind === "auth") return i18n.t("research.token.errAuth");
  if (failure.kind === "rate") return i18n.t("research.token.errRate");
  return i18n.t("research.token.errService");
}
const tr: LocaleSnapshot["t"] = (key, vars) => localeStore.getSnapshot().t(key, vars);

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
      this.set({ created, message: tr("research.token.shownOnce") });
      await this.refresh();
    } catch (error) { this.set({ message: agentTokenErrorMessage(error) }); }
    finally { this.set({ busy: false }); }
  }

  async revoke(tokenId: string): Promise<void> {
    if (this.value.busy) return;
    this.set({ busy: true, message: null });
    try {
      await this.client.revokeAgentToken(tokenId);
      this.set({ message: tr("research.token.revoked"), ...(this.value.created?.tokenId === tokenId ? { created: null } : {}) });
    } catch (error) { this.set({ message: agentTokenErrorMessage(error) }); }
    finally { await this.refresh(); this.set({ busy: false }); }
  }

  /** Hides the one-time secret; it cannot be shown again. */
  dismiss(): void { this.set({ created: null }); }
  reportCopy(ok: boolean): void { this.set({ message: ok ? tr("research.token.copied", { command: TOKEN_SAVE_COMMAND }) : tr("research.token.copyFailed") }); }
}
