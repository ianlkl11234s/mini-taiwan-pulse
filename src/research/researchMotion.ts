import type { GeoJSONSource, Map as MapboxMap } from "mapbox-gl";
import type { FeatureCollection, Point, Polygon } from "geojson";

type Camera = { center: [number, number]; zoom: number; bearing?: number; pitch?: number; padding?: number };
type Motion = { finish: (completed: boolean) => void; listener: () => void; timer: ReturnType<typeof setTimeout> };

const motions = new WeakMap<MapboxMap, Motion>();
export const FOCUS_SOURCE = "research-motion-focus";
const FOCUS_FILL = "research-motion-focus-fill";
const FOCUS_LINE = "research-motion-focus-line";
const FOCUS_DOT = "research-motion-focus-dot";
export const researchFocusLayerIds = [FOCUS_FILL, FOCUS_LINE, FOCUS_DOT] as const;
const EARTH_RADIUS_M = 6_371_008.8;

function safely(action: () => void): void { try { action(); } catch { /* a style reload may remove sources or layers mid-cleanup */ } }

function closeEnough(map: MapboxMap, target: Camera): boolean {
  try {
    const center = map.getCenter();
    const longitudeDifference = Math.abs(((center.lng - target.center[0] + 540) % 360) - 180);
    return (target.bearing === undefined || Math.abs(map.getBearing() - target.bearing) < 0.01) && (target.pitch === undefined || Math.abs(map.getPitch() - target.pitch) < 0.01) && longitudeDifference <= 0.00001 && Math.abs(center.lat - target.center[1]) <= 0.00001 && Math.abs(map.getZoom() - target.zoom) <= 0.001;
  } catch { return false; }
}

function validCamera(camera: Camera): boolean {
  return Array.isArray(camera.center) && camera.center.length === 2 && camera.center.every(Number.isFinite)
    && Math.abs(camera.center[0]) <= 180 && Math.abs(camera.center[1]) <= 85 && Number.isFinite(camera.zoom) && camera.zoom >= 0 && camera.zoom <= 24;
}

/** Safe in SSR and test environments that do not expose a MediaQueryList. */
export function prefersReducedMotion(): boolean {
  try { return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; }
}

/** Stops only an active research motion. A later motion always resolves an earlier one as false. */
export function cancelResearchMotion(map: MapboxMap): void {
  const motion = motions.get(map);
  if (motion) { motion.finish(false); safely(() => map.stop()); }
}

/** Resolves true only after moveend reads back the requested camera; style readiness is deliberately not inferred. */
export function moveResearchCamera(map: MapboxMap, camera: Camera): Promise<boolean> {
  if (!validCamera(camera)) return Promise.resolve(false);
  cancelResearchMotion(map);
  if (closeEnough(map, camera)) return Promise.resolve(true);
  return new Promise(resolve => {
    let settled = false;
    const listener = () => finish(closeEnough(map, camera));
    const removed = () => finish(false);
    const finish = (completed: boolean) => {
      if (settled) return;
      settled = true;
      safely(() => map.off("moveend", listener));
      safely(() => map.off("remove", removed));
      clearTimeout(timer);
      if (motions.get(map)?.finish === finish) motions.delete(map);
      resolve(completed);
    };
    const timer = setTimeout(() => finish(false), 1_500);
    motions.set(map, { finish, listener, timer });
    safely(() => map.on("moveend", listener));
    safely(() => map.on("remove", removed));
    try { map.easeTo({ ...camera, retainPadding: false, duration: prefersReducedMotion() ? 0 : 650 }); } catch { finish(false); }
  });
}

function validateRadius(radiusM: number | undefined): void {
  if (radiusM !== undefined && (!Number.isFinite(radiusM) || radiusM < 100 || radiusM > 5_000)) throw new Error("INVALID_RESEARCH_FOCUS_RADIUS");
}

function destination([lng, lat]: [number, number], bearing: number, distanceM: number): [number, number] {
  const φ1 = lat * Math.PI / 180; const λ1 = lng * Math.PI / 180; const θ = bearing * Math.PI / 180; const δ = distanceM / EARTH_RADIUS_M;
  const φ2 = Math.asin(Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ));
  const λ2 = λ1 + Math.atan2(Math.sin(θ) * Math.sin(δ) * Math.cos(φ1), Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2));
  return [((λ2 * 180 / Math.PI + 540) % 360) - 180, φ2 * 180 / Math.PI];
}

function focusData(center: [number, number], radiusM?: number): FeatureCollection<Point | Polygon> {
  const features: FeatureCollection<Point | Polygon>["features"] = [{ type: "Feature", properties: { kind: "focus_center" }, geometry: { type: "Point", coordinates: center } }];
  if (radiusM !== undefined) {
    const ring = Array.from({ length: 64 }, (_, index) => destination(center, index * 360 / 64, radiusM));
    ring.push(ring[0]!);
    features.push({ type: "Feature", properties: { kind: "straight_line_haversine_radius", radius_m: radiusM }, geometry: { type: "Polygon", coordinates: [ring] } });
  }
  return { type: "FeatureCollection", features };
}

function ensureFocusLayers(map: MapboxMap, duration: number): void {
  if (!map.getLayer(FOCUS_FILL)) map.addLayer({ id: FOCUS_FILL, type: "fill", source: FOCUS_SOURCE, filter: ["==", ["get", "kind"], "straight_line_haversine_radius"], paint: { "fill-color": "#38bdf8", "fill-opacity": 0.12, "fill-opacity-transition": { duration, delay: 0 } } });
  if (!map.getLayer(FOCUS_LINE)) map.addLayer({ id: FOCUS_LINE, type: "line", source: FOCUS_SOURCE, filter: ["==", ["get", "kind"], "straight_line_haversine_radius"], paint: { "line-color": "#0284c7", "line-width": 2, "line-opacity": 0.8, "line-opacity-transition": { duration, delay: 0 } } });
  if (!map.getLayer(FOCUS_DOT)) map.addLayer({ id: FOCUS_DOT, type: "circle", source: FOCUS_SOURCE, filter: ["==", ["get", "kind"], "focus_center"], paint: { "circle-color": "#0369a1", "circle-radius": 6, "circle-stroke-color": "#ffffff", "circle-stroke-width": 2, "circle-opacity": 1, "circle-opacity-transition": { duration, delay: 0 } } });
}

/** Shows a center and, only when supplied, a straight-line Haversine radius; it never represents walking access. */
export function showResearchFocus(map: MapboxMap, center: [number, number], radiusM?: number): boolean {
  if (!Array.isArray(center) || center.length !== 2 || !center.every(Number.isFinite) || Math.abs(center[0]) > 180 || Math.abs(center[1]) > 85) throw new Error("INVALID_RESEARCH_FOCUS_CENTER");
  validateRadius(radiusM);
  const data = focusData(center, radiusM); const duration = prefersReducedMotion() ? 0 : 300;
  try {
    const source = map.getSource(FOCUS_SOURCE) as GeoJSONSource | undefined;
    if (source) source.setData(data); else map.addSource(FOCUS_SOURCE, { type: "geojson", data });
    ensureFocusLayers(map, duration);
    return true;
  } catch { return false; }
}

/** Removes transient focus artifacts in dependency order; harmless after map/style teardown. */
export function clearResearchFocus(map: MapboxMap): void {
  for (const id of [FOCUS_DOT, FOCUS_LINE, FOCUS_FILL]) safely(() => { if (map.getLayer(id)) map.removeLayer(id); });
  safely(() => { if (map.getSource(FOCUS_SOURCE)) map.removeSource(FOCUS_SOURCE); });
}
