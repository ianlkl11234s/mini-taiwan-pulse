import type { DeviceProfile, TrackAssetFormat, TrackBucket, TrackFrame, WorkloadCoverage } from "./types";
import type { AssetLoadTiming, CacheMode } from "./cache";

export function percentile(values: readonly number[], fraction: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * fraction) - 1))]!;
}

export function currentDeviceProfile(label: "desktop" | "mobile"): DeviceProfile {
  const nav = navigator as Navigator & { deviceMemory?: number };
  return {
    label,
    viewport: { width: window.innerWidth, height: window.innerHeight },
    devicePixelRatio: window.devicePixelRatio,
    userAgent: navigator.userAgent,
    hardwareConcurrency: Number.isFinite(navigator.hardwareConcurrency) ? navigator.hardwareConcurrency : null,
    deviceMemoryGb: Number.isFinite(nav.deviceMemory) ? nav.deviceMemory! : null,
    note: label === "mobile"
      ? "Viewport/profile label only unless the exported run records real-device or CPU/network throttling externally."
      : "Local Chromium-class desktop profile; external CPU/network throttling must be recorded separately.",
  };
}

type HeapPerformance = { memory?: { usedJSHeapSize: number } };

/** `performance.memory` is admissible only when the operator attests precise-memory launch flags. */
export function attestedHeapBytes(attested: boolean, source: unknown = performance): number | null {
  if (!attested || source === null || typeof source !== "object") return null;
  const memory = (source as HeapPerformance).memory;
  return typeof memory?.usedJSHeapSize === "number" && Number.isFinite(memory.usedJSHeapSize)
    ? memory.usedJSHeapSize
    : null;
}

export interface FrameTelemetry {
  visibleHeadGroups: number;
  visibleMembers: number;
  visibleTrailVertices: number;
  renderedHeadGroups: number;
  renderedTrailVertices: number;
  overBudgetHeads: number;
  overBudgetTrailVertices: number;
}

export interface PeakFrameTelemetry extends FrameTelemetry {
  sampleIndex: number;
  epoch: number;
  selection: "budget-then-visible-load";
}

export function summarizeFrame(frame: TrackFrame): FrameTelemetry {
  return {
    visibleHeadGroups: frame.visibleHeadGroups,
    visibleMembers: frame.visibleMembers,
    visibleTrailVertices: frame.visibleTrailVertices,
    renderedHeadGroups: frame.renderedHeadGroups,
    renderedTrailVertices: frame.renderedTrailVertices,
    overBudgetHeads: frame.overBudgetHeads,
    overBudgetTrailVertices: frame.overBudgetTrailVertices,
  };
}

function frameRank(frame: FrameTelemetry): readonly number[] {
  return [frame.overBudgetHeads, frame.overBudgetTrailVertices, frame.visibleHeadGroups, frame.visibleTrailVertices, frame.visibleMembers];
}

export function isHigherPeakFrame(candidate: FrameTelemetry, previous: FrameTelemetry | null): boolean {
  if (!previous) return true;
  const candidateRank = frameRank(candidate);
  const previousRank = frameRank(previous);
  for (let index = 0; index < candidateRank.length; index++) {
    if (candidateRank[index] !== previousRank[index]) return candidateRank[index]! > previousRank[index]!;
  }
  return false;
}

export function frameWorkSummary(values: readonly number[]): { samples: number; p95Ms: number | null; maxMs: number | null } {
  return {
    samples: values.length,
    p95Ms: percentile(values, 0.95),
    maxMs: values.length ? Math.max(...values) : null,
  };
}

export interface BenchRunExport {
  schemaVersion: 1;
  startedAt: string;
  completedAt: string | null;
  manifestUrl: string;
  selectedDate: string;
  format: TrackAssetFormat;
  cacheMode: CacheMode;
  enabledBuckets: TrackBucket[];
  trailHours: number;
  profile: DeviceProfile;
  externalProfileNote: string;
  workload: WorkloadCoverage;
  heapAttestation: { preciseMemoryInfo: boolean; note: string };
  assets: AssetLoadTiming[];
  resourceTiming: Array<{ name: string; transferSize: number; encodedBodySize: number; decodedBodySize: number; duration: number }>;
  raf: { samples: number; p50Ms: number | null; p95Ms: number | null; maxMs: number | null };
  longTasks: Array<{ startTime: number; duration: number }>;
  heap: {
    quality: "externally-attested-precise" | "unavailable";
    startBytes: number | null;
    afterLoadBytes: number | null;
    afterScrubBytes: number | null;
  };
  cache: { days: number; packs: number; dates: string[] };
  /** Final scrub sample, retained separately from the worst observed sample. */
  frame: FrameTelemetry | null;
  peakFrame: PeakFrameTelemetry | null;
  frameWork: { samples: number; p95Ms: number | null; maxMs: number | null };
  warnings: string[];
}

export class BenchRunRecorder {
  readonly export: BenchRunExport;
  private rafId = 0;
  private lastRaf: number | null = null;
  private readonly rafDeltas: number[] = [];
  private readonly frameWorkSamples: number[] = [];
  private observer: PerformanceObserver | null = null;

  constructor(config: Omit<BenchRunExport, "schemaVersion" | "startedAt" | "completedAt" | "assets" | "resourceTiming" | "raf" | "longTasks" | "heap" | "cache" | "frame" | "peakFrame" | "frameWork" | "warnings">) {
    const heapStart = attestedHeapBytes(config.heapAttestation.preciseMemoryInfo);
    this.export = {
      schemaVersion: 1,
      startedAt: new Date().toISOString(),
      completedAt: null,
      ...config,
      assets: [], resourceTiming: [], raf: { samples: 0, p50Ms: null, p95Ms: null, maxMs: null },
      longTasks: [],
      heap: {
        quality: heapStart === null ? "unavailable" : "externally-attested-precise",
        startBytes: heapStart,
        afterLoadBytes: null,
        afterScrubBytes: null,
      },
      cache: { days: 0, packs: 0, dates: [] },
      frame: null,
      peakFrame: null,
      frameWork: { samples: 0, p95Ms: null, maxMs: null },
      warnings: [],
    };
  }

  start(): void {
    performance.clearResourceTimings();
    const tick = (now: number) => {
      if (this.lastRaf !== null) this.rafDeltas.push(now - this.lastRaf);
      this.lastRaf = now;
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
    if (typeof PerformanceObserver !== "undefined") {
      try {
        this.observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) this.export.longTasks.push({ startTime: entry.startTime, duration: entry.duration });
        });
        this.observer.observe({ type: "longtask", buffered: true });
      } catch { this.export.warnings.push("Long-task PerformanceObserver unavailable"); }
    }
  }

  afterLoad(): void {
    this.export.heap.afterLoadBytes = attestedHeapBytes(this.export.heapAttestation.preciseMemoryInfo);
  }
  addAsset(timing: AssetLoadTiming): void { this.export.assets.push(timing); }
  observeFrame(frame: TrackFrame, epoch: number, frameWorkMs: number): void {
    const summary = summarizeFrame(frame);
    this.export.frame = summary;
    this.frameWorkSamples.push(frameWorkMs);
    if (isHigherPeakFrame(summary, this.export.peakFrame)) {
      this.export.peakFrame = {
        ...summary,
        sampleIndex: this.frameWorkSamples.length - 1,
        epoch,
        selection: "budget-then-visible-load",
      };
    }
  }

  finish(cache: { dayCount(): number; packCount(): number; dates(): string[] }): BenchRunExport {
    cancelAnimationFrame(this.rafId);
    this.observer?.disconnect();
    this.export.heap.afterScrubBytes = attestedHeapBytes(this.export.heapAttestation.preciseMemoryInfo);
    if (this.export.heap.afterScrubBytes === null) this.export.heap.quality = "unavailable";
    this.export.cache = { days: cache.dayCount(), packs: cache.packCount(), dates: cache.dates() };
    this.export.resourceTiming = performance.getEntriesByType("resource").map((entry) => {
      const resource = entry as PerformanceResourceTiming;
      return { name: resource.name, transferSize: resource.transferSize, encodedBodySize: resource.encodedBodySize, decodedBodySize: resource.decodedBodySize, duration: resource.duration };
    });
    this.export.raf = {
      samples: this.rafDeltas.length,
      p50Ms: percentile(this.rafDeltas, 0.5),
      p95Ms: percentile(this.rafDeltas, 0.95),
      maxMs: this.rafDeltas.length ? Math.max(...this.rafDeltas) : null,
    };
    this.export.frameWork = frameWorkSummary(this.frameWorkSamples);
    this.export.completedAt = new Date().toISOString();
    if (!this.export.heapAttestation.preciseMemoryInfo) {
      this.export.warnings.push("Heap is null: no external --enable-precise-memory-info attestation was declared");
    } else if (this.export.heap.startBytes === null || this.export.heap.afterLoadBytes === null || this.export.heap.afterScrubBytes === null) {
      this.export.warnings.push("Heap is null: precise-memory was attested but performance.memory was unavailable or invalid");
    }
    if (this.export.profile.label === "mobile") this.export.warnings.push("Mobile label is not proof of real-device performance without external profile evidence");
    return this.export;
  }
}
