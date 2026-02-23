import * as THREE from "three";
import type { Ship } from "../types";
import { toMercator } from "../utils/coordinates";
import { interpolatePosition, getTrailUpToTime } from "../utils/interpolation";

const SHIP_COLOR_DARK = new THREE.Color(0.1, 0.85, 0.9); // 青藍
const SHIP_COLOR_LIGHT = new THREE.Color(0.0, 0.3, 0.45); // 深青

const TRAIL_DURATION = 1800; // 0.5 小時 = 1800 秒
const MAX_TRAIL_VERTICES = 60000; // LineSegments 頂點上限

/**
 * 船舶場景 — InstancedMesh 光球 + LineSegments 拖尾線
 */
export class ShipScene {
  scene: THREE.Scene;
  camera: THREE.Camera;
  renderer!: THREE.WebGLRenderer;

  private instancedMesh: THREE.InstancedMesh | null = null;
  private maxInstances = 2500;
  private isDarkTheme = true;
  private orbScale = 0.000005;
  private breathPhase = 0;

  // 拖尾線
  private trailGeo: THREE.BufferGeometry | null = null;
  private trailLine: THREE.LineSegments | null = null;
  private trailPositions!: Float32Array;
  private trailColors!: Float32Array;

  // 視口剔除用
  private viewBounds: { minLng: number; maxLng: number; minLat: number; maxLat: number } | null = null;

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

    const geo = new THREE.IcosahedronGeometry(1, 2);

    // 主光球 Mesh
    const mat = new THREE.MeshBasicMaterial({
      color: SHIP_COLOR_DARK,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.instancedMesh = new THREE.InstancedMesh(geo, mat, this.maxInstances);
    this.instancedMesh.frustumCulled = false;
    this.instancedMesh.count = 0;
    this.scene.add(this.instancedMesh);

    // 拖尾 LineSegments（per-vertex color）
    this.trailGeo = new THREE.BufferGeometry();
    this.trailPositions = new Float32Array(MAX_TRAIL_VERTICES * 3);
    this.trailColors = new Float32Array(MAX_TRAIL_VERTICES * 3);

    this.trailGeo.setAttribute("position", new THREE.BufferAttribute(this.trailPositions, 3));
    this.trailGeo.setAttribute("color", new THREE.BufferAttribute(this.trailColors, 3));
    this.trailGeo.setDrawRange(0, 0);

    const trailMat = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.trailLine = new THREE.LineSegments(this.trailGeo, trailMat);
    this.trailLine.frustumCulled = false;
    this.scene.add(this.trailLine);
  }

  setTheme(isDark: boolean) {
    if (this.isDarkTheme === isDark) return;
    this.isDarkTheme = isDark;
    if (this.instancedMesh) {
      const mat = this.instancedMesh.material as THREE.MeshBasicMaterial;
      mat.color.copy(isDark ? SHIP_COLOR_DARK : SHIP_COLOR_LIGHT);
      mat.blending = isDark ? THREE.AdditiveBlending : THREE.NormalBlending;
      mat.opacity = isDark ? 0.85 : 0.7;
    }
    if (this.trailLine) {
      const mat = this.trailLine.material as THREE.LineBasicMaterial;
      mat.blending = isDark ? THREE.AdditiveBlending : THREE.NormalBlending;
      mat.opacity = isDark ? 0.8 : 0.5;
    }
  }

  setOrbScale(scale: number) {
    this.orbScale = scale;
  }

  setViewBounds(bounds: { minLng: number; maxLng: number; minLat: number; maxLat: number } | null) {
    this.viewBounds = bounds;
  }

  update(ships: Ship[], currentTime: number) {
    if (!this.instancedMesh || !this.trailGeo) return;

    this.breathPhase += 0.02;
    const breathFactor = 1.0 + 0.15 * Math.sin(this.breathPhase);

    const dummy = new THREE.Matrix4();
    let headCount = 0;
    let vi = 0; // trail vertex index
    const bounds = this.viewBounds;
    const baseScale = this.orbScale * 0.6;

    const baseColor = this.isDarkTheme ? SHIP_COLOR_DARK : SHIP_COLOR_LIGHT;
    const positions = this.trailPositions;
    const colors = this.trailColors;

    for (const ship of ships) {
      if (headCount >= this.maxInstances) break;

      const pos = interpolatePosition(ship.path, currentTime);
      if (!pos) continue;

      const [lat, lng] = pos;

      // 視口剔除
      if (bounds) {
        const pad = 0.5;
        if (lng < bounds.minLng - pad || lng > bounds.maxLng + pad ||
            lat < bounds.minLat - pad || lat > bounds.maxLat + pad) {
          continue;
        }
      }

      // 主光球
      const mc = toMercator(lat, lng, 0);
      const s = baseScale * breathFactor;
      dummy.makeScale(s, s, s);
      dummy.setPosition(mc.x, mc.y, mc.z);
      this.instancedMesh.setMatrixAt(headCount, dummy);
      headCount++;

      // 拖尾線段
      const trail = getTrailUpToTime(ship.path, currentTime, TRAIL_DURATION);
      if (trail.length >= 2 && vi < MAX_TRAIL_VERTICES - trail.length * 2) {
        for (let i = 0; i < trail.length - 1; i++) {
          const ptA = trail[i]!;
          const ptB = trail[i + 1]!;
          const progressA = i / (trail.length - 1); // 0=oldest → 1=newest
          const progressB = (i + 1) / (trail.length - 1);

          const mcA = toMercator(ptA[0], ptA[1], 0);
          const mcB = toMercator(ptB[0], ptB[1], 0);

          // 頂點 A
          positions[vi * 3] = mcA.x;
          positions[vi * 3 + 1] = mcA.y;
          positions[vi * 3 + 2] = mcA.z;
          const bA = 0.1 + 0.9 * progressA;
          colors[vi * 3] = baseColor.r * bA;
          colors[vi * 3 + 1] = baseColor.g * bA;
          colors[vi * 3 + 2] = baseColor.b * bA;
          vi++;

          // 頂點 B
          positions[vi * 3] = mcB.x;
          positions[vi * 3 + 1] = mcB.y;
          positions[vi * 3 + 2] = mcB.z;
          const bB = 0.1 + 0.9 * progressB;
          colors[vi * 3] = baseColor.r * bB;
          colors[vi * 3 + 1] = baseColor.g * bB;
          colors[vi * 3 + 2] = baseColor.b * bB;
          vi++;
        }
      }
    }

    this.instancedMesh.count = headCount;
    this.instancedMesh.instanceMatrix.needsUpdate = true;

    this.trailGeo.setDrawRange(0, vi);
    (this.trailGeo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (this.trailGeo.attributes.color as THREE.BufferAttribute).needsUpdate = true;
  }

  render(matrix: number[]) {
    const gl = this.renderer.getContext();
    const blendEnabled = gl.isEnabled(gl.BLEND);
    const blendSrc = gl.getParameter(gl.BLEND_SRC_RGB);
    const blendDst = gl.getParameter(gl.BLEND_DST_RGB);
    const blendSrcA = gl.getParameter(gl.BLEND_SRC_ALPHA);
    const blendDstA = gl.getParameter(gl.BLEND_DST_ALPHA);

    this.camera.projectionMatrix = new THREE.Matrix4().fromArray(matrix);
    this.renderer.resetState();
    this.renderer.render(this.scene, this.camera);
    this.renderer.resetState();

    if (blendEnabled) gl.enable(gl.BLEND);
    else gl.disable(gl.BLEND);
    gl.blendFuncSeparate(blendSrc, blendDst, blendSrcA, blendDstA);
  }

  getVisibleCount(): number {
    return this.instancedMesh?.count ?? 0;
  }

  dispose() {
    if (this.instancedMesh) {
      this.scene.remove(this.instancedMesh);
      this.instancedMesh.geometry.dispose();
      (this.instancedMesh.material as THREE.Material).dispose();
      this.instancedMesh = null;
    }
    if (this.trailLine) {
      this.scene.remove(this.trailLine);
      this.trailGeo?.dispose();
      (this.trailLine.material as THREE.Material).dispose();
      this.trailLine = null;
      this.trailGeo = null;
    }
    this.renderer?.dispose();
  }
}
