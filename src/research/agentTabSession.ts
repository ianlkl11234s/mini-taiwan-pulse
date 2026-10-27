import { BridgeError, type BridgeClient, type BridgeConnectionContext, type StudyState } from "./bridgeClient";
import { BrowserChannel } from "./browserChannel";
import { acquireConnectionLease, classifyConnectionFailure, isBackgroundDocument, nextPollDelay, type ConnectionLease } from "./connectionReliability";
import type { QueryHandler } from "./QueryResponder";
import { localeStore } from "../state/localeStore";
import type { MessageKey } from "../i18n/keys";

/** 狀態訊息在產生當下依目前語系翻（只顯示在面板，不回傳給 Agent） */
const msg = (key: MessageKey) => localeStore.getSnapshot().t(key);

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
  if (failure.code === "AUTH_REQUIRED") return msg("research.session.authRequired");
  if (failure.code === "AUTH_UPSTREAM_FAILED") return msg("research.session.authUpstream");
  if (failure.code === "CONNECTION_LOCK_UNAVAILABLE") return msg("research.session.lockUnavailable");
  if (failure.kind === "rate") return msg("research.session.rateLimited");
  if (failure.kind === "timeout") return msg("research.session.timeout");
  if (failure.kind === "scene") return msg("research.session.sceneNotReady");
  return msg("research.session.serviceUnavailable");
}

const WAITING = () => msg("research.session.waiting");
const CONNECTED = () => msg("research.session.connected");
const PAUSED = () => msg("research.session.paused");
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
  /** 儲存的 study 租約被別的分頁持有（複製分頁）：不自建新 study，交給呼叫端收回開放狀態。 */
  onDuplicateTab?: () => void;
  schedule?: (callback: () => void, ms: number) => () => void;
};

export class AgentTabSession {
  private stopped = false;
  private lease: ConnectionLease | null = null;
  private channel: BrowserChannel | null = null;
  private study: { studyId: string; tabId: string } | null = null;
  private view: AgentTabView = { status: "starting", tabLabel: null, paused: false, deviceLabel: null, message: msg("research.session.preparing") };
  private failures = 0;
  private rebuilds = 0;
  private cancelRetry: (() => void) | null = null;
  /** 進行中的 open()（resume／createStudy）；關閉時要等它落地，才知道有沒有 study 需要撤銷。 */
  private opening: Promise<void> | null = null;
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
      this.emit({ ...this.view, paused: next.paused, message: next.paused ? msg("research.session.pausedSite") : msg("research.session.resumedSite") });
    } catch { this.emit({ ...this.view, message: msg("research.session.pauseUnconfirmed") }); }
  }

  /** Owner revokes the agent: the study is revoked (agent gets SESSION_REVOKED) and a fresh study takes its place. */
  async disconnectAgent(): Promise<boolean> {
    const study = this.study;
    if (!study) return false;
    try { await this.client.revoke(study.studyId); }
    catch { this.emit({ ...this.view, message: msg("research.session.disconnectUnconfirmed") }); return false; }
    if (this.stopped || this.study !== study) return true;
    this.detach(); this.options.storage.clear();
    this.rebuilds = 0;
    this.emit({ status: "starting", tabLabel: null, paused: false, deviceLabel: null, message: msg("research.session.reconnecting") });
    void this.open();
    return true;
  }

  /** Before sign-out: revoke this tab's study so no agent keeps controlling it. */
  async revokeForSignOut(): Promise<boolean> {
    // resume／createStudy 還在進行：先等它落地，否則伺服器端 study 不會被撤銷
    if (!this.study && this.opening) await this.opening.catch(() => undefined);
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

  private open(): Promise<void> {
    const run = this.openStudy();
    this.opening = run;
    const clear = () => { if (this.opening === run) this.opening = null; };
    void run.then(clear, clear);
    return run;
  }

  private async openStudy(): Promise<void> {
    let lease: ConnectionLease | null = null;
    try {
      let ref = await this.resume();
      if (ref === "duplicate") return;
      if (ref) lease = this.lease;
      else {
        const created = await this.client.createStudy((this.options.newTabId ?? (() => crypto.randomUUID()))());
        // 建立期間已被停止：這個 study 沒人會用，撤銷以免伺服器端殘留
        if (this.stopped) { await this.client.revoke(created.studyId).catch(() => undefined); return; }
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
  private async resume(): Promise<{ studyId: string; tabId: string } | "duplicate" | null> {
    const { storage, userId } = this.options;
    const stored = storage.read();
    if (!stored || stored.userId !== userId) { if (stored) storage.clear(); return null; }
    const lease = await this.acquire(stored.studyId, stored.tabId);
    if (this.stopped) { lease?.release(); return null; }
    if (!lease) {
      storage.clear();
      if (this.options.onDuplicateTab) { this.options.onDuplicateTab(); return "duplicate"; }
      return null;
    }
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
    this.emit({ status: "waiting", tabLabel, paused: false, deviceLabel: null, message: WAITING() });
    this.options.onConnection({ client, studyId: study.studyId, tabId: study.tabId });
    const channel = new BrowserChannel({
      client, studyId: study.studyId, tabId: study.tabId, queryHandler: this.options.queryHandler ?? null,
      onState: (snapshot, agent) => {
        if (this.channel !== channel) return;
        this.rebuilds = 0;
        const connected = snapshot.connected;
        this.emit({ status: connected ? "connected" : "waiting", tabLabel, paused: snapshot.paused, deviceLabel: connected ? agent.deviceLabel : null, message: snapshot.paused ? PAUSED() : snapshot.view.phase === "error" ? msg("research.session.sceneNotReady") : connected ? CONNECTED() : WAITING() });
        this.options.onState(snapshot);
      },
      onRecovered: () => { if (this.channel === channel) this.emit({ ...this.view, message: this.view.status === "connected" ? CONNECTED() : WAITING() }); },
      onFailure: (error, _failures, terminal) => {
        if (this.channel !== channel) return;
        const failure = classifyConnectionFailure(error);
        if (terminal && STUDY_GONE.has(failure.code) && this.rebuilds < MAX_REBUILDS) {
          this.rebuilds += 1;
          this.detach(); this.options.storage.clear();
          this.emit({ status: "starting", tabLabel: null, paused: false, deviceLabel: null, message: msg("research.session.staleRebuilding") });
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
