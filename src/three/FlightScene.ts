import * as THREE from "three";
import type { Flight, RenderMode } from "../types";
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
 * 管理所有航班的光軌、光球、閃爍燈 + 靜態 3D 軌跡
 */
export class FlightScene {
  scene: THREE.Scene;
  camera: THREE.Camera;
  renderer!: THREE.WebGLRenderer;

  private visuals = new Map<string, FlightVisual>();
  private colorIndex = 0;

  // 靜態軌跡的 3D mesh（暖橘色，全路徑）
  private staticMesh: THREE.LineSegments | null = null;
  private staticGlowMesh: THREE.LineSegments | null = null;
  private lastStaticKey = "";

  // 光軌顏色調色盤
  private colors = [
    new THREE.Color(0.3, 0.6, 1.0),
    new THREE.Color(0.2, 0.8, 0.9),
    new THREE.Color(0.5, 0.4, 1.0),
    new THREE.Color(0.3, 0.9, 0.7),
    new THREE.Color(0.6, 0.5, 1.0),
  ];

  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.Camera();
  }

  init(gl: WebGLRenderingContext) {
    this.renderer = new THREE.WebGLRenderer({
      canvas: gl.canvas as HTMLCanvasElement,
      context: gl as unknown as WebGL2RenderingContext,
      antialias: true,
    });
    this.renderer.autoClear = false;
  }

  /**
   * 更新靜態軌跡 mesh（全路徑暖橘色 3D 線條）
   * 只有航班集合真正變動時才重建 geometry。
   * 在 2D 模式下隱藏 Three.js 靜態軌跡（由 Mapbox 原生圖層接管）。
   */
  updateStaticTrails(flights: Flight[], mode: RenderMode = "3d") {
    // 2D 模式：移除 Three.js 靜態軌跡，交給 Mapbox 原生圖層
    if (mode === "2d") {
      this.removeStaticMeshes();
      this.lastStaticKey = "";
      return;
    }

    // 用航班數 + 首末 ID 判斷是否需要重建
    const key =
      flights.length === 0
        ? ""
        : `${flights.length}|${flights[0]!.fr24_id}|${flights[flights.length - 1]!.fr24_id}`;
    if (key === this.lastStaticKey) return;
    this.lastStaticKey = key;

    this.removeStaticMeshes();

    if (flights.length === 0) return;

    // 計算總頂點數（LineSegments 需要每段兩個頂點）
    let totalSegments = 0;
    for (const f of flights) {
      if (f.path.length >= 2) totalSegments += f.path.length - 1;
    }
    if (totalSegments === 0) return;

    const positions = new Float32Array(totalSegments * 2 * 3);
    let offset = 0;

    for (const f of flights) {
      if (f.path.length < 2) continue;
      for (let i = 0; i < f.path.length - 1; i++) {
        const a = f.path[i]!;
        const b = f.path[i + 1]!;
        const ma = toMercator(a[0], a[1], a[2]);
        const mb = toMercator(b[0], b[1], b[2]);
        positions[offset++] = ma.x;
        positions[offset++] = ma.y;
        positions[offset++] = ma.z;
        positions[offset++] = mb.x;
        positions[offset++] = mb.y;
        positions[offset++] = mb.z;
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

    // 內層線條（暖橘色，較亮）
    const mat = new THREE.LineBasicMaterial({
      color: new THREE.Color(1.0, 0.65, 0.25),
      transparent: true,
      opacity: 0.2,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.staticMesh = new THREE.LineSegments(geometry, mat);
    this.staticMesh.frustumCulled = false;
    this.scene.add(this.staticMesh);

    // 外層 glow（較寬概念用 linewidth 不支援，改用更淡的疊加）
    const glowMat = new THREE.LineBasicMaterial({
      color: new THREE.Color(1.0, 0.5, 0.15),
      transparent: true,
      opacity: 0.06,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.staticGlowMesh = new THREE.LineSegments(geometry.clone(), glowMat);
    this.staticGlowMesh.frustumCulled = false;
    this.scene.add(this.staticGlowMesh);
  }

  /** 每幀更新動態光軌/光球 */
  update(flights: Flight[], currentTime: number) {
    const animDt = 0.016;
    const activeIds = new Set<string>();

    for (const flight of flights) {
      activeIds.add(flight.fr24_id);

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

      const trail = getTrailUpToTime(flight.path, currentTime, 600);
      if (trail.length < 2) {
        visual.orb.setVisible(false);
        visual.blink.setVisible(false);
        continue;
      }

      visual.trail.updateTrail(trail);
      visual.trail.setOpacity(0.8);

      const lastPt = trail[trail.length - 1]!;
      const pos = toMercator(lastPt[0], lastPt[1], lastPt[2]);
      visual.orb.setPosition(pos.x, pos.y, pos.z);
      visual.orb.setVisible(true);
      visual.orb.update(animDt);

      visual.blink.setVisible(true);
      visual.blink.update(animDt);
    }

    for (const [id, visual] of this.visuals) {
      if (!activeIds.has(id)) {
        visual.trail.setOpacity(0);
        visual.orb.setVisible(false);
        visual.blink.setVisible(false);
      }
    }
  }

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

  private removeStaticMeshes() {
    if (this.staticMesh) {
      this.scene.remove(this.staticMesh);
      this.staticMesh.geometry.dispose();
      (this.staticMesh.material as THREE.Material).dispose();
      this.staticMesh = null;
    }
    if (this.staticGlowMesh) {
      this.scene.remove(this.staticGlowMesh);
      this.staticGlowMesh.geometry.dispose();
      (this.staticGlowMesh.material as THREE.Material).dispose();
      this.staticGlowMesh = null;
    }
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
    this.removeStaticMeshes();
    this.lastStaticKey = "";
  }

  dispose() {
    this.clearScene();
    this.renderer.dispose();
  }
}
