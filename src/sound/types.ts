/**
 * City Sound Atlas — 領域型別（MVP-A，計畫書 §6–§7 精簡版）。
 *
 * 時間一律 unix 秒；臺灣日期鍵為 Asia/Taipei 的 YYYY-MM-DD。
 * relativePotential 是無單位 0–1 的「類別活躍潛勢」，**不是 dB**；null = unknown。
 */

/** MVP-B 三族（W4 引擎；鐵道、道路類型 proxy、施工許可） */
export type MvpBSoundFamily = "rail" | "road_traffic" | "roadwork";

/**
 * W5 自然聲源三族（風×植被、海浪×海岸、河川水聲）。
 * 口徑與接線規格見 docs/features/city-sound-atlas/ADVANCED_SOURCES.md。
 */
export type AdvancedSoundFamily = "wind_vegetation" | "coastal_wave" | "river_water";

/** UI 與引擎共用的家族（MVP-A 四族＋MVP-B 三族＋W5 三族；components／hooks 以 Record<SoundSourceFamily, …> 窮舉） */
export type SoundSourceFamily = "aviation" | "rain" | "thunder" | "waste_collection" | MvpBSoundFamily | AdvancedSoundFamily;

/** 引擎層通用的家族全集 */
export type AnySoundFamily = SoundSourceFamily | AdvancedSoundFamily;

export type SoundGeometryKind =
  | "point"
  | "moving_point_2d"
  | "moving_point_3d"
  | "distributed_field"
  | "impulse_event"
  /** MVP-B：線聲源（道路路段）與面狀範圍（施工區） */
  | "line"
  | "area";

export type TimeEvidence = "observed" | "scheduled" | "estimated";
/** estimated：歷史期間統計推估（例：VD 平日典型值），不是當日觀測 */
export type ContributionEvidence = "observed" | "scheduled" | "modeled" | "inferred" | "estimated";

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

export interface SoundSourceRecord<P = unknown, F extends AnySoundFamily = SoundSourceFamily> {
  id: string;
  family: F;
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
export interface SourceCoverage<F extends AnySoundFamily = SoundSourceFamily> {
  family: F;
  provider: string;
  dateKey: string;
  status: SourceHealth;
  /** 此來源資料可代表的時間窗 [windowStart, windowEnd)（unix 秒） */
  windowStart: number;
  windowEnd: number;
  temporalKind: "day_series" | "static_schedule" | "latest_snapshot";
  reason?: string;
}

export interface SoundSourceSet<P = unknown, F extends AnySoundFamily = SoundSourceFamily> {
  family: F;
  dateKey: string;
  records: SoundSourceRecord<P, F>[];
  coverage: SourceCoverage<F>[];
}

export interface ThunderTiming {
  flashTime: number;
  perceivedArrivalTime: number;
  envelopeEndTime: number;
  delayS: number;
  propagationApproximation: "2d" | "3d";
}

export interface SourceContribution<F extends AnySoundFamily = SoundSourceFamily> {
  sourceId: string;
  family: F;
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
  /**
   * MVP-B：潛勢的依據種類（UI 必須照此措辭，不可把 proxy 說成流量或施工中）。
   * - road_type_no_volume：只有道路類型，沒有車流量（不可宣稱流量）
   * - observed_volume：有觀測車流量（VD 等）
   * - permit_window_possible_activity：在施工許可期間內＝可能有施工，許可≠機具運轉
   * - typical_weekday_volume：歷史期間平日典型流量（非當日觀測）
   * - W5 wind_speed_x_canopy：測站風速 × 接收點周圍樹冠覆蓋（風速≠聲級）
   * - W5 wave_height_period_x_coast_distance：浪高×週期（測站）× 離海岸距離 proxy
   * - W5 water_level_percentile：水位相對該站自身歷史的分位（水位≠流量≠聲音）
   */
  proxyKind?:
    | "road_type_no_volume"
    | "observed_volume"
    | "permit_window_possible_activity"
    | "typical_weekday_volume"
    | "wind_speed_x_canopy"
    | "wave_height_period_x_coast_distance"
    | "water_level_percentile";
  /** MVP-B 鐵道：發聲位置的結構分類（地下段不產生貢獻，所以不會出現 underground） */
  railStructure?: "elevated" | "at_grade" | "surface" | "unknown";
  notes: string[];
}

export type FamilyStatus = "active" | "inactive" | "unknown" | "unavailable";

export interface FamilyResult<F extends AnySoundFamily = SoundSourceFamily> {
  family: F;
  status: FamilyStatus;
  /** active → 最大潛勢；inactive → 0（資料健康且無候選）；unknown/unavailable → null */
  relativePotential: number | null;
  reason?: string;
  contributions: SourceContribution<F>[];
  notes: string[];
}

/** adapter 的接收者區間查詢（純函式）：只回半徑內候選的貢獻 */
export type IntervalQuery<P, F extends AnySoundFamily = SoundSourceFamily> = (
  records: readonly SoundSourceRecord<P, F>[],
  receiver: Receiver,
  t0: number,
  t1: number,
) => { contributions: SourceContribution<F>[]; notes: string[] };

export interface SoundLoadContext {
  /** 臺灣日期 YYYY-MM-DD */
  date: string;
  /** 牆鐘 unix 秒（可注入測試）；查「今天」時用來截斷涵蓋窗，未發生的時段不算 0 */
  nowUnix?: number;
}

export interface SoundSourceAdapter<P = unknown, F extends AnySoundFamily = SoundSourceFamily> {
  family: F;
  load(context: SoundLoadContext): Promise<SoundSourceSet<P, F>>;
  evaluate(source: SoundSourceRecord<P, F>, unixSeconds: number): SourceEvaluation;
  queryInterval: IntervalQuery<P, F>;
}
