import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const analyticsRoot = "/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/taipei-gis-analytics";
const miniRoot = "/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/mini-taiwan-pulse";
const tainanRaw = "data/raw/water_resources/flood_minor/108523_tainan_detention.csv";
const taoyuanRaw = "data/raw/water_resources/flood_minor/152950_taoyuan_detention.csv";
const TAINAN_RAW_SHA256 = "df2521430f8a76f204361e9c5300cfa83d1f5c0efa010c4f9ef7ff41333f2aab";
const TAOYUAN_RAW_SHA256 = "7644ebf0dcec99ffcfb9621c612540874ae43237eceb4a72db5d8188a721a132";
const DISPLAY_SHA256 = "6dd46deca47a13b479ad8dede339eb1c4e14c0540b08b5b3472e1d6fc250686a";
const SAFE_FIELDS = ["basin_id", "name", "county", "basin_type", "area_m2", "source_dataset_id"];

const hash = value => createHash("sha256").update(value).digest("hex");
const fail = code => { throw new Error(code); };
const point = geometry => geometry?.type === "Point" && Array.isArray(geometry.coordinates) && geometry.coordinates.length === 2
  && geometry.coordinates.every(value => typeof value === "number" && Number.isFinite(value));

const [root = analyticsRoot, display = resolve(miniRoot, "public/geo/water_detention_basins.geojson"), output = "../runtime/owner-only/water-detention-basins/water-detention-basins-owner-20260511.geojson"] = process.argv.slice(2);
const [tainanBytes, taoyuanBytes, displayBytes] = await Promise.all([
  readFile(resolve(root, tainanRaw)), readFile(resolve(root, taoyuanRaw)), readFile(resolve(display)),
]);
if (hash(tainanBytes) !== TAINAN_RAW_SHA256) fail("WATER_DETENTION_TAINAN_RAW_SHA_MISMATCH");
if (hash(taoyuanBytes) !== TAOYUAN_RAW_SHA256) fail("WATER_DETENTION_TAOYUAN_RAW_SHA_MISMATCH");
if (hash(displayBytes) !== DISPLAY_SHA256) fail("WATER_DETENTION_DISPLAY_SHA_MISMATCH");

const displayCollection = JSON.parse(displayBytes.toString("utf8"));
if (displayCollection?.type !== "FeatureCollection" || !Array.isArray(displayCollection.features) || displayCollection.features.length !== 56) fail("WATER_DETENTION_DISPLAY_SHAPE_MISMATCH");
const sourceCounts = Object.fromEntries(["108523", "152950"].map(id => [id, 0]));
const ids = new Set();
const features = displayCollection.features.map((feature, index) => {
  const properties = feature?.properties;
  if (feature?.type !== "Feature" || !point(feature.geometry) || !properties || typeof properties !== "object") fail(`WATER_DETENTION_POINT_INVALID_${index}`);
  const county = properties.county;
  const source = properties.source;
  const sourceDatasetId = source === "data.gov.tw/dataset/108523" ? "108523" : source === "data.gov.tw/dataset/152950" ? "152950" : null;
  const expectedCounty = sourceDatasetId === "108523" ? "tainan" : sourceDatasetId === "152950" ? "taoyuan" : null;
  if (!sourceDatasetId || county !== expectedCounty || properties.basin_type !== "detention" || typeof properties.name !== "string" || !properties.name || typeof feature.id !== "string" || !feature.id || ids.has(feature.id)) fail(`WATER_DETENTION_DISPLAY_SEMANTICS_${index}`);
  if (sourceDatasetId === "108523" && (typeof properties.area_m2 !== "number" || properties.area_m2 < 0)) fail(`WATER_DETENTION_TAINAN_AREA_${index}`);
  if (sourceDatasetId === "152950" && properties.area_m2 !== null) fail(`WATER_DETENTION_TAOYUAN_AREA_NULL_${index}`);
  ids.add(feature.id); sourceCounts[sourceDatasetId]++;
  return { type: "Feature", geometry: feature.geometry, properties: { basin_id: feature.id, name: properties.name, county, basin_type: properties.basin_type, area_m2: properties.area_m2, source_dataset_id: sourceDatasetId } };
});
if (sourceCounts["108523"] !== 45 || sourceCounts["152950"] !== 11) fail("WATER_DETENTION_SOURCE_COUNT_MISMATCH");

const bytes = Buffer.from(`${JSON.stringify({ type: "FeatureCollection", features })}\n`);
const outputPath = resolve(output); await mkdir(dirname(outputPath), { recursive: true }); await writeFile(outputPath, bytes);
console.log(JSON.stringify({ raw: { tainan: { sha256: TAINAN_RAW_SHA256, rows: 45 }, taoyuan: { sha256: TAOYUAN_RAW_SHA256, rows: 11 } }, display: { sha256: DISPLAY_SHA256, rows: 56 }, retainedFields: SAFE_FIELDS, sourceCounts, output: { path: outputPath, sha256: hash(bytes), bytes: bytes.length, rows: features.length }, missing: { township: 56, status: 56, designed_volume_m3: 56, current_volume_m3: 56, max_depth_m: 56, taoyuan_area_m2: 11 }, geometry: "official-source Point snapshot: Tainan uses pipeline TM97 to WGS84 conversion and Taoyuan source WGS84; point does not prove pool boundary, entrance, depth, volume, current status, flood risk, access or nearest usable facility" }));
