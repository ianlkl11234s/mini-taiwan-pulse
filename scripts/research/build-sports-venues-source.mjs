import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const inputSha = "f6a925cc9bd83903d4e34404680b32d9b0ced5f96a4f9ed72ae97650c298feb0";
const expectedLayers = { "學校場館": 12221, "其他公共場館": 1135, "民營場館": 691, "運動公園/開放空間": 596, "國民運動中心": 357 };
const fields = ["venue_id", "layer", "city", "district", "name", "category", "open_status", "area_sqm"];
const fail = code => { throw new Error(code); };
const sha = bytes => createHash("sha256").update(bytes).digest("hex");

const [inputArg, outputArg] = process.argv.slice(2);
if (!inputArg) fail("Usage: node scripts/research/build-sports-venues-source.mjs <analytics-processed.geojson> [output.geojson]");
const input = resolve(inputArg);
const output = resolve(outputArg ?? "../runtime/research-public/sports-venues-source-20260704.geojson");
const bytes = await readFile(input);
if (sha(bytes) !== inputSha) fail("SPORTS_SOURCE_SHA_MISMATCH");
const collection = JSON.parse(bytes.toString("utf8"));
if (collection.type !== "FeatureCollection" || !Array.isArray(collection.features) || collection.features.length !== 15000) fail("SPORTS_SOURCE_COUNT_MISMATCH");
const counts = Object.fromEntries(Object.keys(expectedLayers).map(layer => [layer, 0]));
const ids = new Set();
let missingArea = 0;
const features = collection.features.map(feature => {
  const p = feature.properties;
  const coordinates = feature.geometry?.coordinates;
  if (feature.type !== "Feature" || feature.geometry?.type !== "Point" || !Array.isArray(coordinates) || coordinates.length !== 2
    || !coordinates.every(Number.isFinite) || Math.abs(coordinates[0]) > 180 || Math.abs(coordinates[1]) > 90
    || typeof p?.venue_id !== "string" || ids.has(p.venue_id) || !Object.hasOwn(counts, p.layer)
    || fields.slice(1, 7).some(field => typeof p[field] !== "string")) fail("SPORTS_SOURCE_FEATURE_INVALID");
  ids.add(p.venue_id);
  counts[p.layer]++;
  if (p.area_sqm === null) missingArea++;
  else if (typeof p.area_sqm !== "number" || !Number.isFinite(p.area_sqm)) fail("SPORTS_SOURCE_AREA_INVALID");
  return { type: "Feature", geometry: feature.geometry, properties: Object.fromEntries(fields.map(field => [field, p[field]])) };
});
if (Object.keys(counts).some(layer => counts[layer] !== expectedLayers[layer]) || missingArea !== 380) fail("SPORTS_SOURCE_SEMANTICS_MISMATCH");
const out = `${JSON.stringify({ type: "FeatureCollection", features })}\n`;
await mkdir(dirname(output), { recursive: true });
await writeFile(output, out);
console.log(JSON.stringify({ input, inputSha, output, outputSha: sha(out), bytes: Buffer.byteLength(out), records: features.length, layerCounts: counts, missingArea }));
