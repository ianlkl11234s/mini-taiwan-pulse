import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const inputSha = "f9285d1d13f9693b33ee885a58f8f7c7d61ce84334839787b440aa3567870303";
const fields = ["id", "name", "city", "coord_source", "inspection_date", "inspection_issues_count", "has_accessible_facility", "has_aed"];
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
const fail = code => { throw new Error(code); };
const [inputArg, outputArg] = process.argv.slice(2);
if (!inputArg) fail("Usage: node scripts/research/build-amusement-park-source.mjs <analytics-processed.geojson> [output.geojson]");
const input = resolve(inputArg);
const output = resolve(outputArg ?? "public/research/amusement-parks-source-20260723.geojson");
const bytes = await readFile(input);
if (sha(bytes) !== inputSha) fail("AMUSEMENT_SOURCE_SHA_MISMATCH");
const collection = JSON.parse(bytes.toString("utf8"));
if (collection.type !== "FeatureCollection" || !Array.isArray(collection.features) || collection.features.length !== 27) fail("AMUSEMENT_SOURCE_COUNT_MISMATCH");
const methods = { park_address: 0, parking: 0, none: 0 };
const ids = new Set();
const features = collection.features.map(feature => {
  const p = feature.properties;
  if (feature.type !== "Feature" || !p || !Number.isSafeInteger(p.id) || ids.has(p.id) || !Object.hasOwn(methods, p.coord_source)
    || ["name", "city", "inspection_date"].some(field => typeof p[field] !== "string")
    || ["inspection_issues_count", "has_accessible_facility", "has_aed"].some(field => !Number.isSafeInteger(p[field]))) fail("AMUSEMENT_SOURCE_FEATURE_INVALID");
  ids.add(p.id);
  methods[p.coord_source]++;
  if (p.coord_source === "none") {
    if (feature.geometry !== null) fail("AMUSEMENT_SOURCE_GEOMETRY_MISMATCH");
  } else {
    const c = feature.geometry?.coordinates;
    if (feature.geometry?.type !== "Point" || !Array.isArray(c) || c.length !== 2 || !c.every(Number.isFinite)
      || Math.abs(c[0]) > 180 || Math.abs(c[1]) > 90) fail("AMUSEMENT_SOURCE_GEOMETRY_MISMATCH");
  }
  return { type: "Feature", geometry: feature.geometry, properties: Object.fromEntries(fields.map(field => [field, p[field]])) };
});
if (methods.park_address !== 24 || methods.parking !== 2 || methods.none !== 1) fail("AMUSEMENT_SOURCE_METHOD_COUNT_MISMATCH");
const out = `${JSON.stringify({ type: "FeatureCollection", features })}\n`;
await mkdir(dirname(output), { recursive: true });
await writeFile(output, out);
console.log(JSON.stringify({ input, inputSha, output, outputSha: sha(out), bytes: Buffer.byteLength(out), records: features.length, methods }));
