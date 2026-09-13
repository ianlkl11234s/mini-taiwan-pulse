import gridReceipt from "./contracts/schools-grid-receipt.json";
import type { DatasetDescriptor } from "./dataContracts";
import type { QueryAdapter, AdapterReadResult } from "./queryExecutor";
import { withLoading } from "../lib/loadingRegistry";

const URL = "/__local-research/schools-grid.json";
const MAX_BYTES = 8 * 1024 * 1024;
const field = (name: string, type: "string" | "number" | "json" | "datetime", nullable = false) => ({ name, type, nullable, nullMeaning: nullable ? "來源觀測時間未知，不以檔案時間代填" : null, unit: name === "source_place_record_count" ? "source place records" : null });
export const gridDescriptor: DatasetDescriptor = {
  schemaVersion: "pulse-dataset/0.1", datasetId: "tw-schools-grid-150m", label: "學校來源紀錄 150m 格網",
  description: "本地 occupied-only 方格彙總；保留原始校址血緣，未列格網不代表零，非學區或教育服務覆蓋。",
  layerRefs: [], kind: "grid", recordGrain: "grid_cell", primaryKey: ["grid_id"],
  fields: [field("grid_id", "string"), field("source_place_record_count", "number"), field("metric_status", "string"), field("source_sha256", "string"), field("source_version", "string"), field("grid_definition_id", "string"), field("observed_at", "datetime", true), field("geometry", "json")],
  geometry: { type: "Polygon", crs: "EPSG:4326", role: "generalized", precision: "150m EPSG:3826 grid, origin 144250/2399250; occupied cells only", spatialAnalysisEligible: false },
  timeFields: [{ name: "observed_at", role: "observed", timezone: "UTC" }], coverage: "input snapshot occupied cells only; source coverage unknown", license: "unknown", versions: [{ versionId: gridReceipt.bundleSha256, checksumSha256: gridReceipt.bundleSha256, mutable: false, observedAt: null, availableAt: null }],
  source: { publisher: "local research from 教育部 school site records", reference: URL, lineage: "original Point snapshot -> EPSG:3826 assign -> count -> EPSG:4326 Polygon; original geometry retained upstream" },
  accessPolicy: { mode: "public", maxRowsPerQuery: 50, maxScanRows: 10_000 }, supportedOperations: ["query_records", "aggregate"], adapterId: "schools-grid-local-v1",
};

type ObjectValue = Record<string, any>; // Boundary values are checked before they enter the typed executor.
export function validateGridBundle(input: unknown): { rows: Record<string, unknown>[]; sourceHash: string; version: string; summary: ObjectValue; lineage: ObjectValue } {
  const raw = input as ObjectValue;
  const fail = () => { throw new Error("INVALID_GRID_BUNDLE"); };
  if (!raw || raw.schema_version !== "research-schools-grid/0.1" || raw.datasetId !== gridDescriptor.datasetId) fail();
  const grid = raw.gridDefinition, asset = raw.asset, summary = raw.summary;
  if (!grid || grid.crs !== "EPSG:3826" || grid.output_crs !== "EPSG:4326" || grid.cell_size_m !== 150 || grid.origin_x !== 144250 || grid.origin_y !== 2399250 || !grid.version) fail();
  if (!asset || !["hold", "candidate", "promoted"].includes(asset.lifecycle) || asset.time?.freshness_status === "stale") throw new Error("GRID_ASSET_STALE_OR_UNAVAILABLE");
  if (!/^[a-f0-9]{64}$/.test(asset.source?.sha256) || asset.geometry?.source_geometry_sha256 !== asset.source.sha256 || asset.geometry?.preserved !== true || !Array.isArray(asset.evidence) || !asset.evidence.length || asset.time?.observed_at !== null) fail();
  const features = raw.geojson?.features;
  if (raw.geojson?.type !== "FeatureCollection" || !Array.isArray(features) || features.length > 10_000 || !summary || summary.occupied_cell_count !== features.length || summary.count_conservation !== true) fail();
  const ids = new Set<string>(); let count = 0;
  const rows = features.map((feature: ObjectValue) => {
    const p = feature?.properties, geometry = feature?.geometry;
    if (!p || typeof p.grid_id !== "string" || !/^G_-?\d+_-?\d+$/.test(p.grid_id) || ids.has(p.grid_id) || !Number.isSafeInteger(p.source_place_record_count) || p.source_place_record_count <= 0 || p.metric_status !== "valid" || p.source_sha256 !== asset.source.sha256 || p.source_version !== asset.version || p.grid_definition_id !== grid.id || p.observed_at !== null) fail();
    const [, col, row] = p.grid_id.split("_").map(Number);
    if (!Number.isSafeInteger(p.column) || !Number.isSafeInteger(p.row) || col !== p.column || row !== p.row) fail();
    ids.add(p.grid_id); count += p.source_place_record_count;
    const ring = geometry?.coordinates?.[0];
    if (geometry?.type !== "Polygon" || geometry.coordinates.length !== 1 || !Array.isArray(ring) || ring.length !== 5 || ring.some((v: unknown) => !Array.isArray(v) || v.length !== 2 || !v.every(Number.isFinite) || Math.abs(v[0]) > 180 || Math.abs(v[1]) > 90) || JSON.stringify(ring[0]) !== JSON.stringify(ring[4])) fail();
    const area = ring.slice(0, 4).reduce((sum: number, v: number[], i: number) => sum + v[0]! * ring[i + 1][1] - ring[i + 1][0] * v[1]!, 0);
    if (!(area > 0)) fail();
    for (let i = 0; i < 4; i++) {
      const a = ring[i], b = ring[(i + 1) % 4], c = ring[(i + 2) % 4];
      if ((b[0]-a[0])*(c[1]-b[1]) - (b[1]-a[1])*(c[0]-b[0]) <= 0) fail();
    }
    return { ...p, geometry };
  });
  if (!Number.isSafeInteger(summary.input_features) || !Number.isSafeInteger(summary.assigned_features) || !Number.isSafeInteger(summary.invalid_geometry) || !Number.isSafeInteger(summary.proxy_geometry) || summary.invalid_geometry < 0 || summary.proxy_geometry < 0 || count !== summary.assigned_features || count + summary.invalid_geometry + summary.proxy_geometry !== summary.input_features) fail();
  return { rows, sourceHash: asset.source.sha256, version: asset.version, summary, lineage: { gridDefinition: grid, source: asset.source, time: asset.time, geometry: asset.geometry, evidence: asset.evidence, metricDefinitions: raw.metricDefinitions, availability: raw.availability } };
}

async function read(signal?: AbortSignal): Promise<AdapterReadResult> {
  return withLoading("research:schools-grid", "學校格網研究資產", (async () => {
    const response = await fetch(URL, { signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15_000)]) : AbortSignal.timeout(15_000) });
    if (!response.ok) throw new Error("GRID_ASSET_UNAVAILABLE");
    if (Number(response.headers.get("content-length")) > MAX_BYTES || !response.body) throw new Error("GRID_ASSET_TOO_LARGE");
    const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
    try { while (true) { const part = await reader.read(); if (part.done) break; size += part.value.byteLength; if (size > MAX_BYTES) { await reader.cancel(); throw new Error("GRID_ASSET_TOO_LARGE"); } chunks.push(part.value); } } finally { reader.releaseLock(); }
    const bytes = new Uint8Array(size); let offset = 0; for (const part of chunks) { bytes.set(part, offset); offset += part.byteLength; }
    const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map(v => v.toString(16).padStart(2, "0")).join("");
    if (hash !== gridReceipt.bundleSha256 || size !== gridReceipt.bytes) throw new Error("GRID_ARTIFACT_VERSION_MISMATCH");
    const bundle = validateGridBundle(JSON.parse(new TextDecoder().decode(bytes)));
    const acquiredAt = new Date().toISOString();
    return { rows: bundle.rows, lineage: bundle.lineage, sourceRefs: [
      { sourceId: gridDescriptor.datasetId, version: hash, checksumSha256: hash, reference: URL, acquiredAt },
      { sourceId: "tw-schools", version: bundle.sourceHash, checksumSha256: bundle.sourceHash, reference: "/education/schools.geojson", acquiredAt },
    ], coverage: gridDescriptor.coverage, freshness: "unknown", exclusions: { invalid_geometry: bundle.summary.invalid_geometry, proxy_geometry: bundle.summary.proxy_geometry }, rowsScanned: bundle.rows.length, bytesScanned: size, downloadedBytes: size, requests: 1, cacheHit: false, expiresAt: null };
  })());
}
export const schoolsGridAdapter: QueryAdapter = { descriptor: gridDescriptor, allowedParameters: {}, read: (_parameters, signal) => read(signal) };
