import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.argv[2] ?? "/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/taipei-gis-analytics";
const output = resolve(process.argv[3] ?? "../runtime/owner-only/aquaculture-zone");
const sourcePath = resolve(root, "data/processed/agriculture/aquaculture_production_zone/aquaculture_production_zone.geojson");
const expectedSha = "3096bf94ac94a98b642bd011e846ab7b886807b0bfe8c01fd8cb4aae05fcdb8e";
const expectedCount = 62;
const sha = value => createHash("sha256").update(value).digest("hex");
const json = value => Buffer.from(`${JSON.stringify(value)}\n`);
const fail = code => { throw new Error(code); };
const geometryTypes = new Set(["Polygon", "MultiPolygon"]);
function coords(value, out = []) { if (Array.isArray(value)) { if (value.length >= 2 && value.every(Number.isFinite)) out.push(value); else value.forEach(item => coords(item, out)); } return out; }
function featureBbox(feature) { const points = coords(feature.geometry.coordinates); if (!points.length) fail("AQUACULTURE_ZONE_EMPTY_GEOMETRY"); const xs = points.map(p => p[0]), ys = points.map(p => p[1]); return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]; }
const validBbox = b => Array.isArray(b) && b.length === 4 && b.every(Number.isFinite) && b[0] <= b[2] && b[1] <= b[3];
async function main() {
  const source = await readFile(sourcePath); if (sha(source) !== expectedSha) fail("AQUACULTURE_ZONE_SOURCE_SHA_MISMATCH");
  const collection = JSON.parse(source); if (collection?.type !== "FeatureCollection" || collection.features.length !== expectedCount) fail("AQUACULTURE_ZONE_SOURCE_SCHEMA_MISMATCH");
  const ids = new Set(), features = collection.features.map((feature, index) => {
    if (feature?.type !== "Feature" || !geometryTypes.has(feature.geometry?.type)) fail("AQUACULTURE_ZONE_GEOMETRY_MISMATCH");
    if (!feature.properties || typeof feature.properties.zone_name !== "string" || typeof feature.properties.county !== "string" || typeof feature.properties.township !== "string" || typeof feature.properties.area_ha !== "number" || !Number.isFinite(feature.properties.area_ha)) fail("AQUACULTURE_ZONE_FIELD_MISMATCH");
    const id = `${index}:${feature.properties.zone_name}:${feature.properties.county}`; if (ids.has(id)) fail("AQUACULTURE_ZONE_DUPLICATE_ID"); ids.add(id);
    return { type: "Feature", sourceOrdinal: index, geometry: feature.geometry, properties: { record_id: id, zone_name: feature.properties.zone_name, county: feature.properties.county, township: feature.properties.township, area_ha: feature.properties.area_ha } };
  });
  await rm(output, { recursive: true, force: true }); await mkdir(output, { recursive: true });
  const payload = json({ type: "FeatureCollection", features }); await writeFile(resolve(output, "aquaculture-zone.geojson"), payload);
  const receipt = { schemaVersion: "pulse-aquaculture-zone-owner-only/1", source: { sha256: expectedSha, bytes: source.length, featureCount: expectedCount }, output: { sha256: sha(payload), bytes: payload.length, featureCount: features.length }, publisher: "農業部漁業署", license: "OGDL-Taiwan-1.0", availableAt: "2026-05-19", geometry: { types: ["Polygon", "MultiPolygon"], crs: "EPSG:4326", semantics: "法定陸上養殖魚塭生產區範圍；bbox queries return geometry whose envelope intersects the bbox." }, nullCounts: { zone_name: 0, county: 0, township: 0, area_ha: 0 }, sourcePath };
  await writeFile(resolve(output, "manifest-receipt.json"), json(receipt)); console.log(JSON.stringify(receipt));
}
await main();
