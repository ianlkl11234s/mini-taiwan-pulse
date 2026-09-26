#!/usr/bin/env node
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const sourcePath = resolve(process.argv[2] ?? "../../../../taipei-gis-analytics/data/processed/transportation/rail_stations/rail_stations_20260529.geojson");
const outputPath = resolve(process.argv[3] ?? "../runtime/owner-only/rail-stations/rail-stations-owner-20260529.geojson");
const expectedSourceSha256 = "2e334441261600b2b5541982705f9cdf11182f94df5a507f45572441b8a33637";
const expectedCounts = { thsr: 12, tra: 244, trtc: 139, krtc: 39, klrt: 38, tymc: 22, tmrt: 18, dlrt: 14, aklrt: 9 };
const safeFields = ["system_id", "station_id", "name", "county_id", "county_name", "station_class", "color"];

function sha256(bytes) { return createHash("sha256").update(bytes).digest("hex"); }
function fail(code) { throw new Error(code); }
function validCoordinate(value) { return typeof value === "number" && Number.isFinite(value); }

const sourceBytes = await readFile(sourcePath);
if (sha256(sourceBytes) !== expectedSourceSha256) fail("RAIL_STATIONS_20260529_SOURCE_SHA_MISMATCH");
const source = JSON.parse(sourceBytes);
if (source?.type !== "FeatureCollection" || !Array.isArray(source.features)) fail("RAIL_STATIONS_20260529_INVALID_SOURCE");

const counts = Object.fromEntries(Object.keys(expectedCounts).map(key => [key, 0]));
const ids = new Set();
const features = source.features.map((feature, index) => {
  const properties = feature?.properties;
  const geometry = feature?.geometry;
  if (feature?.type !== "Feature" || !properties || geometry?.type !== "Point" || !Array.isArray(geometry.coordinates)
    || !validCoordinate(geometry.coordinates[0]) || !validCoordinate(geometry.coordinates[1])) fail("RAIL_STATIONS_20260529_GEOMETRY_MISMATCH");
  if (!(properties.system_id in expectedCounts) || typeof properties.station_id !== "string" || typeof properties.name !== "string") fail("RAIL_STATIONS_20260529_PROPERTIES_MISMATCH");
  const id = `${properties.system_id}:${properties.station_id}`;
  if (ids.has(id)) fail("RAIL_STATIONS_20260529_DUPLICATE_ID");
  ids.add(id);
  counts[properties.system_id]++;
  const safeProperties = Object.fromEntries(safeFields.map(field => [field, properties[field] ?? null]));
  return { type: "Feature", properties: safeProperties, geometry: { type: "Point", coordinates: [geometry.coordinates[0], geometry.coordinates[1]] } };
});
if (features.length !== 535 || JSON.stringify(counts) !== JSON.stringify(expectedCounts)) fail("RAIL_STATIONS_20260529_COUNT_MISMATCH");

const output = `${JSON.stringify({ type: "FeatureCollection", features })}\n`;
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, output);
console.log(JSON.stringify({ sourcePath, sourceSha256: expectedSourceSha256, outputPath, outputSha256: sha256(output), records: features.length, counts, safeFields }));
