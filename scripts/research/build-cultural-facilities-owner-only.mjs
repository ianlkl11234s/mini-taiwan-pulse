import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const analyticsRoot = "/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/taipei-gis-analytics";
const raw = [
  ["data/raw/culture/cultural_facilities_moc/maintype2_20260716.json", "65ca99559c387deaf4394fe7b5e1fde03a9bb278e6ddbe4b3598a1481a9b5521"],
  ["data/raw/culture/cultural_facilities_moc/typeid_H_20260716.json", "886df91dbbd4e229bc54caa4d8520e54eee207f34ab44091367c8097ec5ccd3e"],
  ["data/raw/culture/cultural_facilities_moc/typeid_I_20260716.json", "e2a844b9cca4571a38d4af42d1c69318c03c6fa49ab900d99905f4d07b45a77b"],
  ["data/raw/culture/cultural_facilities_moc/typeid_K_20260716.json", "7d8f61491fea6603e6a689e73cbcb9c59fcbd2640e671ad96e88cab966775d25"],
  ["data/raw/culture/cultural_facilities_moc/typeid_L_20260716.json", "d0071505a3947c8a1ff3d41f8ed61afc12cc46395ef99b3eabdca6b4da8f076b"],
  ["data/raw/culture/cultural_facilities_moc/typeid_M_20260716.json", "d68829d9694ff177835b2e58079c1a3285ceccf064952b6870c5b484a005305c"],
];
const processed = "data/processed/culture/cultural_facilities_moc/cultural_facilities_moc_20260716.geojson";
const processedSha256 = "5b018ab1615c4fb818f8b147cbb77df51f4ae8fb42abec231f792a615781a89b";
const display = "public/culture/cultural_facilities_national.geojson";
const displaySha256 = "0f7d0d93b9695c2beb45f5916fb0185f1aac30c9e333669ebe31bc55f506591d";
const hash = value => createHash("sha256").update(value).digest("hex");
const fail = code => { throw new Error(code); };
const point = geometry => geometry?.type === "Point" && Array.isArray(geometry.coordinates) && geometry.coordinates.length === 2
  && geometry.coordinates.every(value => typeof value === "number" && Number.isFinite(value))
  && geometry.coordinates[0] >= 118 && geometry.coordinates[0] <= 124 && geometry.coordinates[1] >= 21 && geometry.coordinates[1] <= 27;
const displayKey = feature => JSON.stringify([feature.geometry.coordinates.map(value => Number(value.toFixed(9))), feature.properties.name, feature.properties.address, feature.properties.city, feature.properties.facility_type, feature.properties.source_type_id]);
const [root = analyticsRoot, outputRoot = "../runtime/owner-only/cultural-facilities"] = process.argv.slice(2);

for (const [path, expectedSha256] of raw) if (hash(await readFile(resolve(root, path))) !== expectedSha256) fail("CULTURAL_FACILITIES_RAW_SHA_MISMATCH");
const processedBytes = await readFile(resolve(root, processed));
if (hash(processedBytes) !== processedSha256) fail("CULTURAL_FACILITIES_PROCESSED_SHA_MISMATCH");
const collection = JSON.parse(processedBytes.toString("utf8"));
if (collection?.type !== "FeatureCollection" || !Array.isArray(collection.features) || collection.features.length !== 1170) fail("CULTURAL_FACILITIES_PROCESSED_COUNT_MISMATCH");
const displayBytes = await readFile(resolve(process.cwd(), display));
if (hash(displayBytes) !== displaySha256) fail("CULTURAL_FACILITIES_DISPLAY_SHA_MISMATCH");
const displayCollection = JSON.parse(displayBytes.toString("utf8"));
if (displayCollection?.type !== "FeatureCollection" || !Array.isArray(displayCollection.features) || displayCollection.features.length !== 787 || displayCollection.features.some(feature => !point(feature.geometry))) fail("CULTURAL_FACILITIES_DISPLAY_SEMANTICS_MISMATCH");

let located = 0, unlocated = 0;
const features = collection.features.map((feature, index) => {
  const p = feature?.properties;
  if (feature?.type !== "Feature" || !p || typeof p !== "object" || ["name", "address", "city", "facility_type", "source_type_id", "coord_status"].some(field => typeof p[field] !== "string")) fail(`CULTURAL_FACILITIES_PROPERTIES_${index}`);
  if (point(feature.geometry)) located++; else if (feature.geometry === null && p.coord_status === "no_coord") unlocated++; else fail(`CULTURAL_FACILITIES_GEOMETRY_${index}`);
  return { type: "Feature", geometry: feature.geometry, properties: { facility_id: `cultural-facilities-20260716-${index}`, name: p.name, address: p.address, city: p.city, facility_type: p.facility_type, source_type_id: p.source_type_id, coord_status: p.coord_status } };
});
if (located !== 787 || unlocated !== 383) fail("CULTURAL_FACILITIES_GEOMETRY_COUNT_MISMATCH");
const sourceDisplayKeys = new Set(collection.features.filter(feature => point(feature.geometry)).map(displayKey));
if (sourceDisplayKeys.size !== 787 || displayCollection.features.some(feature => !sourceDisplayKeys.has(displayKey(feature)))) fail("CULTURAL_FACILITIES_DISPLAY_LINEAGE_MISMATCH");
const bytes = Buffer.from(`${JSON.stringify({ type: "FeatureCollection", features })}\n`);
const output = resolve(outputRoot, "cultural-facilities-owner-20260716.geojson");
await mkdir(dirname(output), { recursive: true }); await writeFile(output, bytes);
console.log(JSON.stringify({ raw: raw.map(([path, sha256]) => ({ path, sha256 })), processed: { sha256: processedSha256, rows: 1170 }, display: { sha256: displaySha256, rows: 787 }, output: { path: output, sha256: hash(bytes), bytes: bytes.length, rows: features.length, located, unlocated } }));
