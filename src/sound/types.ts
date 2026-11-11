/**
 * City Sound Atlas — 領域型別（MVP-A，計畫書 §6–§7 精簡版）。
 *
 * 時間一律 unix 秒；臺灣日期鍵為 Asia/Taipei 的 YYYY-MM-DD。
 * relativePotential 是無單位 0–1 的「類別活躍潛勢」，**不是 dB**；null = unknown。
 */

export type SoundSourceFamily = "aviation" | "rain" | "thunder" | "waste_collection";

export type SoundGeometryKind =
  | "point"
  | "moving_point_2d"
  | "moving_point_3d"
  | "distributed_field"
  | "impulse_event";

export type TimeEvidence = "observed" | "scheduled" | "estimated";
export type ContributionEvidence = "observed" | "scheduled" | "modeled" | "inferred";

export interface Receiver {
  id: string;
  longitude: number;
  latitude: number;
  /** 離地高度（m）；未提供時用 soundProfiles COMMON.receiverDefaultHeightM（assumption） */
  heightM?: number;
  environment: "outdoor" | "indoor_unknown";
}

export interface SoundPosition {
  lon: number;
  lat: number;
  /** 公尺；單位未確認或無高度時 null */
  altitudeM: number | null;
}

export interface SoundSourceRecord<P = unknown> {
  id: string;
  family: SoundSourceFamily;
  geometryKind: SoundGeometryKind;
  /** 依家族而定的原始資料（adapter 內部型別） */
  payload: P;
  /** 此來源可能有活動的最早／最晚時間（unix 秒，含 envelope／buffer） */
  validFrom: number;
  validUntil: number;
  modelVersion: string;
  provenance: {
    provider: string;
    originalId?: string;
    observedAt?: number;
  };
  quality: {
    location: "exact_observed" | "geocoded" | "approximate" | "unknown";
    time: TimeEvidence;
    emission: "unmeasured" | "proxy" | "calibrated";
  };
  visibility: "public" | "owner_only" | "internal";
}

/** 單筆來源在時間 t 的狀態（與接收者無關） */
export type SourceEvaluation =
  | { status: "active"; geometry: SoundPosition; relativeActivity: number }
  | { status: "inactive" }
  | { status: "unknown"; reason: string };

export type SourceHealth = "ok" | "empty" | "error" | "unavailable";

/**
 * 一個來源提供者在某日的涵蓋情況。零筆資料時仍靠它表達 unknown／unavailable，
 * 而不是被當成「安靜」。
 */
export interface SourceCoverage {
  family: SoundSourceFamily;
  provider: string;
  dateKey: string;
  status: SourceHealth;
  /** 此來源資料可代表的時間窗 [windowStart, windowEnd)（unix 秒） */
  windowStart: number;
  windowEnd: number;
  temporalKind: "day_series" | "static_schedule" | "latest_snapshot";
  reason?: string;
}

export interface SoundSourceSet<P = unknown> {
  family: SoundSourceFamily;
  dateKey: string;
  records: SoundSourceRecord<P>[];
  coverage: SourceCoverage[];
}

export interface ThunderTiming {
  flashTime: number;
  perceivedArrivalTime: number;
  envelopeEndTime: number;
  delayS: number;
  propagationApproximation: "2d" | "3d";
}

export interface SourceContribution {
  sourceId: string;
  family: SoundSourceFamily;
  /** 'active' 有證據且潛勢 > 0；'unknown' 為候選但無法估（relativePotential=null） */
  status: "active" | "unknown";
  /** ISO-8601 UTC：此貢獻所依據的來源時間（觀測／表定／內插時刻） */
  sourceTime: string;
  spatialDistanceM: number | null;
  /** 無單位 0–1；NOT dB；null = unknown */
  relativePotential: number | null;
  /** 通過聲學校準 gate 前一律 null */
  modeledDbA: null;
  evidence: ContributionEvidence;
  spatialPrecision: string;
  temporalPrecision: string;
  acousticConfidence: "unmeasured" | "proxy" | "calibrated";
  /** status=unknown 時的機器可讀原因（不依賴 notes 順序） */
  unknownReason?: string;
  propagationApproximation?: "2d" | "3d";
  thunderTiming?: ThunderTiming;
  notes: string[];
}

export type FamilyStatus = "active" | "inactive" | "unknown" | "unavailable";

export interface FamilyResult {
  family: SoundSourceFamily;
  status: FamilyStatus;
  /** active → 最大潛勢；inactive → 0（資料健康且無候選）；unknown/unavailable → null */
  relativePotential: number | null;
  reason?: string;
  contributions: SourceContribution[];
  notes: string[];
}

/** adapter 的接收者區間查詢（純函式）：只回半徑內候選的貢獻 */
export type IntervalQuery<P> = (
  records: readonly SoundSourceRecord<P>[],
  receiver: Receiver,
  t0: number,
  t1: number,
) => { contributions: SourceContribution[]; notes: string[] };

export interface SoundLoadContext {
  /** 臺灣日期 YYYY-MM-DD */
  date: string;
  /** 牆鐘 unix 秒（可注入測試）；查「今天」時用來截斷涵蓋窗，未發生的時段不算 0 */
  nowUnix?: number;
}

export interface SoundSourceAdapter<P = unknown> {
  family: SoundSourceFamily;
  load(context: SoundLoadContext): Promise<SoundSourceSet<P>>;
  evaluate(source: SoundSourceRecord<P>, unixSeconds: number): SourceEvaluation;
  queryInterval: IntervalQuery<P>;
}
