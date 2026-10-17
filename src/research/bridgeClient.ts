import type { TimelineChange } from "./timelineControl";
export const RESEARCH_API_PREFIX = "/api/research/v1";
export const BRIDGE_TIMEOUT_MS = 8_000;
export const MAX_BRIDGE_RESPONSE_BYTES = 32 * 1024;
export const MAX_NETWORK_PROVIDER_RESPONSE_BYTES = 2 * 1024 * 1024;
/** P1 result channel (SPEC-prod-connect §2.3, §2.8): GET bytes ≤24 MiB within 30 s; meta ≤288 KiB. */
export const RESULT_FETCH_TIMEOUT_MS = 30_000;
export const MAX_RESULT_BYTES = 24 * 1024 * 1024;
export const QUERY_TRANSPORT_LIMIT_BYTES = 288 * 1024;
/**
 * P2 long poll (SPEC-prod-connect §2.4, §2.8). Must hold:
 * hold 20 s < gateway timer 25 s < bridge wait 27 s < nginx 30 s < Cloudflare ~100 s,
 * and hold 20 s < the 45 s browser-activity window refreshed by every wait.
 */
export const BROWSER_WAIT_HOLD_MS = 20_000;
export const BRIDGE_WAIT_TIMEOUT_MS = 27_000;
export type BrowserWaitEnvelope = { version: string; snapshot: StudyState; request: BrowserQuery | null; agent: { deviceLabel: string | null } };
export type WarehouseResultMeta = { resultId: string; sha256: string; bytes: number; label: string; featureCount: number; style: Record<string, unknown> | null };
export type WarehouseResultsMeta = { results: WarehouseResultMeta[]; missing: string[] };
const STUDY_ID = /^[a-f0-9]{32}$/;
const TAB_ID = /^[A-Za-z0-9._-]{1,128}$/;
/** Session results may be split per geometry (`wh-3:point`); the gateway stores the base id. */
export function warehouseBaseResultId(resultId: string): string | null {
  const match = /^(wh-[0-9]{1,6})(?::[a-z]+)?$/.exec(resultId);
  return match ? match[1]! : null;
}

export type LayerControlValue = number | boolean | string | string[];
export type LayerControlScene = { layerKey: string; controlId: string; value: LayerControlValue; expectedValue: LayerControlValue };
export type ViewportFraming = { bounds: [number, number, number, number]; padding: number; maxZoom: number };
export type ResultCollectionItem = { resultId: string; visible: boolean; groupId: string | null };
export type ResultCollectionGroup = { groupId: string; label: string; visible: boolean };
/** Ordered transient result stack. An item is rendered only when it and its group are visible. */
export type ResultCollection = { items: ResultCollectionItem[]; groups: ResultCollectionGroup[] };
export type Scene = { framing?: ViewportFraming | null; timeline?: TimelineChange | null; camera: { center: [number, number]; zoom: number }; resultMode: "empty" | "synthetic"; layers?: Record<string, boolean>; layerControl?: LayerControlScene | null; nearby?: { queryId: string } | null; results?: ResultCollection | null; focus?: { resultId: string; recordId: string } | null };
export type Command = { protocolVersion: "1"; sessionId: string; studyId: string; tabId: string; commandId: string; expectedRevision: number; expiresAt: number; patch: Partial<Scene> };
export type StudyState = { studyId: string; tabId: string; revision: number; scene: Scene; view: { revision: number; phase: "empty" | "applied" | "ready" | "error" }; connected: boolean; paused: boolean; pendingCommand: Command | null };
/** P3 agent tokens (SPEC-prod-connect §2.5): the secret appears only in the create response. */
export type CreatedAgentToken = { tokenId: string; token: string; label: string; createdAt: number; expiresAt: number };
export type AgentTokenSummary = { tokenId: string; label: string; createdAt: number; expiresAt: number; lastUsedAt: number | null; activeSessions: number };
export type BrowserSessionStatus = {
  studyId: string;
  tabId: string;
  session: { active: boolean; sessionId: string | null; expiresAt: number | null; hardExpiresAt: number | null };
  snapshot: StudyState;
};
export type BridgeConnectionContext = { client: BridgeClient; studyId: string; tabId: string };
export type AccessTokenProvider = () => Promise<string | null>;

export class BridgeError extends Error {
  constructor(public readonly code: string, public readonly retryAfterMs: number | null = null) { super(code); }
}

export class BridgeClient {
  constructor(private readonly getAccessToken: AccessTokenProvider, private readonly fetcher: typeof fetch = (input, init) => fetch(input, init)) {}

  async createStudy(tabId: string): Promise<{ studyId: string; tabId: string }> { return this.post("/studies", { tabId }, isStudyRef); }
  async browserStatus(studyId: string, tabId: string): Promise<BrowserSessionStatus> { return normalizeBrowserSessionStatus(await this.post("/browser/status", { studyId, tabId }, isBrowserSessionStatus)); }
  async sync(studyId: string, tabId: string): Promise<StudyState> { return normalizeStudyState(await this.post("/browser/sync", { studyId, tabId }, isStudyState)); }
  async manual(studyId: string, tabId: string, expectedRevision: number, scene: Scene): Promise<StudyState> { return normalizeStudyState(await this.post("/browser/manual", { studyId, tabId, expectedRevision, scene }, isStudyState)); }
  async ack(studyId: string, tabId: string, commandId: string, expectedRevision: number): Promise<StudyState> { return normalizeStudyState(await this.post("/browser/ack", { studyId, tabId, commandId, expectedRevision }, isStudyState)); }
  async report(studyId: string, tabId: string, revision: number, phase: "ready" | "error"): Promise<StudyState> { return normalizeStudyState(await this.post("/browser/report", { studyId, tabId, revision, phase }, isStudyState)); }
  async pause(studyId: string, tabId: string, paused: boolean): Promise<StudyState> { return normalizeStudyState(await this.post("/browser/pause", { studyId, tabId, paused }, isStudyState)); }
  async queryResult(studyId: string, tabId: string, requestId: string, result: QueryResult): Promise<void> { await this.post("/browser/query-result", { studyId, tabId, requestId, result }, isAnyResponse); }
  async networkProvider(studyId: string, tabId: string, operation: "route_distance" | "walking_isochrone", args: Record<string, unknown>): Promise<{ graph: Record<string, unknown>; payload: Record<string, unknown> }> {
    return this.post("/browser/network-provider", { studyId, tabId, operation, args }, isNetworkProviderResponse, MAX_NETWORK_PROVIDER_RESPONSE_BYTES);
  }
  /** Single long poll replacing the 3 s sync loop and the /browser/query loop. */
  async wait(studyId: string, tabId: string, knownVersion: string | null, inFlightRequestId: string | null, acceptQueries: boolean, waitMs = BROWSER_WAIT_HOLD_MS): Promise<BrowserWaitEnvelope> {
    const envelope = await this.post("/browser/wait", { studyId, tabId, knownVersion, inFlightRequestId, acceptQueries, waitMs }, isWaitEnvelope, QUERY_TRANSPORT_LIMIT_BYTES, BRIDGE_WAIT_TIMEOUT_MS);
    return { ...envelope, snapshot: normalizeStudyState(envelope.snapshot) };
  }
  async revoke(studyId: string): Promise<void> { await this.post("/studies/revoke", { studyId }, isAnyResponse); }
  async createAgentToken(label: string): Promise<CreatedAgentToken> { return this.post("/agent-tokens/create", { label }, isCreatedAgentToken); }
  async listAgentTokens(): Promise<AgentTokenSummary[]> { return (await this.post("/agent-tokens/list", {}, isAgentTokenList)).tokens; }
  async revokeAgentToken(tokenId: string): Promise<void> { await this.post("/agent-tokens/revoke", { tokenId }, isTokenRevoked); }
  /** Raw GeoJSON text of an uploaded warehouse result. Integrity is checked by the caller against the relay sha256, never the X-Result-Sha256 header. */
  async fetchResult(studyId: string, tabId: string, resultId: string): Promise<string> {
    const baseId = warehouseBaseResultId(resultId);
    if (!STUDY_ID.test(studyId) || !TAB_ID.test(tabId) || !baseId) throw new BridgeError("INVALID_INPUT");
    return this.request(`/browser/results/${studyId}/${tabId}/${baseId}`, { method: "GET" }, RESULT_FETCH_TIMEOUT_MS, MAX_RESULT_BYTES, (response, text) => {
      if (response.ok) return text;
      throw new BridgeError(errorCode(parseJson(text)), retryAfterMs(response));
    });
  }
  async resultsMeta(studyId: string, tabId: string, resultIds: string[]): Promise<WarehouseResultsMeta> {
    return this.post("/browser/results/meta", { studyId, tabId, resultIds }, isResultsMeta, QUERY_TRANSPORT_LIMIT_BYTES);
  }

  private async post<T>(path: string, body: Record<string, unknown>, guard: (value: unknown) => value is T, maxResponseBytes = MAX_BRIDGE_RESPONSE_BYTES, timeoutMs = BRIDGE_TIMEOUT_MS): Promise<T> {
    return this.request(path, { method: "POST", body: JSON.stringify(body) }, timeoutMs, maxResponseBytes, (response, text) => {
      let payload: unknown;
      try { payload = text ? JSON.parse(text) : {}; } catch { throw new BridgeError("INVALID_RESPONSE"); }
      if (!response.ok) throw new BridgeError(errorCode(payload), retryAfterMs(response));
      if (!guard(payload)) throw new BridgeError("INVALID_RESPONSE");
      return payload;
    });
  }

  private async request<T>(path: string, init: { method: "GET" | "POST"; body?: string }, timeoutMs: number, maxResponseBytes: number, read: (response: Response, text: string) => T): Promise<T> {
    const token = await this.getAccessToken();
    if (!token) throw new BridgeError("AUTH_REQUIRED");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const headers: Record<string, string> = init.body === undefined ? { authorization: `Bearer ${token}` } : { "content-type": "application/json", authorization: `Bearer ${token}` };
      const response = await this.fetcher(`${RESEARCH_API_PREFIX}${path}`, { method: init.method, redirect: "error", cache: "no-store", signal: controller.signal, headers, ...(init.body === undefined ? {} : { body: init.body }) });
      const text = await boundedText(response, maxResponseBytes);
      return read(response, text);
    } catch (error) {
      if (error instanceof BridgeError) throw error;
      if (controller.signal.aborted) throw new BridgeError("REQUEST_TIMEOUT");
      throw new BridgeError("BRIDGE_UNAVAILABLE");
    } finally { clearTimeout(timer); }
  }
}

function parseJson(text: string): unknown { try { return text ? JSON.parse(text) : {}; } catch { return {}; } }

async function boundedText(response: Response, maxBytes: number): Promise<string> {
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) { await response.body?.cancel().catch(() => undefined); throw new BridgeError("RESPONSE_TOO_LARGE"); }
  const reader = response.body?.getReader();
  if (!reader) return response.text();
  const chunks: Uint8Array[] = []; let size = 0;
  while (true) { const next = await reader.read(); if (next.done) break; size += next.value.byteLength; if (size > maxBytes) { await reader.cancel(); throw new BridgeError("RESPONSE_TOO_LARGE"); } chunks.push(next.value); }
  return new TextDecoder().decode(concat(chunks, size));
}
function concat(chunks: Uint8Array[], size: number): Uint8Array { const output = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { output.set(chunk, offset); offset += chunk.byteLength; } return output; }
function errorCode(value: unknown): string { const code = isObject(value) && isObject(value.error) && typeof value.error.code === "string" ? value.error.code : "BRIDGE_REQUEST_FAILED"; return /^[A-Z_]{1,64}$/.test(code) ? code : "BRIDGE_REQUEST_FAILED"; }
function retryAfterMs(response: Response): number | null {
  const value = response.headers.get("retry-after");
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(Math.round(seconds * 1_000), 60_000);
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.min(Math.max(0, date - Date.now()), 60_000) : null;
}
function isObject(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
function isStudyRef(value: unknown): value is { studyId: string; tabId: string } { return isObject(value) && safeId(value.studyId) && safeId(value.tabId); }
const TOKEN_ID = /^[a-f0-9]{32}$/;
function isTokenLabel(value: unknown): value is string { return typeof value === "string" && value.length >= 1 && value.length <= 40; }
function isCreatedAgentToken(value: unknown): value is CreatedAgentToken {
  return exactObject(value, ["tokenId", "token", "label", "createdAt", "expiresAt"]) && typeof value.tokenId === "string" && TOKEN_ID.test(value.tokenId) && typeof value.token === "string" && /^pat_[A-Za-z0-9_-]{43}$/.test(value.token) && isTokenLabel(value.label) && typeof value.createdAt === "number" && nullableTime(value.createdAt) && typeof value.expiresAt === "number" && nullableTime(value.expiresAt);
}
function isAgentTokenSummary(value: unknown): value is AgentTokenSummary {
  return exactObject(value, ["tokenId", "label", "createdAt", "expiresAt", "lastUsedAt", "activeSessions"]) && typeof value.tokenId === "string" && TOKEN_ID.test(value.tokenId) && isTokenLabel(value.label) && typeof value.createdAt === "number" && nullableTime(value.createdAt) && typeof value.expiresAt === "number" && nullableTime(value.expiresAt) && nullableTime(value.lastUsedAt) && isNonnegativeInteger(value.activeSessions);
}
function isAgentTokenList(value: unknown): value is { tokens: AgentTokenSummary[] } { return exactObject(value, ["tokens"]) && Array.isArray(value.tokens) && value.tokens.length <= 50 && value.tokens.every(isAgentTokenSummary); }
function isTokenRevoked(value: unknown): value is { revoked: true } { return exactObject(value, ["revoked"]) && value.revoked === true; }
function safeId(value: unknown): value is string { return typeof value === "string" && /^[A-Za-z0-9._-]{1,128}$/.test(value); }
function isAnyResponse(_value: unknown): _value is unknown { return true; }
function isResultMeta(value: unknown): value is WarehouseResultMeta {
  return exactObject(value, ["resultId", "sha256", "bytes", "label", "featureCount", "style"]) && typeof value.resultId === "string" && /^wh-[0-9]{1,6}$/.test(value.resultId) && typeof value.sha256 === "string" && /^[a-f0-9]{64}$/.test(value.sha256) && isNonnegativeInteger(value.bytes) && typeof value.label === "string" && isNonnegativeInteger(value.featureCount) && (value.style === null || isObject(value.style));
}
function isResultsMeta(value: unknown): value is WarehouseResultsMeta {
  return exactObject(value, ["results", "missing"]) && Array.isArray(value.results) && value.results.length <= 8 && value.results.every(isResultMeta) && Array.isArray(value.missing) && value.missing.length <= 8 && value.missing.every(item => typeof item === "string" && /^wh-[0-9]{1,6}$/.test(item));
}
function isNetworkProviderResponse(value: unknown): value is { graph: Record<string, unknown>; payload: Record<string, unknown> } { return exactObject(value, ["graph", "payload"]) && isObject(value.graph) && isObject(value.payload); }
function exactObject(value: unknown, keys: string[]): value is Record<string, unknown> { return isObject(value) && Object.keys(value).length === keys.length && keys.every((key) => key in value); }
function isScene(value: unknown): value is Scene { return isObject(value) && Object.keys(value).every(key => ["camera", "resultMode", "layers", "layerControl", "framing", "timeline", "nearby", "results", "focus"].includes(key)) && (value.layers === undefined || isLayers(value.layers)) && (value.framing === undefined || isFraming(value.framing)) && (value.timeline === undefined || isTimeline(value.timeline)) && (value.layerControl === undefined || isLayerControl(value.layerControl)) && (value.nearby === undefined || isNearby(value.nearby)) && (value.results === undefined || isResults(value.results)) && (value.focus === undefined || isFocus(value.focus)) && exactObject(value.camera, ["center", "zoom"]) && Array.isArray(value.camera.center) && value.camera.center.length === 2 && value.camera.center.every((part) => typeof part === "number" && Number.isFinite(part)) && value.camera.center[0] >= -180 && value.camera.center[0] <= 180 && value.camera.center[1] >= -85 && value.camera.center[1] <= 85 && typeof value.camera.zoom === "number" && Number.isFinite(value.camera.zoom) && value.camera.zoom >= 0 && value.camera.zoom <= 18 && (value.resultMode === "empty" || value.resultMode === "synthetic"); }
function isPatch(value: unknown): value is Partial<Scene> { return isObject(value) && Object.keys(value).length >= 1 && Object.keys(value).every((key) => key === "camera" || key === "resultMode" || key === "layers" || key === "framing" || key === "timeline" || key === "layerControl" || key === "nearby" || key === "results" || key === "focus") && (value.camera === undefined || (exactObject(value.camera, ["center", "zoom"]) && Array.isArray(value.camera.center) && value.camera.center.length === 2 && value.camera.center.every((part) => typeof part === "number" && Number.isFinite(part)) && value.camera.center[0] >= -180 && value.camera.center[0] <= 180 && value.camera.center[1] >= -85 && value.camera.center[1] <= 85 && typeof value.camera.zoom === "number" && Number.isFinite(value.camera.zoom) && value.camera.zoom >= 0 && value.camera.zoom <= 18)) && (value.layers === undefined || isLayers(value.layers)) && (value.framing === undefined || isFraming(value.framing)) && (value.timeline === undefined || isTimeline(value.timeline)) && (value.layerControl === undefined || isLayerControl(value.layerControl)) && (value.nearby === undefined || isNearby(value.nearby)) && (value.results === undefined || isResults(value.results)) && (value.focus === undefined || isFocus(value.focus)) && (value.resultMode === undefined || value.resultMode === "empty" || value.resultMode === "synthetic"); }
function isCommand(value: unknown): value is Command { return exactObject(value, ["protocolVersion", "sessionId", "studyId", "tabId", "commandId", "expectedRevision", "expiresAt", "patch"]) && value.protocolVersion === "1" && safeId(value.sessionId) && safeId(value.studyId) && safeId(value.tabId) && safeId(value.commandId) && isNonnegativeInteger(value.expectedRevision) && typeof value.expiresAt === "number" && Number.isFinite(value.expiresAt) && isPatch(value.patch); }
function isNonnegativeInteger(value: unknown): value is number { return typeof value === "number" && Number.isInteger(value) && value >= 0; }
function isStudyState(value: unknown): value is StudyState { return exactObject(value, ["studyId", "tabId", "revision", "scene", "view", "connected", "paused", "pendingCommand"]) && safeId(value.studyId) && safeId(value.tabId) && isNonnegativeInteger(value.revision) && isScene(value.scene) && exactObject(value.view, ["revision", "phase"]) && isNonnegativeInteger(value.view.revision) && (value.view.phase === "empty" || value.view.phase === "applied" || value.view.phase === "ready" || value.view.phase === "error") && typeof value.connected === "boolean" && typeof value.paused === "boolean" && (value.pendingCommand === null || isCommand(value.pendingCommand)); }
function isBrowserSessionStatus(value: unknown): value is BrowserSessionStatus {
  return exactObject(value, ["studyId", "tabId", "session", "snapshot"]) && safeId(value.studyId) && safeId(value.tabId) && isObject(value.session) && exactObject(value.session, ["active", "sessionId", "expiresAt", "hardExpiresAt"]) && typeof value.session.active === "boolean" && nullableSafeId(value.session.sessionId) && nullableTime(value.session.expiresAt) && nullableTime(value.session.hardExpiresAt) && (value.session.active ? safeId(value.session.sessionId) && typeof value.session.expiresAt === "number" && typeof value.session.hardExpiresAt === "number" : value.session.sessionId === null && value.session.expiresAt === null && value.session.hardExpiresAt === null) && isStudyState(value.snapshot) && value.snapshot.studyId === value.studyId && value.snapshot.tabId === value.tabId;
}
function nullableSafeId(value: unknown): value is string | null { return value === null || safeId(value); }
function nullableTime(value: unknown): value is number | null { return value === null || typeof value === "number" && Number.isFinite(value) && value >= 0; }

function isLayers(value: unknown): value is Record<string, boolean> { return isObject(value) && Object.keys(value).length <= 20 && Object.entries(value).every(([key, on]) => /^[A-Za-z][A-Za-z0-9_]{0,79}$/.test(key) && !["__proto__", "constructor", "prototype"].includes(key) && typeof on === "boolean"); }

export type BrowserQuery = { requestId: string; operation: "time_context" | "search_layers" | "layer_details" | "describe_layer" | "describe_layer_statistics" | "summarize_layer" | "list_layer_capabilities" | "search_layer_records" | "layer_controls" | "geocode_address" | "read_layer" | "map_context" | "find_places" | "nearby" | "explore_data" | "compare_neighborhoods" | "search_datasets" | "describe_dataset" | "query_records" | "plan_data_access" | "materialize_data" | "import_warehouse_result" | "analysis_card_draft" | "create_analysis_scope" | "spatial_query" | "aggregate_by_area" | "route_distance" | "walking_isochrone" | "aggregate_records" | "join_records" | "calculate_metric" | "read_series" | "compare_series" | "compare_regions" | "get_data_quality" | "get_record_evidence" | "get_analysis_result" | "get_result_bounds" | "list_results" | "remove_result"; args: Record<string, unknown>; expiresAt: number };
export type QueryResult = { ok: true; data: Record<string, unknown> } | { ok: false; error: string };
function isNearby(value: unknown): value is { queryId: string } | null { return value === null || exactObject(value, ["queryId"]) && safeId(value.queryId); }
type LegacyResultCollection = { resultIds: string[] };
type ResultCollectionInput = ResultCollection | LegacyResultCollection | null;
const RESULT_ID = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$/;
function isResultCollectionItem(value: unknown): value is ResultCollectionItem { return exactObject(value, ["resultId", "visible", "groupId"]) && typeof value.resultId === "string" && RESULT_ID.test(value.resultId) && typeof value.visible === "boolean" && (value.groupId === null || safeId(value.groupId)); }
function isResultCollectionGroup(value: unknown): value is ResultCollectionGroup { return exactObject(value, ["groupId", "label", "visible"]) && safeId(value.groupId) && typeof value.label === "string" && value.label.length >= 1 && value.label.length <= 120 && typeof value.visible === "boolean"; }
function isLegacyResultCollection(value: unknown): value is LegacyResultCollection { return exactObject(value, ["resultIds"]) && Array.isArray(value.resultIds) && value.resultIds.length >= 1 && value.resultIds.length <= 8 && new Set(value.resultIds).size === value.resultIds.length && value.resultIds.every(item => typeof item === "string" && RESULT_ID.test(item)); }
function isCanonicalResultCollection(value: unknown): value is ResultCollection {
  if (!exactObject(value, ["items", "groups"]) || !Array.isArray(value.items) || !Array.isArray(value.groups) || value.items.length < 1 || value.items.length > 8 || value.groups.length > 8 || !value.items.every(isResultCollectionItem) || !value.groups.every(isResultCollectionGroup)) return false;
  const resultIds = new Set(value.items.map(item => item.resultId));
  const groupIds = new Set(value.groups.map(group => group.groupId));
  return resultIds.size === value.items.length && groupIds.size === value.groups.length && value.items.every(item => item.groupId === null || groupIds.has(item.groupId));
}
function isResults(value: unknown): value is ResultCollectionInput { return value === null || isLegacyResultCollection(value) || isCanonicalResultCollection(value); }
/** Converts older `{resultIds}` scenes at the browser boundary; all locally emitted scenes are canonical. */
export function normalizeResultCollection(value: ResultCollectionInput | undefined): ResultCollection | null | undefined {
  if (value === undefined || value === null || isCanonicalResultCollection(value)) return value;
  return { items: value.resultIds.map(resultId => ({ resultId, visible: true, groupId: null })), groups: [] };
}
export function visibleResultIds(collection: ResultCollection | null | undefined): string[] {
  if (!collection) return [];
  const groups = new Map(collection.groups.map(group => [group.groupId, group]));
  return collection.items.filter(item => item.visible && (item.groupId === null || groups.get(item.groupId)?.visible === true)).map(item => item.resultId);
}
function normalizeScene(scene: Scene): Scene { return { ...scene, results: normalizeResultCollection(scene.results as ResultCollectionInput | undefined) }; }
function normalizeCommand(command: Command): Command { return { ...command, patch: "results" in command.patch ? { ...command.patch, results: normalizeResultCollection(command.patch.results as ResultCollectionInput | undefined) } : command.patch }; }
function normalizeStudyState(state: StudyState): StudyState { return { ...state, scene: normalizeScene(state.scene), pendingCommand: state.pendingCommand ? normalizeCommand(state.pendingCommand) : null }; }
function normalizeBrowserSessionStatus(status: BrowserSessionStatus): BrowserSessionStatus { return { ...status, snapshot: normalizeStudyState(status.snapshot) }; }
function isWaitEnvelope(value: unknown): value is BrowserWaitEnvelope {
  return exactObject(value, ["version", "snapshot", "request", "agent"]) && typeof value.version === "string" && /^[a-f0-9]{16}$/.test(value.version) && isStudyState(value.snapshot) && (value.request === null || isBrowserQuery(value.request)) && exactObject(value.agent, ["deviceLabel"]) && (value.agent.deviceLabel === null || typeof value.agent.deviceLabel === "string" && value.agent.deviceLabel.length <= 80);
}
function isBrowserQuery(request: unknown): request is BrowserQuery {
  return exactObject(request, ["requestId", "operation", "args", "expiresAt"]) && safeId(request.requestId) && typeof request.operation === "string" && ["time_context", "layer_details", "layer_controls", "geocode_address", "explore_data", "compare_neighborhoods", "search_layers", "describe_layer", "describe_layer_statistics", "summarize_layer", "list_layer_capabilities", "search_layer_records", "read_layer", "map_context", "find_places", "nearby", "search_datasets", "describe_dataset", "query_records", "plan_data_access", "materialize_data", "import_warehouse_result", "analysis_card_draft", "create_analysis_scope", "spatial_query", "aggregate_by_area", "route_distance", "walking_isochrone", "aggregate_records", "join_records", "calculate_metric", "read_series", "compare_series", "compare_regions", "get_data_quality", "get_record_evidence", "get_analysis_result", "get_result_bounds", "list_results", "remove_result"].includes(request.operation) && isObject(request.args) && typeof request.expiresAt === "number" && Number.isFinite(request.expiresAt);
}

function isFocus(value: unknown): boolean { return value === null || exactObject(value, ["resultId", "recordId"]) && [value.resultId, value.recordId].every(item => typeof item === "string" && /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$/.test(item)); }
function isLayerControlValue(value: unknown): value is LayerControlValue { return typeof value === "boolean" || typeof value === "string" || typeof value === "number" && Number.isFinite(value) || Array.isArray(value) && value.length <= 100 && value.every(item => typeof item === "string" && item.length <= 160); }
function isLayerControl(value: unknown): value is LayerControlScene | null { return value === null || exactObject(value, ["layerKey", "controlId", "value", "expectedValue"]) && safeId(value.layerKey) && safeId(value.controlId) && isLayerControlValue(value.value) && isLayerControlValue(value.expectedValue); }

function isFraming(value: unknown): value is ViewportFraming | null {
  if (value === null) return true;
  if (!exactObject(value, ["bounds", "padding", "maxZoom"])) return false;
  const b = value.bounds;
  return Array.isArray(b) && b.length === 4 && b.every(v => typeof v === "number" && Number.isFinite(v)) && b[0] >= -180 && b[2] <= 180 && b[1] >= -85 && b[3] <= 85 && b[0] <= b[2] && b[1] <= b[3] && typeof value.padding === "number" && value.padding >= 0 && value.padding <= 200 && typeof value.maxZoom === "number" && value.maxZoom >= 0 && value.maxZoom <= 18;
}
function isTimeline(value: unknown): value is TimelineChange | null {
  if (value === null) return true;
  return isObject(value) && Object.keys(value).every(k => ["mode","time","playing","speed"].includes(k)) && (value.mode === "live" ? value.time === undefined && value.playing !== true : value.mode === "replay" && typeof value.time === "number" && Number.isFinite(value.time) && value.time >= 0 && value.time <= 4102444800) && (value.playing === undefined || typeof value.playing === "boolean") && (value.speed === undefined || typeof value.speed === "number" && [30,60,120,300,600,1800,3600].includes(value.speed));
}
