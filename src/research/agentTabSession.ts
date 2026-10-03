import { BridgeError, type BridgeClient, type BridgeConnectionContext, type StudyState } from "./bridgeClient";
import { BrowserChannel } from "./browserChannel";
import { acquireConnectionLease, classifyConnectionFailure, isBackgroundDocument, nextPollDelay, type ConnectionLease } from "./connectionReliability";
import type { QueryHandler } from "./QueryResponder";

/**
 * P3 (SPEC-prod-connect §2.5, §6.4): a signed-in tab owns one study automatically — no
 * pairing code. The tab creates (or, after a reload, resumes) its study, holds the
 * tab-exclusive lease, hands the connection to the map, and long-polls. An agent with a
 * token binds to it via /agent/tabs + /agent/bind. "中斷 Agent" revokes the study and the
 * tab immediately starts a fresh one so the next agent can attach.
 */
export type StoredTab = { studyId: string; tabId: string; userId: string };
export type TabStorage = { read(): StoredTab | null; write(value: StoredTab): void; clear(): void };
export type AgentTabStatus = "starting" | "waiting" | "connected" | "error";
export type AgentTabView = { status: AgentTabStatus; tabLabel: string | null; paused: boolean; deviceLabel: string | null; message: string };

/** Same derivation as the gateway's /agent/tabs `tabLabel`: alphanumerics of tabId, first 4, upper case. */
export function tabLabelOf(tabId: string): string { return tabId.replace(/[^A-Za-z0-9]/g, "").slice(0, 4).toUpperCase(); }

export const TAB_STORAGE_KEY = "pulse.research.connection.v2";
const SAFE = /^[A-Za-z0-9._-]{1,128}$/;
/** Tab-scoped (sessionStorage): a reload resumes the same study; a duplicated tab fails the lease and makes its own. */
export function sessionTabStorage(storage: Pick<Storage, "getItem" | "setItem" | "removeItem"> | null = typeof window === "undefined" ? null : window.sessionStorage): TabStorage {
  return {
    read() {
      try {
        const value: unknown = JSON.parse(storage?.getItem(TAB_STORAGE_KEY) ?? "null");
        return value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 3 && ["studyId", "tabId", "userId"].every(key => key in value) && Object.values(value).every(part => typeof part === "string" && SAFE.test(part)) ? value as StoredTab : null;
      } catch { return null; }
    },
    write(value) { try { storage?.setItem(TAB_STORAGE_KEY, JSON.stringify(value)); } catch { /* private mode: no resume, still usable */ } },
    clear() { try { storage?.removeItem(TAB_STORAGE_KEY); } catch { /* ignore */ } },
  };
}

export function connectionErrorMessage(error: unknown): string {
  const failure = classifyConnectionFailure(error);
  if (failure.code === "AUTH_REQUIRED") return "登入驗證已失效，或此帳號尚未獲准使用研究連線；請重新登入。";
  if (failure.code === "AUTH_UPSTREAM_FAILED") return "登入驗證服務暫時無法連線，將稍後重試。";
  if (failure.code === "CONNECTION_LOCK_UNAVAILABLE") return "此瀏覽器不支援安全的分頁連線，請改用最新版 Chrome、Edge 或 Safari。";
  if (failure.kind === "rate") return "連線請求過多，正在依服務要求放慢重試。";
  if (failure.kind === "timeout") return "連線逾時，將以較慢頻率重試。";
  if (failure.kind === "scene") return "地圖呈現尚未完成；連線仍會繼續同步。";
  return "連線服務暫時無法更新，將以較慢頻率重試。";
}

const WAITING = "等待 Agent 連線：在 Claude Code 使用地圖工具時，會自動接上這個分頁。";
const CONNECTED = "Agent 已連線，可以開始探索圖層。";
const PAUSED = "操作已暫停；Agent 仍綁定這個分頁。";
/** Study gone on the gateway (revoked elsewhere, cleaned up): rebuild instead of stopping. */
const STUDY_GONE = new Set(["STUDY_DENIED", "SESSION_REVOKED", "SESSION_EXPIRED", "NOT_FOUND"]);
const MAX_REBUILDS = 3;

type Client = Pick<BridgeClient, "createStudy" | "browserStatus" | "wait" | "pause" | "revoke">;
export type AgentTabSessionOptions = {
  client: BridgeClient;
  userId: string;
  storage: TabStorage;
  onState: (snapshot: StudyState) => void;
  onConnection: (context: BridgeConnectionContext | null) => void;
  onView: (view: AgentTabView) => void;
  queryHandler?: QueryHandler | null;
  acquireLease?: (studyId: string, tabId: string) => Promise<ConnectionLease | null>;
  newTabId?: () => string;
  schedule?: (callback: () => void, ms: number) => () => void;
};

export class AgentTabSession {
  private stopped = false;
  private lease: ConnectionLease | null = null;
  private channel: BrowserChannel | null = null;
  private study: { studyId: string; tabId: string } | null = null;
  private view: AgentTabView = { status: "starting", tabLabel: null, paused: false, deviceLabel: null, message: "正在準備這個分頁…" };
  private failures = 0;
  private rebuilds = 0;
  private cancelRetry: (() => void) | null = null;
  constructor(private readonly options: AgentTabSessionOptions) {}

  get current(): { studyId: string; tabId: string } | null { return this.study; }
  get snapshot(): AgentTabView { return this.view; }
  start(): void { this.emit(this.view); void this.open(); }

  stop(): void {
    if (this.stopped) return;
    this.stopped = true;
    this.cancelRetry?.(); this.cancelRetry = null;
    this.detach();
  }

  async pause(): Promise<void> {
    const study = this.study;
    if (!study) return;
    try {
      const next = await this.client.pause(study.studyId, study.tabId, !this.view.paused);
      if (this.stopped || this.study !== study) return;
      this.options.onState(next);
      this.emit({ ...this.view, paused: next.paused, message: next.paused ? "已暫停網站操作。" : "已恢復網站操作。" });
    } catch { this.emit({ ...this.view, message: "暫停狀態未確認，請重試。" }); }
  }

  /** Owner revokes the agent: the study is revoked (agent gets SESSION_REVOKED) and a fresh study takes its place. */
  async disconnectAgent(): Promise<boolean> {
    const study = this.study;
    if (!study) return false;
    try { await this.client.revoke(study.studyId); }
    catch { this.emit({ ...this.view, message: "中斷尚未確認，請重試。" }); return false; }
    if (this.stopped || this.study !== study) return true;
    this.detach(); this.options.storage.clear();
    this.rebuilds = 0;
    this.emit({ status: "starting", tabLabel: null, paused: false, deviceLabel: null, message: "已中斷 Agent，正在準備新的連線…" });
    void this.open();
    return true;
  }

  /** Before sign-out: revoke this tab's study so no agent keeps controlling it. */
  async revokeForSignOut(): Promise<boolean> {
    const study = this.study;
    if (study) {
      try { await this.client.revoke(study.studyId); } catch { return false; }
    }
    this.options.storage.clear();
    this.stop();
    return true;
  }

  private get client(): Client { return this.options.client; }

  private emit(view: AgentTabView): void { this.view = view; if (!this.stopped) this.options.onView(view); }

  private async acquire(studyId: string, tabId: string): Promise<ConnectionLease | null> {
    const acquire = this.options.acquireLease ?? acquireConnectionLease;
    const lease = await acquire(studyId, tabId);
    if (lease) return lease;
    // React StrictMode can briefly overlap a cancelled effect's lease release.
    await new Promise<void>(resolve => setTimeout(resolve, 0));
    return acquire(studyId, tabId);
  }

  private async open(): Promise<void> {
    let lease: ConnectionLease | null = null;
    try {
      let ref = await this.resume();
      if (ref) lease = this.lease;
      else {
        const created = await this.client.createStudy((this.options.newTabId ?? (() => crypto.randomUUID()))());
        if (this.stopped) return;
        lease = await this.acquire(created.studyId, created.tabId);
        if (!lease) { await this.client.revoke(created.studyId).catch(() => undefined); throw new BridgeError("CONNECTION_LOCK_UNAVAILABLE"); }
        this.options.storage.write({ ...created, userId: this.options.userId });
        ref = created;
      }
      if (this.stopped) { lease?.release(); return; }
      this.lease = lease;
      this.failures = 0;
      this.attach(ref);
    } catch (error) {
      if (lease && this.lease !== lease) lease.release();
      this.releaseLease();
      if (this.stopped) return;
      const failure = classifyConnectionFailure(error);
      const terminal = failure.code === "AUTH_REQUIRED" || failure.code === "CONNECTION_LOCK_UNAVAILABLE";
      this.emit({ status: "error", tabLabel: null, paused: false, deviceLabel: null, message: connectionErrorMessage(error) });
      if (!terminal) this.retry(error);
    }
  }

  /** Resume this tab's study after a reload; null means "make a new one". */
  private async resume(): Promise<{ studyId: string; tabId: string } | null> {
    const { storage, userId } = this.options;
    const stored = storage.read();
    if (!stored || stored.userId !== userId) { if (stored) storage.clear(); return null; }
    const lease = await this.acquire(stored.studyId, stored.tabId);
    if (this.stopped) { lease?.release(); return null; }
    if (!lease) { storage.clear(); return null; }
    try {
      const status = await this.client.browserStatus(stored.studyId, stored.tabId);
      this.lease = lease;
      return { studyId: status.studyId, tabId: status.tabId };
    } catch (error) {
      lease.release();
      const failure = classifyConnectionFailure(error);
      if (STUDY_GONE.has(failure.code)) { storage.clear(); return null; }
      throw error;
    }
  }

  private retry(error: unknown): void {
    this.failures += 1;
    const schedule = this.options.schedule ?? ((callback, ms) => { const timer = setTimeout(callback, ms); return () => clearTimeout(timer); });
    this.cancelRetry = schedule(() => { this.cancelRetry = null; if (!this.stopped) void this.open(); }, nextPollDelay(error, this.failures, isBackgroundDocument()));
  }

  private attach(study: { studyId: string; tabId: string }): void {
    const { client } = this.options;
    this.study = study;
    const tabLabel = tabLabelOf(study.tabId);
    this.emit({ status: "waiting", tabLabel, paused: false, deviceLabel: null, message: WAITING });
    this.options.onConnection({ client, studyId: study.studyId, tabId: study.tabId });
    const channel = new BrowserChannel({
      client, studyId: study.studyId, tabId: study.tabId, queryHandler: this.options.queryHandler ?? null,
      onState: (snapshot, agent) => {
        if (this.channel !== channel) return;
        this.rebuilds = 0;
        const connected = snapshot.connected;
        this.emit({ status: connected ? "connected" : "waiting", tabLabel, paused: snapshot.paused, deviceLabel: connected ? agent.deviceLabel : null, message: snapshot.paused ? PAUSED : snapshot.view.phase === "error" ? "地圖呈現尚未完成；連線仍會繼續同步。" : connected ? CONNECTED : WAITING });
        this.options.onState(snapshot);
      },
      onRecovered: () => { if (this.channel === channel) this.emit({ ...this.view, message: this.view.status === "connected" ? CONNECTED : WAITING }); },
      onFailure: (error, _failures, terminal) => {
        if (this.channel !== channel) return;
        const failure = classifyConnectionFailure(error);
        if (terminal && STUDY_GONE.has(failure.code) && this.rebuilds < MAX_REBUILDS) {
          this.rebuilds += 1;
          this.detach(); this.options.storage.clear();
          this.emit({ status: "starting", tabLabel: null, paused: false, deviceLabel: null, message: "這個分頁的連線已失效，正在重新準備…" });
          void this.open();
          return;
        }
        if (terminal) { this.detach(); this.emit({ status: "error", tabLabel: null, paused: false, deviceLabel: null, message: connectionErrorMessage(error) }); return; }
        this.emit({ ...this.view, message: connectionErrorMessage(error) });
      },
    });
    this.channel = channel;
    channel.start();
  }

  private detach(): void {
    this.channel?.stop(); this.channel = null;
    this.releaseLease();
    if (this.study) { this.study = null; this.options.onConnection(null); }
  }

  private releaseLease(): void { const lease = this.lease; this.lease = null; lease?.release(); }
}
