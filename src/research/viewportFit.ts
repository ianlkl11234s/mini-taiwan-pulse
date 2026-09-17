import type { Map as MapboxMap } from "mapbox-gl";

export type ResearchFraming = {
  /** [west, south, east, north] */
  bounds: [number, number, number, number];
  padding: number;
  maxZoom: number;
};

export type ResearchCamera = { center: [number, number]; zoom: number; bearing: 0; pitch: 0; padding: 0 };
export type ViewportRect = { left: number; top: number; right: number; bottom: number };
export type ViewportContext = { viewport: ViewportRect; safe: ViewportRect; overlays: readonly ViewportRect[] };

type ViewportMap = Pick<MapboxMap, "getContainer" | "cameraForBounds">;

// The App's flyout starts after the 56px Icon Rail, so it is still left-docked at 58px.
const EDGE_ATTACH_PX = 80;
const MIN_EDGE_SPACE_PX = 16;
const OVERLAY_GAP_PX = 16;
const MIN_CONTENT_PX = 80;
const EXCLUDED_OVERLAY_CLASSES = ["mapboxgl-canvas-container", "mapboxgl-canvas", "mapboxgl-map"];

function finite(value: number): boolean { return Number.isFinite(value); }

function validFraming(framing: ResearchFraming): boolean {
  const [west, south, east, north] = framing.bounds;
  return framing.bounds.every(finite) && west >= -180 && west <= 180 && east >= -180 && east <= 180
    && south >= -85 && south <= 85 && north >= -85 && north <= 85 && west < east && south < north
    && finite(framing.padding) && framing.padding >= 0 && finite(framing.maxZoom) && framing.maxZoom >= 0 && framing.maxZoom <= 24;
}

function visible(element: Element): boolean {
  if (!(element instanceof HTMLElement)) return false;
  try {
    const style = window.getComputedStyle(element);
    return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity || 1) > 0;
  } catch { return false; }
}

function localRect(rect: DOMRect, container: DOMRect): ViewportRect | null {
  const left = Math.max(0, rect.left - container.left);
  const top = Math.max(0, rect.top - container.top);
  const right = Math.min(container.width, rect.right - container.left);
  const bottom = Math.min(container.height, rect.bottom - container.top);
  return right > left && bottom > top && [left, top, right, bottom].every(finite) ? { left, top, right, bottom } : null;
}

function isFullMapSurface(element: Element, rect: ViewportRect, viewport: ViewportRect): boolean {
  if (EXCLUDED_OVERLAY_CLASSES.some(name => element.classList.contains(name))) return true;
  return rect.right - rect.left >= viewport.right - viewport.left - MIN_EDGE_SPACE_PX
    && rect.bottom - rect.top >= viewport.bottom - viewport.top - MIN_EDGE_SPACE_PX;
}

/**
 * Finds edge-docked UI only. Popups in the middle deliberately do not alter a bounds overview.
 * The selector list covers stable research UI; the positioned-child pass covers the existing
 * inline Icon Rail and timeline wrappers without assuming a fixed viewport size.
 */
function overlayRects(host: HTMLElement, containerRect: DOMRect, viewport: ViewportRect): ViewportRect[] {
  if (typeof window === "undefined") return [];
  const candidates = new Set<Element>();
  for (const selector of ["[data-viewport-occluder]", ".research-activity-position", ".layer-sidebar-scroll", "[data-testid='historical-timeline']"]) {
    host.querySelectorAll(selector).forEach(element => candidates.add(element));
  }
  host.querySelectorAll("*").forEach(element => {
    if (!(element instanceof HTMLElement) || !visible(element)) return;
    try {
      const position = window.getComputedStyle(element).position;
      if (position === "absolute" || position === "fixed") candidates.add(element);
    } catch { /* a detached element cannot constrain the current camera */ }
  });
  const rects: ViewportRect[] = [];
  for (const element of candidates) {
    if (!visible(element)) continue;
    const local = localRect(element.getBoundingClientRect(), containerRect);
    // `.layer-sidebar-scroll` is inside the 56px rail; reserve from the map's left edge,
    // not from the flyout's x-position, so its whole parent panel is treated as one occluder.
    const rect = local && element.matches(".layer-sidebar-scroll") ? { ...local, left: 0 } : local;
    if (!rect || isFullMapSurface(element, rect, viewport)) continue;
    const touchesEdge = rect.left <= EDGE_ATTACH_PX || rect.top <= EDGE_ATTACH_PX
      || viewport.right - rect.right <= EDGE_ATTACH_PX || viewport.bottom - rect.bottom <= EDGE_ATTACH_PX;
    if (touchesEdge) rects.push(rect);
  }
  return rects;
}

type Edge = "left" | "top" | "right" | "bottom";

/** A tall rail belongs to the left/right edge, and a wide timeline to top/bottom, even at a corner. */
function dominantEdge(viewport: ViewportRect, rect: ViewportRect): Edge | null {
  const width = viewport.right - viewport.left;
  const height = viewport.bottom - viewport.top;
  const rectWidth = rect.right - rect.left;
  const rectHeight = rect.bottom - rect.top;
  const distances: Record<Edge, number> = {
    left: rect.left,
    top: rect.top,
    right: viewport.right - rect.right,
    bottom: viewport.bottom - rect.bottom,
  };
  if (rectHeight >= height - EDGE_ATTACH_PX * 2 && (distances.left <= EDGE_ATTACH_PX || distances.right <= EDGE_ATTACH_PX)) return distances.left <= distances.right ? "left" : "right";
  if (rectWidth >= width - EDGE_ATTACH_PX * 2 && (distances.top <= EDGE_ATTACH_PX || distances.bottom <= EDGE_ATTACH_PX)) return distances.top <= distances.bottom ? "top" : "bottom";
  const edge = (Object.entries(distances) as Array<[Edge, number]>).sort(([, a], [, b]) => a - b)[0];
  return edge && edge[1] <= EDGE_ATTACH_PX ? edge[0] : null;
}

function insetForOverlays(viewport: ViewportRect, overlays: readonly ViewportRect[]): ViewportRect {
  let left = MIN_EDGE_SPACE_PX;
  let top = MIN_EDGE_SPACE_PX;
  let right = MIN_EDGE_SPACE_PX;
  let bottom = MIN_EDGE_SPACE_PX;
  for (const rect of overlays) {
    switch (dominantEdge(viewport, rect)) {
      case "left": left = Math.max(left, rect.right + OVERLAY_GAP_PX); break;
      case "right": right = Math.max(right, viewport.right - rect.left + OVERLAY_GAP_PX); break;
      case "top": top = Math.max(top, rect.bottom + OVERLAY_GAP_PX); break;
      case "bottom": bottom = Math.max(bottom, viewport.bottom - rect.top + OVERLAY_GAP_PX); break;
    }
  }
  const safeRight = viewport.right - right;
  const safeBottom = viewport.bottom - bottom;
  // During panel animation, opposing occluders can leave no honest place to fit bounds.
  if (safeRight - left < MIN_CONTENT_PX || safeBottom - top < MIN_CONTENT_PX) throw new Error("VIEWPORT_OCCLUDED");
  return { left, top, right: safeRight, bottom: safeBottom };
}

function mercatorY(lat: number): number {
  const radians = lat * Math.PI / 180;
  return (1 - Math.log(Math.tan(Math.PI / 4 + radians / 2)) / Math.PI) / 2;
}

function latitudeFromMercatorY(y: number): number {
  return Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180 / Math.PI;
}

/**
 * cameraForBounds uses padding to choose zoom, but its returned center can still be the
 * geographic midpoint. Move that center in world pixels so the fitted result lands in the
 * safe rectangle once `easeTo` clears persistent Mapbox padding.
 */
export function offsetCameraToSafeRect(camera: Pick<ResearchCamera, "center" | "zoom">, context: ViewportContext): [number, number] {
  const { viewport, safe } = context;
  const worldSize = 512 * 2 ** camera.zoom;
  const safeCenterX = (safe.left + safe.right) / 2;
  const safeCenterY = (safe.top + safe.bottom) / 2;
  const viewportCenterX = (viewport.left + viewport.right) / 2;
  const viewportCenterY = (viewport.top + viewport.bottom) / 2;
  const x = (camera.center[0] + 180) / 360 - (safeCenterX - viewportCenterX) / worldSize;
  const y = mercatorY(camera.center[1]) - (safeCenterY - viewportCenterY) / worldSize;
  const longitude = ((x * 360 + 360) % 360) - 180;
  const latitude = latitudeFromMercatorY(Math.max(0, Math.min(1, y)));
  return [longitude, latitude];
}

/** Reads the live map container and current visible edge overlays. */
export function viewportContextFromRects(width: number, height: number, overlays: readonly ViewportRect[]): ViewportContext {
  if (!finite(width) || !finite(height) || width <= 0 || height <= 0) throw new Error("INVALID_MAP_VIEWPORT");
  const viewport = { left: 0, top: 0, right: width, bottom: height };
  return { viewport, overlays, safe: insetForOverlays(viewport, overlays) };
}

export function resolveViewportContext(map: Pick<MapboxMap, "getContainer">): ViewportContext {
  const container = map.getContainer();
  // MapView's canvas is a direct child of the App scene root; the rail and timeline are siblings.
  // Fall back to the container when embedded in a different host.
  const host = container.parentElement ?? container;
  const rect = container.getBoundingClientRect();
  if (!finite(rect.width) || !finite(rect.height) || rect.width <= 0 || rect.height <= 0) throw new Error("INVALID_MAP_VIEWPORT");
  const viewport = { left: 0, top: 0, right: rect.width, bottom: rect.height };
  const overlays = overlayRects(host, rect, viewport);
  return viewportContextFromRects(rect.width, rect.height, overlays);
}

/**
 * Fits geographic bounds into the currently unobscured map rectangle. The returned camera has
 * no persistent Mapbox padding: callers should easeTo it with retainPadding: false.
 */
export function resolveViewportCameraFromContext(map: Pick<MapboxMap, "cameraForBounds">, context: ViewportContext, framing: ResearchFraming): ResearchCamera {
  if (!validFraming(framing)) throw new Error("INVALID_RESEARCH_FRAMING");
  const { viewport, safe } = context;
  const padding = {
    left: Math.max(0, safe.left + framing.padding),
    top: Math.max(0, safe.top + framing.padding),
    right: Math.max(0, viewport.right - safe.right + framing.padding),
    bottom: Math.max(0, viewport.bottom - safe.bottom + framing.padding),
  };
  const [west, south, east, north] = framing.bounds;
  const camera = map.cameraForBounds([[west, south], [east, north]], { padding, maxZoom: framing.maxZoom, bearing: 0, pitch: 0 });
  const rawCenter: unknown = camera?.center;
  const zoom = camera?.zoom;
  const center = Array.isArray(rawCenter)
    ? rawCenter
    : rawCenter && typeof rawCenter === "object"
      ? [(rawCenter as { lng?: unknown }).lng, (rawCenter as { lat?: unknown }).lat]
      : null;
  if (!camera || !center || !finite(Number(center[0])) || !finite(Number(center[1])) || typeof zoom !== "number" || !finite(zoom)) throw new Error("VIEWPORT_CAMERA_UNAVAILABLE");
  return { center: offsetCameraToSafeRect({ center: [Number(center[0]), Number(center[1])], zoom }, context), zoom, bearing: 0, pitch: 0, padding: 0 };
}

export function resolveViewportCamera(map: ViewportMap, framing: ResearchFraming): ResearchCamera {
  return resolveViewportCameraFromContext(map, resolveViewportContext(map), framing);
}
