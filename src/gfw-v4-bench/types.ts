export const TRACK_BUCKETS = ["cargo", "tanker", "passenger", "fishing", "other"] as const;
export type TrackBucket = typeof TRACK_BUCKETS[number];
export type TrackAssetFormat = "json.gz" | "binary";

export interface VesselMember {
  vesselId: string;
  mmsi: string | null;
  shipName: string | null;
  vesselType: string | null;
  flag: string | null;
  /** Optional popup fields are omitted for legacy five-field day-packs. */
  hours?: number | null;
  entryTimestamp?: string | null;
  exitTimestamp?: string | null;
  imo?: string | null;
  callsign?: string | null;
  firstTransmissionDate?: string | null;
  lastTransmissionDate?: string | null;
  dataset?: string | null;
  geartype?: string | null;
}

export interface TrackPoint {
  lon: number;
  lat: number;
  epoch: number;
}

export interface TrackSegment {
  trackId: string;
  vessel: VesselMember;
  points: TrackPoint[];
}

export interface TrackPack {
  displayDate: string;
  bucket: TrackBucket;
  segments: TrackSegment[];
  pointCount: number;
}

export interface BenchAssetEntry {
  bucket: TrackBucket;
  format: TrackAssetFormat;
  path: string;
  bytes: number | null;
  sha256: string | null;
  /** Required on parsed manifests; optional only for hand-built test fixtures. */
  points?: number;
  /** Required on parsed manifests; optional only for hand-built test fixtures. */
  segments?: number;
}

export interface BenchDayEntry {
  displayDate: string;
  assets: ReadonlyMap<string, BenchAssetEntry>;
}

export interface BenchManifest {
  manifestUrl: string;
  releaseId: string;
  bbox: [number, number, number, number];
  days: ReadonlyMap<string, BenchDayEntry>;
}

export interface FrameHead {
  lon: number;
  lat: number;
  members: VesselMember[];
  buckets: TrackBucket[];
}

export interface FrameTrail {
  trackId: string;
  bucket: TrackBucket;
  coordinates: Array<[number, number]>;
}

export interface FrameBudget {
  maxHeads: number;
  maxTrailVertices: number;
}

export interface TrackFrame {
  heads: FrameHead[];
  trails: FrameTrail[];
  visibleHeadGroups: number;
  visibleMembers: number;
  visibleTrailVertices: number;
  renderedHeadGroups: number;
  renderedTrailVertices: number;
  overBudgetHeads: number;
  overBudgetTrailVertices: number;
}

export interface DeviceProfile {
  label: "desktop" | "mobile";
  viewport: { width: number; height: number };
  devicePixelRatio: number;
  userAgent: string;
  hardwareConcurrency: number | null;
  deviceMemoryGb: number | null;
  note: string;
}

export type BenchPreset = "default" | "all" | "custom";

export interface WorkloadCoverage {
  preset: BenchPreset;
  enabled: { points: number; segments: number };
  total: { points: number; segments: number };
  pointFraction: number;
  segmentFraction: number;
}
