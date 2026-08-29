import type { CustomLayerInterface, Map as MapboxMap } from "mapbox-gl";
import type { FrameBudget, TrackFrame } from "../gfw-v4-bench/types";
import {
  GfwV4TrackScene,
  type GfwV4SpatialPointFrame,
  type GfwV4RenderedFrame,
  type GfwV4ViewBounds,
} from "../three/GfwV4TrackScene";

export const GFW_V4_TRACK_CUSTOM_LAYER_ID = "gfw-v4-tracks-custom";

/** render 跑在 Mapbox 的 paint pass 裡：任何例外都必須就地吞掉，否則整張圖停畫。 */
let warnedRenderFailure = false;

export interface GfwV4TrackCustomLayerOptions {
  id?: string;
  budget: FrameBudget;
  getFrame: () => TrackFrame | null;
  /** Phase-2 Worker/GPU route. Mutually exclusive with getFrame per render. */
  getSpatialFrame?: () => GfwV4SpatialPointFrame | null;
  getVisible: () => boolean;
  getOpacity: () => number;
  getTheme: () => "dark" | "light" | boolean;
  onRendered?: (visible: GfwV4RenderedFrame) => void;
  /** Acceptance-only observation after a spatial frame reaches the shared GL render call. */
  onSpatialRendered?: (visible: { pointCount: number; projectionName: string | null }) => void;
  sceneFactory?: (budget: FrameBudget) => GfwV4TrackScene;
}

function mapBounds(map: MapboxMap): GfwV4ViewBounds {
  const bounds = map.getBounds();
  if (!bounds) return { west: -180, south: -90, east: 180, north: 90 };
  return { west: bounds.getWest(), south: bounds.getSouth(), east: bounds.getEast(), north: bounds.getNorth() };
}

export function createGfwV4TrackCustomLayer(options: GfwV4TrackCustomLayerOptions): CustomLayerInterface {
  const scene = options.sceneFactory?.(options.budget) ?? new GfwV4TrackScene(options.budget);
  let map: MapboxMap | null = null;
  let lastFrame: TrackFrame | GfwV4SpatialPointFrame | null = null;
  let lastViewKey = "";
  return {
    id: options.id ?? GFW_V4_TRACK_CUSTOM_LAYER_ID,
    type: "custom" as const,
    // 與既有 ShipScene 相同；Mapbox 的 3d custom-layer pass 才提供可直接套用的 Mercator matrix。
    renderingMode: "3d" as const,
    onAdd(mapInstance: MapboxMap, gl: WebGLRenderingContext) {
      map = mapInstance;
      scene.init(gl);
    },
    render(_gl: WebGLRenderingContext, matrix: number[], projection?: { name?: string }) {
      try {
        if (!map || !options.getVisible()) return;
        const frame = options.getSpatialFrame?.() ?? options.getFrame();
        if (!frame) return;
        const bounds = mapBounds(map);
        const zoom = map.getZoom();
        const viewKey = `${bounds.west.toFixed(3)}|${bounds.south.toFixed(3)}|${bounds.east.toFixed(3)}|${bounds.north.toFixed(3)}|${zoom.toFixed(2)}|${options.getOpacity()}|${String(options.getTheme())}`;
        scene.setOpacity(options.getOpacity());
        scene.setTheme(options.getTheme());
        let spatialVisible: { pointCount: number } | null = null;
        if (frame !== lastFrame || viewKey !== lastViewKey) {
          lastFrame = frame;
          lastViewKey = viewKey;
          if ("points" in frame) {
            spatialVisible = scene.updateSpatialPoints(frame, zoom);
          } else {
            const rendered = scene.update(frame, bounds, zoom);
            options.onRendered?.(rendered);
          }
        }
        scene.render(matrix);
        if (spatialVisible) options.onSpatialRendered?.({
          pointCount: spatialVisible.pointCount,
          projectionName: projection?.name ?? null,
        });
      } catch (error) {
        if (!warnedRenderFailure) {
          warnedRenderFailure = true;
          console.warn("[gfw-v4-tracks] custom layer render skipped", error);
        }
      }
    },
    onRemove() {
      scene.dispose();
      map = null;
    },
  };
}
