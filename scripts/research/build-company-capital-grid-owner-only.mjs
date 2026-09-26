import { createHash } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const analyticsRoot = "/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/taipei-gis-analytics";
const sourceRelative = "data/processed/business_registry/company_capital_grid/company_capital_grid_1500m_202608_r2.geojson";
const SOURCE_SHA256 = "ecf59329d4812d55bf3f8b1cc296ab94b3cfc994dcc9da5cea866f9af496d330";
const SOURCE_COUNT = 5_745;
const COMPANY_COUNT_TOTAL = 654_165;
const CAPITAL_SUM_TOTAL = 40_627_610_824_468;
const SAFE_FIELDS = ["grid_id", "capital_sum", "n_companies", "capital_median"];

const fail = code => { throw new Error(code); };
const hash = value => createHash("sha256").update(value).digest("hex");
const json = value => Buffer.from(`${JSON.stringify(value)}\n`);
const validRing = geometry => {
  const ring = geometry?.coordinates?.[0];
  return geometry?.type === "Polygon" && geometry.coordinates.length === 1 && Array.isArray(ring) && ring.length === 5
    && ring.every(position => Array.isArray(position) && position.length === 2 && position.every(value => typeof value === "number" && Number.isFinite(value)))
    && ring[0][0] === ring[4][0] && ring[0][1] === ring[4][1];
};

function safeFeature(raw, ordinal) {
  const properties = raw?.properties;
  if (raw?.type !== "Feature" || !validRing(raw.geometry) || !properties || typeof properties !== "object" || Array.isArray(properties)
    || Object.keys(properties).length !== SAFE_FIELDS.length || SAFE_FIELDS.some(field => !(field in properties))
    || typeof properties.grid_id !== "string" || !/^G1500_-?\d+_-?\d+$/.test(properties.grid_id)
    || !Number.isSafeInteger(properties.capital_sum) || properties.capital_sum < 0
    || !Number.isSafeInteger(properties.n_companies) || properties.n_companies < 1
    || !(properties.capital_median === null || typeof properties.capital_median === "number" && Number.isFinite(properties.capital_median) && properties.capital_median > 0)
  ) fail("COMPANY_CAPITAL_GRID_SOURCE_FEATURE_INVALID");
  if ((properties.capital_sum === 0) !== (properties.capital_median === null)) fail("COMPANY_CAPITAL_GRID_NULL_SEMANTICS_MISMATCH");
  return { type: "Feature", sourceOrdinal: ordinal, geometry: raw.geometry, properties: { ...properties } };
}

async function build(root, outputArg) {
  const source = await readFile(resolve(root, sourceRelative));
  if (hash(source) !== SOURCE_SHA256) fail("COMPANY_CAPITAL_GRID_SOURCE_SHA_MISMATCH");
  const collection = JSON.parse(source);
  if (collection?.type !== "FeatureCollection" || !Array.isArray(collection.features) || collection.features.length !== SOURCE_COUNT) fail("COMPANY_CAPITAL_GRID_SOURCE_COUNT_MISMATCH");
  const ids = new Set(); let companyTotal = 0, capitalTotal = 0, nullMedian = 0;
  const features = collection.features.map((raw, ordinal) => {
    const feature = safeFeature(raw, ordinal);
    if (ids.has(feature.properties.grid_id)) fail("COMPANY_CAPITAL_GRID_DUPLICATE_GRID_ID");
    ids.add(feature.properties.grid_id); companyTotal += feature.properties.n_companies; capitalTotal += feature.properties.capital_sum;
    if (feature.properties.capital_median === null) nullMedian++;
    return feature;
  });
  if (companyTotal !== COMPANY_COUNT_TOTAL || capitalTotal !== CAPITAL_SUM_TOTAL || nullMedian !== 3) fail("COMPANY_CAPITAL_GRID_CONSERVATION_MISMATCH");
  const output = resolve(outputArg ?? "../runtime/owner-only/company-capital-grid");
  const temporary = `${output}.building`;
  await rm(output, { recursive: true, force: true }); await rm(temporary, { recursive: true, force: true }); await mkdir(temporary, { recursive: true });
  const sidecar = json({ type: "FeatureCollection", features });
  const sidecarSha256 = hash(sidecar);
  await writeFile(resolve(temporary, "company-capital-grid-1500m-owner-202608.geojson"), sidecar);
  const receipt = {
    schemaVersion: "pulse-company-capital-grid-owner-only/1",
    source: { sha256: SOURCE_SHA256, bytes: source.length, featureCount: SOURCE_COUNT, reference: `/research/company-capital-grid/source-identity/sha256-${SOURCE_SHA256}` },
    retainedFields: SAFE_FIELDS, grid: { size_m: 1500, crs_projected: "EPSG:3826", crs_output: "EPSG:4326", origin_x: 144250, origin_y: 2399250, occupied_only: true },
    metrics: { n_companies: { total: COMPANY_COUNT_TOTAL, unit: "companies" }, capital_sum: { total: CAPITAL_SUM_TOTAL, unit: "TWD" }, capital_median: { null_count: nullMedian, null_meaning: "The occupied grid contains companies whose capital values are all missing; this is not zero capital." } },
    exclusions: { dead_or_abnormal: 1_152, invalid_coordinate: 2_565 },
    rights: "OGDL-Taiwan-1.0 is recorded for the source matrix in the processed manifest. This immutable safe-field sidecar is localhost owner-only until per-upstream receipt review is complete.",
    sidecar: { path: "company-capital-grid-1500m-owner-202608.geojson", sha256: sidecarSha256, bytes: sidecar.length, featureCount: SOURCE_COUNT },
  };
  await writeFile(resolve(temporary, "manifest-receipt.json"), json(receipt));
  await mkdir(dirname(output), { recursive: true }); await rename(temporary, output); console.log(JSON.stringify(receipt));
}

const [root = analyticsRoot, output] = process.argv.slice(2);
await build(root, output);
