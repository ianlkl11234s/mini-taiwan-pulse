import type { LayerVisibility, OverlayConfig } from "../types";
import { loadingRegistry } from "../lib/loadingRegistry";
import { getLoadedJpHeightCatalog, loadJpHeightCatalog, type JpHeightAsset, type JpHeightCatalogResult } from "../data/jpHeightCatalog";
import { addOverlay, updateOverlayTheme, releaseOverlaySnapshots, type OverlayMap } from "./overlayManager";

type Bbox = readonly [number, number, number, number];
type Kind = "buildings" | "grid" | "canopy";
export const JP_HEIGHT_MOVEEND_DEBOUNCE_MS = 200;
export const JP_HEIGHT_SOURCE_LIMIT = 6;
export interface JpHeightRuntime {
  status: "loading" | "ready" | "legacy" | "unavailable";
  version?: string;
  activeSourceIds: string[];
  availableRegionIds: string[];
  cappedRegionIds: string[];
  error?: string;
}
let runtime: JpHeightRuntime = { status: "loading", activeSourceIds: [], availableRegionIds: [], cappedRegionIds: [] };
const subscribers = new Set<() => void>();
export const jpHeightCatalogStore = {
  getSnapshot: () => runtime,
  subscribe: (fn: () => void) => { subscribers.add(fn); return () => { subscribers.delete(fn); }; },
};
function publish(next: JpHeightRuntime) {
  runtime = next;
  subscribers.forEach((fn) => fn());
  if (import.meta.env.DEV) console.debug("[jp-height-lifecycle]", JSON.stringify({
    status: next.status, active: next.activeSourceIds, available: next.availableRegionIds.length,
    capped: next.cappedRegionIds.length, error: next.error,
  }));
}
interface BoundsLike { getWest(): number; getSouth(): number; getEast(): number; getNorth(): number; }
export interface JpHeightMap extends OverlayMap {
  getBounds(): BoundsLike | null;
  getZoom(): number;
  isSourceLoaded(id: string): boolean;
  on(event: string, listener: (event?: unknown) => void): unknown;
  off(event: string, listener: (event?: unknown) => void): unknown;
}
function intersects(view: BoundsLike | null, bounds: Bbox): boolean {
  if (!view) return false;
  const x = (bounds[2] - bounds[0]) * 0.1, y = (bounds[3] - bounds[1]) * 0.1;
  if (view.getSouth() > bounds[3] + y || view.getNorth() < bounds[1] - y) return false;
  const offset = 360 * Math.round(((view.getWest() + view.getEast()) / 2 - (bounds[0] + bounds[2]) / 2) / 360);
  return [offset - 360, offset, offset + 360].some((world) => view.getWest() <= bounds[2] + x + world && view.getEast() >= bounds[0] - x + world);
}
function distance(view: BoundsLike, bounds: Bbox): number {
  const lng = (view.getWest() + view.getEast() - bounds[0] - bounds[2]) / 2;
  const wrapped = ((lng + 180) % 360 + 360) % 360 - 180;
  return Math.abs(wrapped) + Math.abs((view.getSouth() + view.getNorth() - bounds[1] - bounds[3]) / 2);
}
function sourceId(kind: Kind, region: string): string {
  return `jp-${kind === "buildings" ? "building-height" : kind === "grid" ? "building-height-grid" : "canopy-height"}--${region}`;
}
function clone(template: OverlayConfig, kind: Kind, region: string, asset: JpHeightAsset): OverlayConfig {
  const layers = kind === "grid"
    ? template.layers.map(({ maxzoom: _maxzoom, ...layer }) => layer)
    : kind === "canopy" && region === "overview"
      ? template.layers.map((layer) => ({ ...layer, minzoom: asset.minzoom }))
      : template.layers;
  return { ...template, sourceId: sourceId(kind, region), sourceUrl: asset.url,
    // mapbox-pmtiles rounds source zoom; maxzoom=13 drops grid buckets at z12.5.
    // The controller removes the entire grid source at z13 instead.
    layers,
    pmtiles: { minzoom: asset.minzoom, maxzoom: asset.maxzoom, ...(asset.sourceLayer ? { sourceLayer: asset.sourceLayer } : {}) },
    attribution: asset.attribution ?? template.attribution };
}
let nextController = 0;

/** Per-map budget: <=4 building sources (detail OR grid), <=2 canopy sources. */
export function createJpHeightLifecycle(map: JpHeightMap) {
  const instance = ++nextController;
  let disposed = false, suspended = false, generation = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let request: AbortController | undefined;
  let latest: { registry: OverlayConfig[]; visibility: LayerVisibility; isDark: boolean; params: Record<string, number> } | undefined;
  let catalog: JpHeightCatalogResult | undefined = getLoadedJpHeightCatalog();
  const mounted = new Map<string, OverlayConfig>();
  const pending = new Map<string, ReturnType<typeof setTimeout>>();
  const errors = new Map<string, string>();
  let catalogTaskActive = false;
  let lastCapped: string[] = [];
  const taskId = (source: string) => `jp-height:${instance}:${source}`;
  const endCatalogTask = () => {
    if (!catalogTaskActive) return;
    catalogTaskActive = false;
    loadingRegistry.end(taskId("catalog"));
  };
  const end = (source: string) => {
    const timeout = pending.get(source);
    if (timeout === undefined) return;
    clearTimeout(timeout);
    pending.delete(source);
    loadingRegistry.end(taskId(source));
  };
  function report(capped: string[] = lastCapped) {
    lastCapped = capped;
    const base = { activeSourceIds: [...mounted.keys()], cappedRegionIds: capped,
      availableRegionIds: catalog && catalog.status !== "unavailable" ? catalog.catalog.regions.filter((r) => r.status === "ready").map((r) => r.id) : [] };
    if (!catalog) publish({ ...base, status: "loading" });
    else if (catalog.status === "unavailable") publish({ ...base, status: "unavailable", error: catalog.error });
    else publish({ ...base, status: catalog.status, version: catalog.catalog.version,
      ...(errors.size ? { error: [...errors.values()].join("；") } : {}) });
  }
  function unmount(source: string, config: OverlayConfig): boolean {
    end(source);
    errors.delete(source);
    try {
      for (const layer of config.layers) {
        const name = `${source}-${layer.suffix}`;
        if (map.getLayer(name)) map.removeLayer(name);
      }
      if (map.getSource(source)) map.removeSource(source);
      releaseOverlaySnapshots(map, config);
      mounted.delete(source);
      return true;
    } catch {
      errors.set(source, "部分圖磚無法卸載，已暫停新增來源");
      return false;
    }
  }
  async function startCatalog() {
    if (catalog || request || disposed || suspended || !latest || (!latest.visibility.jpBuildingHeight && !latest.visibility.jpCanopyHeight)) return;
    const own = request = new AbortController(), token = ++generation;
    catalogTaskActive = true;
    loadingRegistry.start(taskId("catalog"), "日本高度覆蓋清冊");
    report();
    try {
      const result = await loadJpHeightCatalog(own.signal);
      if (!disposed && !suspended && token === generation) { catalog = result; reconcile(); }
    } catch { /* Abort is expected during style replacement or disposal. */ }
    finally { if (request === own) { request = undefined; endCatalogTask(); } }
  }
  function choose(): { configs: OverlayConfig[]; capped: string[] } {
    if (!latest || !catalog || catalog.status === "unavailable") return { configs: [], capped: [] };
    const view = map.getBounds();
    if (!view) return { configs: [], capped: [] };
    const templates = {
      buildings: latest.registry.find((c) => c.sourceId === "jp-building-height"),
      grid: latest.registry.find((c) => c.sourceId === "jp-building-height-grid"),
      canopy: latest.registry.find((c) => c.sourceId === "jp-canopy-height"),
    };
    const zoom = map.getZoom(), configs: OverlayConfig[] = [], capped: string[] = [];
    const regions = catalog.catalog.regions.filter((r) => r.status === "ready")
      .sort((a, b) => distance(view, a.bbox) - distance(view, b.bbox) || a.id.localeCompare(b.id));
    const overview = catalog.catalog.overview;
    const useOverview = latest.visibility.jpBuildingHeight && overview && zoom >= overview.minzoom && zoom < 13 && intersects(view, overview.bbox);
    if (useOverview && templates.grid) configs.push(clone(templates.grid, "grid", "overview", overview));
    const overviewRegions = overview?.regionIds ? new Set(overview.regionIds) : undefined;
    let buildingCount = useOverview ? 1 : 0, canopyCount = 0;
    const canopyDetails = latest.visibility.jpCanopyHeight && templates.canopy
      ? regions.filter((region) => {
        const canopy = region.canopy;
        return canopy && zoom >= canopy.minzoom && intersects(view, canopy.bbox);
      })
      : [];
    const canopyOverview = catalog.catalog.canopyOverview;
    // An overview fills only a viewport with no renderable regional canopy asset.
    // This avoids mixing coarse and detail values in one view.
    const useCanopyOverview = canopyDetails.length === 0 && latest.visibility.jpCanopyHeight
      && templates.canopy && canopyOverview && zoom >= canopyOverview.minzoom
      && intersects(view, canopyOverview.bbox);
    if (useCanopyOverview && templates.canopy) {
      configs.push(clone(templates.canopy, "canopy", "overview", canopyOverview));
      canopyCount++;
    }
    for (const region of regions) {
      const kind = zoom >= 13 ? "buildings" : "grid";
      const building = region[kind], template = templates[kind];
      // A partial overview replaces only the regions explicitly listed in its manifest.
      // Older catalogs without regionIds retain the legacy all-regions behavior.
      const coveredByOverview = useOverview && (!overviewRegions || overviewRegions.has(region.id));
      if (!coveredByOverview && latest.visibility.jpBuildingHeight && building && template && zoom >= building.minzoom && intersects(view, building.bbox)) {
        if (buildingCount < 4) { configs.push(clone(template, kind, region.id, building)); buildingCount++; }
        else capped.push(region.id);
      }
      const canopy = region.canopy;
      // maxzoom is the archive's last native tile, not the display zoom limit.
      if (!useCanopyOverview && latest.visibility.jpCanopyHeight && canopy && templates.canopy && zoom >= canopy.minzoom && intersects(view, canopy.bbox)) {
        if (canopyCount < 2) { configs.push(clone(templates.canopy, "canopy", region.id, canopy)); canopyCount++; }
        else capped.push(region.id);
      }
    }
    return { configs, capped: [...new Set(capped)] };
  }
  function reconcile() {
    if (disposed || suspended || !latest) return;
    if (!catalog) { void startCatalog(); return; }
    const { configs, capped } = choose(), next = new Map(configs.map((config) => [config.sourceId, config]));
    let canMount = true;
    for (const [source, config] of mounted) {
      if (!next.has(source) || !map.getSource(source)) canMount = unmount(source, config) && canMount;
    }
    if (canMount) for (const [source, config] of next) {
      if (mounted.has(source)) { updateOverlayTheme(map, config, latest.isDark, latest.params, true); continue; }
      if (mounted.size >= JP_HEIGHT_SOURCE_LIMIT) break;
      try {
        addOverlay(map, config, latest.isDark, latest.params);
        mounted.set(source, config);
        if (!map.isSourceLoaded(source)) {
          loadingRegistry.start(taskId(source), config.id === "jpCanopyHeight" ? "日本樹冠高度" : "日本建物高度");
          pending.set(source, setTimeout(() => {
            end(source); errors.set(source, "圖磚載入逾時，可關閉再開啟重試"); report(capped);
          }, 30000));
        }
      } catch {
        // Keep any partially created source tracked for the next cleanup.
        if (map.getSource(source)) mounted.set(source, config);
        errors.set(source, "圖磚載入失敗，可關閉再開啟重試");
      }
    }
    report(capped);
  }
  const move = () => {
    if (disposed || suspended) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => { timer = undefined; reconcile(); }, JP_HEIGHT_MOVEEND_DEBOUNCE_MS);
  };
  const sourcedata = (event?: unknown) => {
    const source = (event as { sourceId?: string } | undefined)?.sourceId;
    if (source && mounted.has(source) && map.getSource(source) && map.isSourceLoaded(source)) { end(source); if (errors.delete(source)) report(); }
  };
  const idle = () => { for (const source of mounted.keys()) sourcedata({ sourceId: source }); };
  const error = (event?: unknown) => {
    const source = (event as { sourceId?: string } | undefined)?.sourceId;
    if (source && mounted.has(source)) { end(source); errors.set(source, "圖磚載入失敗，可關閉再開啟重試"); report(); }
  };
  function suspend() {
    if (disposed || suspended) return;
    suspended = true; generation++; request?.abort(); request = undefined; endCatalogTask();
    if (timer) clearTimeout(timer); timer = undefined;
    for (const [source, config] of mounted) unmount(source, config);
    for (const source of pending.keys()) end(source);
  }
  function resume() { if (!disposed) suspended = false; }
  function dispose() {
    if (disposed) return;
    suspend(); disposed = true;
    map.off("moveend", move); map.off("sourcedata", sourcedata); map.off("idle", idle); map.off("error", error); map.off("remove", dispose);
  }
  map.on("moveend", move); map.on("sourcedata", sourcedata); map.on("idle", idle); map.on("error", error); map.on("remove", dispose);
  function refresh(registry: OverlayConfig[], visibility: LayerVisibility, isDark: boolean, params: Record<string, number>) {
    const wasEnabled = latest && (latest.visibility.jpBuildingHeight || latest.visibility.jpCanopyHeight);
    if (!wasEnabled && (visibility.jpBuildingHeight || visibility.jpCanopyHeight) && catalog?.status === "unavailable") catalog = undefined;
    latest = { registry, visibility, isDark, params };
    if (!visibility.jpBuildingHeight && !visibility.jpCanopyHeight && request) {
      generation++; request.abort(); request = undefined; endCatalogTask();
    }
    reconcile();
  }
  return { refresh, suspend, resume, dispose, getMountedSourceIds: () => [...mounted.keys()] };
}
