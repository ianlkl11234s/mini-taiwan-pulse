import { useEffect, useState } from "react";
import type { BridgeClient } from "./bridgeClient";
import { useLocale } from "../state/localeStore";
import { AgentTokenController, TOKEN_SAVE_COMMAND, type AgentTokenState } from "./agentTokens";

export type AgentTokenPanelProps = { state: AgentTokenState; onCreate: () => void; onCopy: () => void; onDismiss: () => void; onRevoke: (tokenId: string) => void };

/** Presentational: one-time secret (copy + save hint) and the token list with revoke. */
export function AgentTokenPanel({ state, onCreate, onCopy, onDismiss, onRevoke }: AgentTokenPanelProps) {
  const { t, formatDateTime } = useLocale();
  const date = (ms: number) => formatDateTime(ms, { year: "numeric", month: "numeric", day: "numeric" });
  return <section className="agent-token-section" aria-label={t("research.token.aria")}>
    <small>{t("research.token.intro")}</small>
    {state.created ? <div className="agent-token-created">
      <small>{t("research.token.newKey")}</small>
      <code className="agent-token-secret">{state.created.token}</code>
      <small>{t("research.token.saveBefore")}<code>{TOKEN_SAVE_COMMAND}</code>{t("research.token.saveAfter")}</small>
      <div className="agent-connection-actions">
        <button type="button" onClick={onCopy}>{t("research.token.copy")}</button>
        <button type="button" onClick={onDismiss}>{t("research.token.saved")}</button>
      </div>
    </div> : <div className="agent-connection-actions"><button type="button" disabled={state.busy} onClick={onCreate}>{state.busy ? t("research.token.busy") : t("research.token.create")}</button></div>}
    {state.message && <small role="status">{state.message}</small>}
    {state.loaded && (state.tokens.length ? <ul className="agent-token-list" aria-label={t("research.token.listAria")}>
      {state.tokens.map(token => <li key={token.tokenId}>
        <span>{token.label}</span>
        <small>{t("research.token.created", { date: date(token.createdAt) })} · {t("research.token.expires", { date: date(token.expiresAt) })} · {token.lastUsedAt === null ? t("research.token.neverUsed") : t("research.token.lastUsed", { date: date(token.lastUsedAt) })}{token.activeSessions > 0 ? ` · ${t("research.token.inUse")}` : ""}</small>
        <button type="button" disabled={state.busy} aria-label={t("research.token.revokeLabel", { label: token.label })} title={t("research.token.revokeLabel", { label: token.label })} onClick={() => onRevoke(token.tokenId)}>{t("research.token.revoke")}</button>
      </li>)}
    </ul> : <small>{t("research.token.none")}</small>)}
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
