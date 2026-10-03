import { useEffect, useMemo, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { researchAuth as supabase, researchAuthConfigured as supabaseConfigured } from "./authClient";
import { BridgeClient, BridgeError, type BridgeConnectionContext, type PairingRequest, type PairingStatus, type StudyState } from "./bridgeClient";
import { acquireConnectionLease, classifyConnectionFailure, isBackgroundDocument, mustClearStoredConnection, nextPollDelay, type ConnectionLease } from "./connectionReliability";
import { BrowserChannel } from "./browserChannel";
import type { QueryHandler } from "./QueryResponder";
import { DEV_AUTOPAIR, DEV_BROWSER_TOKEN, DEV_PAIRING_PLACEHOLDER, DEV_USER_ID, devPanelState, standbyStep, type Standby } from "./devAutopair";

export type ResearchConnectionProps = {
  surface?: "lab" | "map";
  onReady?: () => void;
  onState: (state: StudyState) => void;
  onDisconnect: () => void;
  onConnection: (context: BridgeConnectionContext | null) => void;
  /** Main map only. Absent on /lab → the long poll sends acceptQueries:false. */
  queryHandler?: QueryHandler;
};

type StoredResearchConnection = { studyId: string; tabId: string; pairingId: string; userId: string };
const SESSION_KEY = "pulse.research.connection.v1";
function readStoredConnection(): StoredResearchConnection | null {
  try {
    const value: unknown = JSON.parse(window.sessionStorage.getItem(SESSION_KEY) ?? "null");
    return value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 4 && ["studyId", "tabId", "pairingId", "userId"].every(key => key in value) && Object.values(value).every(part => typeof part === "string" && /^[A-Za-z0-9._-]{1,128}$/.test(part)) ? value as StoredResearchConnection : null;
  } catch { return null; }
}
function storeConnection(value: StoredResearchConnection): void { window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(value)); }
function clearStoredConnection(): void { window.sessionStorage.removeItem(SESSION_KEY); }
function expiryMs(value: string | number): number { return typeof value === "number" ? value : Date.parse(value); }
function errorMessage(error: unknown): string {
  const failure = classifyConnectionFailure(error);
  if (failure.code === "PAIRING_REJECTED") return "配對無法使用，可能已過期、失效或不屬於目前帳號；請確認帳號後重新建立配對。";
  if (failure.kind === "auth") return "登入驗證已失效，請重新登入後再建立配對。";
  if (failure.kind === "expired") return "本地 Agent 工作階段已到期或撤銷，請重新建立配對。";
  if (failure.kind === "rate") return "連線請求過多，正在依服務要求放慢重試。";
  if (failure.kind === "timeout") return "驗證或連線逾時，將以較慢頻率重試。";
  if (failure.kind === "scene") return "地圖呈現尚未完成；連線仍會繼續同步。";
  if (failure.code === "NOT_FOUND") return "目前 Gateway 不支援安全恢復驗證；請更新 Gateway 後重新建立配對。";
  if (failure.code === "CONNECTION_LOCK_UNAVAILABLE") return "此瀏覽器不支援安全的同分頁恢復；請重新建立配對。";
  return "連線服務暫時無法更新，將以較慢頻率重試。";
}

/** Pairing controls; the separate PKCE client owns tab-scoped auth. Relay secrets stay in the companion. */
export function ResearchConnection({ onState, onDisconnect, onConnection, onReady, queryHandler, surface = "lab" }: ResearchConnectionProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [pairing, setPairing] = useState<PairingRequest | null>(null);
  const [status, setStatus] = useState<PairingStatus | null>(null);
  const [online, setOnline] = useState(false);
  const [paused, setPaused] = useState(false);
  const [creating, setCreating] = useState(false);
  const [study, setStudy] = useState<{ studyId: string; tabId: string } | null>(null);
  const [resumeRevision, setResumeRevision] = useState(0);
  /** True once onConnection delivered a context: the controller and query handler exist, so the long poll may start. */
  const [connectionDelivered, setConnectionDelivered] = useState(false);
  const [message, setMessage] = useState(DEV_AUTOPAIR ? "本機免授權模式：正在準備這個分頁…" : supabaseConfigured ? "先登入以建立配對。" : "連線服務尚未啟用，可先試用研究畫布。");
  const [devRetry, setDevRetry] = useState(0);
  const devBeginStarted = useRef(false);
  const standby = useRef<Standby | null>(null);
  const accessToken = useRef<string | null>(null);
  const client = useMemo(() => new BridgeClient(async () => {
    if (DEV_AUTOPAIR) return DEV_BROWSER_TOKEN;
    if (!supabaseConfigured) return null;
    return accessToken.current;
  }), []);
  const active = useRef(true);
  const resumeForUser = useRef<string | null>(null);
  const sessionUserId = session?.user.id ?? null;
  const resumeFailures = useRef(0);
  const connectionLease = useRef<ConnectionLease | null>(null);
  const activeSessionStudy = useRef<string | null>(null);
  const callbacks = useRef({ onState, onDisconnect, onConnection, onReady, queryHandler });
  callbacks.current = { onState, onDisconnect, onConnection, onReady, queryHandler };
  const releaseLease = (lease = connectionLease.current) => {
    if (!lease) return;
    if (connectionLease.current === lease) connectionLease.current = null;
    lease.release();
  };
  const welcomedStudy = useRef<string | null>(null);
  useEffect(() => {
    if (!study) { welcomedStudy.current = null; return; }
    if (status?.approved && online && welcomedStudy.current !== study.studyId) {
      welcomedStudy.current = study.studyId;
      callbacks.current.onReady?.();
    }
  }, [study, status?.approved, online]);


  useEffect(() => {
    active.current = true;
    let disposed = false;
    if (!supabaseConfigured || DEV_AUTOPAIR) return () => { active.current = false; };
    void supabase!.auth.getSession().then(({ data }) => {
      if (disposed) return;
      accessToken.current = data.session?.access_token ?? null;
      setSession(data.session);
    });
    const { data: subscription } = supabase!.auth.onAuthStateChange((_event, next) => {
      if (disposed) return;
      accessToken.current = next?.access_token ?? null;
      setSession(next);
      if (!next) { resumeForUser.current = null; releaseLease(); clearStoredConnection(); setOnline(false); setPairing(null); setStudy(null); setStatus(null); callbacks.current.onConnection(null); setConnectionDelivered(false); callbacks.current.onDisconnect(); }
    });
    return () => { disposed = true; active.current = false; accessToken.current = null; subscription.subscription.unsubscribe(); releaseLease(); };
  }, []);

  useEffect(() => {
    if (!sessionUserId || resumeForUser.current === sessionUserId || study) return;
    resumeForUser.current = sessionUserId;
    const stored = readStoredConnection();
    if (!stored || stored.userId !== sessionUserId) { resumeFailures.current = 0; if (stored) clearStoredConnection(); return; }
    let cancelled = false;
    let settled = false;
    let retryTimer: number | null = null;
    void (async () => {
      let lease: ConnectionLease | null = null;
      try {
        lease = await acquireConnectionLease(stored.studyId, stored.tabId);
        // React StrictMode can briefly overlap a cancelled effect's lease release.
        if (!lease) { await new Promise<void>(resolve => window.setTimeout(resolve, 0)); lease = await acquireConnectionLease(stored.studyId, stored.tabId); }
        if (cancelled || !active.current) { releaseLease(lease); return; }
        if (!lease) { clearStoredConnection(); setMessage("此探索已在另一個分頁開啟；請回到原分頁操作。 "); return; }
        connectionLease.current = lease;
        const result = await client.browserStatus(stored.studyId, stored.tabId);
        if (cancelled || !active.current) { releaseLease(lease); return; }
        if (mustClearStoredConnection(result.session)) { releaseLease(lease); clearStoredConnection(); setMessage("本地 Agent 工作階段已到期，請重新建立配對。"); return; }
        activeSessionStudy.current = result.studyId;
        resumeFailures.current = 0;
        setStudy({ studyId: result.studyId, tabId: result.tabId });
        setPairing({ pairingId: stored.pairingId, code: "", expiresAt: result.session.expiresAt ?? Date.now() });
        setStatus({ pairingId: stored.pairingId, claimed: true, approved: true, deviceLabel: null, phrase: null });
        setOnline(result.snapshot.connected); setPaused(result.snapshot.paused); callbacks.current.onState(result.snapshot);
        callbacks.current.onConnection({ client, studyId: result.studyId, tabId: result.tabId, pairingId: stored.pairingId }); setConnectionDelivered(true);
        setMessage(result.snapshot.connected ? "已安全恢復本地 Agent 連線。" : "已恢復配對，等待本地 Agent 重新連線。");
      } catch (error) {
        releaseLease(lease);
        if (cancelled || !active.current) return;
        const failure = classifyConnectionFailure(error);
        const terminal = failure.kind === "auth" || failure.kind === "expired" || failure.code === "NOT_FOUND" || failure.code === "CONNECTION_LOCK_UNAVAILABLE";
        if (terminal) { resumeFailures.current = 0; clearStoredConnection(); }
        else {
          resumeFailures.current += 1;
          resumeForUser.current = null;
          retryTimer = window.setTimeout(() => setResumeRevision(value => value + 1), nextPollDelay(error, resumeFailures.current, isBackgroundDocument()));
        }
        setOnline(false); setMessage(errorMessage(error));
      } finally {
        if (!cancelled) settled = true;
      }
    })();
    return () => {
      cancelled = true;
      if (retryTimer !== null) window.clearTimeout(retryTimer);
      // A cancelled attempt did not restore anything; StrictMode may start it again.
      if (!settled && resumeForUser.current === sessionUserId) resumeForUser.current = null;
    };
  }, [client, resumeRevision, sessionUserId, study]);

  // Dev autopair：免登入自動建立（或同分頁重整時恢復）study，主輪詢直接走 sync。
  useEffect(() => {
    if (!DEV_AUTOPAIR || study || devBeginStarted.current) return;
    devBeginStarted.current = true;
    let retryTimer: number | null = null;
    void (async () => {
      let lease: ConnectionLease | null = null;
      try {
        let ref: { studyId: string; tabId: string } | null = null;
        const stored = readStoredConnection();
        if (stored?.userId === DEV_USER_ID) {
          lease = await acquireConnectionLease(stored.studyId, stored.tabId);
          // 複製分頁會帶著同一份 sessionStorage：拿不到 lease 就改建新 study，避免兩個分頁共用綁定。
          if (lease) {
            try { const resumed = await client.browserStatus(stored.studyId, stored.tabId); ref = { studyId: resumed.studyId, tabId: resumed.tabId }; }
            catch { releaseLease(lease); lease = null; }
          }
        }
        if (!ref) {
          clearStoredConnection();
          const created = await client.createStudy(crypto.randomUUID());
          lease = await acquireConnectionLease(created.studyId, created.tabId);
          if (!lease) throw new BridgeError("CONNECTION_LOCK_UNAVAILABLE");
          ref = created;
        }
        if (!active.current) { releaseLease(lease); devBeginStarted.current = false; return; }
        connectionLease.current = lease;
        standby.current = null;
        activeSessionStudy.current = null;
        storeConnection({ ...ref, pairingId: DEV_PAIRING_PLACEHOLDER, userId: DEV_USER_ID });
        setStudy(ref);
        setPairing({ pairingId: DEV_PAIRING_PLACEHOLDER, code: "", expiresAt: Number.MAX_SAFE_INTEGER });
        setStatus({ pairingId: DEV_PAIRING_PLACEHOLDER, claimed: true, approved: true, deviceLabel: null, phrase: null });
        callbacks.current.onConnection({ client, studyId: ref.studyId, tabId: ref.tabId, pairingId: DEV_PAIRING_PLACEHOLDER }); setConnectionDelivered(true);
        setMessage("等待本地 Agent 連線；請保持此頁開啟。");
      } catch (error) {
        releaseLease(lease);
        devBeginStarted.current = false;
        if (!active.current) return;
        setMessage(error instanceof BridgeError && error.code === "AUTH_REQUIRED" ? "本機免授權未啟用：請以 PULSE_RESEARCH_DEV_AUTOPAIR=1 啟動 Gateway。" : errorMessage(error));
        retryTimer = window.setTimeout(() => setDevRetry(value => value + 1), 5_000);
      }
    })();
    return () => { if (retryTimer !== null) window.clearTimeout(retryTimer); };
  }, [client, study, devRetry]);

  // Dev autopair：分頁保有一張待命 pairing；Agent 領取後自動確認，被 exchange 用掉再補下一張（新 Agent 可接手）。
  useEffect(() => {
    if (!DEV_AUTOPAIR || !study) return;
    let cancelled = false;
    let timer: number | null = null;
    const tick = async () => {
      try {
        let current = standby.current;
        let status: PairingStatus | null = null;
        let sessionId: string | null = null;
        if (current && current.approvedForSession === undefined) {
          try { status = await client.pairingStatus(current.pairingId, study.tabId); }
          catch (error) { if (error instanceof BridgeError && error.code === "PAIRING_REJECTED") { standby.current = current = null; } else throw error; }
        }
        if (current && current.approvedForSession !== undefined) {
          const resumed = await client.browserStatus(study.studyId, study.tabId);
          sessionId = resumed.session.active ? resumed.session.sessionId : null;
        }
        if (cancelled) return;
        const step = standbyStep(current, status, sessionId, Date.now());
        if (step.kind === "create") {
          const request = await client.createPairing(study.studyId, study.tabId);
          if (cancelled) return;
          standby.current = { pairingId: request.pairingId, expiresAt: expiryMs(request.expiresAt) };
          await client.pairingStatus(request.pairingId, study.tabId); // 立即登記輪詢，Agent 的分頁清單才看得到
        } else if (step.kind === "approve" && current) {
          const before = await client.browserStatus(study.studyId, study.tabId);
          await client.approve(current.pairingId, study.tabId, step.phrase);
          if (!cancelled && standby.current?.pairingId === current.pairingId) standby.current = { ...current, approvedForSession: before.session.active ? before.session.sessionId : null };
        }
      } catch { /* 主輪詢負責顯示連線錯誤；待命迴圈下一輪再試 */ }
      finally { if (!cancelled) timer = window.setTimeout(() => void tick(), isBackgroundDocument() ? 5_000 : 1_000); }
    };
    void tick();
    return () => { cancelled = true; if (timer) window.clearTimeout(timer); };
  }, [client, study]);

  const signedIn = Boolean(session);
  const pairingApproved = status?.approved === true;
  // Before approval: poll the pairing status (pairing codes are removed in P3).
  useEffect(() => {
    if (!pairing || !study || pairingApproved || (!signedIn && !DEV_AUTOPAIR)) return;
    let cancelled = false;
    let timer: number | null = null;
    let failures = 0;
    const poll = async () => {
      let failure: unknown = null;
      try {
        const next = await client.pairingStatus(pairing.pairingId, study.tabId);
        failures = 0;
        if (!cancelled) setStatus(next);
      } catch (error) {
        failure = error; ++failures;
        if (!cancelled) {
          const classified = classifyConnectionFailure(error);
          setOnline(false); setMessage(errorMessage(error));
          if (classified.kind === "auth" || classified.kind === "expired") { cancelled = true; releaseLease(); clearStoredConnection(); standby.current = null; devBeginStarted.current = false; setPairing(null); setStudy(null); setStatus(null); callbacks.current.onConnection(null); setConnectionDelivered(false); callbacks.current.onDisconnect(); }
        }
      } finally {
        if (!cancelled) timer = window.setTimeout(() => void poll(), nextPollDelay(failure, failures, isBackgroundDocument()));
      }
    };
    void poll();
    return () => { cancelled = true; if (timer) window.clearTimeout(timer); };
  }, [client, pairing, pairingApproved, signedIn, study]);

  // After approval (P2): one /browser/wait long poll replaces the 3 s sync loop and the query poll.
  useEffect(() => {
    if (!pairing || !study || !pairingApproved || !connectionDelivered || (!signedIn && !DEV_AUTOPAIR)) return;
    let cancelled = false;
    const teardown = (text: string | null) => {
      cancelled = true; channel.stop(); activeSessionStudy.current = null; releaseLease(); clearStoredConnection(); standby.current = null; devBeginStarted.current = false;
      setOnline(false); setPairing(null); setStudy(null); setStatus(null); callbacks.current.onConnection(null); setConnectionDelivered(false); callbacks.current.onDisconnect();
      if (text) setMessage(text);
    };
    // A disconnected snapshot may mean the Agent session is gone for good; confirm once per change.
    const confirmSession = async () => {
      try {
        const resume = await client.browserStatus(study.studyId, study.tabId);
        if (cancelled) return;
        if (resume.session.active) activeSessionStudy.current = study.studyId;
        const awaitingExchange = activeSessionStudy.current !== study.studyId && Date.now() < expiryMs(pairing.expiresAt);
        if (mustClearStoredConnection(resume.session) && !awaitingExchange) teardown("本地 Agent 工作階段已到期，請重新建立配對。");
      } catch { /* The long poll reports connection failures. */ }
    };
    const channel = new BrowserChannel({
      client, studyId: study.studyId, tabId: study.tabId, queryHandler: callbacks.current.queryHandler ?? null,
      onState: snapshot => {
        if (cancelled) return;
        if (snapshot.connected) activeSessionStudy.current = study.studyId;
        setOnline(snapshot.connected); setPaused(snapshot.paused); callbacks.current.onState(snapshot);
        setMessage(snapshot.view.phase === "error" ? "地圖呈現尚未完成；連線仍會繼續同步。" : snapshot.connected ? "已連線，可以開始探索圖層。" : "等待本地 Agent 連線；請保持此頁開啟。");
        // Dev autopair 沒有 session 是常態（等待 Agent／接手中），不拆掉分頁綁定。
        if (!snapshot.connected && !DEV_AUTOPAIR) void confirmSession();
      },
      onFailure: (error, _failures, terminal) => {
        if (cancelled) return;
        setOnline(false); setMessage(errorMessage(error));
        if (terminal) teardown(null);
      },
    });
    channel.start();
    return () => { cancelled = true; channel.stop(); };
  }, [client, connectionDelivered, pairing, pairingApproved, signedIn, study]);

  useEffect(() => () => { releaseLease(); callbacks.current.onConnection(null); callbacks.current.onDisconnect(); }, []);

  const signOut = async () => {
    if (study) {
      try { await client.revoke(study.studyId); }
      catch { setMessage("撤銷尚未確認，請先重試撤銷再登出。"); return; }
    }
    const { error } = await supabase!.auth.signOut({ scope: "local" });
    if (error) setMessage("登出尚未確認，請重試。"); else clearStoredConnection();
  };
  const signIn = async () => {
    if (!supabaseConfigured) return;
    setMessage("正在轉往 Google 登入…");
    const { error } = await supabase!.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}${surface === "map" ? "/" : "/lab/"}` } });
    if (error) setMessage("登入暫時無法開始。");
  };
  const begin = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const tabId = crypto.randomUUID();
      const created = await client.createStudy(tabId);
      const lease = await acquireConnectionLease(created.studyId, created.tabId);
      if (!lease) { await client.revoke(created.studyId); throw new BridgeError("CONNECTION_LOCK_UNAVAILABLE"); }
      connectionLease.current = lease;
      const request = await client.createPairing(created.studyId, created.tabId);
      if (!active.current) return;
      activeSessionStudy.current = null; setStudy(created); setPairing(request); setStatus(null); storeConnection({ ...created, pairingId: request.pairingId, userId: session!.user.id }); setMessage("請在本地 Codex 輸入配對碼，並回到此處確認。 ");
      callbacks.current.onConnection({ client, studyId: created.studyId, tabId: created.tabId, pairingId: request.pairingId }); setConnectionDelivered(true);
    } catch (error) { releaseLease(); setMessage(error instanceof BridgeError && error.code === "AUTH_REQUIRED" ? "目前登入帳號尚未獲准使用研究連線。" : error instanceof BridgeError && error.code === "AUTH_UPSTREAM_FAILED" ? "登入驗證服務暫時無法連線，請稍後重試。" : error instanceof BridgeError ? errorMessage(error) : "目前無法建立配對；預覽不受影響。"); } finally { if (active.current) setCreating(false); }
  };
  const copyPairing = async () => {
    if (!pairing || Date.now() >= Number(pairing.expiresAt)) { setMessage("配對碼已過期，請撤銷後重新建立。"); return; }
    try {
      await navigator.clipboard.writeText(`請使用 pulse-research MCP 的 pulse_pair_session 配對：pairingId=${pairing.pairingId}，code=${pairing.code}，deviceLabel=Codex-Local。拿到比對短語後，等我在網站按確認，再讀取目前地圖狀態。之後照我的問題找圖層、看來源、幫我探索，用我聽得懂的白話回答；某件事現在做不到，就用一句話說，並給一個替代做法。`);
      setMessage("已複製，請貼給已載入 pulse-research 的 Codex。");
    } catch { setMessage("無法複製，請手動複製下方配對 ID 與配對碼。"); }
  };
  const approve = async () => { if (!pairing || !study || !status?.phrase) return; try { await client.approve(pairing.pairingId, study.tabId, status.phrase); setMessage("已確認申請，等待本地 Codex 完成連線。 "); } catch { setMessage("確認失敗，尚未建立連線。 "); } };
  const pause = async () => { if (!study) return; try { const current = await client.sync(study.studyId, study.tabId); const next = await client.pause(study.studyId, study.tabId, !current.paused); setPaused(next.paused); callbacks.current.onState(next); setMessage(next.paused ? "已暫停網站操作。 " : "已恢復網站操作。 "); } catch { setMessage("暫停狀態未確認。 "); } };
  const revoke = async () => { if (!study) return; try { await client.revoke(study.studyId); } catch { setMessage("撤銷未確認，保留配對資訊以便重試。 "); return; } releaseLease(); clearStoredConnection(); setOnline(false); setPairing(null); setStudy(null); setStatus(null); callbacks.current.onConnection(null); setConnectionDelivered(false); callbacks.current.onDisconnect(); setMessage("已撤銷研究連線。離頁時無法保證請求送達。 "); };

  if (DEV_AUTOPAIR) {
    const panel = devPanelState(study?.tabId ?? null, online, paused);
    return <section aria-label="圖層探索連線" className="research-pairing research-pairing--dev">
      <strong>協作連線</strong>
      <p className={`research-dev-status research-dev-status--${panel.tone}`} role="status"><span className="research-dev-dot" aria-hidden="true" />{panel.title}<span className="research-dev-tab">{panel.label}</span></p>
      <small>{study ? panel.detail : message}</small>
      {study && online && <button onClick={() => void pause()}>{paused ? "恢復" : "暫停"}</button>}
    </section>;
  }
  return <section aria-label="圖層探索連線" className="research-pairing">
    <strong>協作連線</strong><p>{status?.approved ? (paused ? "操作已暫停" : online ? "已連線，可以開始探索圖層。" : "等待本地 Agent 連線；請保持此頁開啟。") : session && message === "先登入以建立配對。" ? "已登入，可建立配對。" : message}</p>{status?.approved && !online && <small>{message}</small>}
    {!supabaseConfigured ? <small>未啟用：缺少網站登入設定。</small> : !session ? <button onClick={() => void signIn()}>使用 Google 登入</button> : !pairing ? <button disabled={creating} onClick={() => void begin()}>{creating ? "正在建立…" : "建立配對"}</button> : <>
      {!status?.approved && <>
      <p>配對碼：<code>{pairing.code}</code></p><small>有效至 {new Date(pairing.expiresAt).toLocaleTimeString("zh-TW")}，請比對兩端短語再確認。</small><p>配對 ID：<code>{pairing.pairingId}</code></p><button onClick={() => void copyPairing()}>複製配對指令</button>
      {status?.deviceLabel && <p>裝置：{status.deviceLabel}</p>}{status?.phrase && <p>比對短語：{status.phrase}</p>}
      <button disabled={!status?.claimed || !status?.phrase || status.approved} onClick={() => void approve()}>確認配對</button></>}
      {status?.approved && <button onClick={() => void pause()}>{paused ? "恢復" : "暫停"}</button>}
    </>}
    {session && <details className="agent-connection-settings"><summary>連線設定</summary><small>登入帳號：{session.user.email}</small><div className="agent-connection-actions">{pairing && <button onClick={() => void revoke()}>撤銷配對</button>}<button onClick={() => void signOut()}>登出這次探索登入</button></div></details>}
    <small className="agent-connection-help">{surface === "map" ? "在 Codex 提問，在這張地圖一起查看結果。" : "此頁只供獨立驗證連線與呈現；實際使用請回到 Mini Taiwan Pulse 主地圖。正式連線尚待部署驗收。"}</small>
  </section>;
}
