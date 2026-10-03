import { useEffect, useState } from "react";
import type { BridgeClient } from "./bridgeClient";
import { AgentTokenController, TOKEN_SAVE_COMMAND, type AgentTokenState } from "./agentTokens";

const date = (ms: number) => new Date(ms).toLocaleDateString("zh-TW");

export type AgentTokenPanelProps = { state: AgentTokenState; onCreate: () => void; onCopy: () => void; onDismiss: () => void; onRevoke: (tokenId: string) => void };

/** Presentational: one-time secret (copy + save hint) and the token list with revoke. */
export function AgentTokenPanel({ state, onCreate, onCopy, onDismiss, onRevoke }: AgentTokenPanelProps) {
  return <section className="agent-token-section" aria-label="Agent 金鑰">
    <small>Agent 金鑰讓本機 Claude Code 自動接上已登入的分頁；有效 30 天，可隨時撤銷。</small>
    {state.created ? <div className="agent-token-created">
      <small>新金鑰（只顯示這一次）：</small>
      <code className="agent-token-secret">{state.created.token}</code>
      <small>複製後在 MCP 目錄執行 <code>{TOKEN_SAVE_COMMAND}</code>。</small>
      <div className="agent-connection-actions">
        <button type="button" onClick={onCopy}>複製金鑰</button>
        <button type="button" onClick={onDismiss}>我已保存</button>
      </div>
    </div> : <div className="agent-connection-actions"><button type="button" disabled={state.busy} onClick={onCreate}>{state.busy ? "處理中…" : "產生 Agent 金鑰"}</button></div>}
    {state.message && <small role="status">{state.message}</small>}
    {state.loaded && (state.tokens.length ? <ul className="agent-token-list" aria-label="已產生的金鑰">
      {state.tokens.map(token => <li key={token.tokenId}>
        <span>{token.label}</span>
        <small>建立 {date(token.createdAt)} · 到期 {date(token.expiresAt)} · {token.lastUsedAt === null ? "尚未使用" : `最後使用 ${date(token.lastUsedAt)}`}{token.activeSessions > 0 ? " · 使用中" : ""}</small>
        <button type="button" disabled={state.busy} aria-label={`撤銷 ${token.label}`} title={`撤銷 ${token.label}`} onClick={() => onRevoke(token.tokenId)}>撤銷</button>
      </li>)}
    </ul> : <small>目前沒有金鑰。</small>)}
  </section>;
}

export function AgentTokenSection({ client }: { client: BridgeClient }) {
  const [state, setState] = useState<AgentTokenState>({ tokens: [], created: null, busy: false, loaded: false, message: null });
  const [controller] = useState(() => new AgentTokenController(client, setState));
  useEffect(() => { void controller.refresh(); }, [controller]);
  const copy = async () => {
    const token = controller.state.created?.token;
    if (!token) return;
    try { await navigator.clipboard.writeText(token); controller.reportCopy(true); } catch { controller.reportCopy(false); }
  };
  return <AgentTokenPanel state={state} onCreate={() => void controller.create()} onCopy={() => void copy()} onDismiss={() => controller.dismiss()} onRevoke={tokenId => void controller.revoke(tokenId)} />;
}
