import * as THREE from "three";
import type { Flight } from "../types";
import { toMercator } from "../utils/coordinates";
import { getTrailUpToTime, isFlightActive } from "../utils/interpolation";
import { LightTrail } from "./LightTrail";
import { LightOrb } from "./LightOrb";
import { BlinkingLight } from "./BlinkingLight";

interface FlightVisual {
  trail: LightTrail;
  orb: LightOrb;
  blink: BlinkingLight;
}

/**
 * Three.js 場景管理器
 * 管理所有航班的光軌、光球、閃爍燈
 *
 * visuals 採用 lazy 建立策略：update() 遇到未見過的航班會自動建立，
 * 離開範圍的航班只是隱藏（不銷毀），確保跨模式切換和異步資料載入
 * 都不會導致畫面空白。
 */
export class FlightScene {
  scene: THREE.Scene;
  camera: THREE.Camera;
  renderer!: THREE.WebGLRenderer;

  private visuals = new Map<string, FlightVisual>();
  private colorIndex = 0;

  // 光軌顏色調色盤（additive blending 下的基底色）
  private colors = [
    new THREE.Color(0.3, 0.6, 1.0),   // 藍
    new THREE.Color(0.2, 0.8, 0.9),   // 青
    new THREE.Color(0.5, 0.4, 1.0),   // 紫
    new THREE.Color(0.3, 0.9, 0.7),   // 翠
    new THREE.Color(0.6, 0.5, 1.0),   // 淺紫
  ];

  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.Camera();
  }

  /** 在 Mapbox CustomLayer.onAdd 中呼叫 */
  init(gl: WebGLRenderingContext) {
    this.renderer = new THREE.WebGLRenderer({
      canvas: gl.canvas as HTMLCanvasElement,
      context: gl as unknown as WebGL2RenderingContext,
      antialias: true,
    });
    this.renderer.autoClear = false;
  }

  /** 每幀更新（根據當前時間），自動管理 visuals 生命週期 */
  update(flights: Flight[], currentTime: number) {
    const animDt = 0.016; // ~60fps

    // 收集本幀活躍的 flight IDs
    const activeIds = new Set<string>();

    for (const flight of flights) {
      activeIds.add(flight.fr24_id);

      // Lazy 建立：遇到新航班自動建立 visual
      let visual = this.visuals.get(flight.fr24_id);
      if (!visual) {
        visual = this.createVisual(flight.fr24_id);
      }

      const active = isFlightActive(flight.path, currentTime);

      if (!active) {
        visual.trail.setOpacity(0);
        visual.orb.setVisible(false);
        visual.blink.setVisible(false);
        continue;
      }

      // 取得當前軌跡段（保留最近 600 秒的軌跡）
      const trail = getTrailUpToTime(flight.path, currentTime, 600);
      if (trail.length < 2) {
        visual.orb.setVisible(false);
        visual.blink.setVisible(false);
        continue;
      }

      // 更新光軌
      visual.trail.updateTrail(trail);
      visual.trail.setOpacity(0.8);

      // 更新光球位置
      const lastPt = trail[trail.length - 1]!;
      const pos = toMercator(lastPt[0], lastPt[1], lastPt[2]);
      visual.orb.setPosition(pos.x, pos.y, pos.z);
      visual.orb.setVisible(true);
      visual.orb.update(animDt);

      // 更新閃爍燈
      visual.blink.setVisible(true);
      visual.blink.update(animDt);
    }

    // 隱藏不在本幀航班列表中的 visuals
    for (const [id, visual] of this.visuals) {
      if (!activeIds.has(id)) {
        visual.trail.setOpacity(0);
        visual.orb.setVisible(false);
        visual.blink.setVisible(false);
      }
    }
  }

  /** 在 Mapbox CustomLayer.render 中呼叫 */
  render(matrix: number[]) {
    this.camera.projectionMatrix = new THREE.Matrix4().fromArray(matrix);
    this.renderer.resetState();
    this.renderer.render(this.scene, this.camera);
  }

  private createVisual(flightId: string): FlightVisual {
    const color = this.colors[this.colorIndex % this.colors.length]!;
    this.colorIndex++;

    const trail = new LightTrail(color);
    const orb = new LightOrb(color);
    const blink = new BlinkingLight();

    orb.group.add(blink.sprite);
    this.scene.add(trail.mesh);
    this.scene.add(orb.group);

    const visual = { trail, orb, blink };
    this.visuals.set(flightId, visual);
    return visual;
  }

  private clearScene() {
    for (const visual of this.visuals.values()) {
      this.scene.remove(visual.trail.mesh);
      this.scene.remove(visual.orb.group);
      visual.trail.dispose();
      visual.orb.dispose();
      visual.blink.dispose();
    }
    this.visuals.clear();
    this.colorIndex = 0;
  }

  dispose() {
    this.clearScene();
    this.renderer.dispose();
  }
}
