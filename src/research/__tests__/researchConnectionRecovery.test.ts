import { beforeEach, afterEach, expect, it, vi } from "vitest";

// Run the component's actual effects with controlled auth delivery and deferred I/O.
const h = vi.hoisted(() => ({ slots: [] as any[], cursor: 0, pending: [] as (() => void)[], auth: null as any, resolveStatus: null as any, statusCalls: 0 }));
vi.mock("react", () => ({
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
  onAuthStateChange: (callback: any) => { h.auth = callback; return { data: { subscription: { unsubscribe() {} } } }; },
} } }));
vi.mock("../bridgeClient", async importOriginal => {
  const original = await importOriginal<any>();
  return { ...original, BridgeClient: class {
    browserStatus() { h.statusCalls++; return new Promise(resolve => { h.resolveStatus = resolve; }); }
    sync() { return new Promise(() => {}); }
  } };
});
import { ResearchConnection } from "../ResearchConnection";
const onConnection = vi.fn();
function render() { h.cursor = 0; ResearchConnection({ onState: vi.fn(), onDisconnect: vi.fn(), onConnection }); const pending = h.pending.splice(0); pending.forEach(run => run()); }
async function flush() { for (let i = 0; i < 10; i++) await Promise.resolve(); }
beforeEach(() => {
  h.slots = []; h.pending = []; h.statusCalls = 0; h.resolveStatus = null; onConnection.mockClear();
  const storage = new Map([["pulse.research.connection.v1", JSON.stringify({ studyId: "study", tabId: "tab", pairingId: "pair", userId: "owner" })]]);
  vi.stubGlobal("window", { sessionStorage: { getItem: (k: string) => storage.get(k), removeItem: (k: string) => storage.delete(k) }, setTimeout, clearTimeout });
  vi.stubGlobal("navigator", { locks: { request: async (_n: string, _o: unknown, cb: any) => cb({ name: "lease" }) } });
});
afterEach(() => { h.slots.forEach(slot => slot?.cleanup?.()); vi.unstubAllGlobals(); });
it("does not cancel in-flight recovery when the same user's token/session object refreshes", async () => {
  render(); await flush(); render(); await flush();
  expect(h.statusCalls).toBe(1);
  h.auth("TOKEN_REFRESHED", { user: { id: "owner" }, access_token: "renewed" }); render();
  h.resolveStatus({ studyId: "study", tabId: "tab", session: { active: true, expiresAt: 1000 }, snapshot: { connected: true, paused: false } });
  await flush(); render();
  expect(onConnection).toHaveBeenCalledWith(expect.objectContaining({ studyId: "study", pairingId: "pair" }));
  expect(h.statusCalls).toBe(1);
});
it("does not restore a session revoked by the Gateway", async () => {
  render(); await flush(); render(); await flush();
  h.resolveStatus({ session: { active: false } }); await flush(); render();
  expect(onConnection).not.toHaveBeenCalledWith(expect.objectContaining({ studyId: "study" }));
  expect(window.sessionStorage.getItem("pulse.research.connection.v1")).toBeUndefined();
});
