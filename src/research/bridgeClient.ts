import type { TimelineChange } from "./timelineControl";
export const RESEARCH_API_PREFIX = "/api/research/v1";
export const BRIDGE_TIMEOUT_MS = 8_000;
export const MAX_BRIDGE_RESPONSE_BYTES = 32 * 1024;

export type LayerControlValue = number | boolean | string | string[];
export type LayerControlScene = { layerKey: string; controlId: string; value: LayerControlValue; expectedValue: LayerControlValue };
export type ViewportFraming = { bounds: [number, number, number, number]; padding: number; maxZoom: number };
export type Scene = { framing?: ViewportFraming | null; timeline?: TimelineChange | null; camera: { center: [number, number]; zoom: number }; resultMode: "empty" | "synthetic"; layers?: Record<string, boolean>; layerControl?: LayerControlScene | null; nearby?: { queryId: string } | null; results?: { resultIds: string[] } | null; focus?: { resultId: string; recordId: string } | null };
export type Command = { protocolVersion: "1"; sessionId: string; studyId: string; tabId: string; commandId: string; expectedRevision: number; expiresAt: number; patch: Partial<Scene> };
export type StudyState = { studyId: string; tabId: string; revision: number; scene: Scene; view: { revision: number; phase: "empty" | "applied" | "ready" | "error" }; connected: boolean; paused: boolean; pendingCommand: Command | null };
export type PairingRequest = { pairingId: string; code: string; expiresAt: string | number };
export type PairingStatus = { pairingId: string; claimed: boolean; approved: boolean; deviceLabel: string | null; phrase: string | null };
export type BrowserSessionStatus = {
  studyId: string;
  tabId: string;
  session: { active: boolean; sessionId: string | null; expiresAt: number | null; hardExpiresAt: number | null };
  snapshot: StudyState;
};
export type BridgeConnectionContext = { client: BridgeClient; studyId: string; tabId: string; pairingId: string };
export type AccessTokenProvider = () => Promise<string | null>;

export class BridgeError extends Error {
  constructor(public readonly code: string, public readonly retryAfterMs: number | null = null) { super(code); }
}

export class BridgeClient {
  constructor(private readonly getAccessToken: AccessTokenProvider, private readonly fetcher: typeof fetch = (input, init) => fetch(input, init)) {}

  async createStudy(tabId: string): Promise<{ studyId: string; tabId: string }> { return this.post("/studies", { tabId }, isStudyRef); }
  async createPairing(studyId: string, tabId: string): Promise<PairingRequest> { return this.post("/pairings", { studyId, tabId }, isPairingRequest); }
  async pairingStatus(pairingId: string, tabId: string): Promise<PairingStatus> { return this.post("/pairings/status", { pairingId, tabId }, isPairingStatus); }
  async browserStatus(studyId: string, tabId: string): Promise<BrowserSessionStatus> { return this.post("/browser/status", { studyId, tabId }, isBrowserSessionStatus); }
  async approve(pairingId: string, tabId: string, phrase: string): Promise<void> { await this.post("/pairings/approve", { pairingId, tabId, phrase }, isAnyResponse); }
  async sync(studyId: string, tabId: string): Promise<StudyState> { return this.post("/browser/sync", { studyId, tabId }, isStudyState); }
  async manual(studyId: string, tabId: string, expectedRevision: number, scene: Scene): Promise<StudyState> { return this.post("/browser/manual", { studyId, tabId, expectedRevision, scene }, isStudyState); }
  async ack(studyId: string, tabId: string, commandId: string, expectedRevision: number): Promise<StudyState> { return this.post("/browser/ack", { studyId, tabId, commandId, expectedRevision }, isStudyState); }
  async report(studyId: string, tabId: string, revision: number, phase: "ready" | "error"): Promise<StudyState> { return this.post("/browser/report", { studyId, tabId, revision, phase }, isStudyState); }
  async pause(studyId: string, tabId: string, paused: boolean): Promise<StudyState> { return this.post("/browser/pause", { studyId, tabId, paused }, isStudyState); }
  async query(studyId: string, tabId: string): Promise<{ request: BrowserQuery | null }> { return this.post("/browser/query", { studyId, tabId }, isQueryEnvelope); }
  async queryResult(studyId: string, tabId: string, requestId: string, result: QueryResult): Promise<void> { await this.post("/browser/query-result", { studyId, tabId, requestId, result }, isAnyResponse); }
  async revoke(studyId: string): Promise<void> { await this.post("/studies/revoke", { studyId }, isAnyResponse); }

  private async post<T>(path: string, body: Record<string, unknown>, guard: (value: unknown) => value is T): Promise<T> {
    const token = await this.getAccessToken();
    if (!token) throw new BridgeError("AUTH_REQUIRED");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), BRIDGE_TIMEOUT_MS);
    try {
      const response = await this.fetcher(`${RESEARCH_API_PREFIX}${path}`, { method: "POST", redirect: "error", cache: "no-store", signal: controller.signal, headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
      const text = await boundedText(response);
      let payload: unknown;
      try { payload = text ? JSON.parse(text) : {}; } catch { throw new BridgeError("INVALID_RESPONSE"); }
      if (!response.ok) throw new BridgeError(errorCode(payload), retryAfterMs(response));
      if (!guard(payload)) throw new BridgeError("INVALID_RESPONSE");
      return payload;
    } catch (error) {
      if (error instanceof BridgeError) throw error;
      if (controller.signal.aborted) throw new BridgeError("REQUEST_TIMEOUT");
      throw new BridgeError("BRIDGE_UNAVAILABLE");
    } finally { clearTimeout(timer); }
  }
}

async function boundedText(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return response.text();
  const chunks: Uint8Array[] = []; let size = 0;
  while (true) { const next = await reader.read(); if (next.done) break; size += next.value.byteLength; if (size > MAX_BRIDGE_RESPONSE_BYTES) { await reader.cancel(); throw new BridgeError("RESPONSE_TOO_LARGE"); } chunks.push(next.value); }
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
function isPairingRequest(value: unknown): value is PairingRequest { return isObject(value) && safeId(value.pairingId) && typeof value.code === "string" && value.code.length === 8 && (typeof value.expiresAt === "string" || typeof value.expiresAt === "number"); }
function isPairingStatus(value: unknown): value is PairingStatus { return exactObject(value, ["pairingId", "claimed", "approved", "deviceLabel", "phrase"]) && safeId(value.pairingId) && typeof value.claimed === "boolean" && typeof value.approved === "boolean" && nullableText(value.deviceLabel) && nullableText(value.phrase); }
function safeId(value: unknown): value is string { return typeof value === "string" && /^[A-Za-z0-9._-]{1,128}$/.test(value); }
function isAnyResponse(_value: unknown): _value is unknown { return true; }
function nullableText(value: unknown): value is string | null { return value === null || typeof value === "string"; }
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

export type BrowserQuery = { requestId: string; operation: "time_context" | "search_layers" | "layer_details" | "describe_layer" | "describe_layer_statistics" | "summarize_layer" | "layer_controls" | "geocode_address" | "read_layer" | "map_context" | "find_places" | "nearby" | "explore_data" | "compare_neighborhoods" | "search_datasets" | "describe_dataset" | "query_records" | "plan_data_access" | "materialize_data" | "spatial_query" | "aggregate_records" | "join_records" | "calculate_metric" | "read_series" | "compare_series" | "get_data_quality" | "get_record_evidence" | "get_analysis_result" | "get_result_bounds" | "list_results" | "remove_result"; args: Record<string, unknown>; expiresAt: number };
export type QueryResult = { ok: true; data: Record<string, unknown> } | { ok: false; error: string };
function isNearby(value: unknown): value is { queryId: string } | null { return value === null || exactObject(value, ["queryId"]) && safeId(value.queryId); }
function isResults(value: unknown): value is { resultIds: string[] } | null { return value === null || exactObject(value, ["resultIds"]) && Array.isArray(value.resultIds) && value.resultIds.length >= 1 && value.resultIds.length <= 4 && new Set(value.resultIds).size === value.resultIds.length && value.resultIds.every(item => typeof item === "string" && /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$/.test(item)); }
function isQueryEnvelope(value: unknown): value is { request: BrowserQuery | null } {
  if (!exactObject(value, ["request"])) return false;
  const request = value.request;
  return request === null || exactObject(request, ["requestId", "operation", "args", "expiresAt"]) && safeId(request.requestId) && typeof request.operation === "string" && ["time_context", "layer_details", "layer_controls", "geocode_address", "explore_data", "compare_neighborhoods", "search_layers", "describe_layer", "describe_layer_statistics", "summarize_layer", "read_layer", "map_context", "find_places", "nearby", "search_datasets", "describe_dataset", "query_records", "plan_data_access", "materialize_data", "spatial_query", "aggregate_records", "join_records", "calculate_metric", "read_series", "compare_series", "get_data_quality", "get_record_evidence", "get_analysis_result", "get_result_bounds", "list_results", "remove_result"].includes(request.operation) && isObject(request.args) && typeof request.expiresAt === "number" && Number.isFinite(request.expiresAt);
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
