import { supabase, supabaseConfigured } from "../lib/supabase";
import { withLoading } from "../lib/loadingRegistry";
import { cachedByKey, cachedOnce } from "../lib/loaderCache";

export type GlobalEventLifecycle = "published" | "archived" | "superseded" | "retracted";
export type GlobalEventLocationKind = "event_point" | "city_center" | "country_center";
export type GlobalEventTransitionKind = "new_event" | "version_update";
export interface GlobalCandidateAssessment {
  candidateId: string; title: string; decision: string | null; taiwanRelationship: string | null;
  taiwanImpact: string | null; reason: string | null;
}

export interface GlobalEventPoint {
  eventId: string;
  versionId: string;
  versionNo: number | null;
  publicationNo: number | null;
  lifecycleState: GlobalEventLifecycle | null;
  eventPlaceId: string;
  titleZhTw: string;
  summaryZhTw: string | null;
  category: string | null;
  severity: number | null;
  confidence: number | null;
  validFrom: string | null;
  publishedAt: string | null;
  explicitValidTo: string | null;
  displayFrom: string | null;
  displayTo: string | null;
  placeKey: string | null;
  placeName: string | null;
  countryCode: string | null;
  admin1: string | null;
  admin2: string | null;
  precision: string | null;
  locationSource: string | null;
  displayPlaceId: string | null;
  locationKind: GlobalEventLocationKind | null;
  isProxy: boolean;
  representativePrecision: string | null;
  proxyForEventPlaceId: string | null;
  locationLineage: string | null;
  coordinates: [number, number];
  candidateId?: string;
  researchStatus?: string;
  assessmentStatus?: string;
  decision?: string | null;
  taiwanRelationship?: string | null;
  taiwanImpactZhTw?: string | null;
  reasonZhTw?: string | null;
  sourceUrls?: string[];
  canonicalEventId?: string | null;
  linkedPublishedAt?: string | null;
  availableAt?: string | null;
  sourceHeadline?: string | null;
  canonicalLatestLifecycle?: GlobalEventLifecycle | null;
  linkedEffectiveAt?: string | null;
  mapSuppressed?: boolean;
  sourceKind?: string | null;
  countryCodeScheme?: string | null;
  aiGroupId?: string | null;
  candidateIds?: string[];
  candidateAssessments?: GlobalCandidateAssessment[];
}

export interface GlobalEventRecord extends Omit<GlobalEventPoint, "coordinates"> {
  coordinates: [number, number] | null;
}
export type GlobalEventCandidate = GlobalEventRecord;
export type GlobalSituationEntry = GlobalEventRecord;

type JsonObject = Record<string, unknown>;

function nullableString(value: unknown): string | null {
  return value === null || value === undefined || value === "" ? null : String(value);
}

function safeHttpUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try { const url = new URL(value); return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password; } catch { return false; }
}

function nullableFiniteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function nullableInteger(value: unknown): number | null {
  const number = nullableFiniteNumber(value);
  return number !== null && Number.isInteger(number) ? number : null;
}

function lifecycle(value: unknown): GlobalEventLifecycle | null {
  return value === "published" || value === "archived" || value === "superseded" || value === "retracted"
    ? value
    : null;
}

function locationKind(value: unknown): GlobalEventLocationKind | null {
  return value === "event_point" || value === "city_center" || value === "country_center"
    ? value
    : null;
}

function pointCoordinates(value: unknown): [number, number] | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const geometry = value as JsonObject;
  if (geometry.type !== "Point" || !Array.isArray(geometry.coordinates)) return null;
  if (geometry.coordinates.length < 2) return null;
  const lng = geometry.coordinates[0];
  const lat = geometry.coordinates[1];
  if (typeof lng !== "number" || typeof lat !== "number" || !Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  if (lng < -180 || lng > 180 || lat < -90 || lat > 90) return null;
  return [lng, lat];
}

function parseGlobalEventFields(row: JsonObject): Omit<GlobalEventPoint, "coordinates"> {
  return {
    eventId: String(row.event_id ?? ""),
    versionId: String(row.version_id ?? ""),
    versionNo: nullableInteger(row.version_no),
    publicationNo: nullableInteger(row.publication_no),
    lifecycleState: lifecycle(row.lifecycle_state),
    eventPlaceId: String(row.event_place_id ?? ""),
    titleZhTw: String(row.title_zh_tw ?? "未命名事件"),
    summaryZhTw: nullableString(row.summary_zh_tw),
    category: nullableString(row.category),
    severity: nullableFiniteNumber(row.severity),
    confidence: nullableFiniteNumber(row.confidence),
    validFrom: nullableString(row.valid_from),
    publishedAt: nullableString(row.published_at),
    explicitValidTo: nullableString(row.explicit_valid_to),
    displayFrom: nullableString(row.display_from),
    displayTo: nullableString(row.display_to),
    placeKey: nullableString(row.place_key),
    placeName: nullableString(row.name),
    countryCode: nullableString(row.country_code),
    admin1: nullableString(row.admin1),
    admin2: nullableString(row.admin2),
    precision: nullableString(row.precision),
    locationSource: nullableString(row.location_source),
    displayPlaceId: nullableString(row.display_place_id),
    locationKind: locationKind(row.location_kind),
    isProxy: row.is_proxy === true,
    representativePrecision: nullableString(row.representative_precision),
    proxyForEventPlaceId: nullableString(row.proxy_for_event_place_id),
    locationLineage: nullableString(row.location_lineage),
  };
}

export function parseGlobalEventPoint(row: JsonObject): GlobalEventPoint | null {
  if (row.location_kind === "unknown") return null;
  const coordinates = pointCoordinates(row.geometry);
  return coordinates ? { ...parseGlobalEventFields(row), coordinates } : null;
}

/** List-safe formal record: unknown geometry is not a reason to discard the event. */
export function parseGlobalEventRecord(row: JsonObject): GlobalEventRecord {
  return { ...parseGlobalEventFields(row), coordinates: row.location_kind === "unknown" ? null : pointCoordinates(row.geometry) };
}

export function parseGlobalEventCandidate(row: JsonObject): GlobalEventCandidate {
  const id = String(row.candidate_id ?? "");
  const availableAt = nullableString(row.available_at);
  return {
    ...parseGlobalEventFields({ ...row, event_id: `candidate:${id}`, version_id: row.observation_sha256,
      event_place_id: `${id}/${row.place_key ?? "unlocated"}`, title_zh_tw: row.title_zh_tw ?? row.source_headline,
      valid_from: row.observed_at, published_at: null, display_from: row.display_from ?? availableAt, lifecycle_state: null,
      location_source: row.evidence_url, is_proxy: row.location_kind === "country_center" || row.location_kind === "city_center",
    }),
    coordinates: row.location_kind === "unknown" ? null : pointCoordinates(row.geometry), candidateId: id,
    researchStatus: String(row.research_status ?? "ai_assessed"),
    assessmentStatus: String(row.assessment_status ?? "pending"),
    decision: nullableString(row.decision), taiwanRelationship: nullableString(row.taiwan_relationship),
    taiwanImpactZhTw: nullableString(row.taiwan_impact_zh_tw), reasonZhTw: nullableString(row.reason_zh_tw),
    sourceUrls: Array.isArray(row.source_urls) ? [...new Set(row.source_urls.filter(safeHttpUrl))] : [],
    canonicalEventId: nullableString(row.canonical_event_id), linkedPublishedAt: nullableString(row.linked_published_at),
    availableAt, sourceHeadline: nullableString(row.source_headline),
    canonicalLatestLifecycle: lifecycle(row.canonical_latest_lifecycle), linkedEffectiveAt: nullableString(row.linked_effective_at),
    sourceKind: nullableString(row.source_kind), countryCodeScheme: nullableString(row.country_code_scheme),
    aiGroupId: typeof row.ai_group_id === "string" && /^aigroup_[a-f0-9]{24}$/.test(row.ai_group_id) ? row.ai_group_id : null,
  };
}

export interface GlobalEventCandidateWindow { rows: GlobalEventCandidate[]; totalCandidates: number }
async function fetchGlobalEventCandidatesWindowUncached(cacheKey: string): Promise<GlobalEventCandidateWindow> {
  if (!supabaseConfigured) throw new Error("Global Events Supabase is not configured");
  const [windowStart, requestedEnd] = cacheKey.split("|");
  const windowEnd = new Date(Math.min(Date.parse(requestedEnd ?? ""), Date.now())).toISOString();
  if (!windowStart || Date.parse(windowStart) >= Date.parse(windowEnd)) return { rows: [], totalCandidates: 0 };
  const rows: GlobalEventCandidate[] = [];
  let after: string | null = null;
  let totalCandidates = 0;
  for (;;) {
    const { data, error } = await withLoading(`global-events:candidates:${cacheKey}:${after ?? "first"}`, "全球情勢 AI 初判", supabase.rpc("get_global_event_candidates_window", {
      p_window_start: windowStart, p_window_end: windowEnd, p_limit_candidates: 200, p_after_candidate_id: after,
    }));
    if (error) throw new Error(`Supabase get_global_event_candidates_window: ${error.message}`);
    if (!data || typeof data !== "object" || Array.isArray(data) || !Array.isArray((data as JsonObject).rows)) {
      throw new Error("Global Events candidate window envelope is invalid");
    }
    const envelope = data as JsonObject;
    const page = envelope.rows as JsonObject[];
    rows.push(...page.map(parseGlobalEventCandidate));
    totalCandidates = Math.max(totalCandidates, Number(envelope.total_candidates ?? 0));
    if (envelope.has_more !== true) break;
    const next = nullableString(envelope.next_after_candidate_id);
    if (!next || (after !== null && next <= after)) throw new Error("Global Events candidate pagination did not advance");
    after = next;
  }
  return { rows, totalCandidates };
}
const candidateWindowCached = cachedByKey(fetchGlobalEventCandidatesWindowUncached, 5 * 60_000, 8);
export function fetchGlobalEventCandidatesWindow(start: string, end: string): Promise<GlobalEventCandidateWindow> {
  return candidateWindowCached(`${start}|${end}`);
}

export function selectGlobalSituationEntries(
  published: readonly GlobalEventRecord[], candidates: readonly GlobalEventCandidate[], asOfSeconds: number,
): GlobalSituationEntry[] {
  const publishedIds = new Set(published.map((row) => row.eventId));
  const eligible = candidates.filter((row) => {
    const available = Date.parse(row.displayFrom ?? row.availableAt ?? "");
    const end = row.displayTo === null ? null : Date.parse(row.displayTo);
    if (!Number.isFinite(available) || available > asOfSeconds * 1000 || (end !== null && (!Number.isFinite(end) || end <= asOfSeconds * 1000))) return false;
    return !(row.canonicalEventId && publishedIds.has(row.canonicalEventId));
  });
  const latest = new Map<string, GlobalEventCandidate>();
  for (const row of eligible) {
    const current = latest.get(row.eventId);
    if (!current || Date.parse(row.displayFrom ?? "") > Date.parse(current.displayFrom ?? "")) latest.set(row.eventId, row);
  }
  const activeCandidates = eligible.filter((row) => latest.get(row.eventId)?.versionId === row.versionId).map((row) => {
    const terminal = row.canonicalLatestLifecycle === "retracted" || row.canonicalLatestLifecycle === "superseded";
    const effective = Date.parse(row.linkedEffectiveAt ?? "");
    return terminal && Number.isFinite(effective) && effective <= asOfSeconds * 1000 ? { ...row, mapSuppressed: true } : row;
  });
  const groups = new Map<string, GlobalEventCandidate[]>();
  for (const row of activeCandidates) {
    const key = row.aiGroupId ? `candidate-group:${row.aiGroupId}` : row.eventId;
    const group = groups.get(key) ?? [];
    group.push(row); groups.set(key, group);
  }
  const grouped: GlobalEventCandidate[] = [];
  for (const [eventId, group] of groups) {
    if (!group[0]?.aiGroupId) { grouped.push(...group); continue; }
    const observations = [...new Map(group.map((row) => [row.candidateId!, row])).values()].sort((a, b) => a.candidateId!.localeCompare(b.candidateId!));
    const representative = observations[0]!;
    const versionId = observations.map((row) => row.versionId).join("+");
    const candidateIds = observations.map((row) => row.candidateId!);
    const sourceUrls = [...new Set(observations.flatMap((row) => row.sourceUrls ?? []))];
    const candidateAssessments = observations.map((row) => ({ candidateId: row.candidateId!, title: row.titleZhTw,
      decision: row.decision ?? null, taiwanRelationship: row.taiwanRelationship ?? null,
      taiwanImpact: row.taiwanImpactZhTw ?? null, reason: row.reasonZhTw ?? null }));
    for (const row of group) grouped.push({ ...row, eventId, versionId, titleZhTw: representative.titleZhTw,
      summaryZhTw: representative.summaryZhTw, candidateIds, sourceUrls, candidateAssessments });
  }
  return [...published, ...grouped];
}

async function fetchGlobalEventsCurrentUncached(): Promise<GlobalEventRecord[]> {
  if (!supabaseConfigured) throw new Error("Global Events Supabase is not configured");
  const { data, error } = await withLoading(
    "global-events:current",
    "全球重要事件",
    supabase.rpc("get_global_event_places_current", {
      p_category: null,
      p_before_published_at: null,
      p_limit: 100,
    }),
  );
  if (error) throw new Error(`Supabase get_global_event_places_current: ${error.message}`);
  return ((data ?? []) as JsonObject[]).map(parseGlobalEventRecord);
}

export const fetchGlobalEventsCurrent = cachedOnce(fetchGlobalEventsCurrentUncached, 5 * 60_000);

async function fetchGlobalEventsWindowUncached(cacheKey: string): Promise<GlobalEventRecord[]> {
  if (!supabaseConfigured) throw new Error("Global Events Supabase is not configured");
  const [windowStart, windowEnd] = cacheKey.split("|");
  if (!windowStart || !windowEnd) throw new Error("Global Events window key is invalid");
  const { data, error } = await withLoading(
    `global-events:window:${cacheKey}`,
    "全球重要事件歷史",
    supabase.rpc("get_global_event_places_window", {
      p_window_start: windowStart,
      p_window_end: windowEnd,
      p_category: null,
      p_limit_events: 100,
    }),
  );
  if (error) throw new Error(`Supabase get_global_event_places_window: ${error.message}`);
  return ((data ?? []) as JsonObject[]).map(parseGlobalEventRecord);
}

const fetchGlobalEventsWindowCached = cachedByKey(fetchGlobalEventsWindowUncached, 10 * 60_000, 8);

export function fetchGlobalEventsWindow(
  windowStart: string,
  windowEnd: string,
): Promise<GlobalEventRecord[]> {
  return fetchGlobalEventsWindowCached(`${windowStart}|${windowEnd}`);
}

function timestampMs(value: string | null): number | null {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function compareVersions(a: GlobalEventRecord, b: GlobalEventRecord): number {
  return (a.publicationNo ?? -1) - (b.publicationNo ?? -1)
    || (a.versionNo ?? -1) - (b.versionNo ?? -1)
    || (timestampMs(a.publishedAt) ?? -Infinity) - (timestampMs(b.publishedAt) ?? -Infinity)
    || a.versionId.localeCompare(b.versionId);
}

/**
 * 從 RPC 回傳的 immutable versions 選出時間軸時刻可見的版本。
 * 區間一律是 half-open [displayFrom, displayTo)；NULL displayTo 保持開放，
 * 不推測事件結束時間。每個 event 只取最高 publication_no 的 active version，
 * 但保留該版本的全部 place rows，讓跨國事件同時出現在多個國家。
 */
export function selectGlobalEventPlacesAt<T extends GlobalEventRecord>(
  events: readonly T[],
  timelineSeconds: number,
): T[] {
  if (!Number.isFinite(timelineSeconds)) return [];
  const timelineMs = timelineSeconds * 1000;
  const active = events.filter((event) => {
    const from = timestampMs(event.displayFrom);
    const to = timestampMs(event.displayTo);
    if (from === null || (event.displayTo !== null && to === null)) return false;
    return from <= timelineMs && (to === null || timelineMs < to);
  });

  const winnerByEvent = new Map<string, T>();
  for (const event of active) {
    const current = winnerByEvent.get(event.eventId);
    if (!current || compareVersions(event, current) > 0) winnerByEvent.set(event.eventId, event);
  }

  const winnerVersionByEvent = new Map<string, string>();
  for (const [eventId, event] of winnerByEvent) {
    if (event.lifecycleState === "published" || event.lifecycleState === "archived") {
      winnerVersionByEvent.set(eventId, event.versionId);
    }
  }
  return active.filter((event) => winnerVersionByEvent.get(event.eventId) === event.versionId);
}

export function globalEventsToGeoJSON(
  events: readonly GlobalEventPoint[],
  transitions: ReadonlyMap<string, GlobalEventTransitionKind> = new Map(),
): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: "FeatureCollection",
    features: events.map((event) => ({
      type: "Feature",
      id: event.displayPlaceId ?? event.eventPlaceId,
      geometry: { type: "Point", coordinates: event.coordinates },
      properties: {
        event_id: event.eventId,
        version_id: event.versionId,
        version_no: event.versionNo,
        publication_no: event.publicationNo,
        lifecycle_state: event.lifecycleState,
        event_place_id: event.eventPlaceId,
        title_zh_tw: event.titleZhTw,
        summary_zh_tw: event.summaryZhTw,
        category: event.category,
        severity: event.severity,
        confidence: event.confidence,
        valid_from: event.validFrom,
        published_at: event.publishedAt,
        explicit_valid_to: event.explicitValidTo,
        display_from: event.displayFrom,
        display_to: event.displayTo,
        place_key: event.placeKey,
        place_name: event.placeName,
        country_code: event.countryCode,
        admin1: event.admin1,
        admin2: event.admin2,
        precision: event.precision,
        location_source: event.locationSource,
        display_place_id: event.displayPlaceId,
        location_kind: event.locationKind,
        is_proxy: event.isProxy,
        representative_precision: event.representativePrecision,
        proxy_for_event_place_id: event.proxyForEventPlaceId,
        location_lineage: event.locationLineage,
        research_status: event.candidateId ? "ai_assessed" : "published",
        assessment_status: event.assessmentStatus ?? null,
        decision: event.decision ?? null,
        taiwan_relationship: event.taiwanRelationship ?? null,
        taiwan_impact_zh_tw: event.taiwanImpactZhTw ?? null,
        reason_zh_tw: event.reasonZhTw ?? null,
        source_urls: JSON.stringify(event.sourceUrls ?? []),
        source_headline: event.sourceHeadline ?? null,
        source_kind: event.sourceKind ?? null,
        country_code_scheme: event.countryCodeScheme ?? null,
        candidate_ids: JSON.stringify(event.candidateIds ?? []),
        candidate_assessments: JSON.stringify(event.candidateAssessments ?? []),
        transition_kind: transitions.get(event.eventId) ?? null,
      },
    })),
  };
}
