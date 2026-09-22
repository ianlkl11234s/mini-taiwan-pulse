import { boundedAccess, DEFAULT_VALUE_SEMANTICS, type DatasetDescriptor, type SourceReceipt } from "./dataContracts";
import { createAdminStatisticsAdapter, type AdapterSnapshot } from "./queryAdapters";
import type { QueryAdapter } from "./queryExecutor";

type Row = Record<string, unknown>;
type PopulationStatus = "observed" | "missing" | "suppressed" | "not_reported";

export type PopulationSnapshotReceipt = Readonly<{
  status: "PASS_LOCAL_PREVIEW_ONLY" | "PASS_VERIFIED_SNAPSHOT";
  notPublished: boolean;
  artifact: Readonly<{ sha256: string; bytes: number }>;
}>;

export type PopulationBoundarySnapshot = Readonly<{
  receipt: SourceReceipt;
  boundaryVersion: string;
  sha256: string;
  codeProperty: string;
  nameProperty: string;
  /** Loader caller must verify raw boundary bytes/hash before returning these features. */
  features: readonly GeoJSON.Feature[];
}>;

export type PopulationSnapshotContract = Readonly<{
  datasetId: string;
  indicatorId: string;
  releaseId: string;
  level: "county";
  periodStart: string;
  periodEnd: string;
  dimensions: Readonly<Record<string, unknown>>;
  unit: string;
  label: string;
  expectedAreas: number;
  populationLabel: string;
}>;

export type PopulationSnapshotAdapterConfig = Readonly<{
  contract: PopulationSnapshotContract;
  receipt: PopulationSnapshotReceipt;
  /** Caller owns route/file access; this adapter accepts bytes only, never a user URL. */
  readArtifact: (signal?: AbortSignal) => Promise<Uint8Array>;
  /** Caller owns the boundary transport and must return its verified receipt. */
  loadBoundary: (signal?: AbortSignal) => Promise<PopulationBoundarySnapshot>;
}>;

function validSha(value: unknown): value is string { return typeof value === "string" && /^[a-f0-9]{64}$/.test(value); }
function object(value: unknown): value is Row { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
function canonicalJson(value: unknown): string | null {
  if (value === null || typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") return Number.isFinite(value) ? JSON.stringify(value) : null;
  if (Array.isArray(value)) { const items = value.map(canonicalJson); return items.some(item => item === null) ? null : `[${items.join(",")}]`; }
  if (!object(value)) return null;
  const items = Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => {
    const encoded = canonicalJson(item); return encoded === null ? null : `${JSON.stringify(key)}:${encoded}`;
  });
  return items.some(item => item === null) ? null : `{${items.join(",")}}`;
}

function asMultiPolygon(value: GeoJSON.Geometry | null): GeoJSON.MultiPolygon {
  if (!value) throw new Error("POPULATION_BOUNDARY_CONTRACT_MISMATCH");
  if (value.type === "MultiPolygon") return value;
  if (value.type === "Polygon") return { type: "MultiPolygon", coordinates: [value.coordinates] };
  throw new Error("POPULATION_BOUNDARY_CONTRACT_MISMATCH");
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

function descriptor(contract: PopulationSnapshotContract, receipt: PopulationSnapshotReceipt): DatasetDescriptor {
  return {
    schemaVersion: "pulse-dataset/0.1", datasetId: contract.datasetId, label: contract.label,
    description: `${contract.populationLabel} 的已驗證 snapshot；publication 狀態由 source receipt 明示，不能由本 adapter 推論為公開發布。`,
    layerRefs: [], kind: "admin_statistic", recordGrain: "admin_statistic", primaryKey: ["release_id", "area_code"],
    fields: [
      { name: "release_id", type: "string", nullable: false, nullMeaning: null, unit: null }, { name: "dataset_id", type: "string", nullable: false, nullMeaning: null, unit: null },
      { name: "indicator_id", type: "string", nullable: false, nullMeaning: null, unit: null }, { name: "level", type: "string", nullable: false, nullMeaning: null, unit: null },
      { name: "area_code", type: "string", nullable: false, nullMeaning: null, unit: null }, { name: "area_name", type: "string", nullable: false, nullMeaning: null, unit: null },
      { name: "indicator_name", type: "string", nullable: false, nullMeaning: null, unit: null }, { name: "unit", type: "string", nullable: false, nullMeaning: null, unit: null },
      { name: "value", type: "number", nullable: true, nullMeaning: "Only a declared non-observed status may carry null; null is never zero.", unit: contract.unit },
      { name: "status", type: "string", nullable: false, nullMeaning: null, unit: null }, { name: "source_status", type: "string", nullable: true, nullMeaning: "Raw source status when supplied.", unit: null },
      { name: "source_token", type: "string", nullable: true, nullMeaning: "Raw source token when supplied.", unit: null }, { name: "period_start", type: "datetime", nullable: false, nullMeaning: null, unit: null },
      { name: "period_end", type: "datetime", nullable: false, nullMeaning: null, unit: null }, { name: "boundary_version", type: "string", nullable: false, nullMeaning: null, unit: null },
      { name: "boundary_sha256", type: "string", nullable: false, nullMeaning: null, unit: null }, { name: "boundary_resource", type: "string", nullable: false, nullMeaning: null, unit: null },
      { name: "geometry", type: "json", nullable: false, nullMeaning: null, unit: null }, { name: "dimensions", type: "json", nullable: false, nullMeaning: null, unit: null },
      { name: "source_population_scope_note", type: "string", nullable: false, nullMeaning: null, unit: null },
    ],
    geometry: { type: "MultiPolygon", crs: "EPSG:4326", role: "actual", precision: "Verified same-version administrative boundary joined by declared code property.", spatialAnalysisEligible: true },
    timeFields: [{ name: "period_start", role: "period_start", timezone: "Asia/Taipei" }, { name: "period_end", role: "period_end", timezone: "Asia/Taipei" }],
    coverage: `${contract.expectedAreas} expected ${contract.level} areas; receipt status=${receipt.status}; notPublished=${receipt.notPublished}.`, license: "Read the exact snapshot source receipt before redistribution.",
    valueSemantics: { ...DEFAULT_VALUE_SEMANTICS, null: "Declared non-observed value only; never inferred as zero.", missing: "Missing means no observation in this verified snapshot, not no population." }, versions: [{ versionId: contract.releaseId, observedAt: contract.periodEnd, availableAt: null, checksumSha256: receipt.artifact.sha256, mutable: false }],
    source: { publisher: "verified snapshot caller", reference: "snapshot://injected", lineage: "verified artifact bytes + receipt + same-version verified boundary injected by caller" },
    access: boundedAccess({ mode: "owner_only", method: "statistics_snapshot", fields: ["release_id", "dataset_id", "indicator_id", "level", "area_code", "area_name", "indicator_name", "unit", "value", "status", "source_status", "source_token", "period_start", "period_end", "boundary_version", "boundary_sha256", "boundary_resource", "geometry", "dimensions", "source_population_scope_note"], filters: ["release_id", "area_code", "status"], timeFields: ["period_start", "period_end"], maxRowsPerQuery: contract.expectedAreas, maxScanRows: contract.expectedAreas, maxSourceBytes: receipt.artifact.bytes }),
    supportedOperations: ["query_records", "aggregate", "compare_regions"], adapterId: "verified-population-snapshot-v1",
  };
}

type SourceSemantics = { id: string; populationLabel: string; populationScopeNote: string; unit: string };
function sourceSemantics(artifact: Row, contract: PopulationSnapshotContract): SourceSemantics {
  const source = object(artifact.sources) && object(artifact.sources.source) ? artifact.sources.source : null;
  if (!source || typeof source.id !== "string" || typeof source.population_label !== "string" || typeof source.population_scope_note !== "string" || typeof source.unit !== "string") throw new Error("POPULATION_SOURCE_SEMANTICS_MISSING");
  if (source.population_label !== contract.populationLabel || source.unit !== contract.unit) throw new Error("POPULATION_SOURCE_SEMANTICS_MISMATCH");
  return { id: source.id, populationLabel: source.population_label, populationScopeNote: source.population_scope_note, unit: source.unit };
}
function sourceReceipt(source: SourceSemantics, receipt: PopulationSnapshotReceipt): SourceReceipt {
  return { sourceId: source.id, version: "verified-snapshot", acquiredAt: new Date().toISOString(), checksumSha256: receipt.artifact.sha256, reference: "snapshot://injected" };
}

export function createPopulationSnapshotAdapter(config: PopulationSnapshotAdapterConfig): QueryAdapter {
  const { contract, receipt } = config;
  if (!validSha(receipt.artifact.sha256) || !Number.isInteger(receipt.artifact.bytes) || receipt.artifact.bytes < 1 || !["PASS_LOCAL_PREVIEW_ONLY", "PASS_VERIFIED_SNAPSHOT"].includes(receipt.status)) throw new Error("INVALID_POPULATION_SNAPSHOT_RECEIPT");
  const dataDescriptor = descriptor(contract, receipt);
  return createAdminStatisticsAdapter(dataDescriptor, async (parameters, signal): Promise<AdapterSnapshot> => {
    if (parameters.releaseId !== contract.releaseId) throw new Error("RELEASE_NOT_ALLOWED");
    const [bytes, boundary] = await Promise.all([config.readArtifact(signal), config.loadBoundary(signal)]);
    if (bytes.byteLength !== receipt.artifact.bytes || await sha256(bytes) !== receipt.artifact.sha256) throw new Error("POPULATION_ARTIFACT_RECEIPT_MISMATCH");
    if (!validSha(boundary.sha256) || boundary.receipt.checksumSha256 !== boundary.sha256 || boundary.boundaryVersion.length === 0) throw new Error("POPULATION_BOUNDARY_RECEIPT_MISMATCH");
    let artifact: unknown; try { artifact = JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new Error("POPULATION_ARTIFACT_INVALID"); }
    if (!object(artifact) || artifact.schema_version !== "regional-statistics-cdn-v1" || !object(artifact.values) || !object(artifact.values.release) || !object(artifact.geometry) || !object(artifact.geometry.geometry)) throw new Error("POPULATION_ARTIFACT_INVALID");
    const values = artifact.values, release = values.release, geometry = artifact.geometry.geometry;
    if (!object(release) || !object(geometry)) throw new Error("POPULATION_ARTIFACT_INVALID");
    if (values.status !== "OK" || release.release_id !== contract.releaseId || release.dataset_id !== contract.datasetId || release.indicator_id !== contract.indicatorId || values.area_level !== contract.level || release.period_start !== contract.periodStart || release.period_end !== contract.periodEnd || release.boundary_version !== boundary.boundaryVersion || geometry.sha256 !== boundary.sha256 || geometry.boundary_version !== boundary.boundaryVersion || geometry.level !== contract.level || !Array.isArray(values.observations) || values.total !== contract.expectedAreas || values.returned !== contract.expectedAreas || values.truncated !== false || values.next_offset !== null || values.observations.length !== contract.expectedAreas) throw new Error("POPULATION_ARTIFACT_CONTRACT_MISMATCH");
    const local = object(artifact.local_preview_contract) ? artifact.local_preview_contract : null;
    if (receipt.status === "PASS_LOCAL_PREVIEW_ONLY" && (!receipt.notPublished || !local || local.not_published !== true)) throw new Error("POPULATION_PUBLICATION_STATUS_MISMATCH");
    if (receipt.status === "PASS_VERIFIED_SNAPSHOT" && (receipt.notPublished || local?.not_published === true)) throw new Error("POPULATION_PUBLICATION_STATUS_MISMATCH");
    if (!local || canonicalJson(local.dimensions) !== canonicalJson(contract.dimensions)) throw new Error("POPULATION_DIMENSIONS_MISMATCH");
    const source = sourceSemantics(artifact, contract);
    const byCode = new Map<string, GeoJSON.Feature>();
    for (const feature of boundary.features) {
      const code = feature.properties?.[boundary.codeProperty];
      if (typeof code !== "string" || !code || byCode.has(code)) throw new Error("POPULATION_BOUNDARY_CONTRACT_MISMATCH");
      byCode.set(code, feature);
    }
    if (byCode.size !== contract.expectedAreas) throw new Error("POPULATION_BOUNDARY_CONTRACT_MISMATCH");
    const rows: Row[] = [];
    for (const observation of values.observations) {
      if (!object(observation) || typeof observation.area_code !== "string" || typeof observation.area_name !== "string" || !byCode.has(observation.area_code) || !["observed", "missing", "suppressed", "not_reported"].includes(String(observation.status))) throw new Error("POPULATION_OBSERVATION_INVALID");
      const status = observation.status as PopulationStatus, value = observation.value;
      if (status === "observed" ? typeof value !== "number" || !Number.isFinite(value) || value < 0 : value !== null) throw new Error("POPULATION_OBSERVATION_INVALID");
      const feature = byCode.get(observation.area_code)!;
      if (feature.properties?.[boundary.nameProperty] !== observation.area_name) throw new Error("POPULATION_BOUNDARY_CONTRACT_MISMATCH");
      rows.push({ release_id: contract.releaseId, dataset_id: contract.datasetId, indicator_id: contract.indicatorId, level: contract.level, area_code: observation.area_code, area_name: observation.area_name, indicator_name: contract.label, unit: contract.unit, value, status, source_status: typeof observation.source_status === "string" ? observation.source_status : null, source_token: typeof observation.source_token === "string" ? observation.source_token : null, period_start: contract.periodStart, period_end: contract.periodEnd, boundary_version: boundary.boundaryVersion, boundary_sha256: boundary.sha256, boundary_resource: boundary.receipt.reference, geometry: asMultiPolygon(feature.geometry), dimensions: contract.dimensions, source_population_scope_note: source.populationScopeNote });
    }
    if (new Set(rows.map(row => row.area_code)).size !== contract.expectedAreas) throw new Error("POPULATION_OBSERVATION_INVALID");
    return { rows, source: sourceReceipt(source, receipt), sourceRefs: [boundary.receipt], coverage: dataDescriptor.coverage, freshness: "unknown", rowsScanned: rows.length, bytesScanned: bytes.byteLength, downloadedBytes: bytes.byteLength, requests: 1, cacheHit: false, expiresAt: null };
  });
}
