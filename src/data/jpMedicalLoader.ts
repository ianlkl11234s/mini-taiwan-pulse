import { cachedByKey, cachedOnce } from "../lib/loaderCache";
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
    point_sampling?: "none";
    z0_feature_count?: number;
    geometry_provenance?: string;
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
    displayMode?: JpMedicalDisplayMode;
}
export type JpMedicalDisplayMode = "adaptive" | "points";
export interface JpMedicalAggregate extends GeoJSON.FeatureCollection<GeoJSON.Polygon | GeoJSON.MultiPolygon> {}
let runtime: JpMedicalRuntime = { status: "idle", displayMode: "adaptive" };
const listeners = new Set<() => void>();
function setRuntime(next: JpMedicalRuntime) { runtime = { ...next, displayMode: next.displayMode ?? runtime.displayMode ?? "adaptive", revision: next.revision ?? runtime.revision ?? 0 }; listeners.forEach((listener) => listener()); }
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
const loadCatalogCached = cachedOnce(() => withLoading("jp-medical:catalog", "醫療資料目錄 医療データ一覧載入中", loadCatalogUncached()), 30 * 60000);
export function loadJpMedicalCatalog() { return loadCatalogCached(); }
/** 清除失敗／過期目錄，下一次由使用者操作或 hook 重新讀取 current pointer。 */
export function retryJpMedicalCatalog() { loadCatalogCached.invalidate(); aggregateCache.invalidate(); setRuntime({ status: "idle", revision: (runtime.revision ?? 0) + 1 }); }
/** 互動狀態沿既有醫療 runtime 保存；不新增全域 UI framework。 */
export function setJpMedicalDisplayMode(displayMode: JpMedicalDisplayMode) {
    if (runtime.displayMode === displayMode) return;
    setRuntime({ ...runtime, displayMode, revision: (runtime.revision ?? 0) + 1 });
}
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
function isCount(value: unknown): value is number { return Number.isInteger(value) && Number(value) >= 0; }
function aggregateCount(props: Record<string, unknown>, key: string) {
    if (!isCount(props[key])) throw new Error(`聚合格網缺少有效 ${key}`);
    return props[key];
}
function validateAggregate(value: unknown, key: "navii_facilities" | "h17_services", catalog: JpMedicalCatalog): JpMedicalAggregate {
    const fc = value as Partial<JpMedicalAggregate>;
    if (fc?.type !== "FeatureCollection" || !Array.isArray(fc.features) || fc.features.length === 0)
        throw new Error("聚合格網 schema 不相容或為空");
    const mappedByKind = new Map<string, number>();
    for (const feature of fc.features) {
        const props = feature?.properties as Record<string, unknown> | null;
        if (feature?.type !== "Feature" || !props || typeof props.grid_id !== "string" || props.grid_zoom !== 6
            || !feature.geometry || !["Polygon", "MultiPolygon"].includes(feature.geometry.type))
            throw new Error("聚合格網 schema 不相容");
        const kind = typeof props.record_kind === "string" ? props.record_kind : "";
        if (key === "navii_facilities") {
            if (!kind) throw new Error("Navii 聚合格網缺少 record_kind");
            const mapped = aggregateCount(props, "mapped_point_count");
            aggregateCount(props, "source_record_count");
            aggregateCount(props, "excluded_no_coordinate_count");
            mappedByKind.set(kind, (mappedByKind.get(kind) ?? 0) + mapped);
        } else {
            if (typeof props.service_type !== "string" || !props.service_type) throw new Error("H17 聚合格網缺少 service_type");
            const mapped = aggregateCount(props, "mapped_service_registration_count");
            aggregateCount(props, "duplicate_quarantine_count");
            mappedByKind.set("h17", (mappedByKind.get("h17") ?? 0) + mapped);
        }
    }
    const totals = catalog.datasets?.[key === "navii_facilities" ? "navii" : "h17"]?.national_totals;
    if (key === "navii_facilities") {
        for (const [kind, total] of Object.entries(totals ?? {})) {
            const expected = (total as Record<string, unknown>).mapped_point_count;
            if (!isCount(expected) || expected !== (mappedByKind.get(kind) ?? 0))
                throw new Error(`Navii 聚合格網 ${kind} mapped count 不一致`);
        }
    } else {
        const expected = totals?.mapped_service_registration_count;
        if (!isCount(expected) || expected !== mappedByKind.get("h17")) throw new Error("H17 聚合格網 mapped count 不一致");
    }
    return fc as JpMedicalAggregate;
}
const aggregateCache = cachedByKey<JpMedicalAggregate>(async (key) => {
    const catalog = await loadJpMedicalCatalog();
    const layer = catalog.layers.find((item) => item.key === key);
    if (!layer?.aggregate_path) throw new Error(`catalog 缺少 ${key} 聚合格網`);
    const data = await fetchJpMedicalJsonAsset(layer.aggregate_path);
    return validateAggregate(data, key as "navii_facilities" | "h17_services", catalog);
}, 30 * 60000, 2);
/** z6 格網僅在 adaptive 低縮放讀取；bytes/SHA 由 JSON loader 驗證，快取至多兩族。 */
export function fetchJpMedicalAggregate(key: "navii_facilities" | "h17_services") { return aggregateCache(key); }
export async function jpMedicalLayerAsset(key: JpMedicalLayerAsset["key"]): Promise<{
    url: string;
    asset: JpMedicalLayerAsset;
}> {
    const catalog = await loadJpMedicalCatalog();
    const asset = catalog.layers.find((item) => item.key === key);
    if (!asset)
        throw new Error(`catalog 缺少圖層：${key}`);
    if ((key === "navii_facilities" || key === "h17_services") && asset.minimum_point_zoom === 0
        && (asset.point_sampling !== "none" || !Number.isInteger(asset.z0_feature_count) || Number(asset.z0_feature_count) <= 0))
        throw new Error(`catalog 的 ${key} 缺少全縮放守恆證據`);
    return { asset, url: await jpMedicalAssetUrl(asset.pmtiles_path) };
}
