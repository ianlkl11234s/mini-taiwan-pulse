import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const analyticsRoot = "/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/taipei-gis-analytics";
const rawRelative = "data/raw/energy/geothermal_wells_cpc/86147.csv";
const processedRelative = "data/processed/energy/geothermal_wells/geothermal_wells_20260615.geojson";
const rawSha256 = "596bdfb2070d6d9a5c1485341a15da45b5ca7be4ec7d6ade1e7299cd5e304d9b";
const processedSha256 = "c5f1d58c04ba14250053aab0de7f5a30cb19bc3963db6fdf1a14bf6ba23abe15";
const safeFields = ["well_id", "county_code", "geothermal_area", "report_name", "data_source_nid"];

const hash = value => createHash("sha256").update(value).digest("hex");
const fail = code => { throw new Error(code); };
const point = geometry => geometry?.type === "Point" && Array.isArray(geometry.coordinates) && geometry.coordinates.length === 2
  && geometry.coordinates.every(value => typeof value === "number" && Number.isFinite(value));

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
    else if (char === "\n") { row.push(value.replace(/\r$/, "")); rows.push(row); row = []; value = ""; }
    else value += char;
  }
  if (quoted) fail("GEOTHERMAL_WELLS_RAW_CSV_UNCLOSED_QUOTE");
  if (value || row.length) { row.push(value.replace(/\r$/, "")); rows.push(row); }
  return rows.filter(candidate => candidate.some(field => field !== ""));
}

function dmsToDecimal(value) {
  const match = /^\s*(\d+)\s*°\s*(\d+)\s*'\s*([\d.]+)\s*"?\s*$/.exec(value);
  if (!match) return null;
  const decimal = Number(match[1]) + Number(match[2]) / 60 + Number(match[3]) / 3600;
  return Number.isFinite(decimal) ? decimal : null;
}

const [root = analyticsRoot, output = "../runtime/owner-only/geothermal-wells/geothermal-wells-owner-20260615.geojson"] = process.argv.slice(2);
const raw = await readFile(resolve(root, rawRelative));
if (hash(raw) !== rawSha256) fail("GEOTHERMAL_WELLS_RAW_SHA_MISMATCH");
const csv = parseCsv(raw.toString("utf8").replace(/^\uFEFF/, ""));
const header = csv.shift();
const expectedHeader = ["縣市", "地熱區", "報告名稱", "地熱井經度", "地熱井緯度", "附圖內容", "報告下載網址", "附圖下載網址"];
if (!header || JSON.stringify(header) !== JSON.stringify(expectedHeader) || csv.length !== 36 || csv.some(row => row.length !== expectedHeader.length)) fail("GEOTHERMAL_WELLS_RAW_SHAPE_MISMATCH");
const rawRows = csv.map(row => Object.fromEntries(expectedHeader.map((field, index) => [field, row[index]?.trim() ?? ""])));
if (rawRows.some(row => !row.縣市 || !row.地熱區 || !row.報告名稱 || !row.地熱井經度 || !row.地熱井緯度 || !row.附圖內容 || !row.報告下載網址)
  || rawRows.filter(row => !row.附圖下載網址).length !== 3) fail("GEOTHERMAL_WELLS_RAW_SEMANTICS_MISMATCH");

const processed = await readFile(resolve(root, processedRelative));
if (hash(processed) !== processedSha256) fail("GEOTHERMAL_WELLS_PROCESSED_SHA_MISMATCH");
const collection = JSON.parse(processed.toString("utf8"));
if (collection?.type !== "FeatureCollection" || !Array.isArray(collection.features) || collection.features.length !== 36) fail("GEOTHERMAL_WELLS_PROCESSED_SHAPE_MISMATCH");

const features = collection.features.map((feature, index) => {
  const properties = feature?.properties;
  const rawRow = rawRows[index];
  if (!rawRow || feature?.type !== "Feature" || !point(feature.geometry) || !properties || typeof properties !== "object"
    || ["county_code", "geothermal_area", "report_name", "lng_raw", "lat_raw", "figure_content", "report_url", "figure_url", "data_source_nid"].some(field => typeof properties[field] !== "string")
    || properties.county_code !== rawRow.縣市 || properties.geothermal_area !== rawRow.地熱區 || properties.report_name !== rawRow.報告名稱
    || properties.lng_raw !== rawRow.地熱井經度 || properties.lat_raw !== rawRow.地熱井緯度 || properties.figure_content !== rawRow.附圖內容
    || properties.report_url !== rawRow.報告下載網址 || properties.figure_url !== rawRow.附圖下載網址 || properties.data_source_nid !== "86147") fail(`GEOTHERMAL_WELLS_RAW_PROCESSED_ALIGNMENT_${index}`);
  const lng = dmsToDecimal(rawRow.地熱井經度); const lat = dmsToDecimal(rawRow.地熱井緯度);
  if (lng === null || lat === null || Math.abs(feature.geometry.coordinates[0] - lng) > 1e-12 || Math.abs(feature.geometry.coordinates[1] - lat) > 1e-12) fail(`GEOTHERMAL_WELLS_DMS_GEOMETRY_${index}`);
  return { type: "Feature", geometry: feature.geometry, properties: { well_id: `cpc-86147-${String(index + 1).padStart(3, "0")}`, county_code: properties.county_code, geothermal_area: properties.geothermal_area, report_name: properties.report_name, data_source_nid: properties.data_source_nid } };
});
const areaCounts = Object.fromEntries([...new Set(rawRows.map(row => row.地熱區))].sort().map(area => [area, rawRows.filter(row => row.地熱區 === area).length]));
if (JSON.stringify(areaCounts) !== JSON.stringify({ "仁澤": 4, "內員山": 1, "嘉蘭": 1, "土場": 2, "大湖": 1, "寒溪": 1, "廬山": 3, "清水": 11, "瑞穗": 2, "知本": 2, "秀磺坪": 1, "紅葉": 1, "金山": 1, "金崙": 3, "馬槽": 2 })) fail("GEOTHERMAL_WELLS_AREA_SEMANTICS_MISMATCH");
const bytes = Buffer.from(`${JSON.stringify({ type: "FeatureCollection", features })}\n`);
const outputPath = resolve(output); await mkdir(dirname(outputPath), { recursive: true }); await writeFile(outputPath, bytes);
console.log(JSON.stringify({ raw: { path: resolve(root, rawRelative), sha256: rawSha256, rows: rawRows.length, blankFigureUrl: 3 }, processed: { path: resolve(root, processedRelative), sha256: processedSha256, rows: features.length }, retainedFields: safeFields, areaCounts, output: { path: outputPath, sha256: hash(bytes), bytes: bytes.length, rows: features.length }, hold: "fixed 2026-06-15 source snapshot; no current drilling, well status, temperature, depth, production, safety, access, or project-status fields" }));
