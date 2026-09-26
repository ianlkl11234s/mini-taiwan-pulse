import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const rawSha = "09762ba750e9da4a392481507fd20a462cdcd05037ef5e35b7b29ac84a7173b3";
const processedSha = "4223d9558df384c8bcbad50087091d2038408157569f512deebf2bb6ce5600a2";
const expectedCoordMethods = { TGOS: 570, L1: 62, offline_exact: 2, none: 10 };
const fields = ["uid", "name", "type", "county", "town", "coord_method"];
const fail = code => { throw new Error(code); };
const sha = bytes => createHash("sha256").update(bytes).digest("hex");

function parseCsv(text) {
  const rows = []; let row = []; let value = ""; let quoted = false;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') { value += '"'; index++; }
      else if (char === '"') quoted = false;
      else value += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") { row.push(value); value = ""; }
    else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[index + 1] === "\n") index++;
      row.push(value); value = "";
      if (row.length > 1 || row[0]) rows.push(row);
      row = [];
    } else value += char;
  }
  if (quoted) fail("PUBLIC_LIBRARIES_RAW_CSV_INVALID");
  if (row.length || value) { row.push(value); rows.push(row); }
  return rows;
}

const [rawArg, processedArg, outputArg] = process.argv.slice(2);
if (!rawArg || !processedArg) fail("Usage: node scripts/research/build-public-libraries-source.mjs <raw.csv> <processed.geojson> [output.geojson]");
const rawPath = resolve(rawArg); const processedPath = resolve(processedArg);
const output = resolve(outputArg ?? "../runtime/research-public/public-libraries-source-20260717.geojson");
const rawBytes = await readFile(rawPath); const processedBytes = await readFile(processedPath);
if (sha(rawBytes) !== rawSha) fail("PUBLIC_LIBRARIES_RAW_SHA_MISMATCH");
if (sha(processedBytes) !== processedSha) fail("PUBLIC_LIBRARIES_PROCESSED_SHA_MISMATCH");

const rawRows = parseCsv(new TextDecoder("big5").decode(rawBytes));
const [header, ...rows] = rawRows;
const expectedHeader = ["序號", "中文館名", "郵遞區號", "縣市", "區域", "中文地址", "圖書館類型"];
if (JSON.stringify(header) !== JSON.stringify(expectedHeader) || rows.length !== 5254) fail("PUBLIC_LIBRARIES_RAW_SCHEMA_MISMATCH");
const libraries = rows.map(row => Object.fromEntries(header.map((name, index) => [name, row[index] ?? ""])))
  .filter(row => row["圖書館類型"].includes("公共圖書館") && row["圖書館類型"] !== "測試圖書館" && !row["中文館名"].includes("測試"));
if (libraries.length !== 644 || libraries.some(row => !row["序號"] || !row["中文館名"] || !row["縣市"] || !row["區域"] || !row["中文地址"] || !row["圖書館類型"])) fail("PUBLIC_LIBRARIES_RAW_SEMANTICS_MISMATCH");

const processed = JSON.parse(processedBytes.toString("utf8"));
if (processed.type !== "FeatureCollection" || !Array.isArray(processed.features) || processed.features.length !== 634) fail("PUBLIC_LIBRARIES_PROCESSED_COUNT_MISMATCH");
const points = new Map(); const methods = { ...Object.fromEntries(Object.keys(expectedCoordMethods).map(method => [method, 0])) };
for (const feature of processed.features) {
  const p = feature.properties; const coordinates = feature.geometry?.coordinates;
  if (feature.type !== "Feature" || feature.geometry?.type !== "Point" || !Array.isArray(coordinates) || coordinates.length !== 2 || !coordinates.every(Number.isFinite)
    || coordinates[0] < 118 || coordinates[0] > 122.2 || coordinates[1] < 21.8 || coordinates[1] > 26.5
    || typeof p?.uid !== "string" || points.has(p.uid) || !Object.hasOwn(expectedCoordMethods, p.coord_method)) fail("PUBLIC_LIBRARIES_PROCESSED_FEATURE_INVALID");
  points.set(p.uid, feature); methods[p.coord_method]++;
}
if (Object.entries(expectedCoordMethods).some(([method, count]) => method !== "none" && methods[method] !== count)) fail("PUBLIC_LIBRARIES_COORD_METHOD_MISMATCH");

const seen = new Set();
const features = libraries.map(row => {
  const uid = `public_libraries:${row["序號"]}`; const point = points.get(uid);
  if (seen.has(uid)) fail("PUBLIC_LIBRARIES_RAW_UID_DUPLICATE"); seen.add(uid);
  const properties = { uid, name: row["中文館名"], type: row["圖書館類型"], county: row["縣市"], town: row["區域"], coord_method: point?.properties.coord_method ?? "none" };
  if (point && (point.properties.name !== properties.name || point.properties.type !== properties.type || point.properties.county !== properties.county || point.properties.town !== properties.town)) fail("PUBLIC_LIBRARIES_ROW_ALIGNMENT_MISMATCH");
  methods[properties.coord_method]++;
  return { type: "Feature", geometry: point?.geometry ?? null, properties: Object.fromEntries(fields.map(field => [field, properties[field]])) };
});
if (features.length !== 644 || Object.entries(expectedCoordMethods).some(([method, count]) => methods[method] !== count * (method === "none" ? 1 : 2))) fail("PUBLIC_LIBRARIES_SIDECAR_SEMANTICS_MISMATCH");
const out = `${JSON.stringify({ type: "FeatureCollection", features })}\n`;
await mkdir(dirname(output), { recursive: true }); await writeFile(output, out);
console.log(JSON.stringify({ rawPath, rawSha, processedPath, processedSha, output, outputSha: sha(out), bytes: Buffer.byteLength(out), records: features.length, coordMethods: Object.fromEntries(Object.entries(methods).map(([method, count]) => [method, count / (method === "none" ? 1 : 2)])), counties: new Set(features.map(feature => feature.properties.county)).size }));
