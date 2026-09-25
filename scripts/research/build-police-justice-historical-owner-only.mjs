import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const analyticsRoot = "/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/taipei-gis-analytics";
const specs = [
  {
    key: "traffic-accident-yearly", rows: 1600,
    raw: "data/raw/police_justice/traffic_accident_yearly/npa_114_injury_177136.zip", rawSha256: "bb589b97b9473b639be262183b6f2e6b256b0f52c6c28ae1770214c62bdea99e",
    processed: "data/processed/police_justice/traffic_accident_yearly/traffic_accident_yearly_20260626.geojson", processedSha256: "732c01d31864741b482cec34fca8952d41fca56a0ceb8c9f2eff4854516f0fb4",
    properties: ["incident_id", "year", "month", "date", "time", "agency", "weather", "light", "road_type", "speed_limit", "facility_subtype", "source"],
    map(feature, index) {
      const p = feature.properties;
      if (typeof p.entity_id !== "string" || !p.entity_id || ["year", "month", "date", "time", "agency", "weather", "light", "road_type", "speed_limit", "facility_subtype", "source"].some(field => typeof p[field] !== "string")) fail(`TRAFFIC_ACCIDENT_PROPERTIES_${index}`);
      return { incident_id: p.entity_id, year: p.year, month: p.month, date: p.date, time: p.time, agency: p.agency, weather: p.weather, light: p.light, road_type: p.road_type, speed_limit: p.speed_limit, facility_subtype: p.facility_subtype, source: p.source };
    },
  },
  {
    key: "theft-taoyuan", rows: 1423,
    raw: "data/raw/police_justice/theft_points_taoyuan/theft_167673.csv", rawSha256: "20ff5ed3f07afd711ef2b0586c3127b17503c36403959163626b05ac527ba657",
    processed: "data/processed/police_justice/theft_points_taoyuan/theft_points_taoyuan_20260626.geojson", processedSha256: "3e60392a46a65efd06bbc4b9803713908bab44b98b3930e5ac4709d461e69572",
    properties: ["case_id", "case_type", "year_raw", "date_raw", "district_raw", "facility_subtype", "source"],
    map(feature, index) {
      const p = feature.properties;
      if (typeof p.entity_id !== "string" || !p.entity_id || ["case_type", "year", "date", "district", "facility_subtype", "source"].some(field => typeof p[field] !== "string")) fail(`THEFT_TAOYUAN_PROPERTIES_${index}`);
      return { case_id: p.entity_id, case_type: p.case_type, year_raw: p.year, date_raw: p.date, district_raw: p.district, facility_subtype: p.facility_subtype, source: p.source };
    },
  },
];
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

const [root = analyticsRoot, outputRoot = "../runtime/owner-only/police-justice-historical"] = process.argv.slice(2);
const results = [];
for (const spec of specs) {
  const raw = await readFile(resolve(root, spec.raw));
  if (hash(raw) !== spec.rawSha256) fail(`${spec.key.toUpperCase()}_RAW_SHA_MISMATCH`);
  const collection = parse(await readFile(resolve(root, spec.processed)), spec.processedSha256, spec.rows, spec.key.toUpperCase().replaceAll("-", "_"));
  const ids = new Set();
  const features = collection.features.map((feature, index) => {
    if (feature?.type !== "Feature" || !point(feature.geometry) || !feature.properties || typeof feature.properties !== "object") fail(`${spec.key.toUpperCase()}_POINT_${index}`);
    const properties = spec.map(feature, index);
    const id = properties.incident_id ?? properties.case_id;
    if (ids.has(id)) fail(`${spec.key.toUpperCase()}_DUPLICATE_ID`); ids.add(id);
    return { type: "Feature", geometry: feature.geometry, properties };
  });
  if (ids.size !== spec.rows) fail(`${spec.key.toUpperCase()}_ID_COUNT_MISMATCH`);
  const bytes = Buffer.from(`${JSON.stringify({ type: "FeatureCollection", features })}\n`);
  const output = resolve(outputRoot, `${spec.key}-owner-20260626.geojson`);
  await mkdir(dirname(output), { recursive: true }); await writeFile(output, bytes);
  results.push({ key: spec.key, raw: { sha256: spec.rawSha256 }, processed: { sha256: spec.processedSha256, rows: spec.rows }, retainedFields: spec.properties, output: { path: output, sha256: hash(bytes), bytes: bytes.length, rows: features.length } });
}
console.log(JSON.stringify({ results }));
