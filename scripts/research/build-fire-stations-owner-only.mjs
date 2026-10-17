import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const sources = {
  sevenCities: { sha256: "1bb6ab0f12038757509e25db13d9c5dce980a0af1d610acace4423a1cf1bc981", rows: 343 },
  fifteenCounties: { sha256: "bc8b82b594ba5bfae9dc59108d1f22858288c7e9ac0a97a7635659cf971e3416", rows: 374 },
};
const display = { sha256: "3f06f54ed821abd4c4217950f3a0dedaf77a32e5a3ad8651493292e95aaed892", rows: 716, missingIds: ["I_008"], coordinateMismatches: 38 };
const safeFields = ["station_id", "county_id", "name", "type", "district", "data_source", "geocoding_source", "geocoding_precision"];

const fail = (code) => { throw new Error(code); };
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const count = (values) => Object.fromEntries([...values.reduce((out, value) => out.set(value, (out.get(value) ?? 0) + 1), new Map()).entries()].sort(([a], [b]) => a.localeCompare(b)));
const same = (left, right) => Object.keys(left).length === Object.keys(right).length && Object.entries(left).every(([key, value]) => right[key] === value);

function parseCsv(bytes) {
  const text = bytes.toString("utf8").replace(/^\uFEFF/, "");
  const lines = [];
  let row = [], value = "", quoted = false;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') { value += char; index++; }
      else if (char === '"') quoted = false;
      else value += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") { row.push(value); value = ""; }
    else if (char === "\n") { row.push(value.replace(/\r$/, "")); lines.push(row); row = []; value = ""; }
    else value += char;
  }
  if (quoted) fail("FIRE_STATIONS_CSV_UNTERMINATED_QUOTE");
  if (value || row.length) { row.push(value.replace(/\r$/, "")); lines.push(row); }
  const [headers, ...records] = lines;
  if (!headers?.length || new Set(headers).size !== headers.length) fail("FIRE_STATIONS_CSV_HEADER_INVALID");
  return records.filter(record => record.some(value => value !== "")).map(record => {
    if (record.length !== headers.length) fail("FIRE_STATIONS_CSV_ROW_WIDTH_MISMATCH");
    return Object.fromEntries(headers.map((header, index) => [header, record[index]]));
  });
}

function coordinates(row) {
  const lng = Number(row.lng), lat = Number(row.lat);
  if (!Number.isFinite(lng) || !Number.isFinite(lat) || lng < 118 || lng > 122.5 || lat < 21.5 || lat > 26.5) fail("FIRE_STATIONS_SOURCE_COORDINATE_INVALID");
  return [lng, lat];
}

function stationFeature(row, sourceKind) {
  const stationId = row.station_id?.trim();
  if (!stationId || !row.county_id?.trim() || !row.name?.trim() || !row.data_source?.trim() || !row.geocoding_source?.trim()) fail("FIRE_STATIONS_SOURCE_FIELD_INVALID");
  const geocodingPrecision = row.geocoding_precision?.trim() || null;
  if (sourceKind === "seven" && geocodingPrecision !== null) fail("FIRE_STATIONS_SEVEN_CITIES_PRECISION_INVALID");
  if (sourceKind === "fifteen" && !["ROOFTOP", "APPROXIMATE", "FAIL_BBOX", "RANGE_INTERPOLATED", "GEOMETRIC_CENTER"].includes(geocodingPrecision ?? "")) fail("FIRE_STATIONS_FIFTEEN_COUNTIES_PRECISION_INVALID");
  return {
    type: "Feature",
    geometry: { type: "Point", coordinates: coordinates(row) },
    properties: {
      station_id: stationId,
      county_id: row.county_id.trim(),
      name: row.name.trim(),
      type: row.type?.trim() || null,
      district: row.district?.trim() || null,
      data_source: row.data_source.trim(),
      geocoding_source: row.geocoding_source.trim(),
      geocoding_precision: geocodingPrecision,
    },
  };
}

function verifyDisplay(bytes, features) {
  if (sha(bytes) !== display.sha256) fail("FIRE_STATIONS_DISPLAY_SHA_MISMATCH");
  const collection = JSON.parse(bytes.toString("utf8"));
  if (collection?.type !== "FeatureCollection" || !Array.isArray(collection.features) || collection.features.length !== display.rows) fail("FIRE_STATIONS_DISPLAY_COUNT_MISMATCH");
  const sourceById = new Map(features.map(feature => [feature.properties.station_id, feature]));
  const displayIds = new Set();
  const coordinateMismatchIds = [];
  for (const feature of collection.features) {
    const id = feature?.properties?.id;
    const source = sourceById.get(id);
    if (feature?.type !== "Feature" || typeof id !== "string" || !source || displayIds.has(id) || feature.geometry?.type !== "Point") fail("FIRE_STATIONS_DISPLAY_ALIGNMENT_INVALID");
    displayIds.add(id);
    const coordinates = feature.geometry.coordinates;
    if (!Array.isArray(coordinates) || coordinates.length !== 2 || !coordinates.every(Number.isFinite)) fail("FIRE_STATIONS_DISPLAY_COORDINATE_INVALID");
    if (coordinates.some((value, index) => value !== Number(source.geometry.coordinates[index].toFixed(6)))) coordinateMismatchIds.push(id);
  }
  const missingIds = [...sourceById.keys()].filter(id => !displayIds.has(id)).sort();
  if (!same(count(missingIds), count(display.missingIds)) || coordinateMismatchIds.length !== display.coordinateMismatches || coordinateMismatchIds.some(id => !id.startsWith("T_"))) fail("FIRE_STATIONS_DISPLAY_ALIGNMENT_MISMATCH");
  return { rows: collection.features.length, missingIds, coordinateMismatchIds };
}

const [sevenArg, fifteenArg, displayArg, outputArg] = process.argv.slice(2);
if (!sevenArg || !fifteenArg) fail("Usage: node scripts/research/build-fire-stations-owner-only.mjs <stations_7cities.csv> <stations_15counties_geocoded.csv> [display.geojson] [output.geojson]");
const sevenPath = resolve(sevenArg), fifteenPath = resolve(fifteenArg);
const output = resolve(outputArg ?? "../runtime/owner-only/fire-stations/fire-stations-source-20260710.geojson");
const sevenBytes = await readFile(sevenPath), fifteenBytes = await readFile(fifteenPath);
if (sha(sevenBytes) !== sources.sevenCities.sha256 || sha(fifteenBytes) !== sources.fifteenCounties.sha256) fail("FIRE_STATIONS_UPSTREAM_SHA_MISMATCH");
const sevenRows = parseCsv(sevenBytes), fifteenRows = parseCsv(fifteenBytes);
if (sevenRows.length !== sources.sevenCities.rows || fifteenRows.length !== sources.fifteenCounties.rows) fail("FIRE_STATIONS_UPSTREAM_COUNT_MISMATCH");
if (!same(count(sevenRows.map(row => row.geocoding_source)), { google: 39, official_dataset: 304 })
  || !same(count(fifteenRows.map(row => row.geocoding_source)), { google: 374 })) fail("FIRE_STATIONS_UPSTREAM_GEOCODING_SEMANTICS_MISMATCH");
if (!same(count(fifteenRows.map(row => row.geocoding_precision)), { APPROXIMATE: 81, FAIL_BBOX: 10, GEOMETRIC_CENTER: 6, RANGE_INTERPOLATED: 8, ROOFTOP: 269 })) fail("FIRE_STATIONS_UPSTREAM_PRECISION_SEMANTICS_MISMATCH");
const features = [...sevenRows.map(row => stationFeature(row, "seven")), ...fifteenRows.map(row => stationFeature(row, "fifteen"))];
const ids = features.map(feature => feature.properties.station_id);
if (new Set(ids).size !== features.length || features.length !== 717) fail("FIRE_STATIONS_SOURCE_ID_OR_COUNT_MISMATCH");
const displayReceipt = displayArg ? verifyDisplay(await readFile(resolve(displayArg)), features) : null;
const collection = { type: "FeatureCollection", features };
const out = `${JSON.stringify(collection)}\n`;
await mkdir(dirname(output), { recursive: true });
await writeFile(output, out);
console.log(JSON.stringify({ sevenPath, fifteenPath, output, outputSha256: sha(out), records: features.length, geocodingSource: count(features.map(feature => feature.properties.geocoding_source)), geocodingPrecision: count(features.map(feature => feature.properties.geocoding_precision ?? "null")), safeFields, display: displayReceipt }));
