import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BridgeError, type BridgeClient } from "../bridgeClient";
import { AgentTabSession, TAB_STORAGE_KEY, sessionTabStorage, tabLabelOf, type AgentTabView, type StoredTab, type TabStorage } from "../agentTabSession";

// P3 (SPEC-prod-connect §6.4): a signed-in tab owns a study without any pairing code,
// resumes it after a reload, and rebuilds a fresh one after "中斷 Agent".
const snapshot = (studyId: string, tabId: string, connected = false, paused = false) => ({ studyId, tabId, revision: 0, scene: { camera: { center: [121.5, 25], zoom: 12 }, resultMode: "empty" }, view: { revision: 0, phase: "empty" }, connected, paused, pendingCommand: null });
const envelope = (studyId: string, tabId: string, connected: boolean, deviceLabel: string | null = null, version = "v1") => ({ version, snapshot: snapshot(studyId, tabId, connected), request: null, agent: { deviceLabel } });
const last = <T,>(items: T[]): T => items[items.length - 1] as T;
async function flush() { for (let i = 0; i < 20; i++) await Promise.resolve(); await new Promise(resolve => setTimeout(resolve, 0)); }

function memoryStorage(initial: StoredTab | null = null): TabStorage & { value: StoredTab | null } {
  return { value: initial, read() { return this.value; }, write(next) { this.value = next; }, clear() { this.value = null; } };
}

function fakeClient() {
  let studies = 0;
  const waits: unknown[][] = [];
  const pendingWaits: { resolve: (value: unknown) => void; reject: (error: unknown) => void }[] = [];
  const client = {
    createStudy: vi.fn(async (tabId: string) => ({ studyId: `study-${++studies}`, tabId })),
    browserStatus: vi.fn(async (studyId: string, tabId: string) => ({ studyId, tabId, session: { active: false, sessionId: null, expiresAt: null, hardExpiresAt: null }, snapshot: snapshot(studyId, tabId) })),
    wait: vi.fn((...args: unknown[]) => { waits.push(args); return new Promise((resolve, reject) => { pendingWaits.push({ resolve, reject }); }); }),
    pause: vi.fn(async (studyId: string, tabId: string, paused: boolean) => snapshot(studyId, tabId, true, paused)),
    revoke: vi.fn(async () => undefined),
    createPairing: vi.fn(),
  };
  return { client, waits, pendingWaits };
}

function session(fake: ReturnType<typeof fakeClient>, storage: TabStorage, lease: (studyId: string, tabId: string) => Promise<{ release: () => void } | null> = async () => ({ release: vi.fn() })) {
  const views: AgentTabView[] = [];
  const onConnection = vi.fn();
  const onState = vi.fn();
  const scheduled: { callback: () => void; ms: number }[] = [];
  let tabs = 0;
  const tab = new AgentTabSession({
    client: fake.client as unknown as BridgeClient, userId: "owner", storage, onState, onConnection,
    onView: view => views.push(view), acquireLease: lease, newTabId: () => `3f9a2b1c-000${++tabs}`,
    schedule: (callback, ms) => { scheduled.push({ callback, ms }); return () => undefined; },
  });
  return { tab, views, onConnection, onState, scheduled };
}

let active: AgentTabSession[] = [];
afterEach(() => { active.forEach(tab => tab.stop()); active = []; });

describe("AgentTabSession (P3, no pairing code)", () => {
  it("creates a study automatically, stores {studyId,tabId,userId}, hands over the connection, then long-polls", async () => {
    const fake = fakeClient(); const storage = memoryStorage();
    const { tab, views, onConnection } = session(fake, storage); active.push(tab);
    tab.start(); await flush();
    expect(fake.client.createStudy).toHaveBeenCalledTimes(1);
    expect(fake.client.createPairing).not.toHaveBeenCalled();
    expect(storage.value).toEqual({ studyId: "study-1", tabId: "3f9a2b1c-0001", userId: "owner" });
    expect(onConnection).toHaveBeenCalledWith({ client: fake.client, studyId: "study-1", tabId: "3f9a2b1c-0001" });
    expect(fake.waits[0]).toEqual(["study-1", "3f9a2b1c-0001", null, null, false, 20_000]);
    // Standing by: the open tab waits for an agent with its tab label, no code to type.
    expect(last(views)).toMatchObject({ status: "waiting", tabLabel: "3F9A" });
    expect(tabLabelOf("3f9a2b1c-0001")).toBe("3F9A");
    fake.pendingWaits[0]!.resolve(envelope("study-1", "3f9a2b1c-0001", true, "Claude-macbook")); await flush();
    expect(last(views)).toMatchObject({ status: "connected", deviceLabel: "Claude-macbook", tabLabel: "3F9A" });
  });

  it("resumes the stored study after a reload without creating a new one", async () => {
    const fake = fakeClient(); const storage = memoryStorage({ studyId: "stored", tabId: "b7c2-tab", userId: "owner" });
    const { tab, onConnection } = session(fake, storage); active.push(tab);
    tab.start(); await flush();
    expect(fake.client.browserStatus).toHaveBeenCalledWith("stored", "b7c2-tab");
    expect(fake.client.createStudy).not.toHaveBeenCalled();
    expect(onConnection).toHaveBeenCalledWith(expect.objectContaining({ studyId: "stored", tabId: "b7c2-tab" }));
    expect(storage.value).toEqual({ studyId: "stored", tabId: "b7c2-tab", userId: "owner" });
  });

  it("makes its own study when the stored one belongs to another user, a duplicated tab holds the lease, or the gateway forgot it", async () => {
    for (const [stored, lease, status] of [
      [{ studyId: "stored", tabId: "tab", userId: "someone-else" }, null, null],
      [{ studyId: "stored", tabId: "tab", userId: "owner" }, "busy", null],
      [{ studyId: "stored", tabId: "tab", userId: "owner" }, null, new BridgeError("STUDY_DENIED")],
    ] as const) {
      const fake = fakeClient(); const storage = memoryStorage(stored);
      if (status) fake.client.browserStatus.mockRejectedValueOnce(status);
      const acquire = vi.fn(async (studyId: string) => lease === "busy" && studyId === "stored" ? null : { release: vi.fn() });
      const { tab, onConnection } = session(fake, storage, acquire); active.push(tab);
      tab.start(); await flush();
      expect(fake.client.createStudy).toHaveBeenCalledTimes(1);
      expect(storage.value).toMatchObject({ studyId: "study-1", userId: "owner" });
      expect(onConnection).toHaveBeenLastCalledWith(expect.objectContaining({ studyId: "study-1" }));
    }
  });

  it("中斷 Agent revokes the study and immediately prepares a fresh one for the next agent", async () => {
    const fake = fakeClient(); const storage = memoryStorage();
    const { tab, onConnection, views } = session(fake, storage); active.push(tab);
    tab.start(); await flush();
    await expect(tab.disconnectAgent()).resolves.toBe(true); await flush();
    expect(fake.client.revoke).toHaveBeenCalledWith("study-1");
    expect(onConnection).toHaveBeenCalledWith(null);
    expect(fake.client.createStudy).toHaveBeenCalledTimes(2);
    expect(storage.value).toMatchObject({ studyId: "study-2" });
    expect(tab.current).toEqual({ studyId: "study-2", tabId: "3f9a2b1c-0002" });
    expect(last(views)).toMatchObject({ status: "waiting", tabLabel: "3F9A" });
  });

  it("keeps the study when revoke fails, so the owner can retry", async () => {
    const fake = fakeClient(); fake.client.revoke.mockRejectedValueOnce(new BridgeError("BRIDGE_UNAVAILABLE"));
    const { tab, views } = session(fake, memoryStorage()); active.push(tab);
    tab.start(); await flush();
    await expect(tab.disconnectAgent()).resolves.toBe(false);
    expect(tab.current).toMatchObject({ studyId: "study-1" });
    expect(last(views).message).toContain("中斷尚未確認");
  });

  it("rebuilds when the long poll reports the study gone, and stops without retry on AUTH_REQUIRED", async () => {
    const fake = fakeClient(); const storage = memoryStorage();
    const { tab, views, scheduled } = session(fake, storage); active.push(tab);
    tab.start(); await flush();
    fake.pendingWaits[0]!.reject(new BridgeError("SESSION_REVOKED")); await flush();
    expect(fake.client.createStudy).toHaveBeenCalledTimes(2);
    expect(last(views)).toMatchObject({ status: "waiting" });
    fake.pendingWaits[1]!.reject(new BridgeError("AUTH_REQUIRED")); await flush();
    expect(last(views)).toMatchObject({ status: "error" });
    expect(fake.client.createStudy).toHaveBeenCalledTimes(2);
    expect(scheduled).toHaveLength(0);
  });

  it("retries a transient create failure later but never retries a terminal AUTH_REQUIRED", async () => {
    const fake = fakeClient(); fake.client.createStudy.mockRejectedValueOnce(new BridgeError("BRIDGE_UNAVAILABLE"));
    const first = session(fake, memoryStorage()); active.push(first.tab);
    first.tab.start(); await flush();
    expect(last(first.views)).toMatchObject({ status: "error" });
    expect(first.scheduled).toHaveLength(1);
    first.scheduled[0]!.callback(); await flush();
    expect(last(first.views)).toMatchObject({ status: "waiting" });

    const denied = fakeClient(); denied.client.createStudy.mockRejectedValueOnce(new BridgeError("AUTH_REQUIRED"));
    const second = session(denied, memoryStorage()); active.push(second.tab);
    second.tab.start(); await flush();
    expect(last(second.views)).toMatchObject({ status: "error" });
    expect(second.scheduled).toHaveLength(0);
  });

  it("revokes before sign-out and clears the stored tab", async () => {
    const fake = fakeClient(); const storage = memoryStorage();
    const { tab } = session(fake, storage); active.push(tab);
    tab.start(); await flush();
    await expect(tab.revokeForSignOut()).resolves.toBe(true);
    expect(fake.client.revoke).toHaveBeenCalledWith("study-1");
    expect(storage.value).toBeNull();
  });
});

describe("sessionTabStorage", () => {
  it("round-trips only the exact {studyId,tabId,userId} shape (no pairing id)", () => {
    const map = new Map<string, string>();
    const backing = { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => { map.set(k, v); }, removeItem: (k: string) => { map.delete(k); } };
    const storage = sessionTabStorage(backing);
    storage.write({ studyId: "s", tabId: "t", userId: "u" });
    expect(storage.read()).toEqual({ studyId: "s", tabId: "t", userId: "u" });
    map.set(TAB_STORAGE_KEY, JSON.stringify({ studyId: "s", tabId: "t", userId: "u", pairingId: "p" }));
    expect(storage.read()).toBeNull();
    map.set(TAB_STORAGE_KEY, JSON.stringify({ studyId: "../x", tabId: "t", userId: "u" }));
    expect(storage.read()).toBeNull();
    storage.clear();
    expect(map.has(TAB_STORAGE_KEY)).toBe(false);
  });
});

// Component level: a signed-in tab stands by for an agent with no pairing UI.
const h = vi.hoisted(() => ({ slots: [] as any[], cursor: 0, pending: [] as (() => void)[], created: [] as string[], waits: [] as unknown[][], pairings: 0 }));
vi.mock("react", async importOriginal => ({
  ...(await importOriginal<typeof import("react")>()),
  useRef: (value: unknown) => { const i = h.cursor++; return h.slots[i] ??= { current: value }; },
  useState: (value: unknown) => { const i = h.cursor++; h.slots[i] ??= { value }; return [h.slots[i].value, (v: unknown) => { h.slots[i].value = v; }]; },
  useMemo: (factory: () => unknown) => { const i = h.cursor++; return (h.slots[i] ??= { value: factory() }).value; },
  useEffect: (effect: () => any, deps: unknown[]) => {
    const i = h.cursor++; const old = h.slots[i];
    if (!old || deps.some((v, j) => !Object.is(v, old.deps[j]))) h.pending.push(() => { old?.cleanup?.(); h.slots[i] = { deps, cleanup: effect() }; });
  },
}));
vi.mock("../authClient", () => ({ researchAuthConfigured: true, researchAuth: { auth: {
  getSession: async () => ({ data: { session: { user: { id: "owner" }, access_token: "test" } } }),
  onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
} } }));
vi.mock("../bridgeClient", async importOriginal => {
  const original = await importOriginal<any>();
  return { ...original, BridgeClient: class {
    createStudy(tabId: string) { h.created.push(tabId); return Promise.resolve({ studyId: "study-c", tabId }); }
    createPairing() { h.pairings++; return Promise.reject(new Error("no pairing in P3")); }
    browserStatus() { return Promise.reject(new original.BridgeError("NOT_FOUND")); }
    wait(...args: unknown[]) { h.waits.push(args); return new Promise(() => {}); }
    revoke() { return Promise.resolve(); }
  } };
});

describe("ResearchConnection (P3)", () => {
  beforeEach(() => {
    h.slots = []; h.pending = []; h.created = []; h.waits = []; h.pairings = 0;
    vi.stubGlobal("window", { sessionStorage: { getItem: () => null, setItem: () => undefined, removeItem: () => undefined }, location: { origin: "http://localhost" } });
    vi.stubGlobal("navigator", { locks: { request: async (_n: string, _o: unknown, cb: any) => cb({ name: "lease" }) } });
  });
  afterEach(() => { h.slots.forEach(slot => slot?.cleanup?.()); vi.unstubAllGlobals(); });

  it("signed-in tab creates its study and stands by on /browser/wait without a pairing code", async () => {
    const { ResearchConnection } = await import("../ResearchConnection");
    const onConnection = vi.fn();
    const render = () => { h.cursor = 0; ResearchConnection({ onState: vi.fn(), onDisconnect: vi.fn(), onConnection, surface: "map" }); h.pending.splice(0).forEach(run => run()); };
    render(); await flush(); render(); await flush();
    expect(h.created).toHaveLength(1);
    expect(h.pairings).toBe(0);
    expect(onConnection).toHaveBeenCalledWith(expect.objectContaining({ studyId: "study-c", tabId: h.created[0] }));
    expect(h.waits[0]).toEqual(["study-c", h.created[0], null, null, false, 20_000]);
  });
});
