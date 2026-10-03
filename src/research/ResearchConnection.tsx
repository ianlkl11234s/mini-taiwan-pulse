import { useEffect, useMemo, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { researchAuth as supabase, researchAuthConfigured as supabaseConfigured } from "./authClient";
import { BridgeClient, type BridgeConnectionContext, type StudyState } from "./bridgeClient";
import { AgentTabSession, sessionTabStorage, type AgentTabView } from "./agentTabSession";
import { AgentTokenSection } from "./AgentTokenSection";
import type { QueryHandler } from "./QueryResponder";
import { TEST_BROWSER_TOKEN, TEST_IDENTITY } from "./testIdentity";

export type ResearchConnectionProps = {
  surface?: "lab" | "map";
  onReady?: () => void;
  onState: (state: StudyState) => void;
  onDisconnect: () => void;
  onConnection: (context: BridgeConnectionContext | null) => void;
  /** Main map only. Absent on /lab → the long poll sends acceptQueries:false. */
  queryHandler?: QueryHandler;
};

const TONE: Record<AgentTabView["status"], "live" | "waiting"> = { starting: "waiting", waiting: "waiting", connected: "live", error: "waiting" };
function statusTitle(view: AgentTabView | null): string {
  if (!view || view.status === "starting") return "正在準備分頁";
  if (view.status === "error") return "連線未完成";
  if (view.status === "connected") return view.deviceLabel ? `Agent 已連線・${view.deviceLabel}` : "Agent 已連線";
  return "等待 Agent 連線";
}

/**
 * P3 connection panel: a signed-in tab (or the DEV loopback test identity) gets its own
 * study automatically; local agents attach with an agent token, no pairing code.
 */
export function ResearchConnection({ onState, onDisconnect, onConnection, onReady, queryHandler, surface = "lab" }: ResearchConnectionProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [view, setView] = useState<AgentTabView | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [restartKey, setRestartKey] = useState(0);
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

  // One study per signed-in tab, created or resumed automatically; a token refresh keeps it.
  useEffect(() => {
    if (!userId) return;
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
  }, [client, restartKey, userId]);

  const welcomed = useRef<string | null>(null);
  useEffect(() => {
    if (view?.status !== "connected" || !view.tabLabel) return;
    if (welcomed.current === view.tabLabel) return;
    welcomed.current = view.tabLabel;
    callbacks.current.onReady?.();
  }, [view?.status, view?.tabLabel]);

  const signIn = async () => {
    if (!supabaseConfigured) return;
    setNotice("正在轉往 Google 登入…");
    const { error } = await supabase!.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}${surface === "map" ? "/" : "/lab/"}` } });
    if (error) setNotice("登入暫時無法開始。");
  };
  const signOut = async () => {
    if (tab.current && !await tab.current.revokeForSignOut()) { setNotice("撤銷尚未確認，請先重試再登出。"); return; }
    const { error } = await supabase!.auth.signOut({ scope: "local" });
    if (error) setNotice("登出尚未確認，請重試。");
  };

  const help = <small className="agent-connection-help">{surface === "map" ? "在 Claude Code 提問，在這張地圖一起查看結果。" : "此頁只供獨立驗證連線與呈現；實際使用請回到 Mini Taiwan Pulse 主地圖。"}</small>;
  if (!TEST_IDENTITY && !supabaseConfigured) {
    return <section aria-label="圖層探索連線" className="research-pairing"><strong>協作連線</strong><p>連線服務尚未啟用，可先試用研究畫布。</p><small>未啟用：缺少網站登入設定。</small>{help}</section>;
  }
  if (!userId) {
    return <section aria-label="圖層探索連線" className="research-pairing"><strong>協作連線</strong>
      <p>{notice ?? "登入後，這個分頁就能讓本機 Agent 自動接上。"}</p>
      <button type="button" onClick={() => void signIn()}>使用 Google 登入</button>{help}
    </section>;
  }
  const tone = TONE[view?.status ?? "starting"];
  const ready = view?.status === "connected" || view?.status === "waiting";
  return <section aria-label="圖層探索連線" className="research-pairing research-pairing--agent">
    <strong>協作連線</strong>
    <p className={`research-agent-status research-agent-status--${tone}`} role="status"><span className="research-agent-dot" aria-hidden="true" />{statusTitle(view)}<span className="research-agent-tab">{view?.tabLabel ? `分頁 ${view.tabLabel}` : "分頁準備中"}</span></p>
    <small>{notice ?? view?.message ?? "正在準備這個分頁…"}</small>
    {ready && <button type="button" onClick={() => void tab.current?.pause()}>{view?.paused ? "恢復" : "暫停"}</button>}
    {view?.status === "connected" && <button type="button" onClick={() => void tab.current?.disconnectAgent()}>中斷 Agent</button>}
    <details className="agent-connection-settings"><summary>連線設定</summary>
      {session ? <small>登入帳號：{session.user.email}</small> : <small>本機測試身分</small>}
      {surface === "map" && <AgentTokenSection client={client} />}
      {session && <div className="agent-connection-actions"><button type="button" onClick={() => void signOut()}>登出這次探索登入</button></div>}
    </details>
    {help}
  </section>;
}
