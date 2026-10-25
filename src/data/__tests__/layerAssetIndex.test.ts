import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import {
  DEFAULT_LAYER_ASSET_BASE,
  LAYER_ASSET_FETCH_TIMEOUT_MS,
  LAYER_ASSET_INDEX_TASK_ID,
  LAYER_ASSET_SCHEMA,
  MIGRATED_ASSET_KEYS,
  loadLayerAssetIndex,
  resetLayerAssetIndex,
  resolveAssetUrl,
  resolveAssetUrlString,
} from "../layerAssetIndex";
import { loadingRegistry, type LoadingEvent } from "../../lib/loadingRegistry";
import { hydrateOverlayIfNeeded, resetOverlayHydration } from "../../map/overlayManager";
import type { OverlayConfig } from "../../types";

const GEOJSON_KEY = "./police_justice/immigration_offices/immigration_offices_20260626.geojson";
const PMTILES_KEY = "./harm_reduction/dui_crash_points.pmtiles";
const BASE = DEFAULT_LAYER_ASSET_BASE;

const sha = (text: string) => createHash("sha256").update(text).digest("hex");
const bytesOf = (text: string) => new TextEncoder().encode(text).byteLength;

const FC = JSON.stringify({ type: "FeatureCollection", features: [{ type: "Feature", geometry: { type: "Point", coordinates: [121.5, 25] }, properties: { name: "x" } }] });
const GEO_SHA = sha(FC);

function entry(kind: "geojson" | "pmtiles", path: string, content = FC) {
  return {
    asset_id: kind === "geojson" ? "immigration_offices" : "dui_crash_points",
    kind, path, sha256: sha(content), bytes: bytesOf(content), rows: 1,
    content_type: kind === "geojson" ? "application/geo+json" : "application/vnd.pmtiles",
    version: "2026-10-25", note: null, published_at: "2026-10-25T00:00:00Z",
    registry_id: null, package_sha256: null, row_key: ["entity_id"], previous: null,
    pmtiles: kind === "pmtiles" ? { source_layer: "dui_crash_points", minzoom: 5, maxzoom: 12 } : null,
  };
}

function indexText(entries: Record<string, unknown>, schema = LAYER_ASSET_SCHEMA) {
  return JSON.stringify({ schema_version: schema, generated_at: "2026-10-25T00:00:00Z", entries });
}

const GEO_PATH = `assets/immigration_offices/${GEO_SHA}.geojson`;
const PM_PATH = `assets/dui_crash_points/${"a".repeat(64)}.pmtiles`;
const DEFAULT_INDEX = indexText({ [GEOJSON_KEY]: entry("geojson", GEO_PATH), [PMTILES_KEY]: entry("pmtiles", PM_PATH, "pm") });

function pointerText(index: string, opts: { schema?: string; sha?: string } = {}) {
  return JSON.stringify({
    schema_version: opts.schema ?? LAYER_ASSET_SCHEMA,
    manifest: { path: "manifests/m.json", sha256: opts.sha ?? sha(index), bytes: bytesOf(index) },
    published_at: "2026-10-25T00:00:00Z",
    previous_manifest: null,
  });
}

function respond(body: string, status = 200): Response {
  return new Response(body, { status });
}

/** URL → body／status 的假 CDN；未登記的 URL 回 404。 */
function stubCdn(routes: Record<string, string | number>) {
  const fetchSpy = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const hit = routes[url];
    if (hit === undefined) return respond("not found", 404);
    return typeof hit === "number" ? respond("", hit) : respond(hit);
  });
  vi.stubGlobal("fetch", fetchSpy);
  return fetchSpy;
}

function captureEvents() {
  const events: LoadingEvent[] = [];
  const off = loadingRegistry.subscribeEvents((e) => events.push(e));
  return { events, off };
}

beforeEach(() => {
  resetLayerAssetIndex();
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
  resetLayerAssetIndex();
  resetOverlayHydration();
});

describe("layerAssetIndex resolver", () => {
  it("遷移清單只有兩筆試點 key", () => {
    expect([...MIGRATED_ASSET_KEYS].sort()).toEqual([PMTILES_KEY, GEOJSON_KEY].sort());
  });

  it("索引尚未載入：遷移清單內 → fallback（帶理由）；清單外 → legacy 原樣", () => {
    expect(resolveAssetUrl(GEOJSON_KEY)).toEqual({ url: GEOJSON_KEY, source: "fallback", reason: "索引尚未載入" });
    expect(resolveAssetUrl("./geo/other.geojson")).toEqual({ url: "./geo/other.geojson", source: "legacy" });
    expect(resolveAssetUrlString(PMTILES_KEY)).toBe(PMTILES_KEY);
  });

  it("索引有這筆 → CDN 絕對 URL；索引沒有但在遷移清單 → fallback；不在清單 → legacy", async () => {
    const otherIndex = indexText({ [GEOJSON_KEY]: entry("geojson", GEO_PATH) });
    stubCdn({ [`${BASE}current.json`]: pointerText(otherIndex), [`${BASE}manifests/m.json`]: otherIndex });
    const { events, off } = captureEvents();
    await loadLayerAssetIndex();
    off();

    const geo = resolveAssetUrl(GEOJSON_KEY);
    expect(geo.source).toBe("cdn");
    expect(geo.url).toBe(`${BASE}${GEO_PATH}`);
    expect(resolveAssetUrl(PMTILES_KEY)).toEqual({ url: PMTILES_KEY, source: "fallback", reason: "索引缺少此條目" });
    expect(resolveAssetUrl("./geo/x.geojson").source).toBe("legacy");
    expect(events.filter((e) => e.id === LAYER_ASSET_INDEX_TASK_ID).map((e) => e.type)).toEqual(["start", "end"]);
  });

  it("PMTiles 走 CDN 時回傳 base + entry.path", async () => {
    stubCdn({ [`${BASE}current.json`]: pointerText(DEFAULT_INDEX), [`${BASE}manifests/m.json`]: DEFAULT_INDEX });
    await loadLayerAssetIndex();
    expect(resolveAssetUrlString(PMTILES_KEY)).toBe(`${BASE}${PM_PATH}`);
  });

  const failureCases: Array<[string, () => void, RegExp]> = [
    ["指標 404", () => stubCdn({}), /404/],
    ["索引 404", () => stubCdn({ [`${BASE}current.json`]: pointerText(DEFAULT_INDEX) }), /404/],
    ["索引 sha 不符", () => stubCdn({ [`${BASE}current.json`]: pointerText(DEFAULT_INDEX, { sha: "0".repeat(64) }), [`${BASE}manifests/m.json`]: DEFAULT_INDEX }), /SHA-256/],
    ["指標 schema_version 錯", () => stubCdn({ [`${BASE}current.json`]: pointerText(DEFAULT_INDEX, { schema: "pulse-layer-assets-v0" }), [`${BASE}manifests/m.json`]: DEFAULT_INDEX }), /schema_version/],
    ["索引 schema_version 錯", () => {
      const bad = indexText({ [GEOJSON_KEY]: entry("geojson", GEO_PATH) }, "pulse-layer-assets-v0");
      stubCdn({ [`${BASE}current.json`]: pointerText(bad), [`${BASE}manifests/m.json`]: bad });
    }, /schema_version/],
    ["條目 path 越界", () => {
      const bad = indexText({ [GEOJSON_KEY]: entry("geojson", "../../evil.geojson") });
      stubCdn({ [`${BASE}current.json`]: pointerText(bad), [`${BASE}manifests/m.json`]: bad });
    }, /離開版本根目錄/],
  ];

  it.each(failureCases)("%s → 以 fail 結束，遷移清單內走 fallback", async (_name, arrange, reason) => {
    arrange();
    const { events, off } = captureEvents();
    await loadLayerAssetIndex();
    off();
    expect(events.filter((e) => e.id === LAYER_ASSET_INDEX_TASK_ID).map((e) => e.type)).toEqual(["start", "fail"]);
    const r = resolveAssetUrl(GEOJSON_KEY);
    expect(r.source).toBe("fallback");
    expect(r.url).toBe(GEOJSON_KEY);
    expect(r.source === "fallback" && r.reason).toMatch(reason);
    expect(resolveAssetUrl("./geo/x.geojson").source).toBe("legacy");
  });

  it("逾時 8 秒 → 以 fail 結束並 fallback", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn((_input: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
    })));
    const { events, off } = captureEvents();
    const done = loadLayerAssetIndex();
    await vi.advanceTimersByTimeAsync(LAYER_ASSET_FETCH_TIMEOUT_MS + 1);
    await done;
    off();
    expect(events.filter((e) => e.id === LAYER_ASSET_INDEX_TASK_ID).map((e) => e.type)).toEqual(["start", "fail"]);
    const r = resolveAssetUrl(PMTILES_KEY);
    expect(r.source === "fallback" && r.reason).toMatch(/逾時/);
  });
});

describe("hydrateOverlayIfNeeded × layerAssetIndex", () => {
  const config = {
    id: "immigrationOffice",
    sourceId: "immigration-office-test",
    sourceUrl: GEOJSON_KEY,
    layers: [],
  } as unknown as OverlayConfig;

  function mockMap() {
    const setData = vi.fn();
    return { setData, map: { getSource: () => ({ setData }) } as never };
  }

  it("下載失敗（404）→ loadingRegistry 以 fail 結束，且可重試", async () => {
    const fetchSpy = stubCdn({});
    const { map, setData } = mockMap();
    const { events, off } = captureEvents();
    await hydrateOverlayIfNeeded(map, config);
    off();
    const mine = events.filter((e) => e.id === `overlay-hydrate:${config.sourceId}`);
    expect(mine.map((e) => e.type)).toEqual(["start", "fail"]);
    expect(setData).not.toHaveBeenCalled();
    await hydrateOverlayIfNeeded(map, config);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("索引未載入（fallback）→ 抓舊相對路徑，標籤提示顯示部署時版本", async () => {
    const fetchSpy = stubCdn({ [GEOJSON_KEY]: FC });
    const { map, setData } = mockMap();
    const { events, off } = captureEvents();
    await hydrateOverlayIfNeeded(map, config);
    off();
    expect(fetchSpy).toHaveBeenCalledWith(GEOJSON_KEY);
    expect(setData).toHaveBeenCalledTimes(1);
    const mine = events.filter((e) => e.id === `overlay-hydrate:${config.sourceId}`);
    expect(mine.map((e) => e.type)).toEqual(["start", "end"]);
    expect(mine[0]?.label).toContain("顯示部署時版本");
  });

  it("走 CDN：bytes／sha256 相符 → setData；不符 → fail", async () => {
    stubCdn({ [`${BASE}current.json`]: pointerText(DEFAULT_INDEX), [`${BASE}manifests/m.json`]: DEFAULT_INDEX, [`${BASE}${GEO_PATH}`]: FC });
    await loadLayerAssetIndex();
    const ok = mockMap();
    await hydrateOverlayIfNeeded(ok.map, config);
    expect(ok.setData).toHaveBeenCalledTimes(1);

    resetOverlayHydration();
    const tampered = FC.replace('"x"', '"y"');
    stubCdn({ [`${BASE}${GEO_PATH}`]: tampered });
    const bad = mockMap();
    const { events, off } = captureEvents();
    await hydrateOverlayIfNeeded(bad.map, config);
    off();
    expect(bad.setData).not.toHaveBeenCalled();
    expect(events.filter((e) => e.id === `overlay-hydrate:${config.sourceId}`).map((e) => e.type)).toEqual(["start", "fail"]);
  });
});
