import * as THREE from "three";
import { toMercator, getAltOffset, setAltOffset, getAltExaggeration, setAltExaggeration } from "../utils/coordinates";

export interface StationPillarData {
  position: [number, number]; // [lng, lat]
  height: number;             // 正規化 (大站=1, 小站=0.4)
}

const BASE_HEIGHT = 0.0004; // Mercator 單位中的基礎高度（≈ 14km 視覺高度）
const RADIUS = 0.000005;    // 柱體半徑

/**
 * 車站光柱場景 — 每個車站渲染一條垂直發光柱
 * 大站高、小站矮，半透明暖白色
 * 使用 InstancedMesh 單一 draw call 渲染所有光柱
 */
export class StationPillarScene {
  private renderer!: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.Camera();
  private instancedMesh: THREE.InstancedMesh | null = null;
  private pillarData: StationPillarData[] = [];
  private mercatorPositions: { x: number; y: number; z: number }[] = [];
  private heightScale = 1;
  private isDark = true;
  private colorDark: number;
  private colorLight: number;
  private ownsRenderer = false;

  constructor(colorDark = 0xfff5e0, colorLight = 0xb8a070) {
    this.colorDark = colorDark;
    this.colorLight = colorLight;
  }

  init(glOrRenderer: WebGLRenderingContext | THREE.WebGLRenderer) {
    if (glOrRenderer instanceof THREE.WebGLRenderer) {
      this.renderer = glOrRenderer;
      this.ownsRenderer = false;
    } else {
      this.renderer = new THREE.WebGLRenderer({
        canvas: glOrRenderer.canvas as HTMLCanvasElement,
        context: glOrRenderer as unknown as WebGL2RenderingContext,
        antialias: true,
      });
      this.renderer.autoClear = false;
      this.ownsRenderer = true;
    }
  }

  setPositions(data: StationPillarData[]) {
    this.pillarData = data;

    // 暫存並重置全域 altOffset/altExaggeration，避免飛機 render loop 的值影響光柱 z 軸
    const savedOffset = getAltOffset();
    const savedExag = getAltExaggeration();
    setAltOffset(0);
    setAltExaggeration(1);

    this.mercatorPositions = data.map(({ position }) => {
      const [lng, lat] = position;
      return toMercator(lat, lng, 0);
    });

    // 還原全域狀態
    setAltOffset(savedOffset);
    setAltExaggeration(savedExag);

    this.rebuild();
  }

  private rebuild() {
    if (this.instancedMesh) {
      this.scene.remove(this.instancedMesh);
      this.instancedMesh.geometry.dispose();
      (this.instancedMesh.material as THREE.Material).dispose();
      this.instancedMesh = null;
    }

    const count = this.pillarData.length;
    if (count === 0) return;

    // 單位圓柱（高度 1），沿 Y 軸，旋轉到 Z 軸（垂直向上）
    const geo = new THREE.CylinderGeometry(RADIUS, RADIUS * 0.3, 1, 5);
    geo.rotateX(Math.PI / 2);

    const mat = new THREE.MeshBasicMaterial({
      color: this.isDark ? this.colorDark : this.colorLight,
      transparent: true,
      opacity: this.isDark ? 0.35 : 0.45,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    this.instancedMesh = new THREE.InstancedMesh(geo, mat, count);
    this.updateInstanceMatrices();
    this.scene.add(this.instancedMesh);
  }

  private updateInstanceMatrices() {
    if (!this.instancedMesh) return;

    const temp = new THREE.Matrix4();
    const scaleMat = new THREE.Matrix4();

    for (let i = 0; i < this.pillarData.length; i++) {
      const mc = this.mercatorPositions[i]!;
      const h = BASE_HEIGHT * this.pillarData[i]!.height * this.heightScale;

      // 平移到光柱中心點（底部在 mc.z，頂部在 mc.z + h）
      temp.makeTranslation(mc.x, mc.y, mc.z + h / 2);
      scaleMat.makeScale(1, 1, h);
      temp.multiply(scaleMat);

      this.instancedMesh.setMatrixAt(i, temp);
    }
    this.instancedMesh.instanceMatrix.needsUpdate = true;
  }

  setPillarVisible(v: boolean) {
    if (this.instancedMesh) this.instancedMesh.visible = v;
  }

  setPillarHeight(scale: number) {
    if (scale !== this.heightScale) {
      this.heightScale = scale;
      this.updateInstanceMatrices();
    }
  }

  setTheme(isDark: boolean) {
    if (isDark === this.isDark) return;
    this.isDark = isDark;
    if (this.instancedMesh) {
      const m = this.instancedMesh.material as THREE.MeshBasicMaterial;
      m.color.setHex(isDark ? this.colorDark : this.colorLight);
      m.opacity = isDark ? 0.35 : 0.45;
    }
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

    // 還原 Mapbox GL blend state
    if (blendEnabled) gl.enable(gl.BLEND);
    else gl.disable(gl.BLEND);
    gl.blendFuncSeparate(blendSrc, blendDst, blendSrcA, blendDstA);
  }

  dispose() {
    if (this.instancedMesh) {
      this.scene.remove(this.instancedMesh);
      this.instancedMesh.geometry.dispose();
      (this.instancedMesh.material as THREE.Material).dispose();
      this.instancedMesh = null;
    }
    if (this.ownsRenderer) this.renderer?.dispose();
  }
}
