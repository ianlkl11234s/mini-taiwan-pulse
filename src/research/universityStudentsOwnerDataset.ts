import { boundedAccess, DEFAULT_VALUE_SEMANTICS, type DatasetDescriptor, type DatasetField, type Scalar, type SourceReceipt } from "./dataContracts";
import { loadPointDataset } from "./pointDatasetAdapter";
import { createReferencePointDatasetAdapter, type AdapterSnapshot } from "./queryAdapters";

const SOURCE_URL = "/__local-research-owner-only/university-students/university-students-owner-20260807.geojson";
const SOURCE_SHA256 = "a3f5d6e49294aa2ae01da43aad7dde3200c41eeb5dda05a6c228c9ed1bc57e1f";
const fields: readonly DatasetField[] = [
  { name: "record_id", type: "string", nullable: false, nullMeaning: null, unit: null },
  ...(["code", "school_name", "school_level", "city", "district", "system_type"] as const).map(name => ({ name, type: "string" as const, nullable: name === "system_type", nullMeaning: name === "system_type" ? "來源未提供學校體制；不代表不屬於任何體制。" : null, unit: null })),
  { name: "academic_year", type: "number", nullable: false, nullMeaning: null, unit: "ROC academic year" },
  ...(["students_total", "students_male", "students_female"] as const).map(name => ({ name, type: "number" as const, nullable: true, nullMeaning: "21 校在 114 學年度校別統計沒有對應值；不是零學生。", unit: "students" })),
  { name: "n_program_rows", type: "number", nullable: true, nullMeaning: "沒有對應的統計原始列；不是零筆已統計學程。", unit: "source rows" },
  { name: "geometry", type: "json", nullable: false, nullMeaning: null, unit: null },
];

export const universityStudentsOwnerDescriptor: DatasetDescriptor = {
  schemaVersion: "pulse-dataset/0.1", datasetId: "tw-university-students-owner-114", label: "大專校別學生數（owner-only 114 學年度）",
  description: "114 學年度大專校別統計連到 113 學年度學校名錄的 159 個 Point；其中 21 校沒有學生數，保留 null。來源年份不同且學校點位權利待核，只供本機 owner-only bbox、校別屬性與已知值加總參考。",
  layerRefs: ["eduUniversityStudents"], kind: "point", recordGrain: "place", primaryKey: ["record_id"], fields,
  geometry: { type: "Point", crs: "EPSG:4326", role: "proxy", precision: "座標來自 113 學年度學校名錄，統計是 114 學年度；學校座標的公開再散布授權未核對。可作本機 bbox 及屬性參考，不保證校門入口、最近學校、學區、服務範圍或精確距離。", spatialAnalysisEligible: false },
  timeFields: [], coverage: "139 個 114 學年度統計校別，學生總數 1,056,844；其中 1 校在 113 學年度學校名錄沒有對應點位，故有座標的學生總數是 1,055,790。展示／查詢檔共 159 Point，21 校學生數為 null。不得把 159 當成 159 所都有統計，也不得把未對點的 1,054 人歸零。",
  license: "教育部統計處 data.gov.tw 6231：OGDL-Taiwan-1.0；113 學年度學校名錄座標的公開再散布授權另待核，COORDINATE_RIGHTS_HOLD，限 owner-only。",
  valueSemantics: { ...DEFAULT_VALUE_SEMANTICS, null: "21 校無對應的 114 學年度校別統計，學生數 null 不是零。", missing: "1 個有統計的學校沒有連到 113 學年度學校名錄，因此空間查詢不含其 1,054 人；bbox 無結果不證明沒有大專學生。", stale: "114 學年度學生數與 113 學年度點位是固定歷史快照，不代表目前在學人數或學校狀態。" },
  versions: [{ versionId: `sha256:${SOURCE_SHA256}`, observedAt: null, availableAt: "2026-08-07T00:00:00+08:00", checksumSha256: SOURCE_SHA256, mutable: false }],
  source: { publisher: "教育部統計處／113 學年度學校名錄", reference: SOURCE_URL, lineage: `data.gov.tw/dataset/6231 student.csv 114 學年度（737 原始列、139 校、1,056,844 人） join 113 學年度 schools -> analytics processed university_students_20260807.geojson SHA-256 1e32c1b7bec888108b40697a1b07f88da00cd45ee42d00b2761f91989e9e4b64（與 Mini asset byte-identical，159 Point、21 null、1,055,790 人）-> safe-field owner-only sidecar SHA-256 ${SOURCE_SHA256}。地址已移除；原始統計有一校 1,054 人無對應點。` },
  access: boundedAccess({ mode: "owner_only", method: "local_asset", fields: fields.map(f => f.name), filters: fields.filter(f => !["record_id", "geometry"].includes(f.name)).map(f => f.name), supportsBbox: true, maxRowsPerQuery: 100, maxScanRows: 159, maxSourceBytes: 128 * 1024 }),
  supportedOperations: ["query_records", "aggregate"], adapterId: "university-students-owner-reference-v1",
};

async function read(_parameters: Readonly<Record<string, Scalar>>, signal?: AbortSignal): Promise<AdapterSnapshot> {
  const snapshot = await loadPointDataset({ datasetId: universityStudentsOwnerDescriptor.datasetId, url: SOURCE_URL, idField: "code", safeFields: fields.map(f => f.name).filter(name => !["record_id", "geometry"].includes(name)) }, { signal });
  if (snapshot.checksumSha256 !== SOURCE_SHA256 || snapshot.rows.length !== 159 || Object.values(snapshot.exclusions).some(Boolean)) throw new Error("UNIVERSITY_STUDENTS_OWNER_SOURCE_MISMATCH");
  const nullCount = snapshot.rows.filter(row => row.students_total === null).length;
  const sum = snapshot.rows.reduce((n, row) => n + (typeof row.students_total === "number" ? row.students_total : 0), 0);
  if (nullCount !== 21 || sum !== 1_055_790) throw new Error("UNIVERSITY_STUDENTS_OWNER_SEMANTICS_MISMATCH");
  const source: SourceReceipt = { sourceId: universityStudentsOwnerDescriptor.datasetId, version: `sha256:${SOURCE_SHA256}`, acquiredAt: snapshot.acquiredAt, checksumSha256: SOURCE_SHA256, reference: SOURCE_URL };
  return { rows: snapshot.rows, source, coverage: universityStudentsOwnerDescriptor.coverage, freshness: "stale", exclusions: { no_school_point_upstream: 1, no_student_statistic: 21, ...snapshot.exclusions }, rowsScanned: snapshot.rows.length, bytesScanned: snapshot.bytes, downloadedBytes: snapshot.downloadedBytes, requests: snapshot.requests, cacheHit: snapshot.cacheHit };
}

export const universityStudentsOwnerAdapter = createReferencePointDatasetAdapter(universityStudentsOwnerDescriptor, read);
