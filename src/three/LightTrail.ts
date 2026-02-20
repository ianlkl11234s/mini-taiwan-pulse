import * as THREE from "three";
import type { TrailPoint } from "../types";
import { toMercator } from "../utils/coordinates";

import trailVert from "./shaders/trail.vert?raw";
import trailFrag from "./shaders/trail.frag?raw";

/**
 * 光軌：漸層透明的彗尾效果
 * 使用自訂 shader 實現從尾端到前端的 alpha 漸變
 */
export class LightTrail {
  mesh: THREE.Line;
  private geometry: THREE.BufferGeometry;
  private material: THREE.ShaderMaterial;
  private maxPoints: number;

  constructor(color: THREE.Color = new THREE.Color(0.4, 0.7, 1.0), maxPoints = 512) {
    this.maxPoints = maxPoints;

    this.geometry = new THREE.BufferGeometry();
    // 預分配 buffer
    const positions = new Float32Array(maxPoints * 3);
    const progress = new Float32Array(maxPoints);
    this.geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    this.geometry.setAttribute("progress", new THREE.BufferAttribute(progress, 1));
    this.geometry.setDrawRange(0, 0);

    this.material = new THREE.ShaderMaterial({
      vertexShader: trailVert,
      fragmentShader: trailFrag,
      uniforms: {
        uColor: { value: color },
        uOpacity: { value: 0.8 },
      },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.mesh = new THREE.Line(this.geometry, this.material);
    this.mesh.frustumCulled = false;
  }

  /** 更新軌跡點 */
  updateTrail(trail: TrailPoint[]) {
    const count = Math.min(trail.length, this.maxPoints);
    if (count < 2) {
      this.geometry.setDrawRange(0, 0);
      return;
    }

    const posAttr = this.geometry.getAttribute("position") as THREE.BufferAttribute;
    const progAttr = this.geometry.getAttribute("progress") as THREE.BufferAttribute;

    for (let i = 0; i < count; i++) {
      const pt = trail[i]!;
      const mc = toMercator(pt[0], pt[1], pt[2]);
      posAttr.setXYZ(i, mc.x, mc.y, mc.z);
      // progress: 0（最舊） → 1（最新）
      progAttr.setX(i, count > 1 ? i / (count - 1) : 1);
    }

    posAttr.needsUpdate = true;
    progAttr.needsUpdate = true;
    this.geometry.setDrawRange(0, count);
  }

  setColor(color: THREE.Color) {
    this.material.uniforms["uColor"]!.value = color;
  }

  setOpacity(opacity: number) {
    this.material.uniforms["uOpacity"]!.value = opacity;
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
  }
}
