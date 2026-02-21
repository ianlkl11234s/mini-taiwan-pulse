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

// 暗色主題調色盤（Additive Blending 用，淺色系）
const DARK_COLORS = [
  new THREE.Color(0.3, 0.6, 1.0),
  new THREE.Color(0.2, 0.8, 0.9),
  new THREE.Color(0.5, 0.4, 1.0),
  new THREE.Color(0.3, 0.9, 0.7),
  new THREE.Color(0.6, 0.5, 1.0),
];

// 亮色主題調色盤（Normal Blending 用，深飽和色系）
const LIGHT_COLORS = [
  new THREE.Color(0.05, 0.15, 0.6),  // 深藍
  new THREE.Color(0.6, 0.05, 0.15),  // 深紅
  new THREE.Color(0.3, 0.05, 0.55),  // 深紫
  new THREE.Color(0.0, 0.35, 0.35),  // 深青
  new THREE.Color(0.5, 0.25, 0.0),   // 深琥珀
];

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
  private currentOrbScale = 0.000005;
  private currentStaticOpacity = 0.2;
  private isDarkTheme = true;
  private showTrails = true;
  private lastMatrix: THREE.Matrix4 | null = null;

  // 靜態軌跡的 3D mesh（全路徑）
  private staticMesh: THREE.LineSegments | null = null;
  private staticGlowMesh: THREE.LineSegments | null = null;
  private lastStaticKey = "";

  private get colors() {
    return this.isDarkTheme ? DARK_COLORS : LIGHT_COLORS;
  }

  private get blending() {
    return this.isDarkTheme ? THREE.AdditiveBlending : THREE.NormalBlending;
  }

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

  /** 切換明暗主題：更新所有視覺元素的顏色與混合模式 */
  setTheme(isDark: boolean) {
    if (this.isDarkTheme === isDark) return;
    this.isDarkTheme = isDark;

    // 重新配色現有的動態軌跡
    let idx = 0;
    for (const visual of this.visuals.values()) {
      const color = this.colors[idx % this.colors.length]!;
      idx++;
      visual.trail.setColor(color);
      visual.trail.setBlending(this.blending);
      visual.orb.setTheme(color, this.blending);
    }

    // 強制重建靜態軌跡（顏色 + blending 都不同）
    this.forceRebuildStatic();
  }

  /**
   * 更新靜態軌跡 mesh（全路徑 3D 線條）
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

    const totalVerts = totalSegments * 2;
    const positions = new Float32Array(totalVerts * 3);
    const colors = new Float32Array(totalVerts * 3);
    let offset = 0;
    let cOffset = 0;

    const MAX_ALT = 13000;

    // 根據主題選擇高度漸變色
    let lowR: number, lowG: number, lowB: number;
    let highR: number, highG: number, highB: number;

    if (this.isDarkTheme) {
      // 暗色主題：暖橘 → 冷藍
      lowR = 1.0; lowG = 0.65; lowB = 0.25;
      highR = 0.3; highG = 0.6; highB = 1.0;
    } else {
      // 亮色主題：深紅 → 深藍
      lowR = 0.6; lowG = 0.1; lowB = 0.05;
      highR = 0.05; highG = 0.15; highB = 0.55;
    }

    const writeVertexColor = (alt: number) => {
      const t = Math.min(Math.max(alt / MAX_ALT, 0), 1);
      colors[cOffset++] = lowR + (highR - lowR) * t;
      colors[cOffset++] = lowG + (highG - lowG) * t;
      colors[cOffset++] = lowB + (highB - lowB) * t;
    };

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

        writeVertexColor(a[2]);
        writeVertexColor(b[2]);
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    const staticOpacity = this.isDarkTheme
      ? this.currentStaticOpacity
      : Math.min(this.currentStaticOpacity * 2.5, 0.7);

    // 內層線條（per-vertex 高度漸變色）
    const mat = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: staticOpacity,
      blending: this.blending,
      depthWrite: false,
    });
    this.staticMesh = new THREE.LineSegments(geometry, mat);
    this.staticMesh.frustumCulled = false;
    this.scene.add(this.staticMesh);

    // 外層 glow
    const glowMat = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: staticOpacity * 0.3,
      blending: this.blending,
      depthWrite: false,
    });
    this.staticGlowMesh = new THREE.LineSegments(geometry.clone(), glowMat);
    this.staticGlowMesh.frustumCulled = false;
    this.scene.add(this.staticGlowMesh);

    if (!this.showTrails) {
      this.staticMesh.visible = false;
      this.staticGlowMesh.visible = false;
    }
  }

  /** 強制下次重建靜態軌跡 */
  forceRebuildStatic() {
    this.lastStaticKey = "";
  }

  /** 更新靜態軌跡不透明度 */
  setStaticOpacity(innerOpacity: number) {
    this.currentStaticOpacity = innerOpacity;
    const effective = this.isDarkTheme
      ? innerOpacity
      : Math.min(innerOpacity * 2.5, 0.7);
    if (this.staticMesh) {
      (this.staticMesh.material as THREE.LineBasicMaterial).opacity = effective;
    }
    if (this.staticGlowMesh) {
      (this.staticGlowMesh.material as THREE.LineBasicMaterial).opacity = effective * 0.3;
    }
  }

  /** 更新所有光球大小 */
  setOrbScale(scale: number) {
    this.currentOrbScale = scale;
    for (const visual of this.visuals.values()) {
      visual.orb.setScale(scale);
    }
  }

  /** 切換靜態軌跡顯示/隱藏（Live Status 模式只隱藏完整航線，保留動態尾跡） */
  setShowTrails(show: boolean) {
    if (this.showTrails === show) return;
    this.showTrails = show;

    if (this.staticMesh) this.staticMesh.visible = show;
    if (this.staticGlowMesh) this.staticGlowMesh.visible = show;
  }

  /** 點擊拾取：螢幕座標 → 最近的 flightId */
  pickFlight(screenX: number, screenY: number, viewWidth: number, viewHeight: number): string | null {
    if (!this.lastMatrix) return null;

    const threshold = 25;
    let closest: { id: string; dist: number } | null = null;

    for (const [id, visual] of this.visuals) {
      if (!visual.orb.group.visible) continue;
      const pos = visual.orb.group.position;
      const v = new THREE.Vector4(pos.x, pos.y, pos.z, 1.0);
      v.applyMatrix4(this.lastMatrix);
      if (v.w <= 0) continue;

      const sx = ((v.x / v.w) * 0.5 + 0.5) * viewWidth;
      const sy = ((-v.y / v.w) * 0.5 + 0.5) * viewHeight;

      const dist = Math.hypot(sx - screenX, sy - screenY);
      if (dist < threshold && (!closest || dist < closest.dist)) {
        closest = { id, dist };
      }
    }

    return closest?.id ?? null;
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
      visual.trail.setOpacity(this.isDarkTheme ? 0.8 : 1.0);

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
    const gl = this.renderer.getContext();

    // 保存 Mapbox 的 WebGL blend 狀態
    const blendEnabled = gl.isEnabled(gl.BLEND);
    const blendSrc = gl.getParameter(gl.BLEND_SRC_RGB);
    const blendDst = gl.getParameter(gl.BLEND_DST_RGB);
    const blendSrcA = gl.getParameter(gl.BLEND_SRC_ALPHA);
    const blendDstA = gl.getParameter(gl.BLEND_DST_ALPHA);

    this.lastMatrix = new THREE.Matrix4().fromArray(matrix);
    this.camera.projectionMatrix = this.lastMatrix;
    this.renderer.resetState();
    this.renderer.render(this.scene, this.camera);
    this.renderer.resetState();

    // 恢復 Mapbox 的 WebGL blend 狀態
    if (blendEnabled) {
      gl.enable(gl.BLEND);
    } else {
      gl.disable(gl.BLEND);
    }
    gl.blendFuncSeparate(blendSrc, blendDst, blendSrcA, blendDstA);
  }

  private createVisual(flightId: string): FlightVisual {
    const color = this.colors[this.colorIndex % this.colors.length]!;
    this.colorIndex++;

    const trail = new LightTrail(color, 512, this.blending);
    const orb = new LightOrb(color, this.currentOrbScale, this.blending);
    const blink = new BlinkingLight();

    orb.group.add(blink.mesh);
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
