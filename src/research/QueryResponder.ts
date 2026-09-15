import type { BridgeConnectionContext, BrowserQuery, QueryResult } from "./bridgeClient";

export type QueryActivityEvent = { request: BrowserQuery; phase: "started" | "completed"; result?: QueryResult };

/** Single-flight tab reader. Reads never apply a scene or run user-supplied code. */
export class QueryResponder {
  private stopped = false;
  private busy = false;
  private timer: ReturnType<typeof setInterval> | null = null;
  private last: { id: string; result: QueryResult } | null = null;
  constructor(private readonly connection: BridgeConnectionContext, private readonly execute: (query: BrowserQuery) => Promise<Record<string, unknown>>, private readonly onError: () => void, private readonly onActivity?: (event: QueryActivityEvent) => void) {}
  start(): void { void this.tick(); this.timer = setInterval(() => void this.tick(), 2_000); }
  stop(): void { this.stopped = true; if (this.timer) clearInterval(this.timer); this.last = null; }
  async tick(): Promise<void> {
    if (this.stopped || this.busy) return;
    this.busy = true;
    const { client, studyId, tabId } = this.connection;
    try {
      const { request } = await client.query(studyId, tabId);
      if (this.stopped || !request || request.expiresAt <= Date.now()) return;
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
        if (!this.stopped) this.onActivity?.({ request, phase: "completed", result: request.expiresAt > Date.now() ? result : { ok: false, error: "QUERY_EXPIRED" } });
        if (!this.stopped) this.last = { id: request.requestId, result };
      }
      if (!this.stopped && request.expiresAt > Date.now()) await client.queryResult(studyId, tabId, request.requestId, result);
    } catch { if (!this.stopped) this.onError(); }
    finally { this.busy = false; }
  }
}
