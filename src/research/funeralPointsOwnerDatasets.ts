import { boundedAccess, DEFAULT_VALUE_SEMANTICS, type DatasetDescriptor, type DatasetField, type Scalar, type SourceReceipt } from "./dataContracts";
import { loadPointDataset } from "./pointDatasetAdapter";
import { createReferencePointDatasetAdapter, type AdapterSnapshot } from "./queryAdapters";

type Family = {
  key: "facilities" | "operators";
  datasetId: string;
  sourceSha256: string;
  manifestSha256: string;
  count: number;
  fields: readonly DatasetField[];
  safeFields: readonly string[];
  idField: string;
  label: string;
  description: string;
  coverage: string;
  source: DatasetDescriptor["source"];
  exclusions: Readonly<Record<string, number>>;
};

const fields = (names: readonly string[], booleans: readonly string[] = []): readonly DatasetField[] => [
  { name: "record_id", type: "string", nullable: false, nullMeaning: null, unit: null },
  ...names.map(name => ({ name, type: booleans.includes(name) ? "boolean" as const : "string" as const, nullable: false, nullMeaning: null, unit: null })),
  { name: "geometry", type: "json", nullable: false, nullMeaning: null, unit: null },
];

const FACILITIES_SHA256 = "f358f04697fa477cdf99a033f4488be476c12948162d974010cc57fdbb899223";
const OPERATORS_SHA256 = "aa16c2de7b159068f276ef81d8a3dac1fd88d3334b0d20f521fd7a3f821b6c20";
const GOOGLE_COORDINATE_RIGHTS = "Google-derived coordinates have unverified public redistribution rights; this local sidecar remains owner-only.";

const facilities: Family = {
  key: "facilities", datasetId: "tw-funeral-facilities-20260805-owner-only", sourceSha256: FACILITIES_SHA256, manifestSha256: "fa8f04689e549dec2b1ec412b5c42ebf4aec4664e306be36a5a5b3f6a8220f49", count: 3707,
  safeFields: ["facility_id", "facility_uid", "source", "facility_type", "name", "operator_type", "county", "district", "eco_type", "geocode_source", "precision"], idField: "facility_uid",
  fields: fields(["facility_id", "facility_uid", "source", "facility_type", "name", "operator_type", "county", "district", "eco_type", "geocode_source", "precision"]),
  label: "殯葬設施（20260805 owner-only 參考點）",
  description: "內政部殯葬設施與環保自然葬名冊的 3,707 個已定位 Point 固定快照。bbox 必填且只讀命中的 immutable gzip 分片；未保留地址或電話。Google/NLSC/twland 等衍生座標權利或位置精度不足，最近點與距離分析 HOLD。",
  coverage: "2026-08-05 固定快照：母體 4,145，已定位 3,707（89.43%）；438 筆未定位未載入。precision：parcel_centroid 1,576、approximate 429；地號中心或概略座標不代表入口、地塊邊界或道路可達性。",
  source: { publisher: "內政部宗教及禮制司（data.gov.tw 7052、53681）", reference: `/research/funeral-points/facilities/source-identity/sha256-${FACILITIES_SHA256}`, lineage: "官方 raw 7052 主表 SHA-256 79df…26b6（3,751）+ 7052 北北基座標版 283b…75d2（328）+ 53681 環保自然葬 ed97…4fae（69）-> processed 3,707 Point GeoJSON SHA-256 f358…9223 -> safe-field owner-only gzip partitions。" },
  exclusions: { unlocated_source_records: 438, parcel_centroid_proxy: 1576, approximate_proxy: 429, google_coordinate_rights_unverified: 574 },
};

const operators: Family = {
  key: "operators", datasetId: "tw-funeral-operators-20260805-owner-only", sourceSha256: OPERATORS_SHA256, manifestSha256: "8f15496515e649b16784ba12db0cbe0bb9b835fb1510f3654acfcb77393f6d77", count: 6233,
  safeFields: ["operator_id", "source", "entity_type", "name", "county", "district", "status", "is_active", "geocode_source", "precision"], idField: "operator_id",
  // 上游 GeoJSON 明確將 True/False 輸出成字串；保留原值，不能擅自變成 boolean。
  fields: fields(["operator_id", "source", "entity_type", "name", "county", "district", "status", "is_active", "geocode_source", "precision"]),
  label: "殯葬禮儀服務業者（20260805 owner-only 登記參考點）",
  description: "經濟部商工登記 JZ99151 的 6,233 筆登記地 Point 固定快照。bbox 必填且只讀命中的 immutable gzip 分片；未保留統編、門牌、資本額與許可資訊。登記地不是服務範圍、營業現況、入口或可達性。",
  coverage: "2026-08-05 固定快照：6,233/6,233 已定位；4,569 is_active=true、1,664 false。每列是登記紀錄，包含遷址前後或失效紀錄；bbox 中無列不能推論當地沒有業者。",
  source: { publisher: "經濟部商業發展署（data.gov.tw / 商工登記 81112、32679）", reference: `/research/funeral-points/operators/source-identity/sha256-${OPERATORS_SHA256}`, lineage: "官方 raw 商業登記 SHA-256 3793…0279（4,199）+ 公司登記 ada5…781d（2,034）-> processed 6,233 Point GeoJSON SHA-256 aa16…6c20 -> safe-field owner-only gzip partitions。" },
  exclusions: { inactive_registration_records: 1664, google_coordinate_rights_unverified: 48 },
};

function descriptor(family: Family): DatasetDescriptor {
  return {
    schemaVersion: "pulse-dataset/0.1", datasetId: family.datasetId, label: family.label, description: family.description,
    layerRefs: [family.key === "facilities" ? "funeralFacilities" : "funeralOperators"], kind: "point", recordGrain: "place", primaryKey: ["record_id"], fields: family.fields,
    geometry: { type: "Point", crs: "EPSG:4326", role: "proxy", precision: `${GOOGLE_COORDINATE_RIGHTS} Reference Points include source/geocoder/parcel-centroid results and cannot establish nearest facility/operator, exact distance, entrance, parcel boundary, routing, walking, transit access, or current service availability.`, spatialAnalysisEligible: false }, timeFields: [], coverage: family.coverage,
    license: `Official raw rosters are OGDL-Taiwan-1.0. ${GOOGLE_COORDINATE_RIGHTS} This reader is localhost owner-only; public layer equivalence is unverified.`,
    valueSemantics: { ...DEFAULT_VALUE_SEMANTICS, missing: family.key === "facilities" ? "BBox has no loaded Point, or the source record is one of 438 unlocated records; it is not evidence of no facility." : "BBox has no loaded registration Point; it is not evidence of no operator or no service coverage.", stale: "20260805 fixed snapshot does not establish current operation, registration, opening, closure, capacity, service scope, or access." },
    versions: [{ versionId: `20260805-geojson-sha256:${family.sourceSha256}`, observedAt: null, availableAt: "2026-08-05", checksumSha256: family.sourceSha256, mutable: false }], source: family.source,
    access: boundedAccess({ mode: "owner_only", method: "pmtiles_sidecar", fields: family.fields.map(field => field.name), filters: family.safeFields, supportsBbox: true, maxRowsPerQuery: 100, maxScanRows: 20_000, maxSourceBytes: 8 * 1024 * 1024 }), supportedOperations: ["query_records", "aggregate"], adapterId: `funeral-${family.key}-owner-reference-partitions-v1`,
  };
}

export const funeralFacilitiesOwnerDescriptor = descriptor(facilities);
export const funeralOperatorsOwnerDescriptor = descriptor(operators);

async function readFamily(family: Family, descriptorValue: DatasetDescriptor, _parameters: Readonly<Record<string, Scalar>>, signal?: AbortSignal, context?: { bbox?: readonly [number, number, number, number] }): Promise<AdapterSnapshot> {
  if (!context?.bbox) throw new Error("BBOX_REQUIRED");
  const reference = descriptorValue.source.reference;
  const snapshot = await loadPointDataset({ datasetId: descriptorValue.datasetId, url: reference, idField: family.idField, safeFields: family.safeFields, spatialPartition: { manifestUrl: `/__local-research-owner-only/funeral-points/${family.key}/manifest.json`, manifestSha256: family.manifestSha256, sourceSha256: family.sourceSha256 } }, { bbox: context.bbox, signal });
  if (snapshot.checksumSha256 !== family.sourceSha256 || snapshot.exclusions.missing_geometry || snapshot.exclusions.non_point_geometry || snapshot.exclusions.invalid_geometry) throw new Error(`FUNERAL_${family.key.toUpperCase()}_SOURCE_SEMANTICS_MISMATCH`);
  const source: SourceReceipt = { sourceId: descriptorValue.datasetId, version: `sha256:${family.sourceSha256}`, acquiredAt: snapshot.acquiredAt, checksumSha256: family.sourceSha256, reference };
  return { rows: snapshot.rows, source, coverage: descriptorValue.coverage, freshness: "stale", exclusions: { ...family.exclusions, ...snapshot.exclusions }, rowsScanned: snapshot.rows.length, bytesScanned: snapshot.bytes, downloadedBytes: snapshot.downloadedBytes, requests: snapshot.requests, cacheHit: snapshot.cacheHit };
}

export const funeralFacilitiesOwnerAdapter = createReferencePointDatasetAdapter(funeralFacilitiesOwnerDescriptor, (parameters, signal, context) => readFamily(facilities, funeralFacilitiesOwnerDescriptor, parameters, signal, context));
export const funeralOperatorsOwnerAdapter = createReferencePointDatasetAdapter(funeralOperatorsOwnerDescriptor, (parameters, signal, context) => readFamily(operators, funeralOperatorsOwnerDescriptor, parameters, signal, context));
