import { BROWSER_WAIT_HOLD_MS, type BridgeClient, type BrowserWaitEnvelope, type StudyState } from "./bridgeClient";
import { classifyConnectionFailure, isBackgroundDocument } from "./connectionReliability";
import { queryPollDelay, type QueryHandler } from "./QueryResponder";

export type BrowserChannelOptions = {
  client: Pick<BridgeClient, "wait">;
  studyId: string;
  tabId: string;
  /** Called only when the envelope version changes (the long poll never resends an unchanged snapshot). */
  onState: (snapshot: StudyState, agent: BrowserWaitEnvelope["agent"]) => void;
  /** Every failed wait. `terminal` failures (auth/expired) stop the channel. */
  onFailure?: (error: unknown, failures: number, terminal: boolean) => void;
  onRecovered?: () => void;
  /** Absent on /lab (no query handler) → acceptQueries:false so the gateway never returns requests. */
  queryHandler?: QueryHandler | null;
  isBackground?: () => boolean;
  sleep?: (ms: number) => Promise<void>;
};

/** Delay after a failed wait: the previous query-poll backoff (2–8 s, hidden 10 s), or the server's Retry-After when longer. */
export function browserWaitRetryDelay(error: unknown, failures: number, background: boolean): number {
  const delay = queryPollDelay(Math.max(0, failures - 1), background ? "hidden" : "visible");
  const failure = classifyConnectionFailure(error);
  return failure.kind === "rate" && failure.retryAfterMs !== null ? Math.max(delay, failure.retryAfterMs) : delay;
}

/**
 * P2 (SPEC-prod-connect §2.4, §6.3): one `/browser/wait` loop per connected tab. The first
 * round sends `knownVersion:null` to get the snapshot immediately; later rounds hold up to
 * 20 s and return on a snapshot change or a deliverable query. Start it only after
 * `onConnection`, so the controller and query handler already exist.
 */
export class BrowserChannel {
  private stopped = false;
  private started = false;
  private version: string | null = null;
  private failures = 0;
  constructor(private readonly options: BrowserChannelOptions) {}

  start(): void {
    if (this.started || this.stopped) return;
    this.started = true;
    void this.loop();
  }
  stop(): void { this.stopped = true; }
  get running(): boolean { return this.started && !this.stopped; }

  private async loop(): Promise<void> {
    const { client, studyId, tabId, queryHandler } = this.options;
    const sleep = this.options.sleep ?? (ms => new Promise<void>(resolve => setTimeout(resolve, ms)));
    const background = this.options.isBackground ?? isBackgroundDocument;
    while (!this.stopped) {
      try {
        const envelope = await client.wait(studyId, tabId, this.version, queryHandler?.inFlightRequestId() ?? null, Boolean(queryHandler), BROWSER_WAIT_HOLD_MS);
        if (this.stopped) return;
        if (this.failures) { this.failures = 0; this.options.onRecovered?.(); }
        if (envelope.version !== this.version) {
          this.version = envelope.version;
          this.options.onState(envelope.snapshot, envelope.agent);
        }
        // Not awaited: a long query must not block snapshot delivery; the next round carries inFlightRequestId.
        if (envelope.request && queryHandler) void queryHandler.handle(envelope.request);
      } catch (error) {
        if (this.stopped) return;
        this.failures += 1;
        const kind = classifyConnectionFailure(error).kind;
        const terminal = kind === "auth" || kind === "expired";
        this.options.onFailure?.(error, this.failures, terminal);
        if (terminal) { this.stopped = true; return; }
        await sleep(browserWaitRetryDelay(error, this.failures, background()));
      }
    }
  }
}
