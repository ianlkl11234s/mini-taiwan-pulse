import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const analyticsRoot = "/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/taipei-gis-analytics";
const processedRelative = "data/processed/energy/ev_charging_stations/ev_charging_stations_20260615.geojson";
const processedSha256 = "fa5ee9640717cc0cac3ed60f00b2a244c41afa2523b27d1d0ebe9fb3f826c218";
const safeFields = ["station_id", "name", "operator_id", "spaces", "charging_points", "source", "scope"];
const hash = value => createHash("sha256").update(value).digest("hex");
const fail = code => { throw new Error(code); };
const point = geometry => geometry?.type === "Point" && Array.isArray(geometry.coordinates) && geometry.coordinates.length === 2
  && geometry.coordinates.every(value => typeof value === "number" && Number.isFinite(value))
  && geometry.coordinates[0] >= 118 && geometry.coordinates[0] <= 123 && geometry.coordinates[1] >= 21 && geometry.coordinates[1] <= 27;

const [root = analyticsRoot, output = "../runtime/owner-only/ev-charging/ev-charging-owner-20260615.geojson"] = process.argv.slice(2);
const input = await readFile(resolve(root, processedRelative));
if (hash(input) !== processedSha256) fail("EV_CHARGING_PROCESSED_SHA_MISMATCH");
const collection = JSON.parse(input.toString("utf8"));
if (collection?.type !== "FeatureCollection" || !Array.isArray(collection.features) || collection.features.length !== 3_060) fail("EV_CHARGING_PROCESSED_SHAPE_MISMATCH");
const stationIds = new Set(); const sourceCounts = new Map(); let nullServiceTime = 0; let nullParkingRate = 0; let nullChargingRate = 0;
const features = collection.features.map((feature, index) => {
  const properties = feature?.properties;
  if (feature?.type !== "Feature" || !point(feature.geometry) || !properties || typeof properties !== "object"
    || typeof properties.station_id !== "string" || !properties.station_id || stationIds.has(properties.station_id)
    || typeof properties.name !== "string" || !properties.name || typeof properties.operator_id !== "string" || !properties.operator_id
    || !Number.isFinite(properties.spaces) || !Number.isFinite(properties.charging_points)
    || typeof properties.source !== "string" || !properties.source || typeof properties.scope !== "string" || !properties.scope) fail(`EV_CHARGING_FEATURE_INVALID_${index}`);
  stationIds.add(properties.station_id);
  sourceCounts.set(properties.source, (sourceCounts.get(properties.source) ?? 0) + 1);
  if (properties.service_time === null || properties.service_time === "") nullServiceTime++;
  if (properties.parking_rate === null || properties.parking_rate === "") nullParkingRate++;
  if (properties.charging_rate === null || properties.charging_rate === "") nullChargingRate++;
  return { type: "Feature", geometry: feature.geometry, properties: Object.fromEntries(safeFields.map(field => [field, properties[field]])) };
});
const expectedSources = { tdx_aircaa: 2, tdx_city: 2947, tdx_freewaysa: 23, tdx_railtra: 44, tdx_shiptipc: 4, tdx_tourism: 40 };
if (stationIds.size !== 3_060 || nullServiceTime !== 1 || nullParkingRate !== 1 || nullChargingRate !== 1
  || JSON.stringify(Object.fromEntries([...sourceCounts.entries()].sort())) !== JSON.stringify(expectedSources)) fail("EV_CHARGING_SOURCE_SEMANTICS_MISMATCH");
const bytes = Buffer.from(`${JSON.stringify({ type: "FeatureCollection", features })}\n`);
const outputPath = resolve(output); await mkdir(dirname(outputPath), { recursive: true }); await writeFile(outputPath, bytes);
console.log(JSON.stringify({ input: { path: resolve(root, processedRelative), sha256: processedSha256, rows: 3_060 }, retainedFields: safeFields, sourceCounts: Object.fromEntries(sourceCounts), omitted: ["address", "telephone", "service_time", "parking_rate", "charging_rate", "connectors", "floors", "description"], output: { path: outputPath, sha256: hash(bytes), bytes: bytes.length, rows: features.length }, hold: "TDX terms and coordinate precision receipts were not verified; immutable owner-only reference snapshot only, not real-time availability, status, nearest, routing, or public reuse." }));
