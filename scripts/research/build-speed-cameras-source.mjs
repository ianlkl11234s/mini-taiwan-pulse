import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const inputSha = "ce46f68a1ae617a0ae6a14ecaf470613b5a7587cb5b2c5f57709a80c596bb740";
const expectedSubtypes = {
  speed_camera_general: 2620,
  speed_camera_freeway: 169,
  red_light_camera: 10,
  railway_crossing_camera: 6,
};
const fields = ["entity_id", "name", "facility_subtype", "city", "region", "limit_kph", "source", "source_tier", "fetched_at", "coord_suspect", "confidence", "n_sources"];
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
const fail = code => { throw new Error(code); };
const [inputArg, outputArg] = process.argv.slice(2);
if (!inputArg) fail("Usage: node scripts/research/build-speed-cameras-source.mjs <analytics-processed.geojson> [output.geojson]");
const input = resolve(inputArg);
const output = resolve(outputArg ?? "public/research/speed-cameras-source-20260824.geojson");
const bytes = await readFile(input);
if (sha(bytes) !== inputSha) fail("SPEED_CAMERAS_SOURCE_SHA_MISMATCH");

const collection = JSON.parse(bytes.toString("utf8"));
if (collection?.type !== "FeatureCollection" || !Array.isArray(collection.features) || collection.features.length !== 2805) fail("SPEED_CAMERAS_SOURCE_COUNT_MISMATCH");
const ids = new Set();
const subtypeCounts = Object.fromEntries(Object.keys(expectedSubtypes).map(key => [key, 0]));
let suspectCount = 0;
let missingFetchedAt = 0;
const features = collection.features.map(feature => {
  const p = feature?.properties;
  const coordinates = feature?.geometry?.coordinates;
  if (feature?.type !== "Feature" || feature.geometry?.type !== "Point" || !Array.isArray(coordinates) || coordinates.length !== 2 || !coordinates.every(Number.isFinite)
    || !p || typeof p.entity_id !== "string" || !p.entity_id || ids.has(p.entity_id) || !Object.hasOwn(expectedSubtypes, p.facility_subtype)
    || (p.name != null && typeof p.name !== "string") || typeof p.source !== "string" || !p.source || !Number.isSafeInteger(p.source_tier)
    || typeof p.fetched_at !== "string" || !["", "2026-08-24"].includes(p.fetched_at) || typeof p.coord_suspect !== "boolean" || !Number.isFinite(p.confidence) || !Number.isSafeInteger(p._n_sources)) fail("SPEED_CAMERAS_SOURCE_FEATURE_INVALID");
  const outsideTaiwanBbox = coordinates[0] < 119 || coordinates[0] > 122.2 || coordinates[1] < 21.8 || coordinates[1] > 25.4;
  if (p.coord_suspect !== outsideTaiwanBbox) fail("SPEED_CAMERAS_SOURCE_SUSPECT_SEMANTICS_MISMATCH");
  ids.add(p.entity_id); subtypeCounts[p.facility_subtype]++;
  if (p.coord_suspect) suspectCount++;
  if (!p.fetched_at) missingFetchedAt++;
  return { type: "Feature", geometry: feature.geometry, properties: Object.fromEntries(fields.map(field => {
    const sourceField = field === "n_sources" ? "_n_sources" : field;
    return [field, field === "fetched_at" && !p[sourceField] ? null : p[sourceField] ?? null];
  })) };
});
if (Object.entries(expectedSubtypes).some(([subtype, count]) => subtypeCounts[subtype] !== count) || suspectCount !== 62 || missingFetchedAt !== 25) fail("SPEED_CAMERAS_SOURCE_SEMANTICS_MISMATCH");
const out = `${JSON.stringify({ type: "FeatureCollection", features })}\n`;
await mkdir(dirname(output), { recursive: true });
await writeFile(output, out);
console.log(JSON.stringify({ input, inputSha, output, outputSha: sha(out), bytes: Buffer.byteLength(out), records: features.length, suspectCount, spatialEligible: features.length - suspectCount, missingFetchedAt, subtypeCounts }));
