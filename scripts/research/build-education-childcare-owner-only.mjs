import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const datasets = [
  { key: "kindergarten", output: "kindergartens-20260807-owner.geojson", total: 6747, point: 6689, missing: 58, rawSha: "28bbd156fcc66cf62d583221a195dc45d5f08c07e10f17df925b61aed2d8c946", geoSha: "bc9749db2f80411ca176ca1873a0e9a2d8e06e01b5268e23d6d429fa803cbfce", missSha: "1e453ad14607e164c58bd8a0a8cea5bf7ac1fb544e3922ae538465f37dc0e587", current: rows => rows.filter(row => row["學年度"] === "114"), safe: row => ({ source_row_id: row._row_id, academic_year: Number(row["學年度"]), code: row["代碼"], name: row["學校名稱"], ownership: row["公/私立"], city: row["縣市名稱"], district: row["鄉鎮市區名稱"] }) },
  { key: "afterschoolCare", output: "afterschool-care-20260807-owner.geojson", total: 787, point: 782, missing: 5, rawSha: "cf5915d485b7a8817cf24004a11aa076ad2011c01f9c6333227d480c27b8736a", geoSha: "85004118188dc7496af8202931254f44106e51151a81b299fc2a4c429bcfd99d", missSha: "20794e73a3f5a12d6e72bc3c828a63193c274e81f77d4ddfc3197a9cb8b47abe", current: rows => rows, safe: row => ({ source_row_id: row._row_id, name: row["名稱"], city: row["縣市"], registered_at: row["立案時間"] }) },
  { key: "mutualCare", output: "mutual-care-20260807-owner.geojson", total: 148, point: 148, missing: 0, rawSha: "83f08f833f413a58e9a2afbdda2cb5becae580e1ad5d1074530bd2482490b5c7", geoSha: "3bc18d4d426a6e6e1bfa575d2e29f4e316ecfa581dd2efadcabf80138fcfc932", missSha: "a8aa5eee6538e477b412b52d3918ec2b0efc8905b8f536cfdf9a0792c412011e", current: rows => rows.filter(row => row["學年度"] === "114"), safe: row => ({ source_row_id: row._row_id, sequence: Number(row["項次編號"]), academic_year: Number(row["學年度"]), school_code: row["學校代碼"], name: row["學校名稱"], ownership: row["公/私立"], city_code: Number(row["縣市代碼"]), city: row["縣市名稱"], district: row["鄉鎮市區名稱"] }) },
];
const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");
const fail = code => { throw new Error(code); };
const validPoint = geometry => geometry?.type === "Point" && Array.isArray(geometry.coordinates) && geometry.coordinates.length === 2 && geometry.coordinates.every(value => typeof value === "number" && Number.isFinite(value)) && geometry.coordinates[0] >= 118 && geometry.coordinates[0] <= 123 && geometry.coordinates[1] >= 21 && geometry.coordinates[1] <= 27;
function parseCsv(input) {
  const rows = []; let row = []; let field = ""; let quoted = false;
  for (let index = 0; index < input.length; index++) { const ch = input[index]; if (quoted) { if (ch === '"' && input[index + 1] === '"') { field += '"'; index++; } else if (ch === '"') quoted = false; else field += ch; } else if (ch === '"') quoted = true; else if (ch === ',') { row.push(field); field = ""; } else if (ch === '\n') { row.push(field.replace(/\r$/, "")); rows.push(row); row = []; field = ""; } else field += ch; }
  if (quoted) fail("EDUCATION_CHILDCARE_CSV_INVALID"); if (field || row.length) { row.push(field.replace(/\r$/, "")); rows.push(row); }
  const [header, ...body] = rows; if (!header) fail("EDUCATION_CHILDCARE_CSV_EMPTY"); header[0] = header[0].replace(/^\uFEFF/, ""); return body.filter(values => values.length > 1 || values[0]).map(values => Object.fromEntries(header.map((key, index) => [key, values[index] ?? ""])));
}
function assertSafe(dataset, row) { const safe = dataset.safe(row); if (Object.values(safe).some(value => value === "" || value === undefined || (typeof value === "number" && !Number.isSafeInteger(value)))) fail(`EDUCATION_CHILDCARE_${dataset.key}_SAFE_FIELD_INVALID`); return safe; }
const args = process.argv.slice(2);
if (args.length !== 9 && args.length !== 10) fail("Usage: node scripts/research/build-education-childcare-owner-only.mjs <kind-raw.csv> <kind.geojson> <kind-miss.csv> <after-raw.csv> <after.geojson> <after-miss.csv> <mutual-raw.csv> <mutual.geojson> <mutual-miss.csv> [output-dir]");
const outDir = resolve(args[9] ?? "../runtime/owner-only/education-childcare");
const report = [];
for (let index = 0; index < datasets.length; index++) {
  const dataset = datasets[index]; const [rawPath, geoPath, missPath] = args.slice(index * 3, index * 3 + 3).map(path => resolve(path));
  const [rawBytes, geoBytes, missBytes] = await Promise.all([readFile(rawPath), readFile(geoPath), readFile(missPath)]);
  if (sha256(rawBytes) !== dataset.rawSha) fail(`EDUCATION_CHILDCARE_${dataset.key}_RAW_SHA_MISMATCH`);
  if (sha256(geoBytes) !== dataset.geoSha) fail(`EDUCATION_CHILDCARE_${dataset.key}_GEO_SHA_MISMATCH`);
  if (sha256(missBytes) !== dataset.missSha) fail(`EDUCATION_CHILDCARE_${dataset.key}_MISS_SHA_MISMATCH`);
  const raw = dataset.current(parseCsv(rawBytes.toString("utf8"))).map((row, ordinal) => ({ ...row, _row_id: String(ordinal) }));
  const collection = JSON.parse(geoBytes.toString("utf8")); const misses = parseCsv(missBytes.toString("utf8"));
  if (raw.length !== dataset.total || collection?.type !== "FeatureCollection" || !Array.isArray(collection.features) || collection.features.length !== dataset.point || misses.length !== dataset.missing) fail(`EDUCATION_CHILDCARE_${dataset.key}_COUNT_MISMATCH`);
  const rawById = new Map(raw.map(row => [row._row_id, row])); if (rawById.size !== dataset.total) fail(`EDUCATION_CHILDCARE_${dataset.key}_RAW_ID_DUPLICATE`);
  const located = new Map(); for (const feature of collection.features) { const row = feature?.properties; const id = String(row?._row_id ?? ""); if (feature?.type !== "Feature" || !rawById.has(id) || located.has(id) || !validPoint(feature.geometry) || typeof row.source !== "string" || !row.source || typeof row.precision !== "string" || !row.precision) fail(`EDUCATION_CHILDCARE_${dataset.key}_POINT_INVALID`); located.set(id, { geometry: feature.geometry, geocode_source: row.source, geocode_precision: row.precision }); }
  const unlocated = new Set(); for (const row of misses) { const id = String(row._row_id ?? ""); if (!rawById.has(id) || located.has(id) || unlocated.has(id) || row.lon || row.lat || row.source || row.precision) fail(`EDUCATION_CHILDCARE_${dataset.key}_MISS_INVALID`); unlocated.add(id); }
  if (located.size + unlocated.size !== dataset.total) fail(`EDUCATION_CHILDCARE_${dataset.key}_COVERAGE_MISMATCH`);
  const features = raw.map(row => { const point = located.get(row._row_id); return { type: "Feature", geometry: point?.geometry ?? null, properties: { ...assertSafe(dataset, row), coordinate_status: point ? "located" : "unlocated", geocode_source: point?.geocode_source ?? null, geocode_precision: point?.geocode_precision ?? null } }; });
  const output = `${JSON.stringify({ type: "FeatureCollection", features })}\n`; const outputPath = resolve(outDir, dataset.output); await mkdir(outDir, { recursive: true }); await writeFile(outputPath, output, "utf8");
  report.push({ dataset: dataset.key, rawSha256: dataset.rawSha, geoSha256: dataset.geoSha, missSha256: dataset.missSha, output: outputPath, outputSha256: sha256(output), rows: dataset.total, geometry: { point: located.size, null: unlocated.size } });
}
console.log(JSON.stringify(report));
