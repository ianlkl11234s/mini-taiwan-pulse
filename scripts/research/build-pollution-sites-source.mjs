import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const frontendSha = "095079a9717b647a3b4ab1c5ae95d0d8ac8750c2ac8379e957b3c7b7e3ff5682";
const stagedSha = "9139e65862c7206fefcb298e94299e9ed5e28b9b6c072edf1fd83a9a628bd394";
const fields = ["site_id", "site_name", "county", "township", "site_type", "controltype", "is_active", "anno_date", "anno_year", "deanno_date", "sitearea", "pollutant_short", "source_kind", "max_sev"];
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
const fail = code => { throw new Error(code); };

const [frontendArg, stagedArg, outputArg] = process.argv.slice(2);
if (!frontendArg || !stagedArg) fail("Usage: node scripts/research/build-pollution-sites-source.mjs <frontend.geojsonseq> <staged.geojson> [output.geojson]");
const frontendBytes = await readFile(resolve(frontendArg));
const stagedBytes = await readFile(resolve(stagedArg));
if (sha(frontendBytes) !== frontendSha || sha(stagedBytes) !== stagedSha) fail("POLLUTION_SITES_INPUT_SHA_MISMATCH");
const rows = frontendBytes.toString("utf8").trimEnd().split("\n").map(line => JSON.parse(line));
const staged = JSON.parse(stagedBytes.toString("utf8"));
if (rows.length !== 8253 || staged.type !== "FeatureCollection" || staged.features?.length !== 8253) fail("POLLUTION_SITES_INPUT_COUNT_MISMATCH");
const stagedById = new Map(staged.features.map(feature => [feature.properties?.site_id, feature]));
if (stagedById.size !== 8253) fail("POLLUTION_SITES_STAGED_ID_MISMATCH");

const seen = new Set();
let active = 0;
const features = rows.map(feature => {
  const p = feature?.properties;
  const coordinates = feature?.geometry?.coordinates;
  if (feature?.type !== "Feature" || feature.geometry?.type !== "Point" || !Array.isArray(coordinates) || coordinates.length !== 2
    || !coordinates.every(Number.isFinite) || coordinates[0] < 118 || coordinates[0] > 123 || coordinates[1] < 21 || coordinates[1] > 26
    || typeof p?.site_id !== "string" || !p.site_id || seen.has(p.site_id) || typeof p.site_name !== "string"
    || typeof p.county !== "string" || typeof p.township !== "string" || typeof p.site_type !== "string"
    || typeof p.controltype !== "string" || ![0, 1].includes(p.is_active) || typeof p.anno_date !== "string"
    || !Number.isInteger(p.anno_year) || !Number.isFinite(p.sitearea) || typeof p.pollutant_short !== "string"
    || p.source_kind !== "contaminated_site" || p.max_sev !== 4
    || (p.deanno_date !== undefined && typeof p.deanno_date !== "string")) fail("POLLUTION_SITES_SOURCE_FEATURE_INVALID");
  const original = stagedById.get(p.site_id);
  if (!original || original.properties?.site_name !== p.site_name
    || JSON.stringify(original.geometry?.coordinates) !== JSON.stringify(coordinates)
    || p.is_active !== (original.properties?.deanno_date ? 0 : 1)
    || (p.deanno_date ?? null) !== (original.properties?.deanno_date || null)
    || !Number.isFinite(Number(original.properties?.sitearea))
    || p.sitearea !== Math.trunc(Number(original.properties?.sitearea))) fail("POLLUTION_SITES_STAGED_ALIGNMENT_MISMATCH");
  seen.add(p.site_id);
  active += p.is_active;
  // The frontend contract truncated 1,568 decimal areas to integers. Restore the
  // numeric staged value so a query never presents that truncation as observed.
  const safe = { ...p, deanno_date: p.deanno_date ?? null, sitearea: Number(original.properties.sitearea) };
  return { type: "Feature", geometry: feature.geometry, properties: Object.fromEntries(fields.map(field => [field, safe[field]])) };
});
if (active !== 365 || seen.size !== 8253) fail("POLLUTION_SITES_STATUS_COUNT_MISMATCH");
const output = resolve(outputArg ?? "../runtime/research-public/pollution-sites-20260706.geojson");
const bytes = Buffer.from(`${JSON.stringify({ type: "FeatureCollection", features })}\n`);
await mkdir(dirname(output), { recursive: true });
await writeFile(output, bytes);
console.log(JSON.stringify({ frontendSha, stagedSha, output, outputSha: sha(bytes), bytes: bytes.length, rows: rows.length, active, deannounced: rows.length - active }));
