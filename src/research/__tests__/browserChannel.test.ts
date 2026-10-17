import { describe, expect, it, vi } from "vitest";
import { BridgeError, type BrowserQuery, type BrowserWaitEnvelope, type StudyState } from "../bridgeClient";
import { BrowserChannel, browserWaitRetryDelay } from "../browserChannel";

const snapshot = (revision: number): StudyState => ({ studyId: "s", tabId: "t", revision, scene: { camera: { center: [121.5, 25], zoom: 12 }, resultMode: "empty" }, view: { revision, phase: "ready" }, connected: true, paused: false, pendingCommand: null });
const envelope = (version: string, revision = 0, request: BrowserQuery | null = null): BrowserWaitEnvelope => ({ version, snapshot: snapshot(revision), request, agent: { deviceLabel: null } });
const query: BrowserQuery = { requestId: "q-1", operation: "map_context", args: {}, expiresAt: Date.now() + 30_000 };

/** Scripted long poll: each call takes the next step; the last pending call parks until stop. */
function scripted(steps: Array<BrowserWaitEnvelope | Error>) {
  const calls: unknown[][] = [];
  const wait = vi.fn((...args: unknown[]) => {
    calls.push(args);
    const step = steps.shift();
    if (!step) return new Promise<BrowserWaitEnvelope>(() => {});
    return step instanceof Error ? Promise.reject(step) : Promise.resolve(step);
  });
  return { client: { wait } as never, calls, wait };
}
const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };

describe("BrowserChannel (P2 /browser/wait loop)", () => {
  it("starts with knownVersion:null, delivers a snapshot once per version, and carries the version forward", async () => {
    const { client, calls } = scripted([envelope("aaaaaaaaaaaaaaaa", 1), envelope("aaaaaaaaaaaaaaaa", 1), envelope("bbbbbbbbbbbbbbbb", 2)]);
    const onState = vi.fn();
    const channel = new BrowserChannel({ client, studyId: "s", tabId: "t", onState, sleep: async () => {} });
    channel.start(); await flush();
    expect(calls[0]).toEqual(["s", "t", null, null, false, 20_000]);
    expect(calls[1]?.[2]).toBe("aaaaaaaaaaaaaaaa");
    expect(calls[3]?.[2]).toBe("bbbbbbbbbbbbbbbb");
    expect(onState.mock.calls.map(call => call[0].revision)).toEqual([1, 2]);
    channel.stop();
  });

  it("hands a request to the handler without awaiting it and sends its in-flight id next round", async () => {
    const { client, calls } = scripted([envelope("aaaaaaaaaaaaaaaa", 0, query), envelope("aaaaaaaaaaaaaaaa")]);
    let inFlight: string | null = null;
    const handle = vi.fn((request: BrowserQuery) => { inFlight = request.requestId; return new Promise<void>(() => {}); });
    const channel = new BrowserChannel({ client, studyId: "s", tabId: "t", onState: vi.fn(), queryHandler: { handle, inFlightRequestId: () => inFlight }, sleep: async () => {} });
    channel.start(); await flush();
    expect(calls[0]?.[4]).toBe(true);
    expect(handle).toHaveBeenCalledWith(query);
    expect(calls[1]?.[3]).toBe("q-1");
    expect(calls.length).toBeGreaterThanOrEqual(3);
    channel.stop();
  });

  it("sends acceptQueries:false and never forwards requests without a handler (/lab)", async () => {
    const { client, calls } = scripted([envelope("aaaaaaaaaaaaaaaa")]);
    const channel = new BrowserChannel({ client, studyId: "s", tabId: "t", onState: vi.fn(), sleep: async () => {} });
    channel.start(); await flush();
    expect(calls[0]?.[3]).toBeNull();
    expect(calls[0]?.[4]).toBe(false);
    channel.stop();
  });

  it("stops on auth or expired failures and reports them as terminal", async () => {
    for (const code of ["AUTH_REQUIRED", "SESSION_EXPIRED"]) {
      const { client, wait } = scripted([new BridgeError(code), envelope("aaaaaaaaaaaaaaaa")]);
      const onFailure = vi.fn();
      const channel = new BrowserChannel({ client, studyId: "s", tabId: "t", onState: vi.fn(), onFailure, sleep: async () => {} });
      channel.start(); await flush();
      expect(onFailure).toHaveBeenCalledWith(expect.objectContaining({ code }), 1, true);
      expect(wait).toHaveBeenCalledTimes(1);
      expect(channel.running).toBe(false);
    }
  });

  it("backs off transient failures (2/4/8 s, 10 s in a background tab, Retry-After when longer) and recovers", async () => {
    expect([1, 2, 3, 4].map(n => browserWaitRetryDelay(new BridgeError("BRIDGE_UNAVAILABLE"), n, false))).toEqual([2_000, 4_000, 8_000, 8_000]);
    expect(browserWaitRetryDelay(new BridgeError("REQUEST_TIMEOUT"), 1, true)).toBe(10_000);
    expect(browserWaitRetryDelay(new BridgeError("RATE_LIMITED", 12_000), 1, false)).toBe(12_000);
    const { client } = scripted([new BridgeError("BRIDGE_UNAVAILABLE"), new BridgeError("REQUEST_TIMEOUT"), envelope("aaaaaaaaaaaaaaaa")]);
    const sleeps: number[] = [];
    const onRecovered = vi.fn(); const onFailure = vi.fn(); const onState = vi.fn();
    const channel = new BrowserChannel({ client, studyId: "s", tabId: "t", onState, onFailure, onRecovered, isBackground: () => false, sleep: async ms => { sleeps.push(ms); } });
    channel.start(); await flush();
    expect(sleeps).toEqual([2_000, 4_000]);
    expect(onFailure.mock.calls.map(call => call[2])).toEqual([false, false]);
    expect(onRecovered).toHaveBeenCalledTimes(1);
    expect(onState).toHaveBeenCalledTimes(1);
    channel.stop();
  });

  it("does not deliver anything after stop", async () => {
    let resolve!: (value: BrowserWaitEnvelope) => void;
    const client = { wait: vi.fn(() => new Promise<BrowserWaitEnvelope>(next => { resolve = next; })) } as never;
    const onState = vi.fn();
    const channel = new BrowserChannel({ client, studyId: "s", tabId: "t", onState });
    channel.start(); await flush(); channel.stop(); resolve(envelope("aaaaaaaaaaaaaaaa")); await flush();
    expect(onState).not.toHaveBeenCalled();
  });
});
