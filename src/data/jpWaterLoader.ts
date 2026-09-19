import { withLoading } from "../lib/loadingRegistry";
import { cachedOnce } from "../lib/loaderCache";
import { JP_WATER_LAYER_CONTRACT, JP_WATER_LAYER_KEYS, JP_WATER_LOCAL_PMTILES_CONTRACT, type JpWaterFormat, type JpWaterGeometryRole, type JpWaterLayerKey, type JpWaterLocalArchive } from "./jpWaterTypes";

const BASE = `${import.meta.env.BASE_URL ?? "/"}world/jp_water/`;
const LOCAL_BASE_DEFAULT = "http://127.0.0.1:3744/";
const LOCAL_BASE_CONFIGURED = import.meta.env.VITE_JP_WATER_LOCAL_BASE_URL || LOCAL_BASE_DEFAULT;
export type JpWaterRuntimeStatus = "idle" | "loading" | "ready" | "error";
export interface JpWaterRuntime { status: JpWaterRuntimeStatus; error?: string; revision: number; checked: Partial<Record<JpWaterLocalArchive, true>>; }
let runtime: JpWaterRuntime = { status: "idle", revision: 0, checked: {} };
const listeners = new Set<() => void>();
function setRuntime(next: JpWaterRuntime) { runtime = next; listeners.forEach((listener) => listener()); }
export function getJpWaterRuntime() { return runtime; }
export function subscribeJpWaterRuntime(listener: () => void) { listeners.add(listener); return () => listeners.delete(listener); }
export function reportJpWaterError(error: unknown) { const detail = error instanceof Error ? error.message : String(error); setRuntime({ ...runtime, status: "error", error: detail }); }

export interface JpWaterReleaseAsset { key: JpWaterLayerKey; format: JpWaterFormat; path: string; bytes: number; sha256: string; year: string; source_url: string; license: string; coverage: string; geometry_role: JpWaterGeometryRole; status: "published" | "HOLD" | "local_only"; source_layer?: string; }
interface JpWaterRelease { contract_version: 1; release: string; assets: JpWaterReleaseAsset[]; }
export interface JpWaterLocalPmtilesAsset { archive: JpWaterLocalArchive; url: string; bytes: number; sha256: string; }
function reject(message: string): never { throw new Error(`日本水資源 release 拒絕：${message}`); }
function isKey(value: string): value is JpWaterLayerKey { return (JP_WATER_LAYER_KEYS as readonly string[]).includes(value); }
function localBase(): string { if (!import.meta.env.DEV) throw new Error("日本水資源本機 PMTiles 僅允許 DEV；production 未配置受限資產，已停止載入"); try { return new URL(LOCAL_BASE_CONFIGURED).href; } catch { throw new Error("VITE_JP_WATER_LOCAL_BASE_URL 不是有效 URL"); } }
function localUrl(archive: JpWaterLocalArchive) { return new URL(JP_WATER_LOCAL_PMTILES_CONTRACT[archive].fileName, localBase()).href; }
function validate(release: unknown): JpWaterRelease {
  if (!release || typeof release !== "object") reject("release.json 不是物件"); const r = release as Partial<JpWaterRelease>;
  if (r.contract_version !== 1 || typeof r.release !== "string" || !r.release || !Array.isArray(r.assets)) reject("contract_version、release 或 assets 缺失"); const seen = new Set<string>();
  for (const asset of r.assets) { if (!asset || !isKey(asset.key) || seen.has(asset.key)) reject("asset key 非法或重複"); seen.add(asset.key); if (asset.status !== "published") reject(`${asset.key} 未發布（${String(asset.status)}）`); if ((asset.format !== "geojson" && asset.format !== "pmtiles") || !asset.path.startsWith(`releases/${r.release}/`)) reject(`${asset.key} path 或 format 不合法`); if (!Number.isSafeInteger(asset.bytes) || asset.bytes <= 0 || !/^[a-f0-9]{64}$/.test(asset.sha256)) reject(`${asset.key} bytes 或 SHA-256 缺失`); if (!asset.year || !asset.source_url || !asset.license || !asset.coverage) reject(`${asset.key} provenance 缺失`); const expected = JP_WATER_LAYER_CONTRACT[asset.key]; if (!expected.publicDistribution) reject(`${asset.key} 原始利用約款未允許公開再散布`); if (asset.geometry_role !== expected.geometryRole) reject(`${asset.key} geometry_role 與契約不符`); if (asset.format === "pmtiles" && !asset.source_layer) reject(`${asset.key} PMTiles 缺 source_layer`); }
  return r as JpWaterRelease;
}
async function fetchRelease(): Promise<JpWaterRelease> { const response = await fetch(`${BASE}release.json`, { cache: "no-cache" }); if (!response.ok) reject(`release.json HTTP ${response.status}`); return validate(await response.json()); }
const cachedRelease = cachedOnce(() => withLoading("jp-water:release", "日本水資源正式 release", fetchRelease()), 5 * 60_000);
const localChecks = new Map<JpWaterLocalArchive, Promise<JpWaterLocalPmtilesAsset>>();
export function retryJpWaterRelease() { cachedRelease.invalidate(); }
export function retryJpWaterLocalAssets() { localChecks.clear(); setRuntime({ status: "idle", revision: runtime.revision + 1, checked: {} }); }
/** Retry both released GeoJSON metadata and DEV-only PMTiles after a visible source error. */
export function retryJpWaterAssets() { retryJpWaterRelease(); retryJpWaterLocalAssets(); }
export async function jpWaterPublishedAsset(key: JpWaterLayerKey): Promise<JpWaterReleaseAsset> { const asset = (await cachedRelease()).assets.find((candidate) => candidate.key === key); if (!asset) reject(`${key} 不在已發布 allowlist`); return asset; }
export async function jpWaterAssetUrl(key: JpWaterLayerKey): Promise<string> { const asset = await jpWaterPublishedAsset(key); const origin = typeof window === "undefined" ? "http://localhost/" : window.location.href; return new URL(`${BASE}${asset.path}`, origin).href; }
/** DEV local asset preflight: require a 127-byte Range response, then verify full bytes and SHA-256. */
export function jpWaterLocalPmtilesAsset(archive: JpWaterLocalArchive): Promise<JpWaterLocalPmtilesAsset> {
  const cached = localChecks.get(archive); if (cached) return cached;
  const pending = withLoading(`jp-water:local:${archive}`, `日本水資源本機 PMTiles：${archive}`, (async () => {
    setRuntime({ ...runtime, status: "loading", error: undefined }); const contract = JP_WATER_LOCAL_PMTILES_CONTRACT[archive]; const url = localUrl(archive); let response: Response;
    try { response = await fetch(url, { headers: { Range: "bytes=0-126" }, cache: "no-store" }); } catch (error) { throw new Error(`本機 PMTiles 無法讀取（可能是 CORS 或網路）：${error instanceof Error ? error.message : String(error)}`); }
    if (response.status !== 206) throw new Error(`本機 PMTiles Range HTTP ${response.status}（需 206 Partial Content）`); const contentRange = response.headers.get("Content-Range"); const matched = contentRange ? /^bytes\s+0-126\/(\d+)$/i.exec(contentRange) : null;
    if (contentRange && !matched) throw new Error("本機 PMTiles Content-Range 格式錯誤（需 bytes 0-126/total）"); if (matched && Number(matched[1]) !== contract.bytes) throw new Error(`本機 PMTiles bytes 不符：預期 ${contract.bytes}，收到 ${matched[1]}`); const bytes = await response.arrayBuffer(); if (bytes.byteLength !== 127) throw new Error(`本機 PMTiles Range bytes 不符：預期 127，收到 ${bytes.byteLength}`);
    const full = await fetch(url, { cache: "no-store" });
    if (!full.ok) throw new Error(`本機 PMTiles SHA 驗證 HTTP ${full.status}`);
    const payload = await full.arrayBuffer();
    if (payload.byteLength !== contract.bytes) throw new Error(`本機 PMTiles 完整 bytes 不符：預期 ${contract.bytes}，收到 ${payload.byteLength}`);
    const digest = [...new Uint8Array(await crypto.subtle.digest("SHA-256", payload))].map((value) => value.toString(16).padStart(2, "0")).join("");
    if (digest !== contract.sha256) throw new Error(`本機 PMTiles SHA-256 不符：${archive}`);
    const checked = { ...runtime.checked, [archive]: true };
    setRuntime({ status: runtime.status === "error" ? "error" : "ready", error: runtime.status === "error" ? runtime.error : undefined, revision: runtime.revision, checked });
    return { archive, url, bytes: contract.bytes, sha256: contract.sha256 };
  })()).catch((error) => { reportJpWaterError(error); throw error; }); localChecks.set(archive, pending); return pending;
}
/** Fetches only an allowlisted GeoJSON and verifies its immutable receipt before rendering. */
export async function fetchJpWaterGeoJsonAsset(key: JpWaterLayerKey): Promise<GeoJSON.FeatureCollection> { const asset = await jpWaterPublishedAsset(key); if (asset.format !== "geojson") reject(`${key} 是 PMTiles，不可整包 fetch`); return withLoading(`jp-water:${key}`, `日本水資源：${key}`, (async () => { const response = await fetch(await jpWaterAssetUrl(key)); if (!response.ok) reject(`${key} HTTP ${response.status}`); const bytes = new Uint8Array(await response.arrayBuffer()); if (bytes.byteLength !== asset.bytes) reject(`${key} bytes 不符`); const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map((v) => v.toString(16).padStart(2, "0")).join(""); if (hash !== asset.sha256) reject(`${key} SHA-256 不符`); const data = JSON.parse(new TextDecoder().decode(bytes)) as GeoJSON.FeatureCollection; if (data.type !== "FeatureCollection" || !Array.isArray(data.features)) reject(`${key} GeoJSON 格式不符`); return data; })()); }
