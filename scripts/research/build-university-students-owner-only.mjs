import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const SOURCE_SHA256 = "1e32c1b7bec888108b40697a1b07f88da00cd45ee42d00b2761f91989e9e4b64";
const safeFields = ["code", "school_name", "school_level", "city", "district", "system_type", "academic_year", "students_total", "students_male", "students_female", "n_program_rows"];
const digest = bytes => createHash("sha256").update(bytes).digest("hex");
const fail = code => { throw new Error(code); };
const input = resolve(process.argv[2] ?? "public/education/university_students.geojson");
const output = resolve(process.argv[3] ?? "../runtime/owner-only/university-students/university-students-owner-20260807.geojson");
const bytes = await readFile(input);
if (digest(bytes) !== SOURCE_SHA256) fail("UNIVERSITY_STUDENTS_SOURCE_SHA_MISMATCH");
const source = JSON.parse(bytes.toString("utf8"));
if (source?.type !== "FeatureCollection" || !Array.isArray(source.features) || source.features.length !== 159) fail("UNIVERSITY_STUDENTS_SOURCE_COUNT_MISMATCH");
const features = source.features.map(feature => {
  const p = feature?.properties;
  const c = feature?.geometry?.coordinates;
  if (feature?.type !== "Feature" || feature.geometry?.type !== "Point" || !Array.isArray(c) || c.length !== 2
    || c.some(x => typeof x !== "number" || !Number.isFinite(x)) || c[0] < 118 || c[0] > 123 || c[1] < 21 || c[1] > 27
    || !p || typeof p.code !== "string" || !p.code || typeof p.school_name !== "string" || typeof p.city !== "string"
    || p.academic_year !== 114 || ["students_total", "students_male", "students_female", "n_program_rows"].some(k => p[k] !== null && (typeof p[k] !== "number" || !Number.isFinite(p[k])))) fail("UNIVERSITY_STUDENTS_SOURCE_FEATURE_INVALID");
  return { type: "Feature", geometry: feature.geometry, properties: Object.fromEntries(safeFields.map(k => [k, p[k] ?? null])) };
});
const nullStudents = features.filter(f => f.properties.students_total === null).length;
const studentSum = features.reduce((n, f) => n + (f.properties.students_total ?? 0), 0);
if (nullStudents !== 21 || studentSum !== 1_055_790) fail("UNIVERSITY_STUDENTS_SOURCE_SEMANTICS_MISMATCH");
const serialized = `${JSON.stringify({ type: "FeatureCollection", features })}\n`;
await mkdir(dirname(output), { recursive: true });
await writeFile(output, serialized);
console.log(JSON.stringify({ input, inputSha256: SOURCE_SHA256, inputRows: 159, output, outputSha256: digest(serialized), outputBytes: Buffer.byteLength(serialized), outputRows: 159, nullStudents, studentSum, safeFields }));
