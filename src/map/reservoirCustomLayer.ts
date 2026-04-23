import type { CustomLayerInterface, Map as MapboxMap } from "mapbox-gl";
import * as THREE from "three";
import { ReservoirScene } from "../three/ReservoirScene";
import type { ReservoirStatus } from "../data/reservoirStatusLoader";

export interface ReservoirCustomLayerOptions {
  scene: ReservoirScene;
  getStatuses: () => ReservoirStatus[];
  getIsVisible: () => boolean;
  getIsDarkTheme: () => boolean;
  getHeightScale: () => number;
}

/**
 * Reservoir 3D 水位計 Mapbox custom layer
 *
 * 延遲 init：等第一次 getStatuses() 回傳非空陣列時才 setStatuses + rebuild scene。
 * 之後 statuses 變化時要由外部（hook）呼叫 scene.setStatuses() + map.triggerRepaint()。
 *
 * **不觸發 per-frame repaint**：水庫 3D 是靜態幾何，僅在資料更新時需要渲染；
 * 讓 Mapbox 自己決定何時 repaint（相機移動、triggerRepaint 呼叫），避免 60 FPS
 * 無限迴圈浪費 GPU。動畫型圖層（flight/bus）才需要 render 內 triggerRepaint。
 */
export function createReservoirLayer(opts: ReservoirCustomLayerOptions): CustomLayerInterface {
  let renderer: THREE.WebGLRenderer | null = null;
  let initialized = false;

  return {
    id: "reservoir-3d",
    type: "custom" as const,
    renderingMode: "3d" as const,

    onAdd(_mapInstance: MapboxMap, gl: WebGLRenderingContext) {
      console.log("[ReservoirLayer] onAdd");
      renderer = new THREE.WebGLRenderer({
        canvas: gl.canvas as HTMLCanvasElement,
        context: gl as unknown as WebGL2RenderingContext,
        antialias: true,
      });
      renderer.autoClear = false;
      opts.scene.init(renderer);
    },

    render(_gl: WebGLRenderingContext, matrix: number[]) {
      if (!initialized) {
        const list = opts.getStatuses();
        if (list.length > 0) {
          opts.scene.setStatuses(list);
          initialized = true;
        }
      }

      opts.scene.setVisible(opts.getIsVisible());
      opts.scene.setTheme(opts.getIsDarkTheme());
      opts.scene.setHeightScale(opts.getHeightScale());

      if (opts.getIsVisible()) {
        opts.scene.render(matrix);
      }
    },

    onRemove() {
      opts.scene.dispose();
      renderer?.dispose();
      renderer = null;
    },
  };
}
