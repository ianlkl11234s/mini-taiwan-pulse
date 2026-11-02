/**
 * 公開模擬資料家族（G28 P5）讀取端：current.json → bundle.json → 各檔。
 *
 * - 位置：`https://data.itsmigu.com/sim/v1/<slug>/`；開發時可用 `VITE_SIM_BUNDLE_BASE` 覆寫（只在 DEV 生效）。
 * - 驗證：bundle.json 對 current.json 的 `bundle_sha256`；其他檔對 bundle.json `files[]` 或大量清單檔（`files_od`）記的
 *   sha256 與 bytes。bundle 有宣告清單時，不在清單內的檔一律拒收（`not_listed`）；舊版 bundle 沒清單才不驗。
 * - 路徑：一律相對版本根目錄，拒絕絕對路徑、`..`、換 origin（同 `layerAssetUrl`）。
 * - 載入狀態：每次抓取都掛 loadingRegistry；錯誤寫進 `simBundleStatus`（圖例顯示白話訊息），不靜默。
 */
import { withLoading } from "../lib/loadingRegistry";
import { sha256Hex } from "./layerAssetIndex";
import {
  DEFAULT_SIM_BUNDLE_ROOT, SIM_BUNDLE_SCHEMA, SimBundleError,
  type LoadedSimBundle, type SimBundleErrorCode, type SimBundleFileEntry, type SimBundleManifest, type SimBundlePointer, type SimBundleStatus,
} from "./simBundleTypes";

export const SIM_BUNDLE_FETCH_TIMEOUT_MS = 20_000;
const SHA256_RE = /^[0-9a-f]{64}$/;
const SLUG_RE = /^[a-z0-9][a-z0-9_-]*$/;
const VERSION_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

/** 模擬資料根目錄（結尾 `/`）。正式站固定預設值；`VITE_SIM_BUNDLE_BASE` 只在開發模式生效。 */
export function simBundleRoot(env: { DEV?: boolean; VITE_SIM_BUNDLE_BASE?: string } = import.meta.env): string {
  const configured = env.DEV ? env.VITE_SIM_BUNDLE_BASE?.trim() : "";
  const root = configured || DEFAULT_SIM_BUNDLE_ROOT;
  return root.endsWith("/") ? root : `${root}/`;
}

/** `<base>` + 相對路徑；拒絕離開 base 的路徑（絕對路徑、`..`、反斜線、換 origin、帶帳密）。 */
export function simBundleFileUrl(base: string, path: string): string {
  if (!path || path.startsWith("/") || path.includes("\\") || path.split("/").some((part) => part === ".." || part === ".")) {
    throw new SimBundleError("path", `模擬資料路徑不合法：${path}`);
  }
  const root = new URL(base);
  const resolved = new URL(path, root);
  if (resolved.origin !== root.origin || !resolved.pathname.startsWith(root.pathname) || resolved.username || resolved.password) {
    throw new SimBundleError("path", `模擬資料路徑不可離開版本根目錄：${path}`);
  }
  return resolved.href;
}

async function fetchBytes(url: string, noCache: boolean): Promise<ArrayBuffer> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SIM_BUNDLE_FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, { ...(noCache ? { cache: "no-cache" as const } : {}), signal: controller.signal });
    if (response.status === 404) throw new SimBundleError("not_found", `模擬資料不存在（404）：${url}`);
    if (!response.ok) throw new SimBundleError("http", `模擬資料回應 ${response.status}：${url}`);
    return await response.arrayBuffer();
  } catch (error) {
    if (error instanceof SimBundleError) throw error;
    if (controller.signal.aborted) throw new SimBundleError("timeout", `模擬資料載入逾時：${url}`);
    throw new SimBundleError("network", `模擬資料連線失敗：${url}`);
  } finally {
    clearTimeout(timeout);
  }
}

function parseJson<T>(bytes: ArrayBuffer, what: string): T {
  try { return JSON.parse(new TextDecoder().decode(bytes)) as T; }
  catch { throw new SimBundleError("schema", `${what} 不是合法 JSON`); }
}

async function verify(bytes: ArrayBuffer, expected: { sha256?: string; bytes?: number }, what: string): Promise<void> {
  if (Number.isInteger(expected.bytes) && (expected.bytes as number) > 0 && bytes.byteLength !== expected.bytes) {
    throw new SimBundleError("size_mismatch", `${what} 大小不符`);
  }
  if (expected.sha256 && await sha256Hex(bytes) !== expected.sha256) throw new SimBundleError("sha_mismatch", `${what} SHA-256 不符`);
}

/** 抓指標 → 抓 bundle.json → 驗 sha 與 schema。不經快取，給 loader 與測試用。 */
export async function fetchSimBundle(slug: string, root: string = simBundleRoot()): Promise<LoadedSimBundle> {
  if (!SLUG_RE.test(slug)) throw new SimBundleError("path", `模擬資料 slug 不合法：${slug}`);
  const slugBase = simBundleFileUrl(root, `${slug}/`);
  const pointer = parseJson<SimBundlePointer>(await fetchBytes(simBundleFileUrl(slugBase, "current.json"), true), "current.json");
  const version = pointer?.bundle_version;
  if (typeof version !== "string" || !VERSION_RE.test(version)) throw new SimBundleError("schema", "current.json 的 bundle_version 不合法");
  if (pointer.bundle_sha256 !== undefined && (typeof pointer.bundle_sha256 !== "string" || !SHA256_RE.test(pointer.bundle_sha256))) {
    throw new SimBundleError("schema", "current.json 的 bundle_sha256 不合法");
  }
  const base = simBundleFileUrl(slugBase, `${version}/`);
  const bytes = await fetchBytes(simBundleFileUrl(base, "bundle.json"), false);
  await verify(bytes, { sha256: pointer.bundle_sha256 }, "bundle.json");
  const manifest = parseJson<SimBundleManifest>(bytes, "bundle.json");
  if (manifest?.schema !== SIM_BUNDLE_SCHEMA) throw new SimBundleError("schema", "bundle.json schema 不符");
  if (manifest.slug !== slug || manifest.bundle_version !== version) throw new SimBundleError("schema", "bundle.json 的 slug／版本與指標不符");
  for (const file of manifest.files ?? []) simBundleFileUrl(base, file.name); // 越界路徑整份拒收
  if (manifest.files_od) simBundleFileUrl(base, manifest.files_od.file);
  return { slug, version, base, manifest };
}

// ══════════════════════════════════════════════════════════════════
//  狀態（圖例顯示錯誤用）
// ══════════════════════════════════════════════════════════════════

const statuses = new Map<string, SimBundleStatus>();
const listeners = new Set<() => void>();
const IDLE: SimBundleStatus = { status: "idle" };

export function simBundleStatus(slug: string): SimBundleStatus {
  return statuses.get(slug) ?? IDLE;
}

export function subscribeSimBundleStatus(cb: () => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

function setStatus(slug: string, next: SimBundleStatus) {
  statuses.set(slug, next);
  for (const l of listeners) l();
}

export function simBundleErrorCode(error: unknown): SimBundleErrorCode {
  return error instanceof SimBundleError ? error.code : "network";
}

/** 抓取失敗：記錄狀態讓 UI 顯示（`what` 是給 console 的描述） */
export function reportSimBundleError(slug: string, what: string, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  setStatus(slug, { status: "error", code: simBundleErrorCode(error), message });
  console.warn(`[sim-bundle:${slug}] ${what} load failed`, error);
}

// ══════════════════════════════════════════════════════════════════
//  快取的讀取 API
// ══════════════════════════════════════════════════════════════════

const bundles = new Map<string, Promise<LoadedSimBundle>>();
const fileCache = new Map<string, Promise<ArrayBuffer>>();
const fileIndexes = new Map<string, Promise<Map<string, SimBundleFileEntry>>>();
/** 檔案快取上限（od 檔 112 KB × 48 ≈ 5 MB） */
export const SIM_FILE_CACHE_LIMIT = 48;

/** 載入（快取）某 slug 目前版本的 bundle；失敗會清快取讓下次重試。 */
export function loadSimBundle(slug: string, label: string): Promise<LoadedSimBundle> {
  let pending = bundles.get(slug);
  if (!pending) {
    if (simBundleStatus(slug).status !== "ready") setStatus(slug, { status: "loading" });
    pending = withLoading(`sim-bundle-${slug}`, label, fetchSimBundle(slug)).then(
      (bundle) => { setStatus(slug, { status: "ready", version: bundle.version }); return bundle; },
      (error) => { bundles.delete(slug); reportSimBundleError(slug, "bundle.json", error); throw error; },
    );
    bundles.set(slug, pending);
  }
  return pending;
}

function fileIndex(bundle: LoadedSimBundle): Promise<Map<string, SimBundleFileEntry>> {
  const key = bundle.base;
  let pending = fileIndexes.get(key);
  if (!pending) {
    pending = (async () => {
      const index = new Map<string, SimBundleFileEntry>((bundle.manifest.files ?? []).map((file) => [file.name, file]));
      const ref = bundle.manifest.files_od;
      if (ref) {
        const bytes = await fetchBytes(simBundleFileUrl(bundle.base, ref.file), false);
        await verify(bytes, { sha256: ref.sha256 }, ref.file);
        const list = parseJson<SimBundleFileEntry[]>(bytes, ref.file);
        if (!Array.isArray(list)) throw new SimBundleError("schema", `${ref.file} 格式不符`);
        for (const file of list) {
          simBundleFileUrl(bundle.base, file.name);
          index.set(file.name, file);
        }
      }
      return index;
    })();
    pending.catch(() => fileIndexes.delete(key));
    fileIndexes.set(key, pending);
  }
  return pending;
}

/** bundle 有沒有宣告檔案清單（沒有＝舊版開發用 bundle，不驗 sha） */
function hasFileList(bundle: LoadedSimBundle): boolean {
  return Array.isArray(bundle.manifest.files) || !!bundle.manifest.files_od;
}

async function fetchVerified(bundle: LoadedSimBundle, path: string): Promise<ArrayBuffer> {
  const url = simBundleFileUrl(bundle.base, path);
  if (!hasFileList(bundle)) return fetchBytes(url, false);
  const entry = (await fileIndex(bundle)).get(path);
  if (!entry) throw new SimBundleError("not_listed", `模擬資料清單沒有這個檔：${path}`);
  const bytes = await fetchBytes(url, false);
  await verify(bytes, entry, path);
  return bytes;
}

/** 讀版本根目錄下的一個檔（快取、驗 sha、掛 loadingRegistry）。 */
export function loadSimFile(bundle: LoadedSimBundle, path: string, label: string): Promise<ArrayBuffer> {
  const key = `${bundle.base}${path}`;
  let pending = fileCache.get(key);
  if (pending) {
    fileCache.delete(key); // LRU：重新插入到最後
    fileCache.set(key, pending);
    return pending;
  }
  pending = withLoading(`sim-file-${bundle.slug}-${path}`, label, fetchVerified(bundle, path));
  pending.then(
    () => { if (simBundleStatus(bundle.slug).status === "error") setStatus(bundle.slug, { status: "ready", version: bundle.version }); },
    (error) => { fileCache.delete(key); reportSimBundleError(bundle.slug, path, error); },
  );
  fileCache.set(key, pending);
  while (fileCache.size > SIM_FILE_CACHE_LIMIT) fileCache.delete(fileCache.keys().next().value as string);
  return pending;
}

export async function loadSimJson<T>(bundle: LoadedSimBundle, path: string, label: string): Promise<T> {
  return parseJson<T>(await loadSimFile(bundle, path, label), path);
}

/** 測試用：清掉所有快取與狀態 */
export function resetSimBundleCacheForTests(): void {
  bundles.clear(); fileCache.clear(); fileIndexes.clear(); statuses.clear();
}
