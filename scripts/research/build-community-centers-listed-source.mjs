import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const inputSha = "898e50bf7109b80675ac46203cf8c9fb94f88a76549037d373710ff856247774";
const fields = ["uid", "name", "county", "town", "address", "source_id", "coord_method"];
const methods = { native: 0, TGOS: 0, L1: 0, offline_exact: 0, offline_interpolated: 0, offline_cached: 0, no_coord: 0 };
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
const fail = code => { throw new Error(code); };
const [inputArg, outputArg] = process.argv.slice(2);
if (!inputArg) fail("Usage: node scripts/research/build-community-centers-listed-source.mjs <analytics-processed.geojson> [output.geojson]");
const input = resolve(inputArg);
const output = resolve(outputArg ?? "public/research/community-centers-listed-source-20260717.geojson");
const bytes = await readFile(input);
if (sha(bytes) !== inputSha) fail("COMMUNITY_CENTERS_SOURCE_SHA_MISMATCH");
const collection = JSON.parse(bytes.toString("utf8"));
if (collection.type !== "FeatureCollection" || !Array.isArray(collection.features) || collection.features.length !== 1812) fail("COMMUNITY_CENTERS_SOURCE_COUNT_MISMATCH");
const ids = new Set();
const features = collection.features.map(feature => {
  const p = feature?.properties;
  if (feature?.type !== "Feature" || !p || typeof p.uid !== "string" || !p.uid || ids.has(p.uid)
    || !Object.hasOwn(methods, p.coord_method) || fields.slice(1).some(field => typeof p[field] !== "string")) fail("COMMUNITY_CENTERS_SOURCE_FEATURE_INVALID");
  ids.add(p.uid);
  methods[p.coord_method]++;
  if (p.coord_method === "no_coord") {
    if (feature.geometry !== null) fail("COMMUNITY_CENTERS_SOURCE_GEOMETRY_MISMATCH");
  } else {
    const c = feature.geometry?.coordinates;
    if (feature.geometry?.type !== "Point" || !Array.isArray(c) || c.length !== 2 || !c.every(Number.isFinite)
      || Math.abs(c[0]) > 180 || Math.abs(c[1]) > 90) fail("COMMUNITY_CENTERS_SOURCE_GEOMETRY_MISMATCH");
  }
  return { type: "Feature", geometry: feature.geometry, properties: Object.fromEntries(fields.map(field => [field, p[field]])) };
});
if (methods.native !== 592 || methods.TGOS !== 1143 || methods.L1 !== 53 || methods.offline_exact !== 3
  || methods.offline_interpolated !== 2 || methods.offline_cached !== 1 || methods.no_coord !== 18) fail("COMMUNITY_CENTERS_SOURCE_METHOD_COUNT_MISMATCH");
const out = `${JSON.stringify({ type: "FeatureCollection", features })}\n`;
await mkdir(dirname(output), { recursive: true });
await writeFile(output, out);
console.log(JSON.stringify({ input, inputSha, output, outputSha: sha(out), bytes: Buffer.byteLength(out), records: features.length, methods }));
