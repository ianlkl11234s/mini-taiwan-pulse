import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const fail = code => { throw new Error(code); };
const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");
const validPoint = geometry => geometry?.type === "Point" && Array.isArray(geometry.coordinates) && geometry.coordinates.length === 2
  && geometry.coordinates.every(value => typeof value === "number" && Number.isFinite(value)) && geometry.coordinates[0] >= 118 && geometry.coordinates[0] <= 123 && geometry.coordinates[1] >= 21 && geometry.coordinates[1] <= 27;

const [analyticsRootArg, outputRootArg] = process.argv.slice(2);
if (!analyticsRootArg) fail("Usage: node scripts/research/build-religion-points-owner-only.mjs <taipei-gis-analytics-root> [output-directory]");
const analyticsRoot = resolve(analyticsRootArg);
const outputRoot = resolve(outputRootArg ?? "../runtime/owner-only/religion-points");

const families = [
  { id: "ancestral-halls", input: "data/processed/religion/ancestral_halls/ancestral_halls_20260801.geojson", output: "ancestral-halls-owner-20260801.geojson", sha256: "70852726d331315f674d963f1199c9527916d7dde0acf8136a094e094aceb21d", rows: 173, raw: [["data/raw/religion/moi_religion_system/ancestral_20260801.xml", "85cef79597da82a238586a64522e258a4b7711a84e8adfb2bef5ff2653656472"], ["data/raw/religion/moi_religion_system/ancestral_f_20260801.xml", "44696a18c9f2c7a00f0809d9d8867ca3fcc5624559f4ebcd294f3a35b462cf63"]], fields: ["name", "facility_type", "county", "in_moi_registry", "heritage_flag", "source", "license", "source_tier", "fetched_at", "geocode_precision"] },
  { id: "churches", input: "data/processed/religion/churches/churches_20260801.geojson", output: "churches-owner-20260801.geojson", sha256: "9aabe70fc2215069c35e9e16bd30d75588b0883f3652a592623e0719bd79c127", rows: 2116, raw: [["data/raw/religion/moi_religion_system/church_20260801.xml", "211c7bdc74d5a716efa06f5b108e5f0d5e4f5ed0d27a5f51ee22a97849e974de"], ["data/raw/religion/osm_place_of_worship/osm_pow_20260801.json", "6242d9bc1c5f5ec20a613f25cdadcc5b4cefbf3f3e31a3b8e6fe437beb2e1b67"]], fields: ["name", "county", "town", "denomination", "in_moi_registry", "heritage_flag", "is_top100", "source", "license", "source_tier", "fetched_at", "geocode_precision"] },
  { id: "other-worship", input: "data/processed/religion/other_worship/other_worship_20260801.geojson", output: "other-worship-owner-20260801.geojson", sha256: "22cc3273a6b6bbf1cc3bea344eacfa95fe1914072b55d51dec7ca8c3a0d18fe3", rows: 1319, raw: [["data/raw/religion/osm_place_of_worship/osm_pow_20260801.json", "6242d9bc1c5f5ec20a613f25cdadcc5b4cefbf3f3e31a3b8e6fe437beb2e1b67"]], fields: ["name", "religion_type", "denomination", "county", "town", "source", "license", "source_tier", "fetched_at"] },
  { id: "foundations", input: "data/processed/religion/foundations/foundations_20260801.geojson", output: "foundations-owner-20260801.geojson", sha256: "3e1e531bbf9b29c671661571f5e34cf4901a64fd772d10db1e88abcd3e4c8430", rows: 165, raw: [["data/raw/religion/moi_religion_system/foundation_20260801.xml", "ebb9abebaf5dc62ae06cd1937f130f515f872b826c9cbd9661417667cc642ec0"]], fields: ["name", "county", "source", "license", "source_tier", "fetched_at", "geocode_precision"], nullBackfill: true },
  { id: "top100", input: "data/processed/religion/top100/top100_20260122.geojson", output: "top100-owner-20260122.geojson", sha256: "fc5056083e7b263fdc3c1b56f89cd7e5c33c121d5dd50fdc9e478b19e4c98347", rows: 100, raw: [["data/raw/religion/top100/宗教百景_2021.shp", "4e23c6d4d5b7213088233e3e6b0b9e114be8683f6caf3c3b5a4e4ddadc1abf19"], ["data/raw/religion/top100/宗教百景_2021.dbf", "fb801b887995c0447456913fda068a1faba820921db3c18a154b7092c61a509c"]], fields: ["name", "county", "town"], top100: true },
];

const results = [];
for (const family of families) {
  for (const [path, expectedSha] of family.raw) {
    const bytes = await readFile(resolve(analyticsRoot, path));
    if (sha256(bytes) !== expectedSha) fail(`RELIGION_${family.id.toUpperCase().replaceAll("-", "_")}_RAW_SHA_MISMATCH`);
  }
  const input = resolve(analyticsRoot, family.input);
  const inputBytes = await readFile(input);
  if (sha256(inputBytes) !== family.sha256) fail(`RELIGION_${family.id.toUpperCase().replaceAll("-", "_")}_UPSTREAM_SHA_MISMATCH`);
  const collection = JSON.parse(inputBytes.toString("utf8"));
  if (collection?.type !== "FeatureCollection" || !Array.isArray(collection.features) || collection.features.length !== family.rows) fail(`RELIGION_${family.id.toUpperCase().replaceAll("-", "_")}_UPSTREAM_COUNT_MISMATCH`);
  let unlocated = 0;
  const features = collection.features.map((feature, index) => {
    if (feature?.type !== "Feature" || !validPoint(feature.geometry) || !feature.properties || typeof feature.properties !== "object" || Array.isArray(feature.properties)) fail(`RELIGION_${family.id.toUpperCase().replaceAll("-", "_")}_UPSTREAM_FEATURE_INVALID`);
    const properties = feature.properties;
    const coordinateStatus = family.nullBackfill && properties.geocode_precision !== "original" ? "unlocated_source_coordinate" : "source_point";
    if (coordinateStatus === "unlocated_source_coordinate") unlocated++;
    const safeProperties = Object.fromEntries(family.fields.map(field => [field, properties[field] ?? null]));
    if (family.top100) Object.assign(safeProperties, { source: "moi_top100_32191", license: "OGDL-Taiwan-1.0", selection_scope: "Taiwan Religion Top 100 selected landscape; not a national census" });
    if (family.nullBackfill) Object.assign(safeProperties, { coordinate_status: coordinateStatus });
    return { type: "Feature", geometry: coordinateStatus === "source_point" ? feature.geometry : null, properties: { record_id: `${family.id}:${String(index + 1).padStart(4, "0")}`, ...safeProperties } };
  });
  const out = `${JSON.stringify({ type: "FeatureCollection", features })}\n`;
  const output = resolve(outputRoot, family.output);
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, out, "utf8");
  results.push({ dataset: family.id, input, inputSha256: family.sha256, inputRows: family.rows, rawSources: family.raw.map(([path, checksumSha256]) => ({ path, checksumSha256 })), output, outputSha256: sha256(out), outputRows: features.length, outputBytes: Buffer.byteLength(out), retainedFields: ["record_id", ...family.fields, ...(family.top100 ? ["source", "license", "selection_scope"] : []), ...(family.nullBackfill ? ["coordinate_status"] : [])], geometry: { point: features.length - unlocated, null: unlocated, invalid: 0 } });
}
console.log(JSON.stringify({ outputRoot, datasets: results }, null, 2));
