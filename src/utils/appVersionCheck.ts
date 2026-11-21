/**
 * 「網站有新版本」偵測（AG-10）：比對建置時產生的 `/version.json` 與本頁載入時的版本。
 * 純邏輯，不碰 DOM 以外的全域；本機版號與 build 由參數傳入，方便測試。
 */

export interface AppVersionInfo {
  /** package.json 版號（`__APP_VERSION__`） */
  version: string;
  /** 建置識別碼（commit SHA 前 12 碼）；拿不到時是空字串，只比版號 */
  build: string;
}

/** 解析 `/version.json` 回應內容；格式不對一律回 null（當「不知道」，不提示）。 */
export function parseVersionPayload(raw: unknown): AppVersionInfo | null {
  if (!raw || typeof raw !== "object") return null;
  const { version, build } = raw as Record<string, unknown>;
  if (typeof version !== "string" || !version) return null;
  return { version, build: typeof build === "string" ? build : "" };
}

/** 遠端與本頁不同才算有新版本；兩邊都有 build 時以 build 為準，否則比版號。 */
export function isDifferentBuild(local: AppVersionInfo, remote: AppVersionInfo | null): boolean {
  if (!remote) return false;
  if (local.build && remote.build) return local.build !== remote.build;
  return local.version !== remote.version;
}

/** 遠端版本的識別字串，用來記「稍後」略過的是哪一版。 */
export const versionKey = (v: AppVersionInfo): string => `${v.version}#${v.build}`;

/**
 * 抓 `/version.json`。非 200、回 HTML（dev server／SPA fallback 對不存在路徑回 index.html）、
 * JSON 壞掉、網路錯誤一律回 null。
 */
export async function fetchRemoteVersion(
  fetchImpl: typeof fetch = fetch,
  url = "/version.json",
): Promise<AppVersionInfo | null> {
  try {
    const res = await fetchImpl(`${url}?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "";
    if (type && !type.includes("json")) return null;
    return parseVersionPayload(JSON.parse(await res.text()));
  } catch {
    return null;
  }
}

export const CHECK_INTERVAL_MS = 12 * 60 * 1000;
/** 回到前景時的最短檢查間隔，避免切分頁就打一次 */
export const MIN_RECHECK_MS = 60 * 1000;

export interface VersionWatcherOptions {
  local: AppVersionInfo;
  fetchVersion: () => Promise<AppVersionInfo | null>;
  onUpdate: (remote: AppVersionInfo) => void;
  /** 測試注入 */
  doc?: Pick<Document, "visibilityState" | "addEventListener" | "removeEventListener">;
  now?: () => number;
  intervalMs?: number;
  minRecheckMs?: number;
}

/**
 * 背景檢查：每 `intervalMs` 一次（分頁在背景時跳過），分頁回到前景時再檢查（至少隔 `minRecheckMs`）。
 * 偵測到不同版本後呼叫 onUpdate 並停止輪詢。回傳停止函式。
 */
export function startVersionWatcher(opts: VersionWatcherOptions): () => void {
  const doc = opts.doc ?? document;
  const now = opts.now ?? Date.now;
  const minGap = opts.minRecheckMs ?? MIN_RECHECK_MS;
  let lastCheck = now();
  let stopped = false;
  let inFlight = false;

  const check = async () => {
    if (stopped || inFlight) return;
    inFlight = true;
    lastCheck = now();
    try {
      const remote = await opts.fetchVersion();
      if (!stopped && remote && isDifferentBuild(opts.local, remote)) {
        stop();
        opts.onUpdate(remote);
      }
    } finally {
      inFlight = false;
    }
  };
  const onVisible = () => {
    if (doc.visibilityState === "visible" && now() - lastCheck >= minGap) void check();
  };
  const timer = setInterval(() => {
    if (doc.visibilityState === "visible") void check();
  }, opts.intervalMs ?? CHECK_INTERVAL_MS);
  doc.addEventListener("visibilitychange", onVisible);

  function stop() {
    stopped = true;
    clearInterval(timer);
    doc.removeEventListener("visibilitychange", onVisible);
  }
  return stop;
}

/** 開發模式模擬「伺服器版本不同」：`?upd_sim=1` 或 localStorage `pulse.updSim=1`。正式站一律 false。 */
export function isUpdateSimulated(search: string, storage: Pick<Storage, "getItem"> | null, isDev: boolean): boolean {
  if (!isDev) return false;
  if (new URLSearchParams(search).get("upd_sim") === "1") return true;
  try {
    return storage?.getItem("pulse.updSim") === "1";
  } catch {
    return false;
  }
}
