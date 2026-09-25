import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const analyticsRoot = "/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/taipei-gis-analytics";
const osmRelative = "data/processed/water_resources/water_facilities_osm/water_facilities_osm.geojson";
const wraRelative = "data/processed/water_resources/pump_stations_wra/pump_stations_wra.geojson";
const displayPath = "public/geo/water_facilities.geojson";
const osmSha256 = "a37739bb35a422f99169ba8fb3361508c782e9824d8128046e49b75d4527b742";
const wraSha256 = "edb65b22c115c303a4a4597faaa55212a77f7a4e8aedb97faada98a4c68bd99a";
const displaySha256 = "e8174fcc90650280842c8f8b550cfd59b5ed95c63db40fb7db3a8382e034fa97";
const fields = ["facility_id", "name", "facility_type", "source", "operator", "county"];
const hash = value => createHash("sha256").update(value).digest("hex");
const fail = code => { throw new Error(code); };
const point = geometry => geometry?.type === "Point" && Array.isArray(geometry.coordinates) && geometry.coordinates.length === 2
  && geometry.coordinates.every(value => typeof value === "number" && Number.isFinite(value))
  && geometry.coordinates[0] >= 119 && geometry.coordinates[0] <= 123 && geometry.coordinates[1] >= 21 && geometry.coordinates[1] <= 26;

function collection(bytes, expectedSha, expectedRows, code) {
  if (hash(bytes) !== expectedSha) fail(`${code}_SHA_MISMATCH`);
  let parsed; try { parsed = JSON.parse(bytes.toString("utf8")); } catch { fail(`${code}_JSON_INVALID`); }
  if (parsed?.type !== "FeatureCollection" || !Array.isArray(parsed.features) || parsed.features.length !== expectedRows) fail(`${code}_COUNT_MISMATCH`);
  return parsed;
}

function canonical(feature, index, expectedSource) {
  if (feature?.type !== "Feature" || !point(feature.geometry) || !feature.properties || typeof feature.properties !== "object") fail(`WATER_FACILITIES_POINT_${index}`);
  const p = feature.properties;
  const facilityId = typeof p.id === "string" ? p.id : feature.id;
  if (typeof facilityId !== "string" || !facilityId || p.source !== expectedSource
    || ["name", "facility_type", "county"].some(field => typeof p[field] !== "string")
    || !(typeof p.operator === "string" || p.operator === null || p.operator === undefined)) fail(`WATER_FACILITIES_PROPERTIES_${index}`);
  return { type: "Feature", geometry: feature.geometry, properties: { facility_id: facilityId, name: p.name, facility_type: p.facility_type, source: p.source, operator: p.operator ?? null, county: p.county } };
}

function key(feature) {
  const [lng, lat] = feature.geometry.coordinates;
  const p = feature.properties;
  return `${p.facility_id}|${p.facility_type}|${p.source}|${lng.toFixed(9)}|${lat.toFixed(9)}`;
}

const [root = analyticsRoot, output = "../runtime/owner-only/water-facilities/water-facilities-owner-20260519.geojson", display = displayPath] = process.argv.slice(2);
const osm = collection(await readFile(resolve(root, osmRelative)), osmSha256, 526, "WATER_FACILITIES_OSM");
const wra = collection(await readFile(resolve(root, wraRelative)), wraSha256, 83, "WATER_FACILITIES_WRA");
const features = [...osm.features.map((feature, index) => canonical(feature, index, "osm")), ...wra.features.map((feature, index) => canonical(feature, index + 526, "wra_gic"))];
const keys = new Set(features.map(key));
if (keys.size !== 609) fail("WATER_FACILITIES_DUPLICATE_IDENTITY");
const mini = collection(await readFile(resolve(display)), displaySha256, 609, "WATER_FACILITIES_DISPLAY");
const displayKeys = new Set(mini.features.map((feature, index) => canonical(feature, index, index < 526 ? "osm" : "wra_gic")).map(key));
if (displayKeys.size !== keys.size || [...keys].some(value => !displayKeys.has(value))) fail("WATER_FACILITIES_DISPLAY_LINEAGE_MISMATCH");
const sourceCounts = Object.groupBy(features, feature => feature.properties.source);
const typeCounts = Object.groupBy(features, feature => feature.properties.facility_type);
if (sourceCounts.osm?.length !== 526 || sourceCounts.wra_gic?.length !== 83
  || typeCounts.pump_station?.length !== 234 || typeCounts.pump_station_official?.length !== 83
  || typeCounts.treatment_plant?.length !== 170 || typeCounts.water_tower?.length !== 122) fail("WATER_FACILITIES_SEMANTICS_MISMATCH");
const bytes = Buffer.from(`${JSON.stringify({ type: "FeatureCollection", features })}\n`);
const outputPath = resolve(output); await mkdir(dirname(outputPath), { recursive: true }); await writeFile(outputPath, bytes);
console.log(JSON.stringify({ osm: { sha256: osmSha256, rows: osm.features.length }, wra: { sha256: wraSha256, rows: wra.features.length }, display: { sha256: displaySha256, rows: mini.features.length }, retainedFields: fields, output: { path: outputPath, sha256: hash(bytes), bytes: bytes.length, rows: features.length } }));
