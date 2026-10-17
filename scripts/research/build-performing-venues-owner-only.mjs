import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

// `performing_venues_moc_20260716.geojson` is the 861-row processed SSOT.
// The public map asset deliberately drops its four null-geometry rows.
const inputSha = "546aee41200a5aa76eac3e6cf8f5faa3feba43f5fd2a02c34086a1ea67b403e2";
const expected = {
  rows: 861,
  noCoord: 4,
  coordSource: { api_mode: 386, geocode: 471, "": 4 },
  precision: { "": 390, exact: 270, approximate: 124, interpolated: 38, cached: 39 },
  blankCity: 56,
};
const fields = ["venue_id", "venue_name", "city", "coord_source", "precision", "coord_status", "event_count", "show_count"];
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
const fail = code => { throw new Error(code); };
const count = (values) => Object.fromEntries([...values.reduce((result, value) => result.set(value, (result.get(value) ?? 0) + 1), new Map()).entries()].sort(([a], [b]) => a.localeCompare(b)));
const same = (left, right) => Object.keys(left).length === Object.keys(right).length
  && Object.entries(left).every(([key, value]) => right[key] === value);

const [inputArg, outputArg] = process.argv.slice(2);
if (!inputArg) fail("Usage: node scripts/research/build-performing-venues-owner-only.mjs <performing_venues_moc_20260716.geojson> [output.geojson]");
const input = resolve(inputArg);
const output = resolve(outputArg ?? "../runtime/owner-only/performing-venues/performing-venues-source-20260716.geojson");
const bytes = await readFile(input);
if (sha(bytes) !== inputSha) fail("PERFORMING_VENUES_SOURCE_SHA_MISMATCH");
const collection = JSON.parse(bytes.toString("utf8"));
if (collection?.type !== "FeatureCollection" || !Array.isArray(collection.features) || collection.features.length !== expected.rows) fail("PERFORMING_VENUES_SOURCE_COUNT_MISMATCH");

const ids = new Set();
let noCoord = 0;
let blankCity = 0;
const coordSource = [];
const precision = [];
const features = collection.features.map((feature) => {
  const p = feature?.properties;
  if (feature?.type !== "Feature" || !p || typeof p.venue_id !== "string" || !p.venue_id || ids.has(p.venue_id)
    || typeof p.venue_name !== "string" || typeof p.city !== "string" || typeof p.coord_source !== "string"
    || typeof p.precision !== "string" || typeof p.coord_status !== "string"
    || !Number.isSafeInteger(p.event_count) || p.event_count < 0 || !Number.isSafeInteger(p.show_count) || p.show_count < 0) fail("PERFORMING_VENUES_SOURCE_FEATURE_INVALID");
  ids.add(p.venue_id);
  if (!p.city) blankCity++;
  coordSource.push(p.coord_source);
  precision.push(p.precision);
  if (p.coord_status === "no_coord") {
    noCoord++;
    if (feature.geometry !== null || p.coord_source || p.precision || p.lon !== null || p.lat !== null) fail("PERFORMING_VENUES_SOURCE_NULL_GEOMETRY_MISMATCH");
  } else {
    const c = feature.geometry?.coordinates;
    if (p.coord_status !== "ok" || feature.geometry?.type !== "Point" || !Array.isArray(c) || c.length !== 2 || !c.every(Number.isFinite)
      || Math.abs(c[0]) > 180 || Math.abs(c[1]) > 90 || c[0] !== p.lon || c[1] !== p.lat) fail("PERFORMING_VENUES_SOURCE_GEOMETRY_MISMATCH");
  }
  return { type: "Feature", geometry: feature.geometry, properties: Object.fromEntries(fields.map(field => [field, p[field]])) };
});
if (noCoord !== expected.noCoord || blankCity !== expected.blankCity || !same(count(coordSource), expected.coordSource) || !same(count(precision), expected.precision)) fail("PERFORMING_VENUES_SOURCE_SEMANTICS_MISMATCH");

const out = `${JSON.stringify({ type: "FeatureCollection", features })}\n`;
await mkdir(dirname(output), { recursive: true });
await writeFile(output, out);
console.log(JSON.stringify({ input, inputSha, output, outputSha: sha(out), bytes: Buffer.byteLength(out), records: features.length, noCoord, coordSource: count(coordSource), precision: count(precision), blankCity }));
