import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const inputSha = "63dadd2cf7e764138e2cca8bdd57010464b91fb5c3d90afa8a65c8349e83e2e7";
const fields = ["entity_id", "name", "facility_subtype", "source", "source_tier", "coord_source", "fetched_at", "confidence", "n_sources"];
const expectedSubtypes = { headquarters: 5, other: 31, police_dept: 27, precinct: 163, specialized: 298, substation: 1541 };
const expectedSources = { chiayi_mirror_168315: 2, npa_main_5958: 1686, npa_units_24419: 377 };
const fail = code => { throw new Error(code); };
const sha = bytes => createHash("sha256").update(bytes).digest("hex");

const [inputArg, outputArg] = process.argv.slice(2);
if (!inputArg) fail("Usage: node scripts/research/build-police-stations-source.mjs <analytics-processed.geojson> [output.geojson]");
const input = resolve(inputArg);
const output = resolve(outputArg ?? "public/research/police-stations-20260626.geojson");
const bytes = await readFile(input);
if (sha(bytes) !== inputSha) fail("POLICE_STATIONS_SOURCE_SHA_MISMATCH");
const collection = JSON.parse(bytes.toString("utf8"));
if (collection.type !== "FeatureCollection" || !Array.isArray(collection.features) || collection.features.length !== 2065) fail("POLICE_STATIONS_SOURCE_COUNT_MISMATCH");

const subtypes = Object.fromEntries(Object.keys(expectedSubtypes).map(key => [key, 0]));
const sources = Object.fromEntries(Object.keys(expectedSources).map(key => [key, 0]));
const entityIds = new Set();
const features = collection.features.map(feature => {
  const p = feature?.properties;
  const c = feature?.geometry?.coordinates;
  if (feature?.type !== "Feature" || !p || feature.geometry?.type !== "Point" || !Array.isArray(c) || c.length !== 2
    || !c.every(Number.isFinite) || Math.abs(c[0]) > 180 || Math.abs(c[1]) > 90
    || typeof p.entity_id !== "string" || !p.entity_id || typeof p.name !== "string" || !p.name
    || !Object.hasOwn(subtypes, p.facility_subtype) || !Object.hasOwn(sources, p.source)
    || p.coord_source !== p.source || !(p.source_tier === 1 || p.source_tier === 4)
    || p.fetched_at !== "2026-06-26" || !Number.isFinite(p.confidence) || !Number.isInteger(p.n_sources) || p.n_sources < 1
    || !Array.isArray(p.aliases) || typeof p.address !== "string" || typeof p.phone !== "string" || typeof p.postal !== "string"
    || typeof p.name_en !== "string" || !Array.isArray(p._provenance)) fail("POLICE_STATIONS_SOURCE_FEATURE_INVALID");
  entityIds.add(p.entity_id);
  subtypes[p.facility_subtype]++;
  sources[p.source]++;
  return { type: "Feature", geometry: feature.geometry, properties: Object.fromEntries(fields.map(field => [field, p[field]])) };
});
if (Object.keys(expectedSubtypes).some(key => subtypes[key] !== expectedSubtypes[key])
  || Object.keys(expectedSources).some(key => sources[key] !== expectedSources[key])
  || entityIds.size !== 1860) fail("POLICE_STATIONS_SOURCE_SEMANTICS_MISMATCH");
const out = `${JSON.stringify({ type: "FeatureCollection", features })}\n`;
await mkdir(dirname(output), { recursive: true });
await writeFile(output, out);
console.log(JSON.stringify({ input, inputSha, output, outputSha: sha(out), bytes: Buffer.byteLength(out), records: features.length, uniqueEntityIds: entityIds.size, duplicateEntityIdRows: features.length - entityIds.size, subtypes, sources }));
