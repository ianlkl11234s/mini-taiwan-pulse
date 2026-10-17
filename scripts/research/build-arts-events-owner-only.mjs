import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";

const input = resolve(process.argv[2] ?? "/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/taipei-gis-analytics/data/processed/culture/arts_events_moc/arts_events_moc_20260716.geojson");
const output = resolve(process.argv[3] ?? "../runtime/owner-only/arts-events/arts-events-owner-20260716.geojson");
const expectedSha = "75187ca4101ecd378c338f826b0c1c608a20b9f3d441486e4ce75b25ecb316a3";
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
function fail(code) { throw new Error(code); }
const bytes = await readFile(input);
if (sha(bytes) !== expectedSha) fail("ARTS_EVENTS_SOURCE_SHA_MISMATCH");
const parsed = JSON.parse(bytes.toString("utf8"));
if (parsed.type !== "FeatureCollection" || parsed.features?.length !== 7482) fail("ARTS_EVENTS_SOURCE_ROWS_MISMATCH");
const fields = ["uid", "title", "category", "start_date", "end_date", "show_time", "show_end_time", "location_name", "coord_status"];
const features = parsed.features.map((feature, index) => {
  const properties = feature.properties ?? {};
  if (fields.some(field => typeof properties[field] !== "string") || !["ok", "no_coord"].includes(properties.coord_status)) fail(`ARTS_EVENTS_FIELDS_${index}`);
  const geometry = feature.geometry;
  if (properties.coord_status === "ok" && (geometry?.type !== "Point" || geometry.coordinates?.length !== 2 || !geometry.coordinates.every(Number.isFinite))) fail(`ARTS_EVENTS_POINT_${index}`);
  if (properties.coord_status === "no_coord" && geometry !== null) fail(`ARTS_EVENTS_NULL_${index}`);
  return { type: "Feature", properties: Object.fromEntries(fields.map(field => [field, properties[field]])), geometry };
});
if (features.filter(feature => feature.geometry).length !== 6121 || features.filter(feature => feature.geometry === null).length !== 1361) fail("ARTS_EVENTS_GEOMETRY_COUNTS_MISMATCH");
const serialized = Buffer.from(`${JSON.stringify({ type: "FeatureCollection", features })}\n`);
await mkdir(dirname(output), { recursive: true });
await writeFile(output, serialized);
console.log(JSON.stringify({ input, inputSha256: expectedSha, sourceRows: 7482, pointRows: 6121, nullRows: 1361, output, outputSha256: sha(serialized), outputBytes: serialized.length }));
