import { describe, expect, it } from "vitest";
import {
  BoundedLatestWinsQueue,
  GridHoldingRecorder,
  PHASE2_ACCEPTANCE_WINDOW_KEY,
  evaluateLatestWinsGate,
  installPhase2AcceptanceBridge,
  unresolvedNativeGpuGate,
} from "./acceptanceInstrumentation";

describe("GFW v4 production-similar acceptance instrumentation", () => {
  it("coalesces a burst to one in-flight plus the newest pending epoch", async () => {
    const replies: Array<(epoch: number) => void> = [];
    const applied: number[] = [];
    const queue = new BoundedLatestWinsQueue(
      (epoch) => new Promise<{ frameEpoch: number }>((resolve) => replies.push(() => resolve({ frameEpoch: epoch }))),
      (reply) => applied.push(reply.frameEpoch),
    );

    queue.enqueue(100);
    queue.enqueue(101);
    queue.enqueue(102);
    expect(queue.snapshot()).toMatchObject({ requestedEpoch: 102, inFlight: 1, pending: 1, coalescedPending: 1 });
    replies.shift()?.(100);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    expect(applied).toEqual([]);
    expect(queue.snapshot()).toMatchObject({ staleRepliesDropped: 1, inFlight: 1, pending: 0 });
    replies.shift()?.(102);
    const snapshot = await queue.whenIdle();

    expect(applied).toEqual([102]);
    expect(snapshot).toMatchObject({ repliedEpoch: 102, appliedEpoch: 102, inFlight: 0, pending: 0, maxInFlight: 1, maxPending: 1 });
    expect(evaluateLatestWinsGate(snapshot, 102)).toEqual({ status: "pass", expectedLatestEpoch: 102, failures: [] });
  });

  it("does not serialize the producer by awaiting each posted epoch", async () => {
    const applied: number[] = [];
    const queue = new BoundedLatestWinsQueue(
      async (epoch) => { await Promise.resolve(); return { frameEpoch: epoch }; },
      (reply) => applied.push(reply.frameEpoch),
    );
    for (let epoch = 200; epoch <= 220; epoch += 1) queue.enqueue(epoch);
    const snapshot = await queue.whenIdle();
    expect(snapshot.requestedCount).toBe(21);
    expect(snapshot.repliedCount).toBe(2);
    expect(snapshot.coalescedPending).toBe(19);
    expect(snapshot.staleRepliesDropped).toBe(1);
    expect(applied).toEqual([220]);
  });

  it("records Grid desired/rendered-hour lag and hold duration", () => {
    const recorder = new GridHoldingRecorder();
    recorder.observe(10 * 3_600, 9 * 3_600, 1_000);
    recorder.observe(10 * 3_600, 9 * 3_600, 1_350);
    expect(recorder.snapshot()).toMatchObject({ hourLag: 1, holdingDurationMs: 350, maxHoldingDurationMs: 350, maxHourLag: 1 });
    recorder.observe(10 * 3_600, 10 * 3_600, 1_500);
    expect(recorder.snapshot()).toMatchObject({ hourLag: 0, holdingSinceMs: null, holdingDurationMs: 0, maxHoldingDurationMs: 350 });
  });

  it("leaves native-GPU Mapbox/CustomLayer/click acceptance explicitly unresolved", () => {
    expect(unresolvedNativeGpuGate("manual probe required")).toMatchObject({
      status: "not-run",
      environment: "unknown",
      mapboxCustomLayerMounted: null,
      headTrailMaxPx: null,
      clickHeadMaxPx: null,
      popupEpochMatchesApplied: null,
    });
  });

  it("exposes a read-only machine-readable acceptance result", () => {
    const target = {};
    let latest: unknown = null;
    const cleanup = installPhase2AcceptanceBridge(target, () => latest);
    expect(Object.getOwnPropertyDescriptor(target, PHASE2_ACCEPTANCE_WINDOW_KEY)?.set).toBeUndefined();
    latest = { schemaVersion: 1, queue: { status: "pass" } };
    expect(Reflect.get(target, PHASE2_ACCEPTANCE_WINDOW_KEY)).toBe(latest);
    cleanup();
    expect(Object.prototype.hasOwnProperty.call(target, PHASE2_ACCEPTANCE_WINDOW_KEY)).toBe(false);
  });
});
