import { cachedOnce } from "../lib/loaderCache";
import { withLoading } from "../lib/loadingRegistry";
const ROOT = `${import.meta.env.BASE_URL ?? "/"}jp-medical/`;
function currentUrl(): string {
    const origin = typeof window !== "undefined" && window.location.href.startsWith("http") ? window.location.href : "http://localhost/";
    return new URL("current.json", new URL(ROOT, origin)).href;
}
export type JpMedicalRuntimeStatus = "idle" | "loading" | "ready" | "error";
export interface JpMedicalAsset {
    sha256: string;
    bytes: number;
}
export interface JpMedicalLayerAsset {
    key: "navii_facilities" | "h17_services" | "a38_1" | "a38_2" | "a38_3";
    pmtiles_path: string;
    source_layer: string;
    aggregate_path?: string;
    minimum_point_zoom?: number;
}
export interface JpMedicalCatalog {
    contract_version: 1;
    version: string;
    files: Record<string, JpMedicalAsset>;
    layers: JpMedicalLayerAsset[];
    status?: string;
    source_dates?: Record<string, string>;
    datasets?: Record<string, {
        source?: string;
        source_date?: string;
        status?: string;
        grain?: string;
        national_totals?: Record<string, unknown>;
    }>;
}
export interface JpMedicalRuntime {
    status: JpMedicalRuntimeStatus;
    releaseStatus?: string;
    catalog?: JpMedicalCatalog;
    error?: string;
    revision?: number;
}
let runtime: JpMedicalRuntime = { status: "idle" };
const listeners = new Set<() => void>();
function setRuntime(next: JpMedicalRuntime) { runtime = { ...next, revision: next.revision ?? runtime.revision ?? 0 }; listeners.forEach((listener) => listener()); }
export function getJpMedicalRuntime(): JpMedicalRuntime { return runtime; }
export function subscribeJpMedicalRuntime(listener: () => void) { listeners.add(listener); return () => listeners.delete(listener); }
function absolute(path: string, base: string): string {
    const segments = path.split("/");
    if (!path || path.startsWith("/") || path.includes("..") || path.includes("\\") || path.includes("%") || path.includes(":") || segments.some((segment) => ["_private", "raw", "private_rows", "representative"].includes(segment)))
        throw new Error("醫療資產路徑不在 release allowlist");
    return new URL(path, base).href;
}
function isCatalog(value: unknown): value is JpMedicalCatalog {
    const c = value as Partial<JpMedicalCatalog>;
    return c?.contract_version === 1 && typeof c.version === "string" && !!c.files && Array.isArray(c.layers)
        && c.layers.every((layer) => typeof (layer as JpMedicalLayerAsset).key === "string" && typeof (layer as JpMedicalLayerAsset).pmtiles_path === "string");
}
async function json(url: string): Promise<unknown> {
    const response = await fetch(url, { cache: url.endsWith("current.json") ? "no-cache" : "default" });
    if (!response.ok)
        throw new Error(`HTTP ${response.status}`);
    try {
        return await response.json();
    } catch {
        throw new Error("資料目錄不是有效 JSON；請稍後重試");
    }
}
async function loadCatalogUncached(): Promise<JpMedicalCatalog> {
    setRuntime({ status: "loading" });
    try {
        const pointerUrl = currentUrl();
        const current = await json(pointerUrl) as {
            catalog?: unknown;
            version?: unknown;
            status?: unknown;
        };
        if (typeof current.catalog !== "string")
            throw new Error("current.json 缺少 catalog");
        const catalogUrl = absolute(current.catalog, pointerUrl);
        const catalog = await json(catalogUrl);
        if (!isCatalog(catalog))
            throw new Error("catalog schema 不相容");
        if (current.version !== catalog.version || current.catalog !== `releases/${catalog.version}/catalog.json`)
            throw new Error("current / catalog 版本不一致");
        setRuntime({ status: "ready", releaseStatus: typeof current.status === "string" ? current.status : catalog.status, catalog });
        return catalog;
    }
    catch (cause) {
        const error = cause instanceof Error ? cause.message : String(cause);
        setRuntime({ status: "error", error });
        throw cause;
    }
}
const loadCatalogCached = cachedOnce(() => withLoading("jp-medical:catalog", "日本醫療資料目錄載入中", loadCatalogUncached()), 30 * 60000);
export function loadJpMedicalCatalog() { return loadCatalogCached(); }
/** 清除失敗／過期目錄，下一次由使用者操作或 hook 重新讀取 current pointer。 */
export function retryJpMedicalCatalog() { loadCatalogCached.invalidate(); setRuntime({ status: "idle", revision: (runtime.revision ?? 0) + 1 }); }
export function reportJpMedicalError(cause: unknown) {
    setRuntime({ ...runtime, status: "error", error: cause instanceof Error ? cause.message : String(cause) });
}
export async function jpMedicalAssetUrl(path: string): Promise<string> {
    const catalog = await loadJpMedicalCatalog();
    const entry = catalog.files[path];
    if (!entry || !/^[a-f0-9]{64}$/i.test(entry.sha256) || !Number.isInteger(entry.bytes) || entry.bytes < 0)
        throw new Error(`資產未在 catalog allowlist：${path}`);
    return absolute(path, new URL(`releases/${catalog.version}/`, currentUrl()).href);
}
async function sha256(buffer: ArrayBuffer): Promise<string> {
    const digest = await crypto.subtle.digest("SHA-256", buffer);
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
/** 小型 JSON 在 parse 前驗 bytes/SHA。PMTiles 走 Range；完整 SHA 在發布驗收，不在 browser 全檔讀取。 */
export async function fetchJpMedicalJsonAsset(path: string): Promise<unknown> {
    try {
        const catalog = await loadJpMedicalCatalog();
        const entry = catalog.files[path];
        if (!entry)
            throw new Error(`資產未在 catalog allowlist：${path}`);
        const response = await fetch(await jpMedicalAssetUrl(path));
        if (!response.ok)
            throw new Error(`HTTP ${response.status}`);
        const buffer = await response.arrayBuffer();
        if (buffer.byteLength !== entry.bytes)
            throw new Error(`資產 bytes 不符：${path}`);
        if (await sha256(buffer) !== entry.sha256)
            throw new Error(`資產 SHA-256 不符：${path}`);
        return JSON.parse(new TextDecoder().decode(buffer));
    }
    catch (cause) {
        const error = cause instanceof Error ? cause.message : String(cause);
        setRuntime({ ...runtime, status: "error", error });
        throw cause;
    }
}
export async function jpMedicalLayerAsset(key: JpMedicalLayerAsset["key"]): Promise<{
    url: string;
    asset: JpMedicalLayerAsset;
}> {
    const catalog = await loadJpMedicalCatalog();
    const asset = catalog.layers.find((item) => item.key === key);
    if (!asset)
        throw new Error(`catalog 缺少圖層：${key}`);
    return { asset, url: await jpMedicalAssetUrl(asset.pmtiles_path) };
}
/** 詳情是按需 bucket fetch；沒有 detail reference 的類別不應呼叫。 */
export async function loadJpMedicalHours(recordKind: string, sourceId: string, bucket: string): Promise<Record<string, unknown>[]> {
    if (!/^(hospital|clinic|dental)$/.test(recordKind) || !/^[a-f0-9]{2}$/i.test(bucket) || !sourceId)
        return [];
    const expectedBucket = (await sha256(new TextEncoder().encode(sourceId).buffer)).slice(0, 2);
    if (bucket.toLowerCase() !== expectedBucket)
        throw new Error("時段 bucket 與來源 ID 不一致");
    const rows = await withLoading("jp-medical:hours", "日本醫療時段載入中", fetchJpMedicalJsonAsset(`details/${recordKind}_hours/${bucket}.json`));
    const envelope = rows as {
        bucket?: unknown;
        record_kind?: unknown;
        rows?: unknown;
    };
    if (!envelope || envelope.bucket !== expectedBucket || envelope.record_kind !== `${recordKind}_hours` || !Array.isArray(envelope.rows))
        throw new Error("時段資料格式不正確");
    return envelope.rows.filter((row): row is Record<string, unknown> => !!row && typeof row === "object" && String((row as Record<string, unknown>).ID) === sourceId);
}
