import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const rawSha = "e57dc9f32d63a3456b433395a5d13d64bf3ba09dac8dacf627ff4c602c9fd891";
const processedSha = "33d38a6ea41a4d04882f67a57cb32a537c1cdf1cbf98d84bdc287da7a36a932d";
const displaySha = "5f283e24f90e1ae1e53711762a80b438ea259b0b53b1aeb534b38faed49b452e";
const fields = ["museum_id", "name", "name_eng", "type", "city", "source", "precision", "coord_status"];
const expectedPrecision = { exact: 184, approximate: 34, interpolated: 24, cached: 10, "": 14 };
const expectedSources = { google: 80, offline_l1: 10, offline_l15: 24, offline_l2: 138, "": 14 };
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
const fail = code => { throw new Error(code); };
const countBy = (rows, select) => Object.fromEntries([...new Set(rows.map(select))].map(value => [String(value), rows.filter(row => select(row) === value).length]));
const equalCounts = (actual, expected) => JSON.stringify(Object.keys(actual).sort().map(key => [key, actual[key]])) === JSON.stringify(Object.keys(expected).sort().map(key => [key, expected[key]]));
const point = geometry => geometry?.type === "Point" && Array.isArray(geometry.coordinates) && geometry.coordinates.length === 2
  && geometry.coordinates.every(Number.isFinite) && Math.abs(geometry.coordinates[0]) <= 180 && Math.abs(geometry.coordinates[1]) <= 90;
const cleaned = value => typeof value === "string" ? value.trim() : "";
const rawKey = row => JSON.stringify([row.name, row.name_eng, row.type, row.address, row.website, row.facebook, row.srcWebsite].map(cleaned));
const processedKey = props => JSON.stringify([props.name, props.name_eng, props.type, props.address, props.website, props.facebook, props.srcWebsite]);

const [rawArg, processedArg, displayArg, outputArg] = process.argv.slice(2);
if (!rawArg || !processedArg || !displayArg) fail("Usage: node scripts/research/build-cultural-museums-owner-source.mjs <raw.json> <processed.geojson> <display.geojson> [output.geojson]");
const rawPath = resolve(rawArg);
const processedPath = resolve(processedArg);
const displayPath = resolve(displayArg);
const output = resolve(outputArg ?? "../runtime/owner-only/cultural-museums/cultural-museums-owner-20260716.geojson");

const rawBytes = await readFile(rawPath);
if (sha(rawBytes) !== rawSha) fail("CULTURAL_MUSEUMS_RAW_SHA_MISMATCH");
const raw = JSON.parse(rawBytes.toString("utf8"));
if (!Array.isArray(raw) || raw.length !== 266 || raw.some(row => !row || typeof row !== "object" || ["name", "name_eng", "address", "srcWebsite", "cityName", "latitude", "longitude"].some(field => typeof row[field] !== "string") || ["type", "website", "facebook"].some(field => row[field] !== undefined && typeof row[field] !== "string"))) fail("CULTURAL_MUSEUMS_RAW_SCHEMA_MISMATCH");
if (raw.some(row => row.latitude !== "" || row.longitude !== "") || raw.filter(row => row.address === "").length !== 14 || raw.filter(row => row.cityName === "").length !== 22) fail("CULTURAL_MUSEUMS_RAW_SEMANTICS_MISMATCH");

const processedBytes = await readFile(processedPath);
if (sha(processedBytes) !== processedSha) fail("CULTURAL_MUSEUMS_PROCESSED_SHA_MISMATCH");
const processed = JSON.parse(processedBytes.toString("utf8"));
if (processed?.type !== "FeatureCollection" || !Array.isArray(processed.features) || processed.features.length !== 266) fail("CULTURAL_MUSEUMS_PROCESSED_COUNT_MISMATCH");
const processedIds = new Set();
for (const feature of processed.features) {
  const p = feature?.properties;
  if (feature?.type !== "Feature" || !p || typeof p.id !== "string" || !p.id || processedIds.has(p.id)
    || ["name", "name_eng", "type", "address", "city", "website", "facebook", "srcWebsite", "source", "precision", "coord_status"].some(field => typeof p[field] !== "string")
    || !(point(feature.geometry) || feature.geometry === null) || !["ok", "no_coord"].includes(p.coord_status)
    || p.coord_status === "ok" && !point(feature.geometry) || p.coord_status === "no_coord" && feature.geometry !== null) fail("CULTURAL_MUSEUMS_PROCESSED_FEATURE_INVALID");
  processedIds.add(p.id);
}
if (!equalCounts(countBy(processed.features, feature => feature.properties.precision), expectedPrecision)
  || !equalCounts(countBy(processed.features, feature => feature.properties.source), expectedSources)
  || processed.features.filter(feature => feature.geometry === null).length !== 14) fail("CULTURAL_MUSEUMS_PROCESSED_SEMANTICS_MISMATCH");
const rawKeys = new Set(raw.map(rawKey));
if (rawKeys.size !== 266 || processed.features.some(feature => !rawKeys.has(processedKey(feature.properties)))) fail("CULTURAL_MUSEUMS_RAW_PROCESSED_ALIGNMENT_MISMATCH");

const displayBytes = await readFile(displayPath);
if (sha(displayBytes) !== displaySha) fail("CULTURAL_MUSEUMS_DISPLAY_SHA_MISMATCH");
const display = JSON.parse(displayBytes.toString("utf8"));
if (display?.type !== "FeatureCollection" || !Array.isArray(display.features) || display.features.length !== 252) fail("CULTURAL_MUSEUMS_DISPLAY_COUNT_MISMATCH");
const byId = new Map(processed.features.map(feature => [feature.properties.id, feature]));
for (const feature of display.features) {
  const p = feature?.properties;
  const source = byId.get(p?.id);
  if (feature?.type !== "Feature" || !p || !point(feature.geometry) || !source || source.geometry === null
    || JSON.stringify(feature.geometry) !== JSON.stringify(source.geometry)
    || ["id", "address", "city", "name", "name_eng", "type", "website", "facebook", "srcWebsite", "source", "precision"].some(field => p[field] !== source.properties[field])) fail("CULTURAL_MUSEUMS_DISPLAY_ALIGNMENT_MISMATCH");
}
if (new Set(display.features.map(feature => feature.properties.id)).size !== 252) fail("CULTURAL_MUSEUMS_DISPLAY_ID_MISMATCH");

const features = processed.features.map(feature => ({
  type: "Feature", geometry: feature.geometry,
  properties: {
    museum_id: feature.properties.id,
    name: feature.properties.name,
    name_eng: feature.properties.name_eng,
    type: feature.properties.type,
    city: feature.properties.city,
    source: feature.properties.source,
    precision: feature.properties.precision,
    coord_status: feature.properties.coord_status,
  },
}));
const out = `${JSON.stringify({ type: "FeatureCollection", features })}\n`;
await mkdir(dirname(output), { recursive: true });
await writeFile(output, out);
console.log(JSON.stringify({ rawPath, rawSha, processedPath, processedSha, displayPath, displaySha, output, outputSha: sha(out), bytes: Buffer.byteLength(out), records: features.length, fields, precision: expectedPrecision, source: expectedSources, nullGeometry: 14, displayAlignedPoints: 252 }));
