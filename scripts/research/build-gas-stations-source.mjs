import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const inputSha = "00ee5b007a680788c25d1c4e1abf2da2628b776aec1a4644904f49a7dff15c80";
const expectedBrands = { "中油": 2023, "台塑": 350, "台糖": 86, unknown: 698 };
const expectedLicenses = { "OGDL-Taiwan-1.0": 2610, "ODbL 1.0": 443 };
const fields = ["entity_id", "name", "brand", "source", "source_org", "coord_source", "fetched_at", "license", "confidence", "n_sources"];
const fail = code => { throw new Error(code); };
const sha = bytes => createHash("sha256").update(bytes).digest("hex");

const [inputArg, outputArg, displayArg] = process.argv.slice(2);
if (!inputArg) fail("Usage: node scripts/research/build-gas-stations-source.mjs <analytics-processed.geojson> [output.geojson] [existing-static-rpc.json]");
const input = resolve(inputArg);
const output = resolve(outputArg ?? "public/research/gas-stations-canonical-20260620.geojson");
const bytes = await readFile(input);
if (sha(bytes) !== inputSha) fail("GAS_STATIONS_SOURCE_SHA_MISMATCH");
const collection = JSON.parse(bytes.toString("utf8"));
if (collection.type !== "FeatureCollection" || !Array.isArray(collection.features) || collection.features.length !== 3053) fail("GAS_STATIONS_SOURCE_COUNT_MISMATCH");

function canonicalBrand(value) {
  if (typeof value !== "string") return null;
  if (/中油|CPC/i.test(value)) return "中油";
  if (/台塑|FPCC|FORMOSA/i.test(value)) return "台塑";
  if (/台糖|TAISUGAR/i.test(value)) return "台糖";
  return null;
}

const entityIds = new Set();
const brandCounts = Object.fromEntries(Object.keys(expectedBrands).map(brand => [brand, 0]));
const licenseCounts = Object.fromEntries(Object.keys(expectedLicenses).map(license => [license, 0]));
let blankNames = 0;
const features = collection.features.map(feature => {
  const p = feature.properties;
  const coordinates = feature.geometry?.coordinates;
  if (feature.type !== "Feature" || feature.geometry?.type !== "Point" || !Array.isArray(coordinates) || coordinates.length !== 2
    || !coordinates.every(Number.isFinite) || Math.abs(coordinates[0]) > 180 || Math.abs(coordinates[1]) > 90
    || typeof p?.entity_id !== "string" || !p.entity_id || typeof p.name !== "string"
    || typeof p.source !== "string" || typeof p.source_org !== "string" || typeof p.coord_source !== "string"
    || p.fetched_at !== "2026-06-20" || !Object.hasOwn(licenseCounts, p.license)
    || typeof p.confidence !== "number" || !Number.isFinite(p.confidence) || !Number.isInteger(p._n_sources) || p._n_sources < 1
    || !Array.isArray(p.brand_guess) || !Array.isArray(p._provenance)) fail("GAS_STATIONS_SOURCE_FEATURE_INVALID");
  entityIds.add(p.entity_id);
  if (!p.name) blankNames++;
  const brands = [...new Set([
    ...p.brand_guess.map(canonicalBrand),
    ...p._provenance.map(entry => canonicalBrand(entry?.row?.brand)),
  ].filter(Boolean))].sort();
  if (brands.length === 0) brands.push("unknown");
  for (const brand of brands) brandCounts[brand]++;
  licenseCounts[p.license]++;
  const safe = { entity_id: p.entity_id, name: p.name, brand: brands.join("|"), source: p.source, source_org: p.source_org, coord_source: p.coord_source, fetched_at: p.fetched_at, license: p.license, confidence: p.confidence, n_sources: p._n_sources };
  return { type: "Feature", geometry: feature.geometry, properties: Object.fromEntries(fields.map(field => [field, safe[field]])) };
});
if (entityIds.size !== 3022 || Object.keys(expectedBrands).some(brand => brandCounts[brand] !== expectedBrands[brand])
  || Object.keys(expectedLicenses).some(license => licenseCounts[license] !== expectedLicenses[license])) fail("GAS_STATIONS_SOURCE_SEMANTICS_MISMATCH");
const out = `${JSON.stringify({ type: "FeatureCollection", features })}\n`;
let displayAlignment = null;
if (displayArg) {
  const displayBytes = await readFile(resolve(displayArg));
  const displayRows = JSON.parse(displayBytes.toString("utf8")).filter(row => row.layer === "gas_station_canonical");
  const key = (name, coordinates, license = "") => `${name}\u0000${coordinates.map(value => value.toFixed(6)).join(",")}\u0000${license}`;
  const bag = (rows, getKey) => {
    const counts = new Map();
    for (const row of rows) { const value = getKey(row); counts.set(value, (counts.get(value) ?? 0) + 1); }
    return counts;
  };
  const differences = (left, right) => [...left].reduce((count, [name, n]) => count + Math.max(0, n - (right.get(name) ?? 0)), 0);
  const sourceByNamePoint = bag(collection.features, feature => key(feature.properties.name, feature.geometry.coordinates));
  const displayByNamePoint = bag(displayRows, row => key(row.name, row.geom_json?.coordinates));
  const sourceByBrand = bag(features, feature => key(feature.properties.name, feature.geometry.coordinates, feature.properties.brand));
  const displayByBrand = bag(displayRows, row => key(row.name, row.geom_json?.coordinates, (row.attrs?.brand ?? []).slice().sort().join("|")));
  const sourceByLicense = bag(collection.features, feature => key(feature.properties.name, feature.geometry.coordinates, feature.properties.license));
  const displayByLicense = bag(displayRows, row => key(row.name, row.geom_json?.coordinates, row.license));
  displayAlignment = { sha256: sha(displayBytes), canonicalRows: displayRows.length,
    missingNamePointAtSixDecimals: differences(sourceByNamePoint, displayByNamePoint),
    conflictingBrandRows: differences(sourceByBrand, displayByBrand),
    conflictingLicenseRows: differences(sourceByLicense, displayByLicense) };
  if (displayRows.length !== 3053 || displayAlignment.missingNamePointAtSixDecimals !== 0 || displayAlignment.conflictingBrandRows !== 0) fail("GAS_STATIONS_DISPLAY_POINT_MISMATCH");
}
await mkdir(dirname(output), { recursive: true });
await writeFile(output, out);
console.log(JSON.stringify({ input, inputSha, output, outputSha: sha(out), bytes: Buffer.byteLength(out), records: features.length, uniqueEntityIds: entityIds.size, brandCounts, licenseCounts, blankNames, displayAlignment }));
