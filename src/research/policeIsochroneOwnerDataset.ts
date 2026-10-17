import { withLoading } from "../lib/loadingRegistry";
import { boundedAccess, DEFAULT_VALUE_SEMANTICS, type DatasetDescriptor, type DatasetField, type SourceReceipt } from "./dataContracts";
import type { AdapterReadResult, QueryAdapter } from "./queryExecutor";
import { parseSpatialGeometry, type MultiPolygonGeometry } from "./spatialKernel";

type Tier = "substation" | "precinct" | "police_dept";
type Row = Record<string, unknown>;
type Family = Readonly<{ layer: string; tier: Tier; bytes: number; sha256: string; rows: number; minutes: readonly number[]; variants: readonly number[] }>;
const FAMILIES: readonly Family[] = [
  { layer: "policeIsoSubstation", tier: "substation", bytes: 18_440_196, sha256: "d135d84ce395b9762d0ba83d1118e88d54c8e142af75015e7a59bd10fdea3adc", rows: 112, minutes: [5, 10], variants: [4, 8, 28, 72] },
  { layer: "policeIsoPrecinct", tier: "precinct", bytes: 1_625_842, sha256: "0ad87d5c066ad70191bd24a7aa08fb9b99c48e6a377f626b3605eece937d31a4", rows: 64, minutes: [15, 30], variants: [4, 7, 22, 31] },
  { layer: "policeIsoCityDept", tier: "police_dept", bytes: 227_369, sha256: "833780de88055fc0c0772d360738f04cd3784b8fe2ded5aa54ab607e5e03406c", rows: 37, minutes: [30, 60], variants: [6, 8, 10, 13] },
];
const ROUTE = "/__local-research-owner-only/police-iso";
const MAX_BYTES = 20 * 1024 * 1024;
const TIMEOUT_MS = 15_000;
const fields: readonly DatasetField[] = [
  { name: "tier", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "mode", type: "string", nullable: false, nullMeaning: null, unit: null },
  { name: "minutes", type: "number", nullable: false, nullMeaning: null, unit: "model minutes" },
  { name: "overlap_count", type: "number", nullable: false, nullMeaning: null, unit: "model station polygons" },
  { name: "geometry", type: "json", nullable: false, nullMeaning: null, unit: null },
];
function url(family: Family): string { return `${ROUTE}/police_iso_${family.tier}_combined.geojson`; }
function descriptor(family: Family): DatasetDescriptor {
  return {
    schemaVersion: "pulse-dataset/0.1", datasetId: `tw-police-iso-${family.tier}-owner-model`, label: `警察設施覆蓋模型 ${family.tier}`,
    description: "固定歷史模型輸出，按 mode、minutes、overlap_count 切分的面。路網節點距離加固定速度、凹殼、緩衝與部分圓形 fallback；不是實測旅行時間或警察出勤範圍。",
    layerRefs: [family.layer], kind: "polygon", recordGrain: "feature", primaryKey: ["tier", "mode", "minutes", "overlap_count"], fields,
    geometry: { type: "MultiPolygon", crs: "EPSG:4326", role: "proxy", precision: "模型衍生面；來源程式以固定速度步行 1.4m/s、車行 8.3m/s 計算路網節點半徑，再以凹殼、15% buffer、10% simplify 造面；離路網逾 500m 或缺節點可退回粗估圓面。無逐面 fallback 記錄，不能判定點的實際到達時間。", spatialAnalysisEligible: false },
    timeFields: [], coverage: `${family.rows} 個模型重疊片段；僅臺灣本島固定快照。每片是同 mode/minutes 下恰有 overlap_count 個設施模型面重疊的區域，不是警局數或現時服務保證。離島未納入；缺面不等於無警察服務。`,
    license: "HOLD：警政署站點與 OSM 路網衍生面之公開重發布權、歸屬標示和現有 PMTiles 同版尚未逐項核實；僅 localhost owner-only。",
    valueSemantics: { ...DEFAULT_VALUE_SEMANTICS, missing: "固定本島模型缺面不代表無警局、無巡邏或無可達路線。", zero: "overlap_count 從 1 起；沒有輸出的零覆蓋片段不能推定為觀測零。", null: "四個來源屬性與幾何皆必填；缺值拒絕。", stale: "固定歷史模型無可核的路網建模依賴 SHA 收據與逐面 fallback 紀錄，不可當作當前步行／車行分鐘數、法定轄區、救援或警力回應能力。" },
    versions: [{ versionId: `processed-sha256:${family.sha256}`, observedAt: null, availableAt: null, checksumSha256: family.sha256, mutable: false }],
    source: { publisher: "警政署站點與 OpenStreetMap 衍生路網模型（analytics pipeline）", reference: url(family), lineage: `police_stations_20260626 Point -> local OSM graph / possible Overpass fallback -> fixed-speed ego_graph and polygon model -> ${family.rows} overlap fragments. This combined GeoJSON SHA ${family.sha256} is verified. Current local PBF SHAs are not a build-time dependency receipt; source graph version and individual circular fallbacks remain unverified.` },
    access: boundedAccess({ mode: "owner_only", method: "local_asset", fields: fields.map(field => field.name), filters: ["tier", "mode", "minutes", "overlap_count"], supportsBbox: true, maxRowsPerQuery: 10, maxScanRows: family.rows, maxResponseBytes: 1024 * 1024, maxSourceBytes: MAX_BYTES, timeoutMs: TIMEOUT_MS }),
    supportedOperations: ["query_records", "aggregate"], adapterId: `police-iso-${family.tier}-owner-model-v1`,
  };
}
export const policeIsochroneOwnerDescriptors = FAMILIES.map(descriptor);
export type PoliceIsoFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
const cached = new Map<Tier, { rows: Row[]; acquiredAt: string }>();
function fail(code: string): never { throw new Error(code); }
async function digest(bytes: Uint8Array): Promise<string> { const value = await crypto.subtle.digest("SHA-256", bytes); return [...new Uint8Array(value)].map(byte => byte.toString(16).padStart(2, "0")).join(""); }
async function boundedBytes(response: Response, family: Family, signal: AbortSignal): Promise<Uint8Array> {
  const declared = response.headers.get("content-length");
  if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) !== family.bytes)) fail("POLICE_ISO_SIZE_MISMATCH");
  if (!response.body) fail("POLICE_ISO_BODY_MISSING");
  const reader = response.body.getReader(), chunks: Uint8Array[] = []; let size = 0;
  try { while (true) { if (signal.aborted) throw signal.reason ?? new DOMException("aborted", "AbortError"); const next = await reader.read(); if (next.done) break; size += next.value.byteLength; if (size > MAX_BYTES) { await reader.cancel(); fail("POLICE_ISO_TOO_LARGE"); } chunks.push(next.value); } } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  if (bytes.byteLength !== family.bytes) fail("POLICE_ISO_SIZE_MISMATCH");
  return bytes;
}
function multi(value: unknown): MultiPolygonGeometry {
  const geometry = parseSpatialGeometry(value);
  if (geometry.type === "Polygon") return { type: "MultiPolygon", coordinates: [geometry.coordinates] };
  if (geometry.type === "MultiPolygon") return geometry;
  return fail("POLICE_ISO_GEOMETRY_INVALID");
}
function rowsFromSource(source: unknown, family: Family): Row[] {
  const collection = source as { type?: unknown; features?: unknown };
  if (!collection || collection.type !== "FeatureCollection" || !Array.isArray(collection.features) || collection.features.length !== family.rows) fail("POLICE_ISO_COLLECTION_INVALID");
  const keys = new Set<string>(), variants = [0, 0, 0, 0];
  const rows = collection.features.map(raw => {
    const feature = raw as { type?: unknown; properties?: unknown; geometry?: unknown };
    const p = feature?.properties as Record<string, unknown> | undefined;
    if (feature?.type !== "Feature" || !p || typeof p !== "object" || Array.isArray(p) || Object.keys(p).sort().join() !== "minutes,mode,overlap_count,tier") fail("POLICE_ISO_ROW_INVALID");
    const { tier, mode, minutes, overlap_count: overlapCount } = p;
    if (tier !== family.tier || (mode !== "walk" && mode !== "drive") || typeof minutes !== "number" || !family.minutes.includes(minutes) || typeof overlapCount !== "number" || !Number.isInteger(overlapCount) || overlapCount < 1) fail("POLICE_ISO_ROW_INVALID");
    const key = `${tier}:${mode}:${minutes}:${overlapCount}`; if (keys.has(key)) fail("POLICE_ISO_DUPLICATE_FRAGMENT"); keys.add(key);
    const variant = (mode === "walk" ? 0 : 2) + (minutes === family.minutes[0] ? 0 : 1); variants[variant]!++;
    return { tier, mode, minutes, overlap_count: overlapCount, geometry: multi(feature.geometry) };
  });
  if (variants.some((value, i) => value !== family.variants[i])) fail("POLICE_ISO_VARIANT_MISMATCH");
  return rows;
}
const defaultFetch: PoliceIsoFetch = (...args) => fetch(...args);
export function createPoliceIsochroneOwnerAdapter(family: Family, fetcher: PoliceIsoFetch = defaultFetch): QueryAdapter {
  const dataDescriptor = descriptor(family);
  return { descriptor: dataDescriptor, allowedParameters: {}, async read(_parameters, signal): Promise<AdapterReadResult> {
    return withLoading(`research:police-iso:${family.tier}`, `讀取警察覆蓋模型 ${family.tier}`, (async () => {
      const cacheHit = cached.has(family.tier);
      if (!cacheHit) {
        const controller = new AbortController(), forwardAbort = () => controller.abort(signal?.reason);
        signal?.addEventListener("abort", forwardAbort, { once: true });
        const timeout = setTimeout(() => controller.abort(new Error("POLICE_ISO_TIMEOUT")), TIMEOUT_MS);
        try {
          if (signal?.aborted) throw signal.reason ?? new DOMException("aborted", "AbortError");
          const response = await fetcher(url(family), { credentials: "same-origin", redirect: "error", signal: controller.signal });
          if (!response.ok || response.headers.get("content-type")?.includes("text/html")) fail("POLICE_ISO_ASSET_UNAVAILABLE");
          const bytes = await boundedBytes(response, family, controller.signal);
          if (await digest(bytes) !== family.sha256) fail("POLICE_ISO_SHA_MISMATCH");
          let source: unknown; try { source = JSON.parse(new TextDecoder().decode(bytes)); } catch { fail("POLICE_ISO_JSON_INVALID"); }
          cached.set(family.tier, { rows: rowsFromSource(source, family), acquiredAt: new Date().toISOString() });
        } finally { clearTimeout(timeout); signal?.removeEventListener("abort", forwardAbort); }
      }
      const snapshot = cached.get(family.tier)!;
      const sourceRefs: SourceReceipt[] = [{ sourceId: `police-iso:${family.tier}`, version: `processed-sha256:${family.sha256}`, checksumSha256: family.sha256, reference: url(family), acquiredAt: snapshot.acquiredAt }];
      return { rows: snapshot.rows, sourceRefs, coverage: dataDescriptor.coverage, freshness: "stale", exclusions: {}, rowsScanned: family.rows, bytesScanned: family.bytes, downloadedBytes: cacheHit ? 0 : family.bytes, requests: cacheHit ? 0 : 1, cacheHit, expiresAt: null };
    })());
  } };
}
export const policeIsochroneOwnerAdapters = FAMILIES.map(family => createPoliceIsochroneOwnerAdapter(family));
export function clearPoliceIsochroneOwnerCache(): void { cached.clear(); }
