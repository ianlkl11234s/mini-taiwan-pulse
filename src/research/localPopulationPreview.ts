import { withLoading } from "../lib/loadingRegistry";
import { createAdministrativeBoundaryAdapter } from "./administrativeBoundaryAdapter";
import { createPopulationSnapshotAdapter, type PopulationBoundarySnapshot } from "./populationDatasetAdapter";
import type { QueryAdapter } from "./queryExecutor";

type LocalPopulationGroup = "total" | "male" | "female";
type LocalPopulationPreviewProfile = Readonly<{
  group: LocalPopulationGroup;
  datasetId: string;
  indicatorId: string;
  releaseId: string;
  dimensions: Readonly<{ population_scope: LocalPopulationGroup }>;
  label: string;
  populationLabel: string;
  artifact: Readonly<{ sha256: string; bytes: number }>;
}>;

const LOCAL_POPULATION_PREVIEW_PROFILES: Readonly<Record<LocalPopulationGroup, LocalPopulationPreviewProfile>> = {
  total: {
    group: "total", datasetId: "population_statistics", indicatorId: "total_population", releaseId: "2025-12-total_population-county-local-preview",
    dimensions: { population_scope: "total" }, label: "2025-12 行政區人口數（本機 preview）", populationLabel: "行政區人口數",
    artifact: { sha256: "dceed8b079fb7949c63b368b52b062fdf622bcfbadca7265bc41a2bba72973f5", bytes: 4_733 },
  },
  male: {
    group: "male", datasetId: "population_statistics:male", indicatorId: "male_population", releaseId: "2025-12-male_population-county-local-preview",
    dimensions: { population_scope: "male" }, label: "2025-12 男性人口數（本機 preview）", populationLabel: "男性人口數",
    artifact: { sha256: "92cf23066a18a71ec1b80e863ffaee53d6e24186a59a5d77fe7923ed6d86d2db", bytes: 4_758 },
  },
  female: {
    group: "female", datasetId: "population_statistics:female", indicatorId: "female_population", releaseId: "2025-12-female_population-county-local-preview",
    dimensions: { population_scope: "female" }, label: "2025-12 女性人口數（本機 preview）", populationLabel: "女性人口數",
    artifact: { sha256: "8d1ff350007932ac57fa5a70fbec60238ca6b2b70f4459e616d387dd99100165", bytes: 4_770 },
  },
};

const BOUNDARY_SHA256 = "5044636b840fba57230f15b6728030a09f3d6dc801a86c2301052514acc684d6";
const BOUNDARY_VERSION = "COUNTY_MOI_1140318";
const TIMEOUT_MS = 15_000;
const BOUNDARY_URL = "/__local-research-boundaries/county.geojson";

export type LocalPopulationPreviewFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

function abortReason(signal: AbortSignal): Error { return signal.reason instanceof Error ? signal.reason : new DOMException("aborted", "AbortError"); }

async function boundedArtifact(response: Response, artifact: LocalPopulationPreviewProfile["artifact"], signal: AbortSignal): Promise<Uint8Array> {
  const contentLength = response.headers.get("content-length");
  const declared = contentLength === null ? null : Number(contentLength);
  if (declared !== null && (!Number.isFinite(declared) || declared !== artifact.bytes)) throw new Error("POPULATION_PREVIEW_ARTIFACT_BYTES_MISMATCH");
  if (!response.body) throw new Error("POPULATION_PREVIEW_ARTIFACT_BODY_REQUIRED");
  const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let total = 0;
  try {
    while (true) {
      if (signal.aborted) throw abortReason(signal);
      const next = await new Promise<ReadableStreamReadResult<Uint8Array>>((resolve, reject) => {
        const onAbort = () => { void reader.cancel(signal.reason); reject(abortReason(signal)); };
        signal.addEventListener("abort", onAbort, { once: true });
        void reader.read().then(resolve, reject).finally(() => signal.removeEventListener("abort", onAbort));
      });
      if (next.done) break;
      total += next.value.byteLength;
      if (total > artifact.bytes) { await reader.cancel(); throw new Error("POPULATION_PREVIEW_ARTIFACT_TOO_LARGE"); }
      chunks.push(next.value);
    }
  } finally { reader.releaseLock(); }
  if (total !== artifact.bytes) throw new Error("POPULATION_PREVIEW_ARTIFACT_BYTES_MISMATCH");
  const bytes = new Uint8Array(total); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}

async function readArtifact(fetcher: LocalPopulationPreviewFetch, profile: LocalPopulationPreviewProfile, signal?: AbortSignal): Promise<Uint8Array> {
  if (signal?.aborted) throw abortReason(signal);
  const controller = new AbortController(); const forward = () => controller.abort(signal?.reason);
  signal?.addEventListener("abort", forward, { once: true }); const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetcher(`/__local-research-population-preview/${profile.artifact.sha256}.json`, { signal: controller.signal, credentials: "same-origin", redirect: "error" });
    if (response.status === 404 || response.headers.get("content-type")?.includes("text/html")) throw new Error("POPULATION_PREVIEW_ASSET_MISSING");
    if (!response.ok) throw new Error("POPULATION_PREVIEW_ASSET_UNAVAILABLE");
    return await boundedArtifact(response, profile.artifact, controller.signal);
  } catch (error) {
    if (signal?.aborted) throw abortReason(signal);
    if (controller.signal.aborted) throw new Error("REQUEST_TIMEOUT");
    throw error;
  } finally { clearTimeout(timer); signal?.removeEventListener("abort", forward); }
}

function boundaryLoader(fetcher: LocalPopulationPreviewFetch): (signal?: AbortSignal) => Promise<PopulationBoundarySnapshot> {
  const adapter = createAdministrativeBoundaryAdapter({
    datasetId: "tw-county-boundaries-raw-population-preview", sourceUrl: BOUNDARY_URL,
    sourceSha256: BOUNDARY_SHA256, version: BOUNDARY_VERSION,
    publisher: "內政部國土測繪中心；SEGIS existing local snapshot",
    license: "Local source receipt; verify upstream terms before redistribution",
    codeProperty: "行政區域代碼", nameProperty: "名稱", expectedAreas: 22, maxBytes: 16 * 1024 * 1024,
  }, fetcher);
  return async signal => {
    const result = await adapter.read({}, signal);
    const receipt = result.sourceRefs[0];
    if (!receipt) throw new Error("POPULATION_BOUNDARY_RECEIPT_MISSING");
    return {
      receipt, boundaryVersion: BOUNDARY_VERSION, sha256: BOUNDARY_SHA256,
      codeProperty: "行政區域代碼", nameProperty: "名稱",
      features: result.rows.map(row => ({ type: "Feature", properties: { "行政區域代碼": row.area_code, "名稱": row.area_name }, geometry: row.geometry as GeoJSON.MultiPolygon })),
    };
  };
}

/** Fixed, DEV-only local previews. They are not published denominators or per-capita inputs. */
export function createLocalPopulationPreviewAdapter(fetcher: LocalPopulationPreviewFetch = fetch, group: LocalPopulationGroup = "total"): QueryAdapter {
  const profile = LOCAL_POPULATION_PREVIEW_PROFILES[group];
  return createPopulationSnapshotAdapter({
    contract: {
      datasetId: profile.datasetId, indicatorId: profile.indicatorId, releaseId: profile.releaseId,
      level: "county", periodStart: "2025-12-31", periodEnd: "2025-12-31", dimensions: profile.dimensions,
      unit: "人", label: profile.label, expectedAreas: 22, populationLabel: profile.populationLabel,
    },
    receipt: { status: "PASS_LOCAL_PREVIEW_ONLY", notPublished: true, artifact: profile.artifact },
    readArtifact: signal => withLoading(`research:population-preview:${profile.group}`, "載入本機人口 preview", readArtifact(fetcher, profile, signal)),
    loadBoundary: boundaryLoader(fetcher),
  });
}

/** Compiled previews only; callers cannot supply an artifact URL, SHA, or population scope. */
export const localPopulationPreviewAdapters = ["total", "male", "female"].map(group => createLocalPopulationPreviewAdapter(fetch, group as LocalPopulationGroup));
/** Compatibility alias for the existing total-population preview. */
export const localPopulationPreviewAdapter = localPopulationPreviewAdapters[0]!;
