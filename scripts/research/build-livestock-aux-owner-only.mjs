import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const analyticsRoot = resolve(process.cwd(), "../../../../taipei-gis-analytics");
const runtimeRoot = resolve(process.cwd(), "../runtime/owner-only/livestock-aux");

const families = [
  {
    key: "feed",
    input: "feed_factory_points.geojson",
    output: "feed-factories-owner-20260704.geojson",
    fields: { "廠名": "facility_name", geocode_type: "geocode_type" },
  },
  {
    key: "market",
    input: "market_points.geojson",
    output: "livestock-markets-owner-20260704.geojson",
    fields: { "場名": "facility_name", "種類": "livestock_type", "來源": "roster_source", geocode_type: "geocode_type" },
  },
  {
    key: "slaughter",
    input: "slaughterhouse_points.geojson",
    output: "slaughterhouses-owner-20260704.geojson",
    fields: { "場名": "facility_name", "種類": "livestock_type", "來源": "roster_source", geocode_type: "geocode_type" },
  },
];

function sha256(value) { return createHash("sha256").update(value).digest("hex"); }

for (const family of families) {
  const inputPath = resolve(analyticsRoot, "data/processed/agriculture/livestock_ranch", family.input);
  const sourceBytes = await readFile(inputPath);
  const source = JSON.parse(sourceBytes.toString("utf8"));
  if (source.type !== "FeatureCollection" || !Array.isArray(source.features)) throw new Error(`${family.key}:INVALID_SOURCE_COLLECTION`);
  const features = source.features.map((feature, index) => {
    const [lng, lat] = feature?.geometry?.coordinates ?? [];
    if (feature?.geometry?.type !== "Point" || !Number.isFinite(lng) || !Number.isFinite(lat)) throw new Error(`${family.key}:INVALID_POINT_${index}`);
    const properties = {};
    for (const [sourceName, safeName] of Object.entries(family.fields)) {
      const value = feature.properties?.[sourceName];
      if (typeof value !== "string" || !value) throw new Error(`${family.key}:INVALID_${safeName}_${index}`);
      properties[safeName] = value;
    }
    return { type: "Feature", geometry: { type: "Point", coordinates: [lng, lat] }, properties };
  });
  const forbidden = ["地址", "BAN", "電話", "contact", "address", "id", "ID"];
  if (features.some(feature => Object.keys(feature.properties).some(key => forbidden.includes(key)))) throw new Error(`${family.key}:UNSAFE_FIELD`);
  const output = Buffer.from(JSON.stringify({ type: "FeatureCollection", features }));
  await mkdir(runtimeRoot, { recursive: true });
  const outputPath = resolve(runtimeRoot, family.output);
  await writeFile(outputPath, output);
  console.log(JSON.stringify({ key: family.key, source_sha256: sha256(sourceBytes), source_rows: source.features.length, sidecar: outputPath, sidecar_sha256: sha256(output), sidecar_bytes: output.byteLength, safe_fields: Object.values(family.fields) }));
}
