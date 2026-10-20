import { useEffect, useMemo, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { researchAuth as supabase, researchAuthConfigured as supabaseConfigured } from "./authClient";
import { BridgeClient, type BridgeConnectionContext, type StudyState } from "./bridgeClient";
import { AgentTabSession, sessionTabStorage, type AgentTabView } from "./agentTabSession";
import { AgentTokenSection } from "./AgentTokenSection";
import type { QueryHandler } from "./QueryResponder";
import { TEST_BROWSER_TOKEN, TEST_IDENTITY } from "./testIdentity";
import { localeStore, type LocaleSnapshot } from "../state/localeStore";

export type ResearchConnectionProps = {
  surface?: "lab" | "map";
  onReady?: () => void;
  onState: (state: StudyState) => void;
  onDisconnect: () => void;
  onConnection: (context: BridgeConnectionContext | null) => void;
  /** Main map only. Absent on /lab → the long poll sends acceptQueries:false. */
  queryHandler?: QueryHandler;
};

/** 等同 useLocale()，但只用 useState／useEffect：連線元件有測試把它當純函式呼叫（只 mock 這幾個 hook）。 */
function useLocaleSnapshot(): LocaleSnapshot {
  const [, bump] = useState(0);
  useEffect(() => localeStore.subscribe(() => bump(count => count + 1)), []);
  return localeStore.getSnapshot();
}
/**
 * 分頁預設不開放 Agent 連線（2026-10-20：本機任何 Claude 對話呼叫地圖工具時，會自動接上唯一開著的分頁）。
 * 例外：本機測試身分、網址帶 `?agent=1`（自動測試用）、這個分頁先前已開放（重整沿用，存在 sessionStorage）。
 */
export const AGENT_ALLOWED_KEY = "pulse.research.agentAllowed.v1";
export function agentAllowedAtStart(): boolean {
  if (TEST_IDENTITY) return true;
  if (typeof window === "undefined") return false;
  try {
    if (new URLSearchParams(window.location.search ?? "").get("agent") === "1") return true;
    return window.sessionStorage.getItem(AGENT_ALLOWED_KEY) === "1";
  } catch { return false; }
}
function rememberAgentAllowed(allowed: boolean): void {
  try { if (allowed) window.sessionStorage.setItem(AGENT_ALLOWED_KEY, "1"); else window.sessionStorage.removeItem(AGENT_ALLOWED_KEY); } catch { /* private mode: only this page load */ }
}
const TONE: Record<AgentTabView["status"], "live" | "waiting"> = { starting: "waiting", waiting: "waiting", connected: "live", error: "waiting" };
function statusTitle(view: AgentTabView | null, t: LocaleSnapshot["t"]): string {
  if (!view || view.status === "starting") return t("research.conn.preparingTab");
  if (view.status === "error") return t("research.conn.notDone");
  if (view.status === "connected") return view.deviceLabel ? t("research.conn.connectedDevice", { device: view.deviceLabel }) : t("research.conn.connected");
  return t("research.conn.waiting");
}

/**
 * P3 connection panel: a signed-in tab (or the DEV loopback test identity) gets its own
 * study automatically; local agents attach with an agent token, no pairing code.
 */
export function ResearchConnection({ onState, onDisconnect, onConnection, onReady, queryHandler, surface = "lab" }: ResearchConnectionProps) {
  const { t } = useLocaleSnapshot();
  const [session, setSession] = useState<Session | null>(null);
  const [view, setView] = useState<AgentTabView | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [restartKey, setRestartKey] = useState(0);
  const [allowed, setAllowed] = useState(agentAllowedAtStart());
  const accessToken = useRef<string | null>(null);
  const tab = useRef<AgentTabSession | null>(null);
  const callbacks = useRef({ onState, onDisconnect, onConnection, onReady, queryHandler });
  callbacks.current = { onState, onDisconnect, onConnection, onReady, queryHandler };
  const client = useMemo(() => new BridgeClient(async () => {
    if (TEST_IDENTITY) return TEST_BROWSER_TOKEN;
    if (!supabaseConfigured) return null;
    return accessToken.current;
  }), []);
  const userId = TEST_IDENTITY ? TEST_BROWSER_TOKEN : session?.user.id ?? null;

  useEffect(() => {
    if (TEST_IDENTITY || !supabaseConfigured) return;
    let disposed = false;
    void supabase!.auth.getSession().then(({ data }) => {
      if (disposed) return;
      accessToken.current = data.session?.access_token ?? null;
      setSession(data.session);
    });
    const { data: subscription } = supabase!.auth.onAuthStateChange((event, next) => {
      if (disposed) return;
      accessToken.current = next?.access_token ?? null;
      setSession(next);
      // A tab stopped by an expired login resumes once a fresh token arrives.
      if (next && (event === "TOKEN_REFRESHED" || event === "SIGNED_IN") && tab.current?.snapshot.status === "error") setRestartKey(value => value + 1);
    });
    return () => { disposed = true; accessToken.current = null; subscription.subscription.unsubscribe(); };
  }, []);

  // One study per signed-in tab once the owner allows it (or a test opt-in); a reload resumes it, a token refresh keeps it.
  useEffect(() => {
    if (!userId || !allowed) return;
    const tabSession = new AgentTabSession({
      client, userId, storage: sessionTabStorage(), queryHandler: callbacks.current.queryHandler ?? null,
      onState: snapshot => callbacks.current.onState(snapshot),
      onConnection: context => callbacks.current.onConnection(context),
      onView: next => { setView(next); setNotice(null); },
    });
    tab.current = tabSession;
    tabSession.start();
    return () => {
      tabSession.stop();
      if (tab.current === tabSession) tab.current = null;
      callbacks.current.onDisconnect();
      setView(null);
    };
  }, [allowed, client, restartKey, userId]);

  const welcomed = useRef<string | null>(null);
  useEffect(() => {
    if (view?.status !== "connected" || !view.tabLabel) return;
    if (welcomed.current === view.tabLabel) return;
    welcomed.current = view.tabLabel;
    callbacks.current.onReady?.();
  }, [view?.status, view?.tabLabel]);

  const signIn = async () => {
    if (!supabaseConfigured) return;
    setNotice(localeStore.getSnapshot().t("research.conn.googleRedirect"));
    const { error } = await supabase!.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}${surface === "map" ? "/" : "/lab/"}` } });
    if (error) setNotice(localeStore.getSnapshot().t("research.conn.signInFailed"));
  };
  const signOut = async () => {
    if (tab.current && !await tab.current.revokeForSignOut()) { setNotice(localeStore.getSnapshot().t("research.conn.revokeUnconfirmed")); return; }
    const { error } = await supabase!.auth.signOut({ scope: "local" });
    if (error) setNotice(localeStore.getSnapshot().t("research.conn.signOutUnconfirmed"));
  };

  const allow = () => { rememberAgentAllowed(true); setAllowed(true); };
  // Revokes the study (a bound agent gets SESSION_REVOKED) before the tab stops accepting agents.
  const close = async () => {
    if (tab.current && !await tab.current.revokeForSignOut()) { setNotice(localeStore.getSnapshot().t("research.conn.closeUnconfirmed")); return; }
    rememberAgentAllowed(false); setAllowed(false); setNotice(null);
  };

  const help = <small className="agent-connection-help">{surface === "map" ? t("research.conn.helpMap") : t("research.conn.helpLab")}</small>;
  if (!TEST_IDENTITY && !supabaseConfigured) {
    return <section aria-label={t("research.conn.aria")} className="research-pairing"><strong>{t("research.conn.title")}</strong><p>{t("research.conn.disabled")}</p><small>{t("research.conn.disabledNote")}</small>{help}</section>;
  }
  if (!userId) {
    return <section aria-label={t("research.conn.aria")} className="research-pairing"><strong>{t("research.conn.title")}</strong>
      <p>{notice ?? t("research.conn.signInPrompt")}</p>
      <button type="button" onClick={() => void signIn()}>{t("research.conn.signInGoogle")}</button>{help}
    </section>;
  }
  if (!allowed) {
    return <section aria-label={t("research.conn.aria")} className="research-pairing research-pairing--agent">
      <strong>{t("research.conn.title")}</strong>
      <p className="research-agent-status research-agent-status--waiting" role="status"><span className="research-agent-dot" aria-hidden="true" />{t("research.conn.closedTitle")}</p>
      <small>{notice ?? t("research.conn.closedNote")}</small>
      <button type="button" onClick={allow}>{t("research.conn.allow")}</button>
      {session && <details className="agent-connection-settings"><summary>{t("research.conn.settings")}</summary>
        <small>{t("research.conn.account", { email: session.user.email ?? "" })}</small>
        {surface === "map" && <AgentTokenSection client={client} />}
        <div className="agent-connection-actions"><button type="button" onClick={() => void signOut()}>{t("research.conn.signOut")}</button></div>
      </details>}
      {help}
    </section>;
  }
  const tone = TONE[view?.status ?? "starting"];
  const ready = view?.status === "connected" || view?.status === "waiting";
  return <section aria-label={t("research.conn.aria")} className="research-pairing research-pairing--agent">
    <strong>{t("research.conn.title")}</strong>
    <p className={`research-agent-status research-agent-status--${tone}`} role="status"><span className="research-agent-dot" aria-hidden="true" />{statusTitle(view, t)}<span className="research-agent-tab">{view?.tabLabel ? t("research.conn.tabLabel", { label: view.tabLabel }) : t("research.conn.tabPending")}</span></p>
    <small>{notice ?? view?.message ?? t("research.conn.preparingThisTab")}</small>
    {ready && <button type="button" onClick={() => void tab.current?.pause()}>{view?.paused ? t("research.conn.resume") : t("research.conn.pause")}</button>}
    {view?.status === "connected" && <button type="button" onClick={() => void tab.current?.disconnectAgent()}>{t("research.conn.disconnect")}</button>}
    {!TEST_IDENTITY && <button type="button" onClick={() => void close()}>{t("research.conn.close")}</button>}
    <details className="agent-connection-settings"><summary>{t("research.conn.settings")}</summary>
      {session ? <small>{t("research.conn.account", { email: session.user.email ?? "" })}</small> : <small>{t("research.conn.testIdentity")}</small>}
      {surface === "map" && <AgentTokenSection client={client} />}
      {session && <div className="agent-connection-actions"><button type="button" onClick={() => void signOut()}>{t("research.conn.signOut")}</button></div>}
    </details>
    {help}
  </section>;
}
