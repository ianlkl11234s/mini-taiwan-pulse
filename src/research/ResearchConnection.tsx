import { useEffect, useMemo, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { researchAuth as supabase, researchAuthConfigured as supabaseConfigured } from "./authClient";
import { BridgeClient, BridgeError, type BridgeConnectionContext, type PairingRequest, type PairingStatus, type StudyState } from "./bridgeClient";

export type ResearchConnectionProps = {
  surface?: "lab" | "map";
  onState: (state: StudyState) => void;
  onDisconnect: () => void;
  onConnection: (context: BridgeConnectionContext | null) => void;
};

/** Pairing controls; the separate PKCE client owns tab-scoped auth. Relay secrets stay in the companion. */
export function ResearchConnection({ onState, onDisconnect, onConnection, surface = "lab" }: ResearchConnectionProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [pairing, setPairing] = useState<PairingRequest | null>(null);
  const [status, setStatus] = useState<PairingStatus | null>(null);
  const [online, setOnline] = useState(false);
  const [paused, setPaused] = useState(false);
  const [creating, setCreating] = useState(false);
  const [study, setStudy] = useState<{ studyId: string; tabId: string } | null>(null);
  const [message, setMessage] = useState(supabaseConfigured ? "先登入以建立配對。" : "連線服務尚未啟用，可先試用研究畫布。");
  const client = useMemo(() => new BridgeClient(async () => {
    if (!supabaseConfigured) return null;
    const { data } = await supabase!.auth.getSession();
    return data.session?.access_token ?? null;
  }), []);
  const active = useRef(true);
  const polling = useRef(false);
  const callbacks = useRef({ onState, onDisconnect, onConnection });
  const approved = useRef(false);
  callbacks.current = { onState, onDisconnect, onConnection };
  approved.current = status?.approved === true;

  useEffect(() => {
    active.current = true;
    if (!supabaseConfigured) return () => { active.current = false; };
    void supabase!.auth.getSession().then(({ data }) => { if (active.current) setSession(data.session); });
    const { data: subscription } = supabase!.auth.onAuthStateChange((_event, next) => { if (!active.current) return; setSession(next); if (!next) { setPairing(null); setStudy(null); setStatus(null); callbacks.current.onConnection(null); callbacks.current.onDisconnect(); } });
    return () => { active.current = false; subscription.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!pairing || !study || !session) return;
    let cancelled = false;
    const poll = async () => {
      if (polling.current) return;
      polling.current = true;
      try {
        if (approved.current) {
          const synced = await client.sync(study.studyId, study.tabId);
          if (!cancelled) { setOnline(synced.connected); setPaused(synced.paused); callbacks.current.onState(synced); }
        } else {
          const next = await client.pairingStatus(pairing.pairingId, study.tabId);
          if (!cancelled) { setStatus(next); if (next.approved) { const synced = await client.sync(study.studyId, study.tabId); if (!cancelled) { setOnline(synced.connected); setPaused(synced.paused); callbacks.current.onState(synced); } } }
        }
      } catch { if (!cancelled) setMessage("配對狀態暫時無法更新。未確認前不會視為連線。 "); }
      finally { polling.current = false; }
    };
    void poll(); const timer = window.setInterval(() => void poll(), 2_000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [client, pairing, session, study]);

  useEffect(() => () => { callbacks.current.onConnection(null); callbacks.current.onDisconnect(); }, []);

  const signOut = async () => {
    if (study) {
      try { await client.revoke(study.studyId); }
      catch { setMessage("撤銷尚未確認，請先重試撤銷再登出。"); return; }
    }
    const { error } = await supabase!.auth.signOut({ scope: "local" });
    if (error) setMessage("登出尚未確認，請重試。");
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
      const created = await client.createStudy(tabId); const request = await client.createPairing(created.studyId, created.tabId);
      if (!active.current) return;
      setStudy(created); setPairing(request); setStatus(null); setMessage("請在本地 Codex 輸入配對碼，並回到此處確認。 ");
      callbacks.current.onConnection({ client, studyId: created.studyId, tabId: created.tabId, pairingId: request.pairingId });
    } catch (error) { setMessage(error instanceof BridgeError && error.code === "AUTH_REQUIRED" ? "目前登入帳號尚未獲准使用研究連線。" : error instanceof BridgeError && error.code === "AUTH_UPSTREAM_FAILED" ? "登入驗證服務暫時無法連線，請稍後重試。" : error instanceof BridgeError && error.code === "BRIDGE_UNAVAILABLE" ? "研究連線服務暫時無法連線。" : "目前無法建立配對；預覽不受影響。"); } finally { if (active.current) setCreating(false); }
  };
  const copyPairing = async () => {
    if (!pairing || Date.now() >= Number(pairing.expiresAt)) { setMessage("配對碼已過期，請撤銷後重新建立。"); return; }
    try {
      await navigator.clipboard.writeText(`請使用 pulse-research MCP 的 pulse_pair_session 配對：pairingId=${pairing.pairingId}，code=${pairing.code}，deviceLabel=Codex-Local。取得比對短語後等我在網站確認，再讀取研究畫布狀態。`);
      setMessage("已複製，請貼給已載入 pulse-research 的 Codex。");
    } catch { setMessage("無法複製，請手動複製下方配對 ID 與配對碼。"); }
  };
  const approve = async () => { if (!pairing || !study || !status?.phrase) return; try { await client.approve(pairing.pairingId, study.tabId, status.phrase); setMessage("已確認申請，等待本地 Codex 完成連線。 "); } catch { setMessage("確認失敗，尚未建立連線。 "); } };
  const pause = async () => { if (!study) return; try { const current = await client.sync(study.studyId, study.tabId); const next = await client.pause(study.studyId, study.tabId, !current.paused); setPaused(next.paused); callbacks.current.onState(next); setMessage(next.paused ? "已暫停網站操作。 " : "已恢復網站操作。 "); } catch { setMessage("暫停狀態未確認。 "); } };
  const revoke = async () => { if (!study) return; try { await client.revoke(study.studyId); } catch { setMessage("撤銷未確認，保留配對資訊以便重試。 "); return; } setPairing(null); setStudy(null); setStatus(null); callbacks.current.onConnection(null); callbacks.current.onDisconnect(); setMessage("已撤銷研究連線。離頁時無法保證請求送達。 "); };

  return <section aria-label="研究連線" className="research-pairing">
    <strong>本地 Agent 連線</strong>{session && <><small>登入帳號：{session.user.email}</small><button onClick={() => void signOut()}>登出這次研究登入</button></>}<p>{status?.approved ? (paused ? "操作已暫停" : online ? "已連線，可由本地 Agent 操作畫布。" : "等待本地 Agent 連線；請保持此頁開啟。") : session && message === "先登入以建立配對。" ? "已登入，可建立配對。" : message}</p>{status?.approved && !online && <small>{message}</small>}
    {!supabaseConfigured ? <small>未啟用：缺少網站登入設定。</small> : !session ? <button onClick={() => void signIn()}>使用 Google 登入</button> : !pairing ? <button disabled={creating} onClick={() => void begin()}>{creating ? "正在建立…" : "建立配對"}</button> : <>
      <p>配對碼：<code>{pairing.code}</code></p><small>有效至 {new Date(pairing.expiresAt).toLocaleTimeString("zh-TW")}，請比對兩端短語再確認。</small><p>配對 ID：<code>{pairing.pairingId}</code></p><button onClick={() => void copyPairing()}>複製配對指令</button>
      {status?.deviceLabel && <p>裝置：{status.deviceLabel}</p>}{status?.phrase && <p>比對短語：{status.phrase}</p>}
      <button disabled={!status?.claimed || !status?.phrase || status.approved} onClick={() => void approve()}>確認配對</button>{" "}<button onClick={() => void pause()}>{paused ? "恢復" : "暫停"}</button>{" "}<button onClick={() => void revoke()}>撤銷</button>
    </>}
    <small>{surface === "map" ? "操作此頁既有圖層；開啟圖層會沿用原本的資料載入。正式連線尚未部署。" : "目前可測試移動地圖、顯示合成成果與清除。正式連線尚待部署驗收。"}</small>
  </section>;
}
