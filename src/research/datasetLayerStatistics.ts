import type { DatasetDescriptor, Scalar } from "./dataContracts";
import { datasetForLayer, queryRecordsDetailed } from "./researchDatasets";
import type { LayerSummaryInput } from "./layerStatistics";

type Row = Record<string, unknown>;
type Bounds = [number, number, number, number];

function fieldNames(descriptor: DatasetDescriptor): Set<string> {
  return new Set(descriptor.fields.map(field => field.name));
}

function assertAggregateReady(descriptor: DatasetDescriptor): void {
  if (!descriptor.supportedOperations.includes("aggregate") || !descriptor.access.query.enabled) throw new Error("LAYER_STATISTICS_UNSUPPORTED");
}

function matchedBounds(rows: readonly Row[]): Bounds | null {
  let value: Bounds | null = null;
  for (const row of rows) {
    const geometry = row.geometry as { type?: unknown; coordinates?: unknown } | undefined;
    if (geometry?.type !== "Point" || !Array.isArray(geometry.coordinates) || geometry.coordinates.length !== 2) continue;
    const [lng, lat] = geometry.coordinates;
    if (typeof lng !== "number" || typeof lat !== "number" || !Number.isFinite(lng) || !Number.isFinite(lat)) continue;
    if (!value) value = [lng, lat, lng, lat];
    else { value[0] = Math.min(value[0], lng); value[1] = Math.min(value[1], lat); value[2] = Math.max(value[2], lng); value[3] = Math.max(value[3], lat); }
  }
  return value;
}

export async function describeDatasetLayerStatistics(layerKey: string, locked: ReadonlySet<string>): Promise<Record<string, unknown>> {
  const descriptor = await datasetForLayer(layerKey, locked); assertAggregateReady(descriptor);
  return {
    schemaVersion: "pulse-layer-statistics/2", layerKey, datasetId: descriptor.datasetId, label: descriptor.label,
    countUnit: descriptor.recordGrain, recordGrain: descriptor.recordGrain, sourceRefs: descriptor.versions,
    scope: "完整 adapter snapshot；不受目前 viewport、zoom 或顯示 filter 影響。",
    coverage: descriptor.coverage, freshness: descriptor.versions.length ? "unknown" : "unknown", license: descriptor.license,
    geometry: descriptor.geometry, semantics: descriptor.valueSemantics,
    capabilities: { count: true, groupBy: true, filterEquals: true, pagination: true, bounds: descriptor.geometry.type === "Point", area: false, spatialJoin: false },
    fields: descriptor.fields.filter(field => descriptor.access.query.fields.includes(field.name)).map(field => ({ name: field.name, type: field.type, nullable: field.nullable, nullMeaning: field.nullMeaning, unit: field.unit, filterable: descriptor.access.query.filters.includes(field.name) })),
    limits: descriptor.access.limits,
    limitations: ["計數單位是 descriptor recordGrain，不等於唯一實體、服務量能或現實母體完整度。", "來源版本、coverage、缺值與 exclusions 必須與結果一起解讀。", "不從 PMTiles viewport、raster pixels、scene objects 或 render features 推算完整來源數量。"],
  };
}

export async function summarizeDatasetLayer(input: LayerSummaryInput, locked: ReadonlySet<string>): Promise<Record<string, unknown>> {
  const descriptor = await datasetForLayer(input.layerKey, locked); assertAggregateReady(descriptor);
  const fields = fieldNames(descriptor); const filterable = new Set(descriptor.access.query.filters);
  const filters = input.filters ?? []; const groupBy = input.groupBy ?? [];
  if (filters.some(filter => !fields.has(filter.field) || !filterable.has(filter.field)) || groupBy.some(field => !fields.has(field) || field === "geometry")) throw new Error("INVALID_STATISTICS_INPUT");
  const execution = await queryRecordsDetailed({
    datasetId: descriptor.datasetId,
    select: [...new Set([...groupBy, "geometry"].filter(field => fields.has(field)))],
    filters: filters.map(filter => ({ field: filter.field, op: "eq" as const, value: filter.value as Scalar })),
    limit: 1,
  });
  const groups = new Map<string, { labels: Row; count: number }>();
  for (const row of execution.materializedRows) {
    const labels = Object.fromEntries(groupBy.map(field => [field, row[field] ?? null]));
    const key = JSON.stringify(labels); const current = groups.get(key);
    if (current) current.count += 1; else groups.set(key, { labels, count: 1 });
  }
  const order = input.order ?? "count_desc";
  const allGroups = [...groups.values()].map(group => ({ ...group.labels, count: group.count })).sort((a, b) => order === "key_asc"
    ? JSON.stringify(a).localeCompare(JSON.stringify(b), "en")
    : order === "count_asc" ? a.count - b.count : b.count - a.count);
  const offset = input.offset ?? 0; const limit = input.limit ?? 20; const page = allGroups.slice(offset, offset + limit);
  return {
    schemaVersion: "pulse-layer-statistics/2", operation: "count", layerKey: input.layerKey, datasetId: descriptor.datasetId,
    countUnit: descriptor.recordGrain, recordGrain: descriptor.recordGrain, totalMatched: execution.materializedRows.length,
    groups: page, totalGroups: allGroups.length, offset, limit, truncated: offset + page.length < allGroups.length, nextOffset: offset + page.length < allGroups.length ? offset + page.length : null,
    bounds: matchedBounds(execution.materializedRows), sourceRefs: execution.envelope.sourceRefs, coverage: execution.envelope.coverage, freshness: execution.envelope.freshness,
    excludedByReason: execution.envelope.excludedByReason, semantics: execution.envelope.semantics, access: execution.envelope.access, limits: execution.envelope.limits, cost: execution.envelope.cost,
    limitations: ["完整 adapter snapshot 不等於現實母體完整。", "count 保留來源 record grain；未去重、未推論服務量能。", "null、missing、suppressed、zero 與 stale 不互換。"],
  };
}
