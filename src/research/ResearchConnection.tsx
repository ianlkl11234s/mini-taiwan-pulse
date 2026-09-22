import { useEffect, useMemo, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { researchAuth as supabase, researchAuthConfigured as supabaseConfigured } from "./authClient";
import { BridgeClient, BridgeError, type BridgeConnectionContext, type PairingRequest, type PairingStatus, type StudyState } from "./bridgeClient";
import { acquireConnectionLease, classifyConnectionFailure, isBackgroundDocument, mustClearStoredConnection, nextPollDelay, type ConnectionLease } from "./connectionReliability";

export type ResearchConnectionProps = {
  surface?: "lab" | "map";
  onReady?: () => void;
  onState: (state: StudyState) => void;
  onDisconnect: () => void;
  onConnection: (context: BridgeConnectionContext | null) => void;
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
export function ResearchConnection({ onState, onDisconnect, onConnection, onReady, surface = "lab" }: ResearchConnectionProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [pairing, setPairing] = useState<PairingRequest | null>(null);
  const [status, setStatus] = useState<PairingStatus | null>(null);
  const [online, setOnline] = useState(false);
  const [paused, setPaused] = useState(false);
  const [creating, setCreating] = useState(false);
  const [study, setStudy] = useState<{ studyId: string; tabId: string } | null>(null);
  const [message, setMessage] = useState(supabaseConfigured ? "先登入以建立配對。" : "連線服務尚未啟用，可先試用研究畫布。");
  const accessToken = useRef<string | null>(null);
  const client = useMemo(() => new BridgeClient(async () => {
    if (!supabaseConfigured) return null;
    return accessToken.current;
  }), []);
  const active = useRef(true);
  const resumeForUser = useRef<string | null>(null);
  const connectionLease = useRef<ConnectionLease | null>(null);
  const activeSessionStudy = useRef<string | null>(null);
  const callbacks = useRef({ onState, onDisconnect, onConnection, onReady });
  const approved = useRef(false);
  callbacks.current = { onState, onDisconnect, onConnection, onReady };
  approved.current = status?.approved === true;
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
    if (!supabaseConfigured) return () => { active.current = false; };
    void supabase!.auth.getSession().then(({ data }) => {
      if (!active.current) return;
      accessToken.current = data.session?.access_token ?? null;
      setSession(data.session);
    });
    const { data: subscription } = supabase!.auth.onAuthStateChange((_event, next) => {
      if (!active.current) return;
      accessToken.current = next?.access_token ?? null;
      setSession(next);
      if (!next) { releaseLease(); clearStoredConnection(); setOnline(false); setPairing(null); setStudy(null); setStatus(null); callbacks.current.onConnection(null); callbacks.current.onDisconnect(); }
    });
    return () => { active.current = false; accessToken.current = null; subscription.subscription.unsubscribe(); releaseLease(); };
  }, []);

  useEffect(() => {
    if (!session || resumeForUser.current === session.user.id || study) return;
    resumeForUser.current = session.user.id;
    const stored = readStoredConnection();
    if (!stored || stored.userId !== session.user.id) { if (stored) clearStoredConnection(); return; }
    let cancelled = false;
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
        setStudy({ studyId: result.studyId, tabId: result.tabId });
        setPairing({ pairingId: stored.pairingId, code: "", expiresAt: result.session.expiresAt ?? Date.now() });
        setStatus({ pairingId: stored.pairingId, claimed: true, approved: true, deviceLabel: null, phrase: null });
        setOnline(result.snapshot.connected); setPaused(result.snapshot.paused); callbacks.current.onState(result.snapshot);
        callbacks.current.onConnection({ client, studyId: result.studyId, tabId: result.tabId, pairingId: stored.pairingId });
        setMessage(result.snapshot.connected ? "已安全恢復本地 Agent 連線。" : "已恢復配對，等待本地 Agent 重新連線。");
      } catch (error) {
        releaseLease(lease);
        if (cancelled || !active.current) return;
        const failure = classifyConnectionFailure(error);
        if (failure.kind === "auth" || failure.kind === "expired" || failure.code === "NOT_FOUND" || failure.code === "CONNECTION_LOCK_UNAVAILABLE") clearStoredConnection();
        setOnline(false); setMessage(errorMessage(error));
      }
    })();
    return () => { cancelled = true; };
  }, [client, session, study]);

  useEffect(() => {
    if (!pairing || !study || !session) return;
    let cancelled = false;
    let timer: number | null = null;
    let failures = 0;
    let busy = false;
    const poll = async () => {
      if (busy) { if (!cancelled) timer = window.setTimeout(() => void poll(), nextPollDelay(null, failures, isBackgroundDocument())); return; }
      busy = true;
      let failure: unknown = null;
      try {
        if (approved.current) {
          const synced = await client.sync(study.studyId, study.tabId);
          failures = 0;
          if (synced.connected) activeSessionStudy.current = study.studyId;
          if (!synced.connected) {
            const resume = await client.browserStatus(study.studyId, study.tabId);
            if (cancelled) return;
            if (resume.session.active) activeSessionStudy.current = study.studyId;
            const awaitingExchange = activeSessionStudy.current !== study.studyId && Date.now() < expiryMs(pairing.expiresAt);
            if (mustClearStoredConnection(resume.session) && !awaitingExchange) {
              cancelled = true; activeSessionStudy.current = null; releaseLease(); clearStoredConnection(); setOnline(false); setPairing(null); setStudy(null); setStatus(null); callbacks.current.onConnection(null); callbacks.current.onDisconnect(); setMessage("本地 Agent 工作階段已到期，請重新建立配對。"); return;
            }
          }
          if (!cancelled) { setOnline(synced.connected); setPaused(synced.paused); callbacks.current.onState(synced); setMessage(synced.view.phase === "error" ? "地圖呈現尚未完成；連線仍會繼續同步。" : synced.connected ? "已連線，可以開始探索圖層。" : "等待本地 Agent 連線；請保持此頁開啟。"); }
        } else {
          const next = await client.pairingStatus(pairing.pairingId, study.tabId);
          failures = 0;
          if (!cancelled) { setStatus(next); if (next.approved) { const synced = await client.sync(study.studyId, study.tabId); if (!cancelled) { setOnline(synced.connected); setPaused(synced.paused); callbacks.current.onState(synced); setMessage(synced.connected ? "已連線，可以開始探索圖層。" : "等待本地 Agent 連線；請保持此頁開啟。"); } } }
        }
      } catch (error) {
        failure = error; ++failures;
        if (!cancelled) {
          const classified = classifyConnectionFailure(error);
          setOnline(false); setMessage(errorMessage(error));
          if (classified.kind === "auth" || classified.kind === "expired") { releaseLease(); clearStoredConnection(); setPairing(null); setStudy(null); setStatus(null); callbacks.current.onConnection(null); callbacks.current.onDisconnect(); }
        }
      } finally {
        busy = false;
        if (!cancelled) timer = window.setTimeout(() => void poll(), nextPollDelay(failure, failures, isBackgroundDocument()));
      }
    };
    void poll();
    return () => { cancelled = true; if (timer) window.clearTimeout(timer); };
  }, [client, pairing, session, study]);

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
      callbacks.current.onConnection({ client, studyId: created.studyId, tabId: created.tabId, pairingId: request.pairingId });
    } catch (error) { releaseLease(); setMessage(error instanceof BridgeError && error.code === "AUTH_REQUIRED" ? "目前登入帳號尚未獲准使用研究連線。" : error instanceof BridgeError && error.code === "AUTH_UPSTREAM_FAILED" ? "登入驗證服務暫時無法連線，請稍後重試。" : error instanceof BridgeError ? errorMessage(error) : "目前無法建立配對；預覽不受影響。"); } finally { if (active.current) setCreating(false); }
  };
  const copyPairing = async () => {
    if (!pairing || Date.now() >= Number(pairing.expiresAt)) { setMessage("配對碼已過期，請撤銷後重新建立。"); return; }
    try {
      await navigator.clipboard.writeText(`請使用 pulse-research MCP 的 pulse_pair_session 配對：pairingId=${pairing.pairingId}，code=${pairing.code}，deviceLabel=Codex-Local。取得比對短語後等我在網站確認，再讀取目前地圖狀態。接著依我的問題搜尋圖層、查看來源說明並協助探索；可使用已支援圖層的基本統計，尚未支援或資料契約不明的分析請明確說明目前不能做；需要計算時先說明目前範圍，並提供相關圖層作為探索起點。`);
      setMessage("已複製，請貼給已載入 pulse-research 的 Codex。");
    } catch { setMessage("無法複製，請手動複製下方配對 ID 與配對碼。"); }
  };
  const approve = async () => { if (!pairing || !study || !status?.phrase) return; try { await client.approve(pairing.pairingId, study.tabId, status.phrase); setMessage("已確認申請，等待本地 Codex 完成連線。 "); } catch { setMessage("確認失敗，尚未建立連線。 "); } };
  const pause = async () => { if (!study) return; try { const current = await client.sync(study.studyId, study.tabId); const next = await client.pause(study.studyId, study.tabId, !current.paused); setPaused(next.paused); callbacks.current.onState(next); setMessage(next.paused ? "已暫停網站操作。 " : "已恢復網站操作。 "); } catch { setMessage("暫停狀態未確認。 "); } };
  const revoke = async () => { if (!study) return; try { await client.revoke(study.studyId); } catch { setMessage("撤銷未確認，保留配對資訊以便重試。 "); return; } releaseLease(); clearStoredConnection(); setOnline(false); setPairing(null); setStudy(null); setStatus(null); callbacks.current.onConnection(null); callbacks.current.onDisconnect(); setMessage("已撤銷研究連線。離頁時無法保證請求送達。 "); };

  return <section aria-label="圖層探索連線" className="research-pairing">
    <strong>本地 Agent 連線</strong>{session && <><small>登入帳號：{session.user.email}</small><button onClick={() => void signOut()}>登出這次探索登入</button></>}<p>{status?.approved ? (paused ? "操作已暫停" : online ? "已連線，可以開始探索圖層。" : "等待本地 Agent 連線；請保持此頁開啟。") : session && message === "先登入以建立配對。" ? "已登入，可建立配對。" : message}</p>{status?.approved && !online && <small>{message}</small>}
    {!supabaseConfigured ? <small>未啟用：缺少網站登入設定。</small> : !session ? <button onClick={() => void signIn()}>使用 Google 登入</button> : !pairing ? <button disabled={creating} onClick={() => void begin()}>{creating ? "正在建立…" : "建立配對"}</button> : <>
      {!status?.approved && <>
      <p>配對碼：<code>{pairing.code}</code></p><small>有效至 {new Date(pairing.expiresAt).toLocaleTimeString("zh-TW")}，請比對兩端短語再確認。</small><p>配對 ID：<code>{pairing.pairingId}</code></p><button onClick={() => void copyPairing()}>複製配對指令</button>
      {status?.deviceLabel && <p>裝置：{status.deviceLabel}</p>}{status?.phrase && <p>比對短語：{status.phrase}</p>}
      <button disabled={!status?.claimed || !status?.phrase || status.approved} onClick={() => void approve()}>確認配對</button></>}
      {status?.approved && <button onClick={() => void pause()}>{paused ? "恢復" : "暫停"}</button>}{" "}<button onClick={() => void revoke()}>撤銷</button>
    </>}
    <small>{surface === "map" ? "配對後，在 Codex 說出想了解的主題，就能搜尋、解釋與開啟圖層。你也可以隨時手動操作地圖。" : "此頁只供獨立驗證連線與呈現；實際使用請回到 Mini Taiwan Pulse 主地圖。正式連線尚待部署驗收。"}</small>
  </section>;
}
