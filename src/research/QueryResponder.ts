import { BridgeError, type BridgeConnectionContext, type BrowserQuery, type QueryResult } from "./bridgeClient";
import { classifyConnectionFailure } from "./connectionReliability";

export type QueryActivityEvent = { request: BrowserQuery; phase: "started" | "completed"; result?: QueryResult };

export type QueryHealth = { state: "retrying" | "offline" | "recovered" | "paused" | "auth" | "cancelled"; code: string };

const QUERY_POLL_BASE_MS = 2_000;
const QUERY_POLL_HIDDEN_MS = 10_000;
// 8s retry + the BridgeClient's worst-case 8s request leaves 9s before its 25s wait.
const QUERY_POLL_MAX_MS = 8_000;

export function queryPollDelay(failures: number, visibility: DocumentVisibilityState | "unknown" = "unknown"): number {
  const failureDelay = Math.min(QUERY_POLL_MAX_MS, QUERY_POLL_BASE_MS * (2 ** Math.max(0, failures)));
  return Math.max(failureDelay, visibility === "hidden" ? QUERY_POLL_HIDDEN_MS : QUERY_POLL_BASE_MS);
}

/** Single-flight tab reader. Reads never apply a scene or run user-supplied code. */
export class QueryResponder {
  private stopped = false;
  private failures = 0;
  private unhealthy = false;
  private delivered: string | null = null;
  private busy = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private started = false;
  private last: { id: string; result: QueryResult } | null = null;
  constructor(private readonly connection: BridgeConnectionContext, private readonly execute: (query: BrowserQuery) => Promise<Record<string, unknown>>, private readonly onError: () => void, private readonly onActivity?: (event: QueryActivityEvent) => void, private readonly onHealth?: (event: QueryHealth) => void) {}
  start(): void {
    if (this.started || this.stopped) return;
    this.started = true;
    void this.pollLoop();
  }
  stop(): void { this.stopped = true; if (this.timer) clearTimeout(this.timer); this.timer = null; this.last = null; }
  private async pollLoop(): Promise<void> {
    await this.tick();
    if (this.stopped) return;
    const visibility = typeof document === "undefined" ? "unknown" : document.visibilityState;
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.pollLoop();
    }, queryPollDelay(this.failures, visibility));
  }
  async tick(): Promise<void> {
    if (this.stopped || this.busy) return;
    this.busy = true;
    const { client, studyId, tabId } = this.connection;
    try {
      const { request } = await client.query(studyId, tabId);
      if (this.stopped) return;
      if (!request || request.expiresAt <= Date.now()) { this.recovered(); return; }
      let result: QueryResult;
      if (this.last?.id === request.requestId) result = this.last.result;
      else {
        this.onActivity?.({ request, phase: "started" });
        try { result = { ok: true, data: await this.execute(request) }; }
        catch (error) {
          const message = error instanceof Error ? error.message : "QUERY_FAILED";
          result = { ok: false, error: /^[A-Z_]{1,64}$/.test(message) ? message : "QUERY_FAILED" };
        }
        if (new TextEncoder().encode(JSON.stringify(result)).byteLength > 24 * 1024) result = { ok: false, error: "RESULT_TOO_LARGE" };
        if (!this.stopped) this.last = { id: request.requestId, result };
      }
      if (!this.stopped && request.expiresAt > Date.now()) {
        await client.queryResult(studyId, tabId, request.requestId, result);
        if (this.stopped) return;
        this.recovered();
        if (this.delivered !== request.requestId) {
          this.delivered = request.requestId;
          this.onActivity?.({ request, phase: "completed", result });
        }
      } else if (!this.stopped) {
        this.onHealth?.({ state: "cancelled", code: "QUERY_EXPIRED" });
      }
    } catch (error) {
      if (!this.stopped) {
        const code = error instanceof BridgeError ? error.code : "BRIDGE_UNAVAILABLE";
        const classified = classifyConnectionFailure(error);
        const state = code === "SESSION_PAUSED" ? "paused"
          : ["auth", "expired"].includes(classified.kind) ? "auth"
          : ["QUERY_DENIED", "QUERY_EXPIRED"].includes(code) ? "cancelled"
          : ++this.failures >= 3 ? "offline" : "retrying";
        this.unhealthy = true;
        if (this.onHealth) this.onHealth({ state, code }); else this.onError();
      }
    }
    finally { this.busy = false; }
  }
  private recovered(): void {
    if (this.unhealthy) { this.unhealthy = false; this.failures = 0; this.onHealth?.({ state: "recovered", code: "OK" }); }
  }
}
