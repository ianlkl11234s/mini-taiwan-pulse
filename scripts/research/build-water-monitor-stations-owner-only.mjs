import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const analyticsRoot = "/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/taipei-gis-analytics";
const inputs = [
  { type: "rain_gauge", path: "data/processed/water_resources/rain_gauge_stations/rain_gauge_stations.geojson", sha256: "5a4203f5914c1d325b5f5ccd89f2b953be279b88a40d50a397d3d3a4063eb34b", rows: 242 },
  { type: "river_level", path: "data/processed/water_resources/river_water_level_realtime/river_level_stations_wra.geojson", sha256: "9698f7dbb4ef3d4b4831de5f23765c6f17d9102c0f25d334a644d9cdd1ac48bb", rows: 831 },
  { type: "groundwater_well", path: "data/processed/water_resources/groundwater/groundwater_wells.geojson", sha256: "f15549b80767b604d90b9e5a9c0c3a42e9ff5ce6fcc4183ee6ec800e09d68db2", rows: 959 },
];
const displayPath = "public/geo/water_monitor_stations.geojson";
const displaySha256 = "4f6ab8edb69b68e17ea15be500b117581869d1af71a0196b4ee72870326a2baf";
const boundaryPath = "public/statistics/county-reference-2025.geojson";
const boundarySha256 = "3feeca872210d6072c975e5e160c81926972337224b36a1573fb4b74f1a48f6c";
const hash = value => createHash("sha256").update(value).digest("hex");
const fail = code => { throw new Error(code); };
const point = geometry => geometry?.type === "Point" && Array.isArray(geometry.coordinates) && geometry.coordinates.length === 2
  && geometry.coordinates.every(value => typeof value === "number" && Number.isFinite(value))
  && geometry.coordinates[0] >= 118 && geometry.coordinates[0] <= 124 && geometry.coordinates[1] >= 21 && geometry.coordinates[1] <= 27;

function parse(bytes, sha256, rows, code) {
  if (hash(bytes) !== sha256) fail(`${code}_SHA_MISMATCH`);
  let data; try { data = JSON.parse(bytes.toString("utf8")); } catch { fail(`${code}_JSON_INVALID`); }
  if (data?.type !== "FeatureCollection" || !Array.isArray(data.features) || data.features.length !== rows) fail(`${code}_COUNT_MISMATCH`);
  return data;
}

function normCounty(value) { return String(value ?? "").replaceAll("台", "臺"); }
function onSegment(a, b, pointValue) {
  const [ax, ay] = a; const [bx, by] = b; const [x, y] = pointValue;
  const cross = (x - ax) * (by - ay) - (y - ay) * (bx - ax);
  return Math.abs(cross) < 1e-11 && x >= Math.min(ax, bx) - 1e-11 && x <= Math.max(ax, bx) + 1e-11 && y >= Math.min(ay, by) - 1e-11 && y <= Math.max(ay, by) + 1e-11;
}
function ringContains(ring, pointValue) {
  let inside = false; const [x, y] = pointValue;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
    const a = ring[index]; const b = ring[previous];
    if (!Array.isArray(a) || !Array.isArray(b) || !Number.isFinite(a[0]) || !Number.isFinite(a[1]) || !Number.isFinite(b[0]) || !Number.isFinite(b[1])) fail("COUNTY_BOUNDARY_INVALID");
    if (onSegment(a, b, pointValue)) return true;
    if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}
function polygonContains(rings, pointValue) { return Array.isArray(rings) && rings.length > 0 && ringContains(rings[0], pointValue) && !rings.slice(1).some(ring => ringContains(ring, pointValue)); }
function geometryContains(geometry, pointValue) {
  if (geometry?.type === "Polygon") return polygonContains(geometry.coordinates, pointValue);
  if (geometry?.type === "MultiPolygon") return geometry.coordinates.some(rings => polygonContains(rings, pointValue));
  fail("COUNTY_BOUNDARY_GEOMETRY_INVALID");
}
function featureKey(feature) {
  const [lng, lat] = feature.geometry.coordinates; const p = feature.properties;
  return `${p.station_id}|${p.station_type}|${lng.toFixed(9)}|${lat.toFixed(9)}`;
}

const [root = analyticsRoot, output = "../runtime/owner-only/water-monitor-stations/water-monitor-stations-owner-20260519.geojson", display = displayPath, boundaryFile = boundaryPath] = process.argv.slice(2);
const boundary = parse(await readFile(resolve(boundaryFile)), boundarySha256, 22, "COUNTY_REFERENCE");
const counties = boundary.features.map((feature, index) => {
  const name = feature?.properties?.area_name;
  if (typeof name !== "string" || !name || !feature.geometry) fail(`COUNTY_REFERENCE_PROPERTIES_${index}`);
  return { name, geometry: feature.geometry };
});
const sourceFeatures = [];
for (const source of inputs) {
  const collection = parse(await readFile(resolve(root, source.path)), source.sha256, source.rows, `WATER_MONITOR_${source.type.toUpperCase()}`);
  for (const [index, feature] of collection.features.entries()) {
    if (feature?.type !== "Feature" || !point(feature.geometry) || !feature.properties || typeof feature.properties !== "object") fail(`WATER_MONITOR_POINT_${source.type}_${index}`);
    const p = feature.properties;
    if (typeof p.id !== "string" || !p.id || p.station_type !== source.type || p.source !== "wra" || typeof p.name !== "string"
      || typeof p.county !== "string" || !(typeof p.township === "string" || p.township === null) || !(typeof p.elevation_m === "number" || p.elevation_m === null) || typeof p.is_active !== "boolean") fail(`WATER_MONITOR_PROPERTIES_${source.type}_${index}`);
    const pointValue = feature.geometry.coordinates;
    const boundaryCounty = counties.find(county => geometryContains(county.geometry, pointValue))?.name ?? null;
    const reportedCounty = p.county;
    const countySpatialCheck = !reportedCounty ? "unknown" : !boundaryCounty ? "outside" : normCounty(reportedCounty) === normCounty(boundaryCounty) ? "match" : "mismatch";
    sourceFeatures.push({ type: "Feature", geometry: feature.geometry, properties: { station_id: p.id, name: p.name, station_type: p.station_type, source: p.source, reported_county: reportedCounty, township: p.township, elevation_m: p.elevation_m, is_active: p.is_active, county_spatial_check: countySpatialCheck } });
  }
}
const sourceKeys = new Set(sourceFeatures.map(featureKey));
if (sourceFeatures.length !== 2032 || sourceKeys.size !== 2032) fail("WATER_MONITOR_SOURCE_UNION_MISMATCH");
const displayCollection = parse(await readFile(resolve(display)), displaySha256, 2032, "WATER_MONITOR_DISPLAY");
const displayKeys = new Set(displayCollection.features.map((feature, index) => {
  if (feature?.type !== "Feature" || !point(feature.geometry) || !feature.properties || typeof feature.properties !== "object") fail(`WATER_MONITOR_DISPLAY_POINT_${index}`);
  const id = typeof feature.properties.id === "string" ? feature.properties.id : feature.id;
  if (typeof id !== "string" || !id || typeof feature.properties.station_type !== "string") fail(`WATER_MONITOR_DISPLAY_PROPERTIES_${index}`);
  return `${id}|${feature.properties.station_type}|${feature.geometry.coordinates[0].toFixed(9)}|${feature.geometry.coordinates[1].toFixed(9)}`;
}));
if (displayKeys.size !== sourceKeys.size || [...sourceKeys].some(key => !displayKeys.has(key))) fail("WATER_MONITOR_DISPLAY_LINEAGE_MISMATCH");
const qa = Object.groupBy(sourceFeatures, feature => feature.properties.county_spatial_check);
if (qa.match?.length !== 1647 || qa.mismatch?.length !== 360 || qa.unknown?.length !== 15 || qa.outside?.length !== 10) fail("WATER_MONITOR_COUNTY_QA_MISMATCH");
const bytes = Buffer.from(`${JSON.stringify({ type: "FeatureCollection", features: sourceFeatures })}\n`);
const outputPath = resolve(output); await mkdir(dirname(outputPath), { recursive: true }); await writeFile(outputPath, bytes);
console.log(JSON.stringify({ inputs: inputs.map(({ type, sha256, rows }) => ({ type, sha256, rows })), boundary: { sha256: boundarySha256, rows: counties.length }, display: { sha256: displaySha256, rows: displayCollection.features.length }, countySpatialCheck: Object.fromEntries(Object.entries(qa).map(([key, value]) => [key, value.length])), output: { path: outputPath, sha256: hash(bytes), bytes: bytes.length, rows: sourceFeatures.length } }));
