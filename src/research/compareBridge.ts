/**
 * G2-3：AI 助手看得到、也能操作「兩國並排」的右圖（評估 G2-EVAL §2.5）。
 *
 * 協定（網站 × research-gateway × pulse-research MCP 三方）：
 * - **讀**：`map_context` 最上層欄位一律＝左圖（主地圖），舊版 Agent 照常可用。新版網頁另加 `compare`：
 *   - 不在比較：`{ mode: "off" }`（MCP 以「有沒有 compare 欄位」判斷網頁支不支援並排指令）
 *   - 拉桿：`{ mode: "slider" }`（同地點疊圖，沒有獨立的右圖鏡頭可操作）
 *   - 兩國並排：`{ mode: "countries", scaleLocked, right: { country, camera, bounds, visibleLayerKeys, visibleSummary, resultPresentation } }`
 *     （手機 A／B 是單地圖，不算並排）
 * - **寫**：場景多一個 `right` 子場景（`RightScene`）。gateway 以整個物件取代（淺層合併），所以 MCP 每次送完整的 `right`。
 *   `right: null`＝關掉並排；`right.country`＝打開並排並指定右國；`camera`／`framing` 移動右圖；`results` 畫在右圖。
 *   網頁只在**這一次指令的 patch 帶了 `right`** 時處理右圖（場景裡沿用下來的 `right` 不會重開已被使用者關掉的並排）。
 * - 圖層開關不分側：右國圖層本來就自動畫在右圖（`compareCountrySides.ts`），所以不需要 `right.layers`。
 */
import type { ResultCollection, ViewportFraming } from "./bridgeClient";

export type RightCamera = { center: [number, number]; zoom: number };
export type RightScene = { country?: string; camera?: RightCamera | null; framing?: ViewportFraming | null; results?: ResultCollection | null };

const RIGHT_KEYS = ["country", "camera", "framing", "results"];
const COUNTRY = /^[A-Z]{2}$/;

function isObject(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }

export function isRightCamera(value: unknown): value is RightCamera {
  if (!isObject(value) || Object.keys(value).length !== 2 || !("center" in value) || !("zoom" in value)) return false;
  const center = value.center;
  return Array.isArray(center) && center.length === 2 && center.every(part => typeof part === "number" && Number.isFinite(part))
    && center[0] >= -180 && center[0] <= 180 && center[1] >= -85 && center[1] <= 85
    && typeof value.zoom === "number" && Number.isFinite(value.zoom) && value.zoom >= 0 && value.zoom <= 18;
}

/** `right` 的形狀檢查；framing／results 的細部由呼叫端（bridgeClient 既有的檢查）傳入，避免兩份規則。 */
export function isRightScene(value: unknown, isFraming: (value: unknown) => boolean, isResults: (value: unknown) => boolean): value is RightScene | null {
  if (value === null) return true;
  if (!isObject(value) || !Object.keys(value).every(key => RIGHT_KEYS.includes(key))) return false;
  return (value.country === undefined || typeof value.country === "string" && COUNTRY.test(value.country))
    && (value.camera === undefined || value.camera === null || isRightCamera(value.camera))
    && (value.framing === undefined || isFraming(value.framing))
    && (value.results === undefined || isResults(value.results));
}

/** 比較狀態（`compareStore` 的子集），保持純函式好測 */
export type CompareSnapshot = { enabled: boolean; mode: "slider" | "countries"; rightCountry: string | null; scaleLocked: boolean };

/** 右圖讀得到的東西（MainMapConnection 從右圖實例組好傳進來） */
export type RightMapReading = {
  camera: RightCamera;
  bounds: [number, number, number, number] | null;
  visibleLayerKeys: string[];
  visibleSummary: unknown;
  resultPresentation: unknown;
};

export type CompareContext =
  | { mode: "off" }
  | { mode: "slider" }
  | { mode: "countries"; scaleLocked: boolean; right: ({ country: string } & RightMapReading) | { country: string; status: "map_not_ready" } };

/**
 * `map_context.compare`。`countriesActive`＝App 真的掛了右圖（桌機並排）；手機 A／B 或右圖還沒建好時，
 * 並排中回 `status: "map_not_ready"`，不假裝讀得到右圖。
 */
export function compareContext(snapshot: CompareSnapshot, right: RightMapReading | null): CompareContext {
  if (!snapshot.enabled) return { mode: "off" };
  if (snapshot.mode === "slider") return { mode: "slider" };
  if (!snapshot.rightCountry) return { mode: "off" };
  return { mode: "countries", scaleLocked: snapshot.scaleLocked, right: right ? { country: snapshot.rightCountry, ...right } : { country: snapshot.rightCountry, status: "map_not_ready" } };
}

/** 這次 patch 對右圖要做什麼（全部只看 patch 帶的 `right` 與上一個場景的 `right`） */
export type RightPlan =
  | { kind: "none" }
  | { kind: "close" }
  | {
    kind: "apply";
    /** 要打開並排並換成這個右國（null＝沿用目前的右國，必須已在並排） */
    openCountry: string | null;
    /** 要移動右圖：framing 優先，其次 camera；null＝不動 */
    move: { framing: ViewportFraming } | { camera: RightCamera } | null;
    /** 右圖結果集合（null＝清掉；undefined＝這次沒改） */
    results: ResultCollection | null | undefined;
  };

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

export function planRightScene(patchRight: RightScene | null | undefined, previousRight: RightScene | null | undefined, currentRightCountry: string | null): RightPlan {
  if (patchRight === undefined) return { kind: "none" };
  if (patchRight === null) return { kind: "close" };
  const openCountry = patchRight.country && patchRight.country !== currentRightCountry ? patchRight.country : null;
  // 換右國＝右圖整張重建：鏡頭與結果一律重新套用
  const rebuilt = openCountry !== null;
  let move: Extract<RightPlan, { kind: "apply" }>["move"] = null;
  if (patchRight.framing && (rebuilt || !same(patchRight.framing, previousRight?.framing))) move = { framing: patchRight.framing };
  else if (patchRight.camera && (rebuilt || !same(patchRight.camera, previousRight?.camera) || !same(patchRight.framing, previousRight?.framing))) move = { camera: patchRight.camera };
  const results = "results" in patchRight && (rebuilt || !same(patchRight.results, previousRight?.results)) ? patchRight.results ?? null : undefined;
  return { kind: "apply", openCountry, move, results };
}
