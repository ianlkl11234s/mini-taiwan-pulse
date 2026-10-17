import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const fail = code => { throw new Error(code); };
const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");
const validPoint = geometry => geometry?.type === "Point" && Array.isArray(geometry.coordinates) && geometry.coordinates.length === 2
  && geometry.coordinates.every(value => typeof value === "number" && Number.isFinite(value)) && geometry.coordinates[0] >= 118 && geometry.coordinates[0] <= 123 && geometry.coordinates[1] >= 21 && geometry.coordinates[1] <= 27;
const countLines = bytes => bytes.toString("utf8").replace(/^\uFEFF/, "").trimEnd().split(/\r?\n/).length;

const [analyticsRootArg, outputRootArg] = process.argv.slice(2);
if (!analyticsRootArg) fail("Usage: node scripts/research/build-justice-event-points-owner-only.mjs <taipei-gis-analytics-root> [output-directory]");
const analyticsRoot = resolve(analyticsRootArg);
const outputRoot = resolve(outputRootArg ?? "../runtime/owner-only/justice-event-points");

const rawSources = [
  { file: "data/raw/police_justice/women_child_warning/wcs_npa_6247.csv", sha256: "598ca79b8347ad1a8c9213b11608d0496cd9cc1b62ccfcd3c729559d6daad021", lines: 188 },
  { file: "data/raw/police_justice/women_child_warning/wcs_taoyuan_26272.csv", sha256: "245d6277298eb197a6d3cb9735b89882b9d1e7670b7b3a1ec86911a51ae6491b", lines: 3 },
];
for (const source of rawSources) {
  const bytes = await readFile(resolve(analyticsRoot, source.file));
  if (sha256(bytes) !== source.sha256) fail("JUSTICE_WOMEN_CHILD_WARNING_RAW_SHA_MISMATCH");
  if (countLines(bytes) !== source.lines) fail("JUSTICE_WOMEN_CHILD_WARNING_RAW_COUNT_MISMATCH");
}

const input = resolve(analyticsRoot, "data/processed/police_justice/women_child_warning/women_child_warning_20260626.geojson");
const inputBytes = await readFile(input);
const inputSha256 = "29a48e8e229802f0f78e1c57c550aca3f5e02e3ac67e682cad8dbdf016f58e89";
if (sha256(inputBytes) !== inputSha256) fail("JUSTICE_WOMEN_CHILD_WARNING_UPSTREAM_SHA_MISMATCH");
const collection = JSON.parse(inputBytes.toString("utf8"));
if (collection?.type !== "FeatureCollection" || !Array.isArray(collection.features) || collection.features.length !== 185) fail("JUSTICE_WOMEN_CHILD_WARNING_UPSTREAM_COUNT_MISMATCH");

const features = collection.features.map((feature, index) => {
  if (feature?.type !== "Feature" || !validPoint(feature.geometry) || !feature.properties || typeof feature.properties !== "object" || Array.isArray(feature.properties)) fail("JUSTICE_WOMEN_CHILD_WARNING_UPSTREAM_FEATURE_INVALID");
  const { facility_subtype, source, source_tier, fetched_at } = feature.properties;
  if (facility_subtype !== "women_child_safety_warning" || typeof source !== "string" || !source || typeof source_tier !== "number" || !Number.isFinite(source_tier) || fetched_at !== "2026-06-26") fail("JUSTICE_WOMEN_CHILD_WARNING_UPSTREAM_FIELD_INVALID");
  return { type: "Feature", geometry: feature.geometry, properties: { record_id: `women-child-warning:${String(index + 1).padStart(3, "0")}`, warning_type: facility_subtype, source, source_tier, fetched_at } };
});

const out = `${JSON.stringify({ type: "FeatureCollection", features })}\n`;
const output = resolve(outputRoot, "women-child-warning-owner-20260626.geojson");
await mkdir(dirname(output), { recursive: true });
await writeFile(output, out, "utf8");
console.log(JSON.stringify({ outputRoot, dataset: "women-child-warning", input, inputSha256, inputRows: 185, rawSources, output, outputSha256: sha256(out), outputRows: features.length, outputBytes: Buffer.byteLength(out), retainedFields: ["record_id", "warning_type", "source", "source_tier", "fetched_at"], geometry: { point: features.length, null: 0, invalid: 0 }, exclusions: { upstreamGeocodeFailure: 3 } }, null, 2));
