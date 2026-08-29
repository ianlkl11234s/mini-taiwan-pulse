export interface ScrubTelemetry { samples: number; p50Ms: number; p95Ms: number; maxMs: number; heapBefore?: number; heapAfter?: number; }
type Raf = (callback: FrameRequestCallback) => number;
const percentile = (values: readonly number[], ratio: number) => { const ordered = [...values].sort((a, b) => a - b); return ordered[Math.min(ordered.length - 1, Math.ceil(ordered.length * ratio) - 1)]!; };

/** Controlled 96-frame scrub. Work must have completed before the next RAF is sampled. */
export async function measureControlledScrub(work: (index: number) => void | Promise<void>, frames = 96, raf: Raf = requestAnimationFrame): Promise<ScrubTelemetry> {
  if (!Number.isInteger(frames) || frames < 2) throw new Error("scrub needs at least two frames");
  const deltas: number[] = []; let previous = await new Promise<number>((resolve) => raf(resolve));
  for (let index = 0; index < frames; index++) { await work(index); const current = await new Promise<number>((resolve) => raf(resolve)); deltas.push(Math.max(0, current - previous)); previous = current; }
  return { samples: deltas.length, p50Ms: percentile(deltas, 0.5), p95Ms: percentile(deltas, 0.95), maxMs: Math.max(...deltas) };
}
