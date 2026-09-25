import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const SOURCE_SHA256 = "a22841339ec56843b14effec9564461228c42e9c58a2df48659fa34c83a26afa";
const SOURCE_ROWS = 1292;
const KINDS = new Set(["subpackaging", "retailer", "cstation", "dealer", "facility_mixed"]);
const RETAILER_KINDS = new Set(["retailer", "cstation", "dealer"]);
const digest = bytes => createHash("sha256").update(bytes).digest("hex");
const fail = code => { throw new Error(code); };
const input = resolve(process.argv[2] ?? "../taipei-gis-analytics/data/processed/energy/lpg_facilities_canonical/lpg_facilities_canonical_20260620.geojson");
const outputRoot = resolve(process.argv[3] ?? "../runtime/owner-only/lpg");
const bytes = await readFile(input);
if (digest(bytes) !== SOURCE_SHA256) fail("LPG_OWNER_SOURCE_SHA_MISMATCH");
const source = JSON.parse(bytes.toString("utf8"));
if (source?.type !== "FeatureCollection" || !Array.isArray(source.features) || source.features.length !== SOURCE_ROWS) fail("LPG_OWNER_SOURCE_COUNT_MISMATCH");

function valid(feature) {
  const p = feature?.properties, c = feature?.geometry?.coordinates;
  if (feature?.type !== "Feature" || feature.geometry?.type !== "Point" || !Array.isArray(c) || c.length !== 2
    || c.some(value => typeof value !== "number" || !Number.isFinite(value)) || c[0] < 118 || c[0] > 123 || c[1] < 21 || c[1] > 27
    || !p || typeof p.entity_id !== "string" || !p.entity_id || typeof p.name !== "string" || !p.name
    || !Array.isArray(p.facility_kinds) || !p.facility_kinds.length || p.facility_kinds.some(kind => typeof kind !== "string" || !KINDS.has(kind))
    || !Number.isInteger(p.source_tier) || ![1, 2].includes(p.source_tier) || typeof p.source !== "string" || typeof p.coord_source !== "string"
    || typeof p.fetched_at !== "string" || typeof p.license !== "string" || (p.confidence !== null && (typeof p.confidence !== "number" || !Number.isFinite(p.confidence)))) fail("LPG_OWNER_SOURCE_FEATURE_INVALID");
}

for (const feature of source.features) valid(feature);
const entityIdCounts = new Map();
for (const feature of source.features) entityIdCounts.set(feature.properties.entity_id, (entityIdCounts.get(feature.properties.entity_id) ?? 0) + 1);
const duplicateEntityIds = [...entityIdCounts.values()].filter(count => count > 1).length;
if (duplicateEntityIds !== 82) fail("LPG_OWNER_ENTITY_ID_SEMANTICS_MISMATCH");
const hasKind = (feature, kind) => feature.properties.facility_kinds.includes(kind);
const subpackaging = source.features.filter(feature => hasKind(feature, "subpackaging"));
const retailers = source.features.filter(feature => feature.properties.facility_kinds.some(kind => RETAILER_KINDS.has(kind)));
if (subpackaging.length !== 107 || retailers.length !== 567) fail("LPG_OWNER_CATEGORY_COUNT_MISMATCH");

function safe(feature, category) {
  const p = feature.properties;
  const kinds = new Set(p.facility_kinds);
  const isRetailer = kinds.has("retailer"), isCstation = kinds.has("cstation"), isDealer = kinds.has("dealer"), isSubpackaging = kinds.has("subpackaging");
  if (category === "subpackaging" ? !isSubpackaging : !(isRetailer || isCstation || isDealer)) fail("LPG_OWNER_CATEGORY_MAPPING_MISMATCH");
  return { type: "Feature", geometry: feature.geometry, properties: {
    entity_id: p.entity_id, name: p.name, category,
    is_subpackaging: isSubpackaging, is_retailer: isRetailer, is_cstation: isCstation, is_dealer: isDealer,
    source: p.source, source_tier: p.source_tier, coord_source: p.coord_source, fetched_at: p.fetched_at, confidence: p.confidence, license: p.license,
  } };
}

const outputs = [
  ["subpackaging", subpackaging, "lpg-subpackaging-owner-20260620.geojson"],
  ["retailers", retailers, "lpg-retailers-owner-20260620.geojson"],
];
await mkdir(outputRoot, { recursive: true });
const receipt = { source: { sha256: SOURCE_SHA256, bytes: bytes.byteLength, rows: SOURCE_ROWS, duplicateEntityIds }, subsets: {} };
for (const [category, features, filename] of outputs) {
  const serialized = `${JSON.stringify({ type: "FeatureCollection", features: features.map(feature => safe(feature, category)) })}\n`;
  const path = resolve(outputRoot, filename);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, serialized);
  receipt.subsets[category] = { rows: features.length, sha256: digest(serialized), bytes: Buffer.byteLength(serialized), path, excludedFacilityMixedOnly: source.features.filter(feature => feature.properties.facility_kinds.length === 1 && feature.properties.facility_kinds[0] === "facility_mixed").length };
}
await writeFile(resolve(outputRoot, "manifest-receipt.json"), `${JSON.stringify({ schemaVersion: "pulse-lpg-owner-only/1", ...receipt, license: "RIGHTS_HOLD: catalog says 13-source mixed OGDL and CC BY, while processed per-row license is all OGDL-Taiwan-1.0; do not promote until source-by-source license receipt is reconciled.", geometry: "processed canonical reference Points; owner-only bbox and attribute lookup only, no nearest, entrance, availability, service coverage, route or accessibility claim.", duplicateEntityIdSemantics: "82 grid-derived entity_id values repeat among 1,292 features; record_id is generated from immutable sidecar ordinal, so entity_id is a non-unique source attribute.", excludedFields: ["_provenance", "aliases", "all_sources", "source_url", "address", "phone", "name_raw"] }, null, 2)}\n`);
console.log(JSON.stringify(receipt));
