import { BridgeError, type BridgeConnectionContext, type BrowserQuery, type QueryResult } from "./bridgeClient";
import { classifyConnectionFailure, isBackgroundDocument, nextPollDelay } from "./connectionReliability";

export type QueryActivityEvent = { request: BrowserQuery; phase: "started" | "completed"; result?: QueryResult };

export type QueryHealth = { state: "retrying" | "offline" | "recovered" | "paused" | "auth" | "cancelled"; code: string };

/** Single-flight tab reader. Reads never apply a scene or run user-supplied code. */
export class QueryResponder {
  private stopped = false;
  private failures = 0;
  private unhealthy = false;
  private delivered: string | null = null;
  private busy = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private last: { id: string; result: QueryResult } | null = null;
  constructor(private readonly connection: BridgeConnectionContext, private readonly execute: (query: BrowserQuery) => Promise<Record<string, unknown>>, private readonly onError: () => void, private readonly onActivity?: (event: QueryActivityEvent) => void, private readonly onHealth?: (event: QueryHealth) => void) {}
  start(): void { this.stopped = false; void this.tick(); }
  stop(): void { this.stopped = true; if (this.timer) clearTimeout(this.timer); this.last = null; }
  async tick(): Promise<void> {
    if (this.stopped || this.busy) return;
    this.busy = true;
    const { client, studyId, tabId } = this.connection;
    let failure: unknown = null;
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
      failure = error;
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
    finally {
      this.busy = false;
      if (!this.stopped) this.schedule(failure);
    }
  }
  private schedule(failure: unknown): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.tick(), nextPollDelay(failure, this.failures, isBackgroundDocument()));
  }
  private recovered(): void {
    if (this.unhealthy) { this.unhealthy = false; this.failures = 0; this.onHealth?.({ state: "recovered", code: "OK" }); }
  }
}
