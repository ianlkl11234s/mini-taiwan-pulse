import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const SOURCE = "/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/taipei-gis-analytics/data/processed/transportation/ports/ports_20260527.geojson";
const SOURCE_SHA256 = "80c46fd597679cbe717e2b24ac011b44b42a3514420ff4d6508fccab2c65479c";
const OUTPUT = "../runtime/owner-only/ports/ports-owner-20260527.geojson";
const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");
const raw = await readFile(resolve(process.argv[2] ?? SOURCE));
if (sha256(raw) !== SOURCE_SHA256) throw new Error("PORTS_SOURCE_SHA_MISMATCH");
const source = JSON.parse(raw.toString("utf8"));
if (source?.type !== "FeatureCollection" || !Array.isArray(source.features) || source.features.length !== 277) throw new Error("PORTS_SOURCE_COUNT_MISMATCH");
const ids = new Set();
const features = source.features.map((feature, index) => {
  const properties = feature?.properties;
  const coordinates = feature?.geometry?.coordinates;
  if (feature?.type !== "Feature" || feature.geometry?.type !== "Point" || !Array.isArray(coordinates) || coordinates.length !== 2
    || !coordinates.every(value => typeof value === "number" && Number.isFinite(value))
    || !properties || typeof properties !== "object" || typeof properties.port_uid !== "string" || ids.has(properties.port_uid)
    || typeof properties.name !== "string" || typeof properties.source !== "string"
    || (properties.port_class_group !== null && typeof properties.port_class_group !== "string")
    || (properties.county !== null && typeof properties.county !== "string")
    || (properties.county_id !== null && typeof properties.county_id !== "string")) throw new Error(`PORTS_SOURCE_ROW_MISMATCH_${index}`);
  ids.add(properties.port_uid);
  return { type: "Feature", geometry: feature.geometry, properties: { port_uid: properties.port_uid, name: properties.name, port_class_group: properties.port_class_group, county: properties.county, county_id: properties.county_id, source: properties.source } };
});
if (features.filter(feature => feature.properties.port_class_group === null).length !== 6) throw new Error("PORTS_CATEGORY_NULL_MISMATCH");
const bytes = Buffer.from(`${JSON.stringify({ type: "FeatureCollection", features })}\n`);
const output = resolve(process.argv[3] ?? OUTPUT);
await mkdir(dirname(output), { recursive: true });
await writeFile(output, bytes);
console.log(JSON.stringify({ source: SOURCE, sourceSha256: SOURCE_SHA256, rows: features.length, output, outputSha256: sha256(bytes), bytes: bytes.length, categoryNull: 6 }));
