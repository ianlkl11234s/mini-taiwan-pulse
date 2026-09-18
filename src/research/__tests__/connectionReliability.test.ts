import { describe, expect, it, vi } from "vitest";
import { BridgeError } from "../bridgeClient";
import { acquireConnectionLease, classifyConnectionFailure, mustClearStoredConnection, nextPollDelay } from "../connectionReliability";

describe("connection reliability", () => {
  it("separates owner auth, expiry, rate limiting, timeout, and scene failures", () => {
    expect(classifyConnectionFailure(new BridgeError("AUTH_REQUIRED")).kind).toBe("auth");
    expect(classifyConnectionFailure(new BridgeError("SESSION_REVOKED")).kind).toBe("expired");
    expect(classifyConnectionFailure(new BridgeError("RATE_LIMITED", 7_000)).kind).toBe("rate");
    expect(classifyConnectionFailure(new BridgeError("REQUEST_TIMEOUT")).kind).toBe("timeout");
    expect(classifyConnectionFailure(new BridgeError("VIEWPORT_OCCLUDED")).kind).toBe("scene");
  });
  it("honors Retry-After, exponentially backs off failures, and throttles background polls", () => {
    expect(nextPollDelay(new BridgeError("RATE_LIMITED", 7_000), 1, false, () => 0)).toBe(7_000);
    expect(nextPollDelay(new BridgeError("RATE_LIMITED", 60_000), 1, true, () => 0)).toBe(60_000);
    expect(nextPollDelay(new BridgeError("REQUEST_TIMEOUT"), 3, false, () => 0)).toBe(12_000);
    expect(nextPollDelay(null, 0, true, () => 0)).toBe(15_000);
  });
  it("allows only one tab lease for the same study identity and releases only its own lease", async () => {
    const held = new Set<string>();
    const locks = { request: async (name: string, options: { ifAvailable: true }, callback: (lock: { name: string } | null) => Promise<void>) => {
      if (options.ifAvailable && held.has(name)) return callback(null);
      held.add(name);
      try { await callback({ name }); } finally { held.delete(name); }
    } };
    vi.stubGlobal("navigator", { locks });
    try {
      const first = await acquireConnectionLease("study", "tab");
      expect(first).not.toBeNull();
      expect(await acquireConnectionLease("study", "tab")).toBeNull();
      first!.release();
      await new Promise(resolve => setTimeout(resolve, 0));
      const next = await acquireConnectionLease("study", "tab");
      expect(next).not.toBeNull();
      next!.release();
    } finally { vi.unstubAllGlobals(); }
  });
  it("requires stored state to be cleared when verified session metadata is inactive", () => {
    expect(mustClearStoredConnection({ active: false })).toBe(true);
    expect(mustClearStoredConnection({ active: true })).toBe(false);
  });
  it("surfaces Web Locks rejection instead of leaving recovery pending", async () => {
    vi.stubGlobal("navigator", { locks: { request: () => Promise.reject(new Error("locks unavailable")) } });
    try { await expect(acquireConnectionLease("study", "tab")).rejects.toMatchObject({ code: "CONNECTION_LOCK_UNAVAILABLE" }); }
    finally { vi.unstubAllGlobals(); }
  });
});
