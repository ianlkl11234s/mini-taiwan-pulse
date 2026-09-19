import { BridgeError } from "./bridgeClient";

export type ConnectionFailure = "auth" | "expired" | "rate" | "timeout" | "scene" | "unavailable";

export function classifyConnectionFailure(error: unknown): { kind: ConnectionFailure; code: string; retryAfterMs: number | null } {
  const code = error instanceof BridgeError ? error.code : "BRIDGE_UNAVAILABLE";
  const retryAfterMs = error instanceof BridgeError ? error.retryAfterMs : null;
  if (["AUTH_REQUIRED", "STUDY_DENIED", "PAIRING_REJECTED"].includes(code)) return { kind: "auth", code, retryAfterMs };
  if (["SESSION_REVOKED", "SESSION_EXPIRED", "PAIRING_EXPIRED"].includes(code)) return { kind: "expired", code, retryAfterMs };
  if (["RATE_LIMITED", "STUDY_COMMAND_LIMIT", "STUDY_QUERY_LIMIT"].includes(code)) return { kind: "rate", code, retryAfterMs };
  if (code === "REQUEST_TIMEOUT") return { kind: "timeout", code, retryAfterMs };
  if (["VIEWPORT_OCCLUDED", "MAP_NOT_READY", "MAP_EXPLORATION_ONLY", "SCENE_ERROR"].includes(code)) return { kind: "scene", code, retryAfterMs };
  return { kind: "unavailable", code, retryAfterMs };
}

export function nextPollDelay(error: unknown, failures: number, background: boolean, random: () => number = Math.random): number {
  const failure = classifyConnectionFailure(error);
  const delay = failure.kind === "auth" || failure.kind === "expired" ? 30_000
    : failure.kind === "rate" && failure.retryAfterMs !== null ? Math.max(3_000, failure.retryAfterMs + Math.floor(random() * 500))
      : !error ? 3_000 : Math.min(60_000, 3_000 * 2 ** Math.max(0, failures - 1) + Math.floor(random() * 500));
  return background ? Math.max(15_000, delay) : delay;
}

export function isBackgroundDocument(): boolean { return typeof document !== "undefined" && document.visibilityState === "hidden"; }

export type ConnectionLease = { release: () => void };
type Lock = { name: string } | null;
type LockManagerLike = { request: (name: string, options: { mode: "exclusive"; ifAvailable: true }, callback: (lock: Lock) => Promise<void>) => Promise<void> };

/** Holds an origin-wide, tab-exclusive study lease. A missing Web Locks API must not permit automatic recovery. */
export async function acquireConnectionLease(studyId: string, tabId: string): Promise<ConnectionLease | null> {
  const locks = (globalThis.navigator as Navigator & { locks?: LockManagerLike } | undefined)?.locks;
  if (!locks) throw new BridgeError("CONNECTION_LOCK_UNAVAILABLE");
  const name = `pulse-research:${studyId}:${tabId}`;
  let resolveAcquired!: (lease: ConnectionLease | null) => void;
  let rejectAcquired!: (error: Error) => void;
  let settled = false;
  const acquired = new Promise<ConnectionLease | null>((resolve, reject) => { resolveAcquired = value => { if (!settled) { settled = true; resolve(value); } }; rejectAcquired = error => { if (!settled) { settled = true; reject(error); } }; });
  let release!: () => void;
  const released = new Promise<void>(resolve => { release = resolve; });
  void Promise.resolve().then(() => locks.request(name, { mode: "exclusive", ifAvailable: true }, async lock => {
    if (!lock) { resolveAcquired(null); return; }
    let didRelease = false;
    resolveAcquired({ release: () => { if (!didRelease) { didRelease = true; release(); } } });
    await released;
  })).catch(() => rejectAcquired(new BridgeError("CONNECTION_LOCK_UNAVAILABLE")));
  return acquired;
}

export function mustClearStoredConnection(session: { active: boolean }): boolean { return !session.active; }
