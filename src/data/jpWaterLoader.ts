import { withLoading } from "../lib/loadingRegistry";
import { cachedOnce } from "../lib/loaderCache";
import { JP_WATER_LAYER_CONTRACT, JP_WATER_LAYER_KEYS, type JpWaterFormat, type JpWaterGeometryRole, type JpWaterLayerKey } from "./jpWaterTypes";

const BASE = `${import.meta.env.BASE_URL ?? "/"}world/jp_water/`;

export interface JpWaterReleaseAsset {
  key: JpWaterLayerKey;
  format: JpWaterFormat;
  path: string;
  bytes: number;
  sha256: string;
  year: string;
  source_url: string;
  license: string;
  coverage: string;
  geometry_role: JpWaterGeometryRole;
  /** Artifact release state only. `published` permits local preview; it is not upload/deploy evidence. */
  status: "published" | "HOLD" | "local_only";
  source_layer?: string;
}
interface JpWaterRelease { contract_version: 1; release: string; assets: JpWaterReleaseAsset[]; }

function reject(message: string): never { throw new Error(`日本水資源 release 拒絕：${message}`); }
function isKey(value: string): value is JpWaterLayerKey { return (JP_WATER_LAYER_KEYS as readonly string[]).includes(value); }

function validate(release: unknown): JpWaterRelease {
  if (!release || typeof release !== "object") reject("release.json 不是物件");
  const r = release as Partial<JpWaterRelease>;
  if (r.contract_version !== 1 || typeof r.release !== "string" || !r.release || !Array.isArray(r.assets)) reject("contract_version、release 或 assets 缺失");
  const seen = new Set<string>();
  for (const asset of r.assets) {
    if (!asset || !isKey(asset.key) || seen.has(asset.key)) reject("asset key 非法或重複");
    seen.add(asset.key);
    if (asset.status !== "published") reject(`${asset.key} 未發布（${String(asset.status)}）`);
    if ((asset.format !== "geojson" && asset.format !== "pmtiles") || !asset.path.startsWith(`releases/${r.release}/`)) reject(`${asset.key} path 或 format 不合法`);
    if (!Number.isSafeInteger(asset.bytes) || asset.bytes <= 0 || !/^[a-f0-9]{64}$/.test(asset.sha256)) reject(`${asset.key} bytes 或 SHA-256 缺失`);
    if (!asset.year || !asset.source_url || !asset.license || !asset.coverage) reject(`${asset.key} provenance 缺失`);
    const expected = JP_WATER_LAYER_CONTRACT[asset.key];
    if (!expected.publicDistribution) reject(`${asset.key} 原始利用約款未允許公開再散布`);
    if (asset.geometry_role !== expected.geometryRole) reject(`${asset.key} geometry_role 與契約不符`);
    if (asset.format === "pmtiles" && !asset.source_layer) reject(`${asset.key} PMTiles 缺 source_layer`);
  }
  return r as JpWaterRelease;
}

async function fetchRelease(): Promise<JpWaterRelease> {
  const response = await fetch(`${BASE}release.json`, { cache: "no-cache" });
  if (!response.ok) reject(`release.json HTTP ${response.status}`);
  return validate(await response.json());
}
const cachedRelease = cachedOnce(() => withLoading("jp-water:release", "日本水資源正式 release", fetchRelease()), 5 * 60_000);

export function retryJpWaterRelease() { cachedRelease.invalidate(); }
export async function jpWaterPublishedAsset(key: JpWaterLayerKey): Promise<JpWaterReleaseAsset> {
  const asset = (await cachedRelease()).assets.find((candidate) => candidate.key === key);
  if (!asset) reject(`${key} 不在已發布 allowlist`);
  return asset;
}
export async function jpWaterAssetUrl(key: JpWaterLayerKey): Promise<string> {
  const asset = await jpWaterPublishedAsset(key);
  const origin = typeof window === "undefined" ? "http://localhost/" : window.location.href;
  return new URL(`${BASE}${asset.path}`, origin).href;
}

/** Fetches only an allowlisted GeoJSON and verifies its immutable receipt before rendering. */
export async function fetchJpWaterGeoJsonAsset(key: JpWaterLayerKey): Promise<GeoJSON.FeatureCollection> {
  const asset = await jpWaterPublishedAsset(key);
  if (asset.format !== "geojson") reject(`${key} 是 PMTiles，不可整包 fetch`);
  return withLoading(`jp-water:${key}`, `日本水資源：${key}`, (async () => {
    const response = await fetch(await jpWaterAssetUrl(key));
    if (!response.ok) reject(`${key} HTTP ${response.status}`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength !== asset.bytes) reject(`${key} bytes 不符`);
    const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map((v) => v.toString(16).padStart(2, "0")).join("");
    if (hash !== asset.sha256) reject(`${key} SHA-256 不符`);
    const data = JSON.parse(new TextDecoder().decode(bytes)) as GeoJSON.FeatureCollection;
    if (data.type !== "FeatureCollection" || !Array.isArray(data.features)) reject(`${key} GeoJSON 格式不符`);
    return data;
  })());
}
