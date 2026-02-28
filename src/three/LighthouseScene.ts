import * as THREE from "three";
import { toMercator } from "../utils/coordinates";

/**
 * 燈塔光束場景 — 每座燈塔渲染旋轉的半透明錐形光束
 */
export class LighthouseScene {
  private renderer!: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.Camera();
  private beamGroups: THREE.Group[] = [];
  private elapsedAngle = 0;
  private lastRenderTime = Date.now();
  playing = true;

  init(gl: WebGLRenderingContext) {
    this.renderer = new THREE.WebGLRenderer({
      canvas: gl.canvas as HTMLCanvasElement,
      context: gl as unknown as WebGL2RenderingContext,
      antialias: true,
    });
    this.renderer.autoClear = false;
  }

  setPositions(positions: [number, number][]) {
    // 清除舊光束
    for (const group of this.beamGroups) {
      this.scene.remove(group);
      group.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          (obj.material as THREE.Material).dispose();
        }
      });
    }
    this.beamGroups = [];

    const beamMaterial = new THREE.MeshBasicMaterial({
      color: 0xfff8e0,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide,
      depthWrite: false,
    });


    for (const [lng, lat] of positions) {
      const group = new THREE.Group();

      // 將 [lng, lat] 轉為 Mercator 座標（toMercator 參數為 lat, lng, alt）
      const mc = toMercator(lat, lng, 50);
      group.position.set(mc.x, mc.y, mc.z);

      // 光束錐體 — 尖端在燈塔，寬端向外擴散
      const coneGeo = new THREE.ConeGeometry(0.000015, 0.0002, 16, 1, true);
      const cone = new THREE.Mesh(coneGeo, beamMaterial.clone());
      cone.rotation.z = Math.PI / 2;
      cone.position.x = 0.0001;
      group.add(cone);

      this.scene.add(group);
      this.beamGroups.push(group);
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

    // 更新每個光束的旋轉（暫停時凍結角度）
    const now = Date.now();
    if (this.playing) {
      const dt = (now - this.lastRenderTime) / 1000;
      this.elapsedAngle += dt * 0.27;
    }
    this.lastRenderTime = now;

    for (let i = 0; i < this.beamGroups.length; i++) {
      const group = this.beamGroups[i]!;
      group.rotation.z = this.elapsedAngle + i * 0.5;
    }

    this.renderer.resetState();
    this.renderer.render(this.scene, this.camera);
    this.renderer.resetState();

    // 還原 Mapbox GL blend state
    if (blendEnabled) gl.enable(gl.BLEND);
    else gl.disable(gl.BLEND);
    gl.blendFuncSeparate(blendSrc, blendDst, blendSrcA, blendDstA);
  }

  dispose() {
    for (const group of this.beamGroups) {
      this.scene.remove(group);
      group.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          (obj.material as THREE.Material).dispose();
        }
      });
    }
    this.beamGroups = [];
    this.renderer?.dispose();
  }
}
