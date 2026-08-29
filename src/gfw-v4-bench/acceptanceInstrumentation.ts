export interface LatestWinsQueueSnapshot {
  requestedEpoch: number | null;
  repliedEpoch: number | null;
  appliedEpoch: number | null;
  inFlight: 0 | 1;
  pending: 0 | 1;
  requestedCount: number;
  repliedCount: number;
  appliedCount: number;
  coalescedPending: number;
  staleRepliesDropped: number;
  maxInFlight: number;
  maxPending: number;
  requestedEpochs: number[];
  repliedEpochs: number[];
  appliedEpochs: number[];
  errors: string[];
}

export interface EpochReply { frameEpoch: number }

const initialQueueSnapshot = (): LatestWinsQueueSnapshot => ({
  requestedEpoch: null,
  repliedEpoch: null,
  appliedEpoch: null,
  inFlight: 0,
  pending: 0,
  requestedCount: 0,
  repliedCount: 0,
  appliedCount: 0,
  coalescedPending: 0,
  staleRepliesDropped: 0,
  maxInFlight: 0,
  maxPending: 0,
  requestedEpochs: [],
  repliedEpochs: [],
  appliedEpochs: [],
  errors: [],
});

/**
 * Browser-bench model of the production playback contract: at most one request
 * is in flight and only the newest pending epoch survives. A reply is not
 * applied when a newer pending epoch already exists.
 */
export class BoundedLatestWinsQueue<TReply extends EpochReply> {
  private readonly state = initialQueueSnapshot();
  private pendingEpoch: number | null = null;
  private idleWaiters: Array<() => void> = [];

  constructor(
    private readonly send: (epoch: number) => Promise<TReply>,
    private readonly apply: (reply: TReply) => void,
  ) {}

  enqueue(epoch: number): void {
    if (!Number.isFinite(epoch)) throw new Error("latest-wins epoch must be finite");
    this.state.requestedEpoch = epoch;
    this.state.requestedCount += 1;
    this.state.requestedEpochs.push(epoch);
    if (this.state.inFlight === 0) {
      this.dispatch(epoch);
      return;
    }
    if (this.pendingEpoch !== null) this.state.coalescedPending += 1;
    this.pendingEpoch = epoch;
    this.state.pending = 1;
    this.state.maxPending = 1;
  }

  snapshot(): LatestWinsQueueSnapshot {
    return {
      ...this.state,
      requestedEpochs: [...this.state.requestedEpochs],
      repliedEpochs: [...this.state.repliedEpochs],
      appliedEpochs: [...this.state.appliedEpochs],
      errors: [...this.state.errors],
    };
  }

  whenIdle(): Promise<LatestWinsQueueSnapshot> {
    if (this.state.inFlight === 0 && this.pendingEpoch === null) return Promise.resolve(this.snapshot());
    return new Promise((resolve) => this.idleWaiters.push(() => resolve(this.snapshot())));
  }

  private dispatch(epoch: number): void {
    this.state.inFlight = 1;
    this.state.maxInFlight = 1;
    void this.send(epoch).then((reply) => {
      this.state.repliedEpoch = reply.frameEpoch;
      this.state.repliedCount += 1;
      this.state.repliedEpochs.push(reply.frameEpoch);
      if (this.pendingEpoch !== null) {
        this.state.staleRepliesDropped += 1;
      } else {
        this.apply(reply);
        this.state.appliedEpoch = reply.frameEpoch;
        this.state.appliedCount += 1;
        this.state.appliedEpochs.push(reply.frameEpoch);
      }
    }).catch((error: unknown) => {
      this.state.errors.push(error instanceof Error ? error.message : String(error));
    }).finally(() => {
      this.state.inFlight = 0;
      if (this.pendingEpoch !== null) {
        const next = this.pendingEpoch;
        this.pendingEpoch = null;
        this.state.pending = 0;
        this.dispatch(next);
        return;
      }
      const waiters = this.idleWaiters;
      this.idleWaiters = [];
      waiters.forEach((resolve) => resolve());
    });
  }
}

export interface LatestWinsGate {
  status: "pass" | "fail";
  expectedLatestEpoch: number;
  failures: string[];
}

const isMonotonic = (values: readonly number[]) => values.every((value, index) => index === 0 || value >= values[index - 1]!);

export function evaluateLatestWinsGate(
  snapshot: LatestWinsQueueSnapshot,
  expectedLatestEpoch: number,
  requirements: { requireCoalescing?: boolean } = {},
): LatestWinsGate {
  const failures: string[] = [];
  if (snapshot.requestedEpoch !== expectedLatestEpoch) failures.push("requestedEpoch is not the final posted epoch");
  if (snapshot.appliedEpoch !== expectedLatestEpoch) failures.push("appliedEpoch did not converge to the final posted epoch");
  if (snapshot.inFlight !== 0 || snapshot.pending !== 0) failures.push("queue was not idle at export");
  if (snapshot.maxInFlight > 1) failures.push("more than one request was in flight");
  if (snapshot.maxPending > 1) failures.push("more than one pending request was retained");
  if (!isMonotonic(snapshot.appliedEpochs)) failures.push("applied epochs regressed");
  if (snapshot.errors.length > 0) failures.push("worker probe reported errors");
  if (requirements.requireCoalescing && snapshot.coalescedPending === 0) failures.push("probe did not overwrite a pending epoch");
  if (requirements.requireCoalescing && snapshot.staleRepliesDropped === 0) failures.push("probe did not drop a stale reply");
  if (requirements.requireCoalescing && snapshot.repliedCount >= snapshot.requestedCount) failures.push("producer was effectively serialized");
  return { status: failures.length === 0 ? "pass" : "fail", expectedLatestEpoch, failures };
}

export interface GridHoldingSnapshot {
  desiredHour: number | null;
  renderedHour: number | null;
  hourLag: number | null;
  holdingSinceMs: number | null;
  holdingDurationMs: number;
  maxHoldingDurationMs: number;
  maxHourLag: number;
  samples: number;
}

/** Records how long Grid keeps an older ready hour while the desired hour advances. */
export class GridHoldingRecorder {
  private state: GridHoldingSnapshot = {
    desiredHour: null,
    renderedHour: null,
    hourLag: null,
    holdingSinceMs: null,
    holdingDurationMs: 0,
    maxHoldingDurationMs: 0,
    maxHourLag: 0,
    samples: 0,
  };

  observe(desiredHour: number, renderedHour: number | null, nowMs: number): GridHoldingSnapshot {
    const hourLag = renderedHour === null ? null : Math.max(0, Math.floor((desiredHour - renderedHour) / 3_600));
    const holding = renderedHour === null || renderedHour !== desiredHour;
    const holdingSinceMs = holding ? (this.state.holdingSinceMs ?? nowMs) : null;
    const holdingDurationMs = holdingSinceMs === null ? 0 : Math.max(0, nowMs - holdingSinceMs);
    this.state = {
      desiredHour,
      renderedHour,
      hourLag,
      holdingSinceMs,
      holdingDurationMs,
      maxHoldingDurationMs: Math.max(this.state.maxHoldingDurationMs, holdingDurationMs),
      maxHourLag: Math.max(this.state.maxHourLag, hourLag ?? 0),
      samples: this.state.samples + 1,
    };
    return this.snapshot();
  }

  snapshot(nowMs?: number): GridHoldingSnapshot {
    const holdingDurationMs = this.state.holdingSinceMs !== null && nowMs !== undefined
      ? Math.max(0, nowMs - this.state.holdingSinceMs)
      : this.state.holdingDurationMs;
    return {
      ...this.state,
      holdingDurationMs,
      maxHoldingDurationMs: Math.max(this.state.maxHoldingDurationMs, holdingDurationMs),
    };
  }
}

export interface ManualVisualGate {
  status: "not-run" | "pass" | "fail";
  environment: "native-gpu" | "software" | "unknown";
  mapboxCustomLayerMounted: boolean | null;
  headTrailMaxPx: number | null;
  clickHeadMaxPx: number | null;
  popupEpochMatchesApplied: boolean | null;
  notes: string[];
}

/** This bench has no Mapbox canvas; export an explicit unresolved gate instead of a proxy pass. */
export function unresolvedNativeGpuGate(note: string): ManualVisualGate {
  return {
    status: "not-run",
    environment: "unknown",
    mapboxCustomLayerMounted: null,
    headTrailMaxPx: null,
    clickHeadMaxPx: null,
    popupEpochMatchesApplied: null,
    notes: [note],
  };
}

export const PHASE2_ACCEPTANCE_WINDOW_KEY = "__GFW_V4_PHASE2_ACCEPTANCE__" as const;

/** Read-only browser-automation bridge; the result itself remains owned by React state. */
export function installPhase2AcceptanceBridge<T>(target: object, readLatest: () => T | null): () => void {
  const previous = Object.getOwnPropertyDescriptor(target, PHASE2_ACCEPTANCE_WINDOW_KEY);
  Object.defineProperty(target, PHASE2_ACCEPTANCE_WINDOW_KEY, {
    configurable: true,
    enumerable: false,
    get: readLatest,
  });
  return () => {
    if (previous) Object.defineProperty(target, PHASE2_ACCEPTANCE_WINDOW_KEY, previous);
    else Reflect.deleteProperty(target, PHASE2_ACCEPTANCE_WINDOW_KEY);
  };
}
