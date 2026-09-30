import type { CustomLayerInterface, Map as MapboxMap } from "mapbox-gl";
import { FireStationScene, type FireStationRow } from "../three/FireStationScene";

/**
 * 消防分隊 3D Custom Layer — 光柱（高度依階級）+ 向外擴張漣漪。
 * 疊在既有 Mapbox circle 之上（circle 仍負責俯視標示 + click popup）。
 * onAdd 時自 fetch /geo/fire_stations.geojson 餵 scene（一次性，與 overlay 共用同檔已被瀏覽器快取）。
 *
 * 重繪策略：靜態圖層，只在資料／可見性／參數改變時重畫（由 useThreeJsLayers wake-up 通道觸發），
 * 漣漪動畫因此只在相機移動或輸入改變時前進。要恢復「可見時持續漣漪」把下方旗標改 true。
 */
const ANIMATE_WHILE_VISIBLE = false;

export interface FireStationLayerOptions {
  id?: string;
  getIsVisible: () => boolean;
  getOpacity?: () => number;
  getScale?: () => number;
  onSceneReady?: (scene: FireStationScene) => void;
}

export function createFireStationLayer(opts: FireStationLayerOptions): CustomLayerInterface {
  const scene = new FireStationScene();
  let map: MapboxMap | null = null;
  let loaded = false;
  let lastOpacity = -1;
  let lastScale = -1;

  const loadData = async () => {
    try {
      const res = await fetch("./geo/fire_stations.geojson");
      const fc = (await res.json()) as GeoJSON.FeatureCollection;
      const rows: FireStationRow[] = [];
      for (const f of fc.features) {
        if (!f.geometry || f.geometry.type !== "Point") continue;
        const [lng, lat] = f.geometry.coordinates as [number, number];
        rows.push({ lng, lat, cat: String(f.properties?.cat ?? "其他") });
      }
      scene.setRows(rows);
      loaded = true;
      map?.triggerRepaint();
    } catch {
      /* 靜默：拿不到就不顯示 3D，circle 仍在 */
    }
  };

  return {
    id: opts.id ?? "fire-station-3d",
    type: "custom" as const,
    renderingMode: "3d" as const,

    onAdd(mapInstance: MapboxMap, gl: WebGLRenderingContext) {
      map = mapInstance;
      scene.init(gl);
      opts.onSceneReady?.(scene);
      loadData();
    },

    render(_gl: WebGLRenderingContext, matrix: number[]) {
      const show = opts.getIsVisible() && loaded;
      scene.setVisible(show);
      if (!show) return;
      const op = opts.getOpacity?.() ?? 0.85;
      if (op !== lastOpacity) { lastOpacity = op; scene.setOpacity(op); }
      const sc = opts.getScale?.() ?? 1;
      if (sc !== lastScale) { lastScale = sc; scene.setScale(sc); }
      scene.render(matrix);
      if (ANIMATE_WHILE_VISIBLE) map?.triggerRepaint();
    },

    onRemove() {
      scene.dispose();
    },
  };
}
