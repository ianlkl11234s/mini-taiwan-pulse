import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const inputSha = "f10f820f74155ac7583c110f08b1f0068902b1bd076e52acfe0f497c3d86371f";
const fields = ["id", "name", "attraction_class", "category", "city", "address", "open_time", "annual_visitors_2024", "yoy_pct"];
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
const fail = code => { throw new Error(code); };
const [inputArg, outputArg] = process.argv.slice(2);
if (!inputArg) fail("Usage: node scripts/research/build-tour-attractions-source.mjs <mini-display.geojson> [output.geojson]");
const input = resolve(inputArg);
const output = resolve(outputArg ?? "../runtime/research-public/tour-attractions-source-20260722.geojson");
const bytes = await readFile(input);
if (sha(bytes) !== inputSha) fail("ATTRACTIONS_SOURCE_SHA_MISMATCH");
const collection = JSON.parse(bytes.toString("utf8"));
if (collection.type !== "FeatureCollection" || !Array.isArray(collection.features) || collection.features.length !== 6070) fail("ATTRACTIONS_SOURCE_COUNT_MISMATCH");
const ids = new Set();
let emptyOpenTime = 0, nullVisitors = 0, nullYoy = 0;
const features = collection.features.map(feature => {
  const p = feature?.properties;
  const c = feature?.geometry?.coordinates;
  if (feature?.type !== "Feature" || !p || fields.slice(0, 7).some(field => typeof p[field] !== "string")
    || !p.id || ids.has(p.id) || feature.geometry?.type !== "Point" || !Array.isArray(c) || c.length !== 2
    || !c.every(Number.isFinite) || Math.abs(c[0]) > 180 || Math.abs(c[1]) > 90
    || !(p.annual_visitors_2024 === null || Number.isFinite(p.annual_visitors_2024))
    || !(p.yoy_pct === null || Number.isFinite(p.yoy_pct))) fail("ATTRACTIONS_SOURCE_FEATURE_INVALID");
  ids.add(p.id);
  if (p.open_time === "") emptyOpenTime++;
  if (p.annual_visitors_2024 === null) nullVisitors++;
  if (p.yoy_pct === null) nullYoy++;
  return { type: "Feature", geometry: feature.geometry, properties: Object.fromEntries(fields.map(field => [field, p[field]])) };
});
if (emptyOpenTime !== 4379 || nullVisitors !== 5807 || nullYoy !== 5836) fail("ATTRACTIONS_SOURCE_MISSINGNESS_MISMATCH");
const out = `${JSON.stringify({ type: "FeatureCollection", features })}\n`;
await mkdir(dirname(output), { recursive: true });
await writeFile(output, out);
console.log(JSON.stringify({ input, inputSha, output, outputSha: sha(out), bytes: Buffer.byteLength(out), records: features.length, emptyOpenTime, nullVisitors, nullYoy }));
