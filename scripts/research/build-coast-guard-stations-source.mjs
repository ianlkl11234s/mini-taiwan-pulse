import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ANALYTICS_SHA256 = "8a4624f2d3d821b24052203a28af06808c174d2cee161cb4c199e8bf6fa78183";
const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(here, "../..");
const analyticsSource = resolve(projectRoot, "../../../../taipei-gis-analytics/data/processed/police_justice/coast_guard_stations/coast_guard_stations_20260626.geojson");
const output = resolve(projectRoot, "../runtime/research-public/coast-guard-stations-20260626.geojson");
const safeProperties = ["entity_id", "name", "area", "facility_subtype", "source", "source_tier", "fetched_at", "confidence", "n_sources"];

const bytes = await readFile(analyticsSource);
const sha256 = createHash("sha256").update(bytes).digest("hex");
if (sha256 !== ANALYTICS_SHA256) throw new Error("ANALYTICS_COAST_GUARD_SOURCE_SHA_MISMATCH");

const raw = JSON.parse(bytes.toString("utf8"));
if (raw?.type !== "FeatureCollection" || !Array.isArray(raw.features) || raw.features.length !== 269) throw new Error("ANALYTICS_COAST_GUARD_SOURCE_COUNT_MISMATCH");

const features = raw.features.map((feature) => {
  if (feature?.type !== "Feature" || feature.geometry?.type !== "Point" || !Array.isArray(feature.geometry.coordinates)) throw new Error("ANALYTICS_COAST_GUARD_SOURCE_GEOMETRY_MISMATCH");
  const properties = Object.fromEntries(safeProperties.map((name) => [name, feature.properties?.[name] ?? null]));
  return { type: "Feature", geometry: feature.geometry, properties };
});

await mkdir(dirname(output), { recursive: true });
await writeFile(output, JSON.stringify({ type: "FeatureCollection", features }));
