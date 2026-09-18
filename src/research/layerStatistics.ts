import { DATASET_WHITELIST } from "../chat/tools/datasets";
import { loadPointDataset, type PointDatasetSnapshot } from "./pointDatasetAdapter";

type Value = string | null;
type Bounds = [number, number, number, number];
type Config = { dataset: string; label: string; id: string; fields: string[]; grain: string; version: string | null; location: "source_fields" | "address_prefix" };
const REGISTRY: Record<string, Config> = {
  schools: { dataset: "schools", label: "學校", id: "code", fields: ["city", "district", "school_level", "system_type", "region_type"], grain: "來源學制／學校紀錄；同校代碼可能含附設學制，不等同唯一學校或校址", version: null, location: "source_fields" },
  policeStation: { dataset: "policeStations", label: "警察機關", id: "entity_id", fields: ["city", "district", "facility_subtype"], grain: "警察機關據點紀錄，混合警察局、分局、派出所與專業警察等", version: "20260626", location: "address_prefix" },
};
const normalize = (s: string) => s.normalize("NFKC").trim().replace(/臺/g, "台");
const scalar = (v: unknown): Value => v === null || v === undefined || v === "" ? null : typeof v === "string" ? normalize(v) || null : null;
const hasOwn = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);
export interface LayerSummaryInput { layerKey: string; filters?: { field: string; value: Value }[]; groupBy?: string[]; order?: "count_desc" | "count_asc" | "key_asc"; offset?: number; limit?: number }

function configFor(layerKey: string): { key: string; config: Config } {
  const key = layerKey === "policeStations" ? "policeStation" : layerKey;
  if (!hasOwn(REGISTRY, key)) throw new Error("LAYER_STATISTICS_UNSUPPORTED");
  return { key, config: REGISTRY[key]! };
}
function integer(v: unknown, fallback: number, min: number, max: number): number {
  if (v === undefined) return fallback;
  if (typeof v !== "number" || !Number.isInteger(v) || v < min || v > max) throw new Error("INVALID_STATISTICS_INPUT");
  return v;
}
function bounds(rows: readonly Record<string, unknown>[]): Bounds | null {
  let result: Bounds | null = null;
  for (const row of rows) {
    const point = row.geometry as { coordinates?: number[] } | null;
    if (!point?.coordinates) continue;
    const [x, y] = point.coordinates;
    if (x === undefined || y === undefined || Math.abs(y) > 85) continue;
    if (!result) result = [x, y, x, y];
    else { result[0] = Math.min(result[0], x); result[1] = Math.min(result[1], y); result[2] = Math.max(result[2], x); result[3] = Math.max(result[3], y); }
  }
  return result;
}
function receipt(snapshot: PointDatasetSnapshot, reference: string, version: string | null) {
  return { reference, version, sourceYear: null, acquiredAt: snapshot.acquiredAt, checksumSha256: snapshot.checksumSha256, bytes: snapshot.bytes };
}
async function read(key: string) {
  const { key: canonicalKey, config } = configFor(key);
  const meta = DATASET_WHITELIST[config.dataset]!;
  const [snapshot, county, town] = await Promise.all([
    loadPointDataset({ datasetId: `statistics:${canonicalKey}`, url: meta.url, safeFields: [...config.fields, config.id, "address", "fetched_at"], idField: config.id, preserveUnlocatedRecords: true }),
    loadPointDataset({ datasetId: "statistics:county-reference", url: "./statistics/county-reference-2025.geojson", safeFields: ["area_code", "area_name"], idField: "area_code", preserveUnlocatedRecords: true }),
    loadPointDataset({ datasetId: "statistics:town-reference", url: "./statistics/township-reference.geojson", safeFields: ["area_code", "area_name"], idField: "area_code", preserveUnlocatedRecords: true }),
  ]);
  const counties = county.rows.map(r => ({ name: scalar(r.area_name), code: scalar(r.area_code) }));
  const towns = town.rows.map(r => ({ name: scalar(r.area_name), code: scalar(r.area_code) }));
  if (!counties.length || !towns.length || [...counties, ...towns].some(r => !r.name || !r.code)) throw new Error("ADMIN_REFERENCE_INVALID");
  const ids = new Set<string>(); let missingIds = 0; let duplicateIds = 0;
  const rows = snapshot.rows.map(source => {
    const id = scalar(source[config.id]);
    if (!id) missingIds++; else { if (ids.has(id)) duplicateIds++; ids.add(id); }
    const row: Record<string, unknown> = { ...source, regionNullKnown: canonicalKey === "schools" && source.region_type === null };
    for (const field of config.fields) {
      if (source[field] !== undefined && source[field] !== null && typeof source[field] !== "string") throw new Error("STATISTICS_FIELD_INVALID");
      row[field] = scalar(source[field]);
    }
    // Anchored address parsing, never a name/substring or point-in-polygon inference.
    const address = typeof source.address === "string" ? normalize(source.address).replace(/^(?:\d{3}(?:\d{2,3})?\s*)?(?:台灣|中華民國)?\s*/, "") : "";
    const city = counties.find(c => config.location === "source_fields" ? c.name === row.city : address.startsWith(c.name!));
    const district = city ? towns.filter(t => t.name!.startsWith(city.name!)).sort((a, b) => b.name!.length - a.name!.length).find(t => config.location === "source_fields" ? t.name === `${city.name}${row.district ?? ""}` : address.startsWith(t.name!)) : undefined;
    row.city = city?.name ?? null; row.city_code = city?.code ?? null;
    row.district = district ? district.name!.slice(city!.name!.length) : null; row.district_code = district?.code ?? null;
    return row;
  });
  const absentByField = Object.fromEntries(config.fields.filter(f => config.location !== "address_prefix" || !["city", "district"].includes(f)).map(f => [f, snapshot.rows.filter(r => !hasOwn(r, f)).length]));
  const missingByField = Object.fromEntries(config.fields.map(f => [f, rows.filter(r => r[f] === null).length]));
  return { rows, config, meta, canonicalKey, snapshot, missingByField, absentByField, identity: { field: config.id, uniqueNonMissing: ids.size, missing: missingIds, duplicateExtraRecords: duplicateIds, deduplicated: false }, sources: [receipt(snapshot, meta.url, config.version), receipt(county, "./statistics/county-reference-2025.geojson", "2025"), receipt(town, "./statistics/township-reference.geojson", null)] };
}
function metadata(data: Awaited<ReturnType<typeof read>>) {
  return { schemaVersion: "pulse-layer-statistics/1", layerKey: data.canonicalKey, label: data.config.label,
    countUnit: "source_record", recordGrain: data.config.grain, sourceRefs: data.sources,
    scope: "完整同源資產紀錄；不受目前地圖 viewport、zoom 或顯示篩選影響", artifactComplete: true, populationCoverage: "unknown", sourceYear: null,
    administrativeAttribution: { method: data.config.location, geometryJoin: false, unmatchedCity: data.missingByField.city, unmatchedDistrict: data.missingByField.district, coverage: data.missingByField.district === 0 ? "complete_for_asset" : "partial" },
    nullSemantics: data.canonicalKey === "schools" ? { region_type: "來源null表示非偏遠；missingByField在此是null筆數，不代表全部未知" } : {},
    identity: data.identity, absentByField: data.absentByField, missingByField: data.missingByField, geometryIssues: data.snapshot.exclusions,
    limitations: ["完整資產不等於現實全台母體已驗證；不以讀取日期冒充來源年份。", "所在地非服務轄區；點位不能計算校地、轄區或覆蓋面積。", "不去重來源紀錄；跨圖層比較須保留各自粒度、版本與缺值。", ...(data.config.location === "address_prefix" ? ["縣市／鄉鎮由地址前綴與參考行政區名稱衍生，未匹配仍保留；不是空間落點歸屬。", "警察局 police_dept 與派出所 substation、分局 precinct 分開，不能將所有據點稱為警察局。"] : [])] };
}
export async function describeLayerStatistics(input: { layerKey: string }): Promise<Record<string, unknown>> {
  const data = await read(input.layerKey);
  return { ...metadata(data), totalRows: data.rows.length, supportedLayerKeys: Object.keys(REGISTRY), capabilities: { count: true, groupBy: true, filterEquals: true, sort: true, pagination: true, bounds: true, area: false, spatialJoin: false },
    fields: data.config.fields.map(field => {
      const values = [...new Set(data.rows.map(r => r[field] as Value))].sort((a, b) => (a ?? "").localeCompare(b ?? "", "en"));
      return { field, type: "string", nullable: true, missing: data.missingByField[field], nullMeaning: data.canonicalKey === "schools" && field === "region_type" ? "來源以 null 表示非偏遠；不改成0，也不一律解讀為未知" : "未提供或無法匹配；不等於0", distinct: values.length, values: values.slice(0, 12), valuesTruncated: values.length > 12, derived: data.config.location === "address_prefix" && ["city", "district"].includes(field) };
    }), pagination: { defaultLimit: 20, maxLimit: 50 }, districtGrouping: "district 自動加入 city，避免同名鄉鎮合併；回傳行政區代碼。" };
}
export async function summarizeLayer(input: LayerSummaryInput): Promise<Record<string, unknown>> {
  if (!input || Object.keys(input).some(k => !["layerKey", "filters", "groupBy", "order", "offset", "limit"].includes(k))) throw new Error("INVALID_STATISTICS_INPUT");
  const { config } = configFor(input.layerKey);
  const offset = integer(input.offset, 0, 0, 10000); const limit = integer(input.limit, 20, 1, 50);
  const groupBy = input.groupBy ?? []; const filters = input.filters ?? []; const order = input.order ?? "count_desc";
  if (!Array.isArray(groupBy) || groupBy.length > 2 || new Set(groupBy).size !== groupBy.length || groupBy.some(f => !config.fields.includes(f))
    || !Array.isArray(filters) || filters.length > 5 || filters.some(f => !f || Object.keys(f).some(k => !["field", "value"].includes(k)) || !config.fields.includes(f.field) || !(f.value === null || typeof f.value === "string" && f.value.length <= 160))
    || !["count_desc", "count_asc", "key_asc"].includes(order)) throw new Error("STATISTICS_FIELD_NOT_ALLOWED");
  const effectiveGroups = groupBy.includes("district") && !groupBy.includes("city") ? ["city", ...groupBy] : [...groupBy];
  const data = await read(input.layerKey);
  const normalizedFilters = filters.map(f => ({ field: f.field, value: f.value === null ? null : normalize(f.value) }));
  const matched = data.rows.filter(r => normalizedFilters.every(f => r[f.field] === f.value));
  const buckets = new Map<string, Record<string, unknown>[]>();
  if (effectiveGroups.length) for (const row of matched) {
    const key = JSON.stringify(effectiveGroups.map(f => row[f]));
    const bucket = buckets.get(key) ?? []; bucket.push(row); buckets.set(key, bucket);
  }
  const groups = [...buckets.entries()].map(([key, rows]) => ({ key, values: Object.fromEntries(effectiveGroups.map(f => [f, rows[0]![f]])), count: rows.length,
    ...(effectiveGroups.includes("city") ? { cityCode: rows[0]!.city_code } : {}), ...(effectiveGroups.includes("district") ? { districtCode: rows[0]!.district_code } : {}), bounds: bounds(rows) }));
  groups.sort((a, b) => (order === "key_asc" ? 0 : order === "count_asc" ? a.count - b.count : b.count - a.count) || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  const returnedGroups = groups.slice(offset, offset + limit).map(({ key: _key, ...g }, i) => ({ ...g, rank: order === "key_asc" ? null : groups.findIndex(v => v.count === g.count) + 1, position: offset + i + 1 }));
  const unknownFilterRows = data.rows.filter(r => normalizedFilters.some(f => f.value !== null && r[f.field] === null && !(f.field === "region_type" && r.regionNullKnown))).length;
  return { ...metadata(data), operation: "count", totalRows: data.rows.length, totalMatched: matched.length, filters: normalizedFilters,
    filterUnknownRows: unknownFilterRows, countCompleteness: unknownFilterRows ? "partial_attribution" : "complete_for_asset", groupBy: effectiveGroups, order,
    groupTotal: groups.length, zeroCountGroupsIncluded: false, groups: returnedGroups, returned: returnedGroups.length, offset, limit, truncated: offset + returnedGroups.length < groups.length,
    nextOffset: offset + returnedGroups.length < groups.length ? offset + returnedGroups.length : null,
    matchedMissingByField: Object.fromEntries(config.fields.map(f => [f, matched.filter(r => r[f] === null).length])), bounds: bounds(matched),
    mapPresentation: { layerKey: data.canonicalKey, boundsMeaning: "符合紀錄的有效 Point 範圍；非行政區邊界，開圖層不會自動套用本查詢篩選。" } };
}
