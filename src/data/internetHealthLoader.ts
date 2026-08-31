/**
 * 台灣電信與網路狀態 loader。
 *
 * 資料只走 public.get_internet_health_status RPC；前端不直打各 provider，
 * 也不把 ASN 或 country status 轉成地圖 geometry。
 *
 * 保守語意：
 * - effective_status 是 UI 狀態真相，reported_status 只留作溯源。
 * - stale / unavailable / 缺列都只能是 unknown，不能安靜變成 normal 或 0。
 * - normal 只接受 fresh detector composite 且 metadata 明示 normal quorum；
 *   provider 明細缺席／受限或 NCDR 無通報都不能單獨證明網路正常。
 */
import { supabase, supabaseConfigured } from "../lib/supabase";
import { withLoading } from "../lib/loadingRegistry";
import { cachedOnce } from "../lib/loaderCache";

export type InternetHealthStatus = "normal" | "watch" | "degraded" | "outage" | "unknown";
export type InternetHealthConfidence = "low" | "medium" | "high" | "unknown";
export type InternetHealthSourceKey = "cloudflare" | "ioda" | "ripe_atlas" | "ripe_ris" | "ncdr";
export type InternetHealthSourceAvailability = "fresh" | "stale" | "missing" | "restricted";
export type InternetHealthRowType = "detector" | "evidence" | "official" | "unknown";

export interface InternetHealthEvidence {
  row_type: InternetHealthRowType;
  source_observation_id: string | null;
  entity_type: string;
  entity_id: string;
  entity_name: string | null;
  source: string;
  source_key: InternetHealthSourceKey | "other";
  evidence_family: string | null;
  signal: string | null;
  reported_status: string | null;
  status: InternetHealthStatus;
  incident_kind: string | null;
  value: number | null;
  unit: string | null;
  baseline_value: number | null;
  change_ratio: number | null;
  confidence: InternetHealthConfidence;
  confidence_score: number | null;
  sample_count: number | null;
  observed_at: string | null;
  source_updated_at: string | null;
  collected_at: string | null;
  age_seconds: number | null;
  is_stale: boolean;
  active_incident_id: string | null;
  incident_status: string | null;
  metadata: Record<string, unknown>;
}

export interface InternetHealthSourceSummary {
  key: InternetHealthSourceKey;
  label: string;
  status: InternetHealthStatus;
  fresh: boolean;
  availability: InternetHealthSourceAvailability;
  detector_fresh: boolean;
  detector_stale: boolean;
  observed_at: string | null;
  source_updated_at: string | null;
  age_seconds: number | null;
  signal: string | null;
  value: number | null;
  unit: string | null;
  change_ratio: number | null;
  confidence: InternetHealthConfidence;
  confidence_score: number | null;
  sample_count: number | null;
  evidence_count: number;
}

export interface InternetHealthIncident {
  id: string;
  kind: string | null;
  status: string | null;
  entity_type: string;
  entity_id: string;
  entity_name: string | null;
  severity: InternetHealthStatus;
  confidence: InternetHealthConfidence;
  observed_at: string | null;
  source: string;
}

export interface InternetHealthSummary {
  overall_status: InternetHealthStatus;
  confidence: InternetHealthConfidence;
  confidence_score: number | null;
  summary: string;
  last_updated_at: string | null;
  fresh_source_count: number;
  public_source_total: number;
  source_total: number;
  normal_quorum_met: boolean | null;
  fresh_evidence_families: string[];
  stale_evidence_families: string[];
  restricted_evidence_families: string[];
  sources: InternetHealthSourceSummary[];
  incidents: InternetHealthIncident[];
  evidence: InternetHealthEvidence[];
}

const SOURCE_LABELS: Record<InternetHealthSourceKey, string> = {
  cloudflare: "Cloudflare Radar",
  ioda: "IODA",
  ripe_atlas: "RIPE Atlas",
  ripe_ris: "RIPE RIS Live",
  ncdr: "NCDR",
};

const SOURCE_KEYS: readonly InternetHealthSourceKey[] = [
  "cloudflare", "ioda", "ripe_atlas", "ripe_ris", "ncdr",
];

/**
 * Production public RPC policy (2026-08-31): IODA and both RIPE provider rows
 * stay internal-only. The detector may disclose family names/freshness in its
 * public-safe metadata, but the UI must not infer or reveal provider metrics.
 */
const RESTRICTED_SOURCE_KEYS = new Set<InternetHealthSourceKey>([
  "ioda", "ripe_atlas", "ripe_ris",
]);

const SOURCE_FAMILIES: Record<InternetHealthSourceKey, readonly string[]> = {
  cloudflare: ["cloudflare", "cloudflare_radar"],
  ioda: ["ioda"],
  ripe_atlas: ["ripe_atlas"],
  ripe_ris: ["ripe_ris", "ripe_ris_live"],
  ncdr: ["ncdr", "official"],
};

const STATUS_RANK: Record<InternetHealthStatus, number> = {
  unknown: 0,
  normal: 1,
  watch: 2,
  degraded: 3,
  outage: 4,
};

const CONFIDENCE_RANK: Record<InternetHealthConfidence, number> = {
  unknown: 0,
  low: 1,
  medium: 2,
  high: 3,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const out = value.trim();
  return out || null;
}

function num(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const out = Number(value);
    return Number.isFinite(out) ? out : null;
  }
  return null;
}

function timestamp(value: unknown): string | null {
  const out = text(value);
  if (!out || !Number.isFinite(Date.parse(out))) return null;
  return out;
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(text).filter((item): item is string => item !== null))];
}

export function normalizeInternetHealthStatus(value: unknown): InternetHealthStatus {
  const raw = text(value)?.toLowerCase().replace(/[\s-]+/g, "_") ?? "";
  if (["normal", "ok", "healthy", "clear"].includes(raw)) return "normal";
  if (["watch", "warning", "anomaly", "suspected"].includes(raw)) return "watch";
  if ([
    "degraded", "partial_outage", "single_asn_outage", "multi_asn_partial_outage",
    "international_path_degradation", "selective_service_blocking",
  ].includes(raw)) return "degraded";
  if (["outage", "down", "major_outage", "national_outage"].includes(raw)) return "outage";
  return "unknown";
}

function normalizeConfidence(value: unknown): InternetHealthConfidence {
  const numeric = num(value);
  if (numeric !== null && numeric >= 0 && numeric <= 1) {
    if (numeric >= 0.8) return "high";
    if (numeric >= 0.5) return "medium";
    return "low";
  }
  const raw = text(value)?.toLowerCase() ?? "";
  if (raw === "low" || raw === "medium" || raw === "high") return raw;
  return "unknown";
}

function confidenceScore(value: unknown): number | null {
  const numeric = num(value);
  return numeric !== null && numeric >= 0 && numeric <= 1 ? numeric : null;
}

function sourceKeyOf(value: unknown): InternetHealthSourceKey | "other" {
  const raw = text(value)?.toLowerCase() ?? "";
  if (raw.includes("cloudflare") || raw.includes("radar")) return "cloudflare";
  if (raw.includes("ioda")) return "ioda";
  if (raw.includes("ripe_atlas") || raw.includes("ripe atlas")) return "ripe_atlas";
  if (raw.includes("ripe_ris") || raw.includes("ris_live") || raw.includes("ris live")) return "ripe_ris";
  if (raw.includes("ncdr")) return "ncdr";
  return "other";
}

function rowTypeOf(value: unknown, evidenceFamily: string | null): InternetHealthRowType {
  const raw = text(value)?.toLowerCase() ?? "";
  if (raw === "status") return evidenceFamily === "composite" ? "detector" : "evidence";
  if (raw === "official_evidence") return "official";
  // 防禦性相容早期前端 fixture，不是 production RPC 的 canonical 值。
  if (raw === "detector" || raw === "evidence" || raw === "official") return raw;
  return "unknown";
}

/** 單列 parser；欄位缺失時保守保留 null，不補 0。 */
export function parseInternetHealthEvidence(raw: unknown): InternetHealthEvidence | null {
  if (!isRecord(raw)) return null;
  const entityType = text(raw.entity_type);
  const entityId = text(raw.entity_id);
  const source = text(raw.source);
  if (!entityType || !entityId || !source) return null;

  // RPC contract 明確要求 is_stale。缺欄也視為 stale，避免舊 RPC 靜默顯示正常。
  const isStale = raw.is_stale !== false;
  const effective = normalizeInternetHealthStatus(raw.effective_status);
  const status = isStale ? "unknown" : effective;
  const evidenceFamily = text(raw.evidence_family);

  return {
    row_type: rowTypeOf(raw.row_type, evidenceFamily),
    source_observation_id: text(raw.source_observation_id),
    entity_type: entityType,
    entity_id: entityId,
    entity_name: text(raw.entity_name),
    source,
    source_key: sourceKeyOf(source),
    evidence_family: evidenceFamily,
    signal: text(raw.signal),
    reported_status: text(raw.reported_status),
    status,
    incident_kind: text(raw.incident_kind),
    value: num(raw.value),
    unit: text(raw.unit),
    baseline_value: num(raw.baseline_value),
    change_ratio: num(raw.change_ratio),
    confidence: normalizeConfidence(raw.confidence),
    confidence_score: confidenceScore(raw.confidence),
    sample_count: num(raw.sample_count),
    observed_at: timestamp(raw.observed_at),
    source_updated_at: timestamp(raw.source_updated_at),
    collected_at: timestamp(raw.collected_at),
    age_seconds: num(raw.age_seconds),
    is_stale: isStale,
    active_incident_id: text(raw.active_incident_id),
    incident_status: text(raw.incident_status),
    metadata: isRecord(raw.metadata) ? raw.metadata : {},
  };
}

function latestTimestamp(rows: InternetHealthEvidence[]): string | null {
  let latest: string | null = null;
  let latestMs = -Infinity;
  for (const row of rows) {
    const candidate = row.source_updated_at ?? row.observed_at ?? row.collected_at;
    if (!candidate) continue;
    const ms = Date.parse(candidate);
    if (ms > latestMs) {
      latestMs = ms;
      latest = candidate;
    }
  }
  return latest;
}

function worstStatus(rows: InternetHealthEvidence[]): InternetHealthStatus {
  let out: InternetHealthStatus = "unknown";
  for (const row of rows) {
    if (STATUS_RANK[row.status] > STATUS_RANK[out]) out = row.status;
  }
  return out;
}

function conservativeConfidence(rows: InternetHealthEvidence[]): InternetHealthConfidence {
  const known = rows.map((row) => row.confidence).filter((c) => c !== "unknown");
  if (!known.length) return "unknown";
  return known.reduce((a, b) => CONFIDENCE_RANK[a] <= CONFIDENCE_RANK[b] ? a : b);
}

function conservativeConfidenceScore(rows: InternetHealthEvidence[]): number | null {
  const known = rows
    .map((row) => row.confidence_score)
    .filter((score): score is number => score !== null);
  return known.length ? Math.min(...known) : null;
}

interface DetectorMetadataSummary {
  normalQuorumMet: boolean | null;
  freshFamilies: string[];
  staleFamilies: string[];
  restrictedFamilies: string[];
}

function detectorMetadata(rows: InternetHealthEvidence[]): DetectorMetadataSummary {
  const sorted = [...rows].sort((a, b) => {
    const ta = Date.parse(a.source_updated_at ?? a.observed_at ?? "") || 0;
    const tb = Date.parse(b.source_updated_at ?? b.observed_at ?? "") || 0;
    return tb - ta;
  });
  const latest = sorted[0];
  if (!latest) {
    return { normalQuorumMet: null, freshFamilies: [], staleFamilies: [], restrictedFamilies: [] };
  }
  return {
    normalQuorumMet: typeof latest.metadata.normal_quorum_met === "boolean"
      ? latest.metadata.normal_quorum_met
      : null,
    freshFamilies: stringArray(latest.metadata.fresh_evidence_families),
    staleFamilies: stringArray(latest.metadata.stale_evidence_families),
    restrictedFamilies: stringArray(latest.metadata.restricted_evidence_families),
  };
}

function familyListed(key: InternetHealthSourceKey, families: string[]): boolean {
  return SOURCE_FAMILIES[key].some((family) => families.includes(family));
}

function sourceSummary(
  key: InternetHealthSourceKey,
  rows: InternetHealthEvidence[],
  metadata: DetectorMetadataSummary,
): InternetHealthSourceSummary {
  const sourceRows = rows.filter((row) => row.source_key === key);
  const freshRows = sourceRows.filter((row) => !row.is_stale && row.status !== "unknown");
  const restricted = RESTRICTED_SOURCE_KEYS.has(key) || familyListed(key, metadata.restrictedFamilies);
  const status = restricted ? "unknown" : worstStatus(freshRows);
  const candidates = freshRows.filter((row) => row.status === status);
  const notable = [...(candidates.length ? candidates : sourceRows)].sort((a, b) => {
    const ta = Date.parse(a.source_updated_at ?? a.observed_at ?? "") || 0;
    const tb = Date.parse(b.source_updated_at ?? b.observed_at ?? "") || 0;
    return tb - ta;
  })[0] ?? null;
  const availability: InternetHealthSourceAvailability = restricted
    ? "restricted"
    : freshRows.length > 0
      ? "fresh"
      : sourceRows.length > 0
        ? "stale"
        : "missing";
  return {
    key,
    label: SOURCE_LABELS[key],
    status,
    fresh: !restricted && freshRows.length > 0,
    availability,
    detector_fresh: familyListed(key, metadata.freshFamilies),
    detector_stale: familyListed(key, metadata.staleFamilies),
    observed_at: restricted ? null : (notable?.observed_at ?? null),
    source_updated_at: restricted ? null : (notable?.source_updated_at ?? null),
    age_seconds: restricted ? null : (notable?.age_seconds ?? null),
    signal: restricted ? null : (notable?.signal ?? null),
    value: restricted ? null : (notable?.value ?? null),
    unit: restricted ? null : (notable?.unit ?? null),
    change_ratio: restricted ? null : (notable?.change_ratio ?? null),
    confidence: restricted ? "unknown" : conservativeConfidence(candidates),
    confidence_score: restricted ? null : conservativeConfidenceScore(candidates),
    sample_count: restricted ? null : (notable?.sample_count ?? null),
    evidence_count: sourceRows.length,
  };
}

/**
 * Defense in depth for the browser model. The production RPC already applies
 * a migration-owned allowlist, but an upstream policy regression must not put
 * restricted provider rows (or an unknown future provider) into page memory.
 */
function isPublicEvidence(row: InternetHealthEvidence): boolean {
  if (row.row_type === "detector" || row.row_type === "official") return true;
  return row.source_key === "cloudflare" || row.source_key === "ncdr";
}

function activeIncidents(rows: InternetHealthEvidence[]): InternetHealthIncident[] {
  const byId = new Map<string, InternetHealthIncident>();
  for (const row of rows) {
    const id = row.active_incident_id
      ?? (row.row_type === "official" && row.status !== "normal" && row.status !== "unknown"
        ? row.source_observation_id && `official:${row.source_observation_id}`
        : null);
    const incidentStatus = row.incident_status?.toLowerCase() ?? null;
    if (!id || incidentStatus === "closed" || incidentStatus === "resolved") continue;
    const candidate: InternetHealthIncident = {
      id,
      kind: row.incident_kind,
      status: row.incident_status,
      entity_type: row.entity_type,
      entity_id: row.entity_id,
      entity_name: row.entity_name,
      severity: row.status,
      confidence: row.confidence,
      observed_at: row.observed_at,
      source: row.source,
    };
    const current = byId.get(id);
    if (!current || STATUS_RANK[candidate.severity] > STATUS_RANK[current.severity]) byId.set(id, candidate);
  }
  return [...byId.values()].sort((a, b) => STATUS_RANK[b.severity] - STATUS_RANK[a.severity]);
}

function summaryText(status: InternetHealthStatus): string {
  if (status === "normal") return "多來源未見明顯網路異常";
  if (status === "watch") return "部分訊號需要持續觀察";
  if (status === "degraded") return "偵測到局部或服務品質下降";
  if (status === "outage") return "偵測到網路中斷訊號";
  return "核心來源不足，暫時無法判斷";
}

/** 將 RPC evidence rows 彙整成 Monitor 卡片模型。 */
export function aggregateInternetHealthRows(rawRows: unknown): InternetHealthSummary {
  const parsedEvidence = Array.isArray(rawRows)
    ? rawRows.map(parseInternetHealthEvidence).filter((row): row is InternetHealthEvidence => row !== null)
    : [];
  const evidence = parsedEvidence.filter(isPublicEvidence);
  const freshEvidence = evidence.filter((row) => !row.is_stale && row.status !== "unknown");
  const freshDetectors = freshEvidence.filter((row) => row.row_type === "detector");
  const freshOfficial = freshEvidence.filter((row) => row.row_type === "official");
  const detectorMeta = detectorMetadata(freshDetectors);
  const sources = SOURCE_KEYS.map((key) => sourceSummary(key, evidence, detectorMeta));
  // Provider evidence 是 detector 的輸入，不可蓋過 composite；NCDR active official evidence
  // 則保留為獨立正向中斷證據。
  const primaryRows = freshDetectors.length ? [...freshDetectors, ...freshOfficial] : freshEvidence;
  let overall = worstStatus(primaryRows);

  // normal 只接受 fresh composite 明示 quorum。IODA／RIPE provider 明細受限，
  // 因此不能再靠公開 provider rows 重算 normal；metadata 缺欄一律 unknown。
  if (overall === "normal") {
    const hasQuorumDetector = freshDetectors.some((row) => (
      row.status === "normal" && row.metadata.normal_quorum_met === true
    ));
    if (!hasQuorumDetector) {
      overall = "unknown";
    }
  }
  if (!primaryRows.length) overall = "unknown";

  const contributing = primaryRows.filter((row) => row.status === overall);
  return {
    overall_status: overall,
    confidence: conservativeConfidence(contributing),
    confidence_score: conservativeConfidenceScore(contributing),
    summary: summaryText(overall),
    last_updated_at: latestTimestamp(evidence),
    fresh_source_count: sources.filter((source) => source.fresh).length,
    public_source_total: sources.filter((source) => source.availability !== "restricted").length,
    source_total: sources.length,
    normal_quorum_met: detectorMeta.normalQuorumMet,
    fresh_evidence_families: detectorMeta.freshFamilies,
    stale_evidence_families: detectorMeta.staleFamilies,
    restricted_evidence_families: detectorMeta.restrictedFamilies,
    sources,
    incidents: activeIncidents(evidence),
    evidence,
  };
}

async function fetchInternetHealthStatusUncached(): Promise<InternetHealthSummary> {
  if (!supabaseConfigured) throw new Error("Supabase not configured");
  const { data, error } = await withLoading(
    "internet-health:status",
    "電信與網路狀態",
    supabase.rpc("get_internet_health_status", {
      p_entity_type: "country",
      p_entity_ids: ["TW"],
      p_include_evidence: true,
      p_limit: 500,
    }),
  );
  if (error) throw new Error(`get_internet_health_status: ${error.message}`);
  return aggregateInternetHealthRows(data);
}

export const fetchInternetHealthStatus = cachedOnce(fetchInternetHealthStatusUncached, 4 * 60_000);
export function invalidateInternetHealthStatus(): void {
  fetchInternetHealthStatus.invalidate();
}
