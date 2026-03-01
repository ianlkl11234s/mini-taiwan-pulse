import * as THREE from "three";
import type { RailTrain } from "../types";
import { toMercator } from "../utils/coordinates";

const TRAIL_DURATION = 180; // 3 分鐘 = 180 秒
const TRAIL_SYSTEMS = new Set(["tra", "thsr"]); // 只有台鐵和高鐵有拖尾
const MAX_TRAIL_VERTICES = 30000;

/**
 * 軌道列車場景 — InstancedMesh 光球 + LineSegments 拖尾 + 3D 靜態軌道
 */
export class RailScene {
  scene: THREE.Scene;
  camera: THREE.Camera;
  renderer!: THREE.WebGLRenderer;

  private instancedMesh: THREE.InstancedMesh | null = null;
  private maxInstances = 2500;
  private isDarkTheme = true;
  private orbScale = 0.000005;
  private altitudeOffset = 0; // 軌道 Z 軸偏移（公尺）

  // 快取顏色物件
  private colorCache = new Map<string, THREE.Color>();

  // 拖尾線
  private trailGeo: THREE.BufferGeometry | null = null;
  private trailLine: THREE.LineSegments | null = null;
  private trailPositions!: Float32Array;
  private trailColors!: Float32Array;

  // 靜態軌道線
  private staticTrackLine: THREE.LineSegments | null = null;
  private staticTrackGeo: THREE.BufferGeometry | null = null;
  private trackFeatures: GeoJSON.FeatureCollection | null = null;
  private needsStaticRebuild = false;

  // 列車位置歷史（用於拖尾）
  private positionHistory = new Map<string, Array<{ lng: number; lat: number; time: number; color: string }>>();
  private lastUpdateTime = 0;

  // 點擊拾取用
  private lastMatrix: THREE.Matrix4 | null = null;
  private trainPositions = new Map<number, RailTrain>(); // instanceIndex → train

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
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.instancedMesh = new THREE.InstancedMesh(geo, mat, this.maxInstances);
    this.instancedMesh.frustumCulled = false;
    this.instancedMesh.count = 0;
    this.instancedMesh.instanceColor = new THREE.InstancedBufferAttribute(
      new Float32Array(this.maxInstances * 3),
      3,
    );
    this.scene.add(this.instancedMesh);

    // 拖尾 LineSegments
    this.trailGeo = new THREE.BufferGeometry();
    this.trailPositions = new Float32Array(MAX_TRAIL_VERTICES * 3);
    this.trailColors = new Float32Array(MAX_TRAIL_VERTICES * 3);
    this.trailGeo.setAttribute("position", new THREE.BufferAttribute(this.trailPositions, 3));
    this.trailGeo.setAttribute("color", new THREE.BufferAttribute(this.trailColors, 3));
    this.trailGeo.setDrawRange(0, 0);

    const trailMat = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.trailLine = new THREE.LineSegments(this.trailGeo, trailMat);
    this.trailLine.frustumCulled = false;
    this.scene.add(this.trailLine);
  }

  /**
   * 設定靜態軌道 GeoJSON（建構 3D 線段）
   */
  setStaticTracks(geojson: GeoJSON.FeatureCollection) {
    this.trackFeatures = geojson;
    this.needsStaticRebuild = true;
  }

  /**
   * 設定軌道 Z 軸偏移（公尺）
   */
  setAltitudeOffset(offset: number) {
    if (this.altitudeOffset === offset) return;
    this.altitudeOffset = offset;
    this.needsStaticRebuild = true;
  }

  private buildStaticTracks() {
    // 移除舊的
    if (this.staticTrackLine) {
      this.scene.remove(this.staticTrackLine);
      this.staticTrackGeo?.dispose();
      (this.staticTrackLine.material as THREE.Material).dispose();
      this.staticTrackLine = null;
      this.staticTrackGeo = null;
    }

    if (!this.trackFeatures || this.trackFeatures.features.length === 0) return;

    // 計算所有線段頂點數
    let totalVertices = 0;
    for (const feature of this.trackFeatures.features) {
      const geom = feature.geometry;
      if (geom.type === "LineString") {
        totalVertices += (geom.coordinates.length - 1) * 2;
      } else if (geom.type === "MultiLineString") {
        for (const line of geom.coordinates) {
          totalVertices += (line.length - 1) * 2;
        }
      }
    }

    if (totalVertices === 0) return;

    const positions = new Float32Array(totalVertices * 3);
    const colors = new Float32Array(totalVertices * 3);
    let vi = 0;
    const alt = this.altitudeOffset;

    for (const feature of this.trackFeatures.features) {
      const geom = feature.geometry;
      const colorHex = (feature.properties?.color ?? "#ffffff") as string;
      const color = new THREE.Color(colorHex);
      if (this.isDarkTheme) {
        color.multiplyScalar(1.2);
      }

      const processLine = (coords: number[][]) => {
        for (let i = 0; i < coords.length - 1; i++) {
          const a = coords[i]!;
          const b = coords[i + 1]!;
          // GeoJSON coords: [lng, lat]
          const mcA = toMercator(a[1]!, a[0]!, alt);
          const mcB = toMercator(b[1]!, b[0]!, alt);

          positions[vi * 3] = mcA.x;
          positions[vi * 3 + 1] = mcA.y;
          positions[vi * 3 + 2] = mcA.z;
          colors[vi * 3] = color.r;
          colors[vi * 3 + 1] = color.g;
          colors[vi * 3 + 2] = color.b;
          vi++;

          positions[vi * 3] = mcB.x;
          positions[vi * 3 + 1] = mcB.y;
          positions[vi * 3 + 2] = mcB.z;
          colors[vi * 3] = color.r;
          colors[vi * 3 + 1] = color.g;
          colors[vi * 3 + 2] = color.b;
          vi++;
        }
      };

      if (geom.type === "LineString") {
        processLine(geom.coordinates);
      } else if (geom.type === "MultiLineString") {
        for (const line of geom.coordinates) {
          processLine(line);
        }
      }
    }

    this.staticTrackGeo = new THREE.BufferGeometry();
    this.staticTrackGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    this.staticTrackGeo.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: this.isDarkTheme ? 0.75 : 0.6,
      blending: this.isDarkTheme ? THREE.AdditiveBlending : THREE.NormalBlending,
      depthWrite: false,
    });
    this.staticTrackLine = new THREE.LineSegments(this.staticTrackGeo, mat);
    this.staticTrackLine.frustumCulled = false;
    this.scene.add(this.staticTrackLine);
  }

  setTheme(isDark: boolean) {
    if (this.isDarkTheme === isDark) return;
    this.isDarkTheme = isDark;
    this.colorCache.clear();
    if (this.instancedMesh) {
      const mat = this.instancedMesh.material as THREE.MeshBasicMaterial;
      mat.blending = isDark ? THREE.AdditiveBlending : THREE.NormalBlending;
      mat.opacity = isDark ? 0.9 : 0.75;
    }
    if (this.trailLine) {
      const mat = this.trailLine.material as THREE.LineBasicMaterial;
      mat.blending = isDark ? THREE.AdditiveBlending : THREE.NormalBlending;
      mat.opacity = isDark ? 0.7 : 0.45;
    }
    // 重建靜態軌道（顏色變了）
    this.needsStaticRebuild = true;
  }

  setOrbScale(scale: number) {
    this.orbScale = scale;
  }

  setTrackOpacity(opacity: number) {
    if (this.staticTrackLine) {
      (this.staticTrackLine.material as THREE.LineBasicMaterial).opacity = opacity;
    }
    if (this.trailLine) {
      (this.trailLine.material as THREE.LineBasicMaterial).opacity = opacity * 0.9;
    }
  }

  private getColor(hex: string): THREE.Color {
    let c = this.colorCache.get(hex);
    if (!c) {
      c = new THREE.Color(hex);
      if (this.isDarkTheme) {
        c.multiplyScalar(1.5);
      }
      this.colorCache.set(hex, c);
    }
    return c;
  }

  update(trains: RailTrain[], currentTime?: number) {
    if (!this.instancedMesh || !this.trailGeo) return;

    // 需要時重建靜態軌道
    if (this.needsStaticRebuild) {
      this.needsStaticRebuild = false;
      this.buildStaticTracks();
    }

    const now = currentTime ?? Date.now() / 1000;
    const alt = this.altitudeOffset;

    // 偵測時間跳轉
    if (Math.abs(now - this.lastUpdateTime) > 5 && this.lastUpdateTime > 0) {
      this.positionHistory.clear();
    }
    this.lastUpdateTime = now;

    const dummy = new THREE.Matrix4();
    const baseScale = this.orbScale * 0.5;
    let headCount = 0;
    let vi = 0;

    const positions = this.trailPositions;
    const colors = this.trailColors;

    // 記錄 TRA/THSR 列車位置到歷史
    for (const train of trains) {
      if (!TRAIL_SYSTEMS.has(train.systemId)) continue;

      const key = `${train.systemId}-${train.trainId}`;
      let history = this.positionHistory.get(key);
      if (!history) {
        history = [];
        this.positionHistory.set(key, history);
      }

      const lastEntry = history[history.length - 1];
      if (!lastEntry || now - lastEntry.time > 0.5) {
        history.push({
          lng: train.position[0],
          lat: train.position[1],
          time: now,
          color: train.color,
        });
      }

      const cutoff = now - TRAIL_DURATION;
      while (history.length > 0 && history[0]!.time < cutoff) {
        history.shift();
      }
    }

    // 清理不再活躍的列車歷史
    const activeKeys = new Set(
      trains
        .filter((t) => TRAIL_SYSTEMS.has(t.systemId))
        .map((t) => `${t.systemId}-${t.trainId}`),
    );
    for (const key of this.positionHistory.keys()) {
      if (!activeKeys.has(key)) {
        this.positionHistory.delete(key);
      }
    }

    // 渲染主光球
    this.trainPositions.clear();
    for (const train of trains) {
      if (headCount >= this.maxInstances) break;

      const [lng, lat] = train.position;
      if (lng === 0 && lat === 0) continue;

      const mc = toMercator(lat, lng, alt);
      const s = baseScale;

      dummy.makeScale(s, s, s);
      dummy.setPosition(mc.x, mc.y, mc.z);
      this.instancedMesh.setMatrixAt(headCount, dummy);

      const color = this.getColor(train.color);
      this.instancedMesh.instanceColor!.setXYZ(headCount, color.r, color.g, color.b);

      this.trainPositions.set(headCount, train);
      headCount++;
    }

    // 渲染 TRA/THSR 拖尾線段
    for (const [, history] of this.positionHistory) {
      if (history.length < 2 || vi >= MAX_TRAIL_VERTICES - history.length * 2) continue;

      for (let i = 0; i < history.length - 1; i++) {
        const entryA = history[i]!;
        const entryB = history[i + 1]!;
        const progressA = i / (history.length - 1);
        const progressB = (i + 1) / (history.length - 1);

        const mcA = toMercator(entryA.lat, entryA.lng, alt);
        const mcB = toMercator(entryB.lat, entryB.lng, alt);

        const colorObj = this.getColor(entryA.color);

        positions[vi * 3] = mcA.x;
        positions[vi * 3 + 1] = mcA.y;
        positions[vi * 3 + 2] = mcA.z;
        const bA = 0.15 + 0.85 * progressA;
        colors[vi * 3] = colorObj.r * bA;
        colors[vi * 3 + 1] = colorObj.g * bA;
        colors[vi * 3 + 2] = colorObj.b * bA;
        vi++;

        positions[vi * 3] = mcB.x;
        positions[vi * 3 + 1] = mcB.y;
        positions[vi * 3 + 2] = mcB.z;
        const bB = 0.15 + 0.85 * progressB;
        colors[vi * 3] = colorObj.r * bB;
        colors[vi * 3 + 1] = colorObj.g * bB;
        colors[vi * 3 + 2] = colorObj.b * bB;
        vi++;
      }
    }

    this.instancedMesh.count = headCount;
    this.instancedMesh.instanceMatrix.needsUpdate = true;
    if (this.instancedMesh.instanceColor) {
      (this.instancedMesh.instanceColor as THREE.InstancedBufferAttribute).needsUpdate = true;
    }

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

    this.lastMatrix = new THREE.Matrix4().fromArray(matrix);
    this.camera.projectionMatrix = this.lastMatrix.clone();
    this.renderer.resetState();
    this.renderer.render(this.scene, this.camera);
    this.renderer.resetState();

    if (blendEnabled) gl.enable(gl.BLEND);
    else gl.disable(gl.BLEND);
    gl.blendFuncSeparate(blendSrc, blendDst, blendSrcA, blendDstA);
  }

  /** 點擊拾取：螢幕座標 → 最近的 RailTrain */
  pickTrain(screenX: number, screenY: number, viewWidth: number, viewHeight: number): RailTrain | null {
    if (!this.lastMatrix || !this.instancedMesh) return null;

    const threshold = 25;
    let closest: { train: RailTrain; dist: number } | null = null;
    const mat = new THREE.Matrix4();

    for (const [idx, train] of this.trainPositions) {
      this.instancedMesh.getMatrixAt(idx, mat);
      const v = new THREE.Vector4(
        mat.elements[12], mat.elements[13], mat.elements[14], 1.0,
      );
      v.applyMatrix4(this.lastMatrix);
      if (v.w <= 0) continue;

      const sx = ((v.x / v.w) * 0.5 + 0.5) * viewWidth;
      const sy = ((-v.y / v.w) * 0.5 + 0.5) * viewHeight;
      const dist = Math.hypot(sx - screenX, sy - screenY);

      if (dist < threshold && (!closest || dist < closest.dist)) {
        closest = { train, dist };
      }
    }

    return closest?.train ?? null;
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
    if (this.staticTrackLine) {
      this.scene.remove(this.staticTrackLine);
      this.staticTrackGeo?.dispose();
      (this.staticTrackLine.material as THREE.Material).dispose();
      this.staticTrackLine = null;
      this.staticTrackGeo = null;
    }
    this.renderer?.dispose();
    this.colorCache.clear();
    this.positionHistory.clear();
  }
}
