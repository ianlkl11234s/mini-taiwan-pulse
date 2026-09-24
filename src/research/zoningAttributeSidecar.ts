import { withLoading } from "../lib/loadingRegistry";
import { boundedAccess, DEFAULT_VALUE_SEMANTICS, type DatasetDescriptor } from "./dataContracts";
import type { AdapterReadResult, QueryAdapter } from "./queryExecutor";

const URL = "/urban/urban_zoning_taipei.analysis.json";
const SIDECAR_SHA = "497bc0abf3fcf81457c867a6439c8131204a3ec5de37c02b35d0ecff94d0b646";
const SOURCE_SHA = "5d7eb9ae65f6ac83bc77236b9551383156664bf7f85bdb53acd5b0529fd42e12";
const PMTILES_SHA = "319a15cf95d07a2e68bf43f627d209fd173e7a4cb22c98dbd91c61d31e389eae";
const ROWS = 15_518;
const MAX_BYTES = 3 * 1024 * 1024;
type Row = Readonly<{ feature_id: string; city: string; plan_level: string; zone_code: string; zone_category: string }>;
let cached: { rows: readonly Row[]; acquiredAt: string; bytes: number } | null = null;

export const taipeiZoningAttributeDescriptor: DatasetDescriptor = {
  schemaVersion: "pulse-dataset/0.1", datasetId: "urban_zoning_taipei", label: "臺北市土地使用分區來源屬性",
  description: "同版完整 GeoJSON 衍生的 15,518 筆細部計畫面屬性；可查分區與計數。sidecar 不含幾何，不能做面積、相交、環域或法律判定。",
  layerRefs: ["urbanZoningTaipei"], kind: "polygon", recordGrain: "feature", primaryKey: ["feature_id"],
  fields: [
    { name: "feature_id", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "city", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "plan_level", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "zone_code", type: "string", nullable: false, nullMeaning: null, unit: null },
    { name: "zone_category", type: "string", nullable: false, nullMeaning: null, unit: null },
  ],
  geometry: { type: "none", crs: null, role: "none", precision: "完整來源為 WGS84 MultiPolygon；此屬性 sidecar 完全不含幾何。PMTiles 只供顯示。", spatialAnalysisEligible: false },
  timeFields: [],
  coverage: "臺北市 2026-04-01 細部計畫來源的 15,518 筆 feature；主計畫未混入。每筆保留唯一 feature_id；zone_category 是前端輔助分類，不是法定分區。",
  license: "政府資料開放授權條款第 1 版（OGDL-Taiwan-1.0）",
  valueSemantics: { ...DEFAULT_VALUE_SEMANTICS, missing: "未出現在這份細部計畫快照不代表沒有都市計畫或土地使用管制。", null: "此 sidecar 必填欄位不得為 null；來源 zone_raw 的字面 nan 未納入此 sidecar，不得當成觀測值。" },
  versions: [{ versionId: `sha256:${SIDECAR_SHA}`, observedAt: "2026-04-01", availableAt: null, checksumSha256: SIDECAR_SHA, mutable: false }],
  source: { publisher: "臺北市政府都市發展局；data.gov.tw/dataset/156197", reference: URL,
    lineage: `官方細部計畫 SHP -> 已驗 GeoJSON sha256:${SOURCE_SHA} -> 去除幾何的完整屬性 sidecar sha256:${SIDECAR_SHA}; 同處理批次的展示 PMTiles sha256:${PMTILES_SHA}。來源幾何與展示 tile 不授權此 adapter 進行空間分析。` },
  access: boundedAccess({ mode: "public", method: "pmtiles_sidecar", fields: ["feature_id", "city", "plan_level", "zone_code", "zone_category"], filters: ["feature_id", "city", "plan_level", "zone_code", "zone_category"], maxRowsPerQuery: 100, maxScanRows: ROWS, maxSourceBytes: MAX_BYTES }),
  supportedOperations: ["query_records", "aggregate"], adapterId: "zoning-attribute-sidecar-v1",
};

async function readBounded(response: Response): Promise<Uint8Array> {
  if (Number(response.headers.get("content-length")) > MAX_BYTES) throw new Error("ZONING_SIDECAR_TOO_LARGE");
  const chunks: Uint8Array[] = []; let size = 0;
  if (!response.body) {
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > MAX_BYTES) throw new Error("ZONING_SIDECAR_TOO_LARGE");
    return bytes;
  }
  const reader = response.body.getReader();
  try {
    while (true) {
      const part = await reader.read(); if (part.done) break;
      size += part.value.byteLength;
      if (size > MAX_BYTES) { await reader.cancel(); throw new Error("ZONING_SIDECAR_TOO_LARGE"); }
      chunks.push(part.value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}

function validate(value: unknown): readonly Row[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("ZONING_SIDECAR_INVALID");
  const source = value as Record<string, unknown>;
  if (source.schemaVersion !== "pulse-zoning-attributes/1" || source.datasetId !== "urban_zoning_taipei"
    || source.featureCount !== ROWS || source.dataDate !== "2026-04-01" || source.geometryIncluded !== false
    || source.sourceGeojsonSha256 !== SOURCE_SHA || source.displayPmtilesSha256 !== PMTILES_SHA
    || !Array.isArray(source.rows) || source.rows.length !== ROWS) throw new Error("ZONING_SIDECAR_INVALID");
  const ids = new Set<string>();
  for (const candidate of source.rows) {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) throw new Error("ZONING_SIDECAR_INVALID");
    const row = candidate as Record<string, unknown>;
    if (Object.keys(row).length !== 5 || ["feature_id", "city", "plan_level", "zone_code", "zone_category"].some(key => typeof row[key] !== "string" || !(row[key] as string) || (row[key] as string).length > 4000)
      || typeof row.feature_id !== "string" || ids.has(row.feature_id) || row.city !== "臺北市" || row.plan_level !== "detail") throw new Error("ZONING_SIDECAR_INVALID");
    ids.add(row.feature_id);
  }
  return source.rows as Row[];
}

export function clearTaipeiZoningSidecarCache(): void { cached = null; }

export const taipeiZoningAttributeAdapter: QueryAdapter = {
  descriptor: taipeiZoningAttributeDescriptor, allowedParameters: {},
  async read(_parameters, signal): Promise<AdapterReadResult> {
    if (signal?.aborted) throw signal.reason ?? new Error("ABORTED");
    const cacheHit = cached !== null;
    if (!cached) cached = await withLoading("research:urban-zoning-taipei", "載入臺北市土地使用分區屬性", (async () => {
      const controller = new AbortController(); const forward = () => controller.abort(signal?.reason);
      signal?.addEventListener("abort", forward, { once: true });
      const timeout = setTimeout(() => controller.abort(), 15_000);
      try {
        const response = await fetch(URL, { credentials: "same-origin", redirect: "error", signal: controller.signal });
        if (!response.ok || response.headers.get("content-type")?.includes("text/html")) throw new Error("ZONING_SIDECAR_UNAVAILABLE");
        const bytes = await readBounded(response);
        const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map(byte => byte.toString(16).padStart(2, "0")).join("");
        if (hash !== SIDECAR_SHA) throw new Error("ZONING_SIDECAR_SHA_MISMATCH");
        return { rows: validate(JSON.parse(new TextDecoder().decode(bytes))), acquiredAt: new Date().toISOString(), bytes: bytes.byteLength };
      } catch (error) {
        if (controller.signal.aborted && !signal?.aborted) throw new Error("ZONING_SIDECAR_TIMEOUT");
        throw error;
      } finally { clearTimeout(timeout); signal?.removeEventListener("abort", forward); }
    })());
    if (signal?.aborted) throw signal.reason ?? new Error("ABORTED");
    return { rows: cached.rows, sourceRefs: [{ sourceId: "urban_zoning_taipei:attribute-sidecar", version: `sha256:${SIDECAR_SHA}`, acquiredAt: cached.acquiredAt, checksumSha256: SIDECAR_SHA, reference: URL }],
      coverage: taipeiZoningAttributeDescriptor.coverage, freshness: "unknown", exclusions: {}, rowsScanned: ROWS, bytesScanned: cached.bytes,
      downloadedBytes: cacheHit ? 0 : cached.bytes, requests: cacheHit ? 0 : 1, cacheHit, expiresAt: null };
  },
};
