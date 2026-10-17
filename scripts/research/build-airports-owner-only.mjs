import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const SOURCE = "/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/taipei-gis-analytics/data/processed/transportation/airport/airports_merged_latest.geojson";
const SOURCE_SHA256 = "d82e9fff2cd6f7eb6417f22a2155cd9958815961731c1be073b4232f5629d6c2";
const OUTPUT = "../runtime/owner-only/airports/airports-owner-20260519.geojson";
const SAFE_FIELDS = ["name", "name_zh", "icao", "iata", "airport_type", "airport_type_zh", "elevation_ft", "source", "tdx_airport_id"];
const SOURCE_FIELDS = [...SAFE_FIELDS, "lat", "lng"];
const SOURCE_COUNT = 125;

const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");
const isOptionalString = value => value === undefined || typeof value === "string";
const isOptionalNumber = value => value === undefined || value === null || typeof value === "number" && Number.isFinite(value);

const raw = await readFile(resolve(process.argv[2] ?? SOURCE));
if (sha256(raw) !== SOURCE_SHA256) throw new Error("AIRPORTS_SOURCE_SHA_MISMATCH");
const source = JSON.parse(raw.toString("utf8"));
if (source?.type !== "FeatureCollection" || !Array.isArray(source.features) || source.features.length !== SOURCE_COUNT) throw new Error("AIRPORTS_SOURCE_COUNT_MISMATCH");
const features = source.features.map((feature, index) => {
  const properties = feature?.properties;
  const coordinates = feature?.geometry?.coordinates;
  if (feature?.type !== "Feature" || feature.geometry?.type !== "Point" || !Array.isArray(coordinates) || coordinates.length !== 2
    || !coordinates.every(value => typeof value === "number" && Number.isFinite(value)) || Math.abs(coordinates[0]) > 180 || Math.abs(coordinates[1]) > 90
    || !properties || typeof properties !== "object" || Array.isArray(properties)
    || Object.keys(properties).some(field => !SOURCE_FIELDS.includes(field)) || SOURCE_FIELDS.filter(field => field !== "tdx_airport_id").some(field => !(field in properties))
    || !SAFE_FIELDS.filter(field => field !== "elevation_ft").every(field => isOptionalString(properties[field])) || !isOptionalNumber(properties.elevation_ft)
    || properties.lat !== coordinates[1] || properties.lng !== coordinates[0]) throw new Error(`AIRPORTS_SOURCE_ROW_MISMATCH_${index}`);
  return { type: "Feature", sourceOrdinal: index, geometry: { type: "Point", coordinates }, properties: Object.fromEntries(SAFE_FIELDS.map(field => [field, properties[field] ?? null])) };
});
const bytes = Buffer.from(`${JSON.stringify({ type: "FeatureCollection", features })}\n`);
const output = resolve(process.argv[3] ?? OUTPUT);
await mkdir(dirname(output), { recursive: true });
await writeFile(output, bytes);
console.log(JSON.stringify({ source: SOURCE, sourceSha256: SOURCE_SHA256, rows: features.length, output, outputSha256: sha256(bytes), bytes: bytes.length }));
