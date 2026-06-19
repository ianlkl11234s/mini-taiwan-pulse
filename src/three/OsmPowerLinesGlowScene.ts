/**
 * OsmPowerLinesGlowScene
 * Three.js custom layer scene 畫高壓輸電線的 emissive bloom 效果。
 *
 * 核心做法：
 *  - 每段 line segment 一個 instance（InstancedBufferGeometry quad expansion）
 *  - vertex shader 把 segment 展成 fat-line quad（with constant pixel width）
 *  - fragment shader 用 exponential falloff + 亮中心做 emissive bloom 視覺
 *  - tier 分 4 個 mesh + AdditiveBlending → 重疊處更亮
 *  - 每 tier 還畫 2 pass（halo wide + core narrow）強化光暈漸層
 *
 * 取代 Mapbox 4 層 stacking 的 line-blur 方案；Mapbox 端只留 transparent core 給 hit-test。
 */
import * as THREE from "three";
import mapboxgl from "mapbox-gl";

export interface PowerLineFeature {
  /** [[lng, lat], ...] */
  coords: [number, number][];
  /** 345 / 161 / 69 / 0 */
  tier: number;
}

interface TierMesh {
  meshHalo: THREE.Mesh;
  meshCore: THREE.Mesh;
  materialHalo: THREE.ShaderMaterial;
  materialCore: THREE.ShaderMaterial;
  geometry: THREE.InstancedBufferGeometry;
}

const TIER_COLORS: Record<number, THREE.Color> = {
  345: new THREE.Color("#1AB6D9"),
  161: new THREE.Color("#62D9AD"),
  69:  new THREE.Color("#468BA6"),
  0:   new THREE.Color("#DFE0DC"),
};

/** tier → [halo px width @zoom14, core px width @zoom14] base，
 *  跟 useTransportParams.osmPowerLinesWidth slider 相乘
 */
const TIER_WIDTH_PX: Record<number, [number, number]> = {
  345: [40, 4],
  161: [26, 2.6],
  69:  [18, 1.8],
  0:   [12, 1.2],
};

const VERTEX_SHADER = `
attribute vec2 instancePosA;
attribute vec2 instancePosB;
attribute float across;   // -1 or +1
attribute float along;    // 0 or 1

uniform mat4 uMatrix;
uniform vec2 uResolution;
uniform float uHalfWidthPx;

varying float vAcross;

void main() {
  vec2 pos    = mix(instancePosA, instancePosB, along);
  vec2 other  = mix(instancePosB, instancePosA, along);
  vec4 clip   = uMatrix * vec4(pos,   0.0, 1.0);
  vec4 clipO  = uMatrix * vec4(other, 0.0, 1.0);
  vec2 ndcS   = clip.xy  / clip.w;
  vec2 ndcO   = clipO.xy / clipO.w;
  vec2 dPx    = (ndcO - ndcS) * uResolution * 0.5;
  // dPx points from self → other; we need normal (perpendicular)
  vec2 dn     = length(dPx) > 1e-6 ? dPx / length(dPx) : vec2(1.0, 0.0);
  vec2 normalPx = vec2(-dn.y, dn.x) * across * uHalfWidthPx;
  // shift in clip space by px
  vec2 offsetNdc = (normalPx / uResolution) * 2.0;
  clip.xy += offsetNdc * clip.w;
  gl_Position = clip;
  vAcross = across;
}
`;

const FRAGMENT_SHADER = `
precision highp float;
uniform vec3 uColor;
uniform float uOpacity;
uniform float uFalloff;   // 越大越窄核
uniform float uBoost;     // 中心提亮（emissive feel）

varying float vAcross;

void main() {
  float t = abs(vAcross);
  float a = exp(-t * t * uFalloff);
  // 中心 emissive boost
  float boost = uBoost * exp(-t * t * 10.0);
  vec3 col = clamp(uColor + vec3(boost), 0.0, 1.6);
  gl_FragColor = vec4(col * (0.5 + 0.5 * a), a * uOpacity);
}
`;

export class OsmPowerLinesGlowScene {
  private renderer!: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.Camera();
  private tierMeshes = new Map<number, TierMesh>();
  private ownsRenderer = false;
  private opacity = 0.4;
  private widthMul = 1;
  private visible = true;

  init(glOrRenderer: WebGLRenderingContext | THREE.WebGLRenderer) {
    if (glOrRenderer instanceof THREE.WebGLRenderer) {
      this.renderer = glOrRenderer;
      this.ownsRenderer = false;
    } else {
      this.renderer = new THREE.WebGLRenderer({
        canvas: (glOrRenderer as WebGLRenderingContext).canvas as HTMLCanvasElement,
        context: glOrRenderer as unknown as WebGL2RenderingContext,
        antialias: true,
      });
      this.renderer.autoClear = false;
      this.ownsRenderer = true;
    }
  }

  setVisible(v: boolean) { this.visible = v; }
  setOpacity(o: number) { this.opacity = o; }
  setWidthMul(w: number) { this.widthMul = w; }

  /** 傳入所有 polyline，按 tier group 後展成 segment instances */
  setData(features: PowerLineFeature[]) {
    // Dispose existing
    for (const t of this.tierMeshes.values()) {
      this.scene.remove(t.meshHalo);
      this.scene.remove(t.meshCore);
      t.geometry.dispose();
      t.materialHalo.dispose();
      t.materialCore.dispose();
    }
    this.tierMeshes.clear();

    // Group segments by tier
    const segsByTier = new Map<number, { a: number[]; b: number[] }>();
    const getBucket = (tier: number) => {
      let s = segsByTier.get(tier);
      if (!s) { s = { a: [], b: [] }; segsByTier.set(tier, s); }
      return s;
    };

    for (const f of features) {
      const tier = TIER_COLORS[f.tier] ? f.tier : 0;
      const bucket = getBucket(tier);
      const coords = f.coords;
      for (let i = 0; i < coords.length - 1; i++) {
        const [lngA, latA] = coords[i]!;
        const [lngB, latB] = coords[i + 1]!;
        if (!Number.isFinite(lngA) || !Number.isFinite(lngB)) continue;
        const mcA = mapboxgl.MercatorCoordinate.fromLngLat([lngA, latA], 0);
        const mcB = mapboxgl.MercatorCoordinate.fromLngLat([lngB, latB], 0);
        bucket.a.push(mcA.x, mcA.y);
        bucket.b.push(mcB.x, mcB.y);
      }
    }

    for (const [tier, bucket] of segsByTier) {
      const count = bucket.a.length / 2;
      if (count === 0) continue;

      const color = TIER_COLORS[tier] ?? TIER_COLORS[0]!;
      const [haloW, coreW] = TIER_WIDTH_PX[tier] ?? TIER_WIDTH_PX[0]!;

      // 4-vertex quad: across=[-1,+1,-1,+1], along=[0,0,1,1]
      const acrossArr = new Float32Array([-1, 1, -1, 1]);
      const alongArr  = new Float32Array([ 0, 0, 1, 1]);
      const indices = new Uint16Array([0, 1, 2, 2, 1, 3]);

      const geo = new THREE.InstancedBufferGeometry();
      geo.instanceCount = count;
      geo.setAttribute("across", new THREE.BufferAttribute(acrossArr, 1));
      geo.setAttribute("along",  new THREE.BufferAttribute(alongArr, 1));
      geo.setIndex(new THREE.BufferAttribute(indices, 1));
      geo.setAttribute("instancePosA", new THREE.InstancedBufferAttribute(new Float32Array(bucket.a), 2));
      geo.setAttribute("instancePosB", new THREE.InstancedBufferAttribute(new Float32Array(bucket.b), 2));
      // 自訂 bounding 避免 frustum cull 整批
      geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0.5, 0.5, 0), 2);
      geo.boundingBox = new THREE.Box3(
        new THREE.Vector3(-1, -1, -1),
        new THREE.Vector3(2, 2, 1),
      );

      const baseUniforms = () => ({
        uMatrix:       { value: new THREE.Matrix4() },
        uResolution:   { value: new THREE.Vector2(1, 1) },
        uColor:        { value: color.clone() },
        uOpacity:      { value: 1.0 },
        uHalfWidthPx:  { value: 1.0 },
        uFalloff:      { value: 3.5 },
        uBoost:        { value: 0.0 },
      });

      const haloU = baseUniforms();
      haloU.uHalfWidthPx.value = haloW * 0.5;
      haloU.uFalloff.value = 2.2;   // 寬而柔
      haloU.uBoost.value = 0.0;

      const coreU = baseUniforms();
      coreU.uHalfWidthPx.value = coreW * 0.5;
      coreU.uFalloff.value = 10.0;  // 窄而實
      coreU.uBoost.value = 0.6;     // 中心提亮模擬發光

      const materialHalo = new THREE.ShaderMaterial({
        vertexShader: VERTEX_SHADER,
        fragmentShader: FRAGMENT_SHADER,
        uniforms: haloU,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const materialCore = new THREE.ShaderMaterial({
        vertexShader: VERTEX_SHADER,
        fragmentShader: FRAGMENT_SHADER,
        uniforms: coreU,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });

      const meshHalo = new THREE.Mesh(geo, materialHalo);
      const meshCore = new THREE.Mesh(geo, materialCore);
      meshHalo.frustumCulled = false;
      meshCore.frustumCulled = false;
      meshHalo.renderOrder = 0; // halo 先
      meshCore.renderOrder = 1;
      this.scene.add(meshHalo);
      this.scene.add(meshCore);
      this.tierMeshes.set(tier, { meshHalo, meshCore, materialHalo, materialCore, geometry: geo });
    }
  }

  render(matrix: number[]) {
    if (!this.visible) return;
    const canvas = this.renderer.domElement;
    const w = canvas.width;
    const h = canvas.height;
    const mvp = new THREE.Matrix4().fromArray(matrix);
    for (const t of this.tierMeshes.values()) {
      const uh = t.materialHalo.uniforms as Record<string, { value: unknown }>;
      const uc = t.materialCore.uniforms as Record<string, { value: unknown }>;
      uh.uMatrix!.value = mvp;
      (uh.uResolution!.value as THREE.Vector2).set(w, h);
      uh.uOpacity!.value = this.opacity;
      const [haloW, coreW] = TIER_WIDTH_PX[
        this.findTierByColor(uh.uColor!.value as THREE.Color)
      ] ?? TIER_WIDTH_PX[0]!;
      uh.uHalfWidthPx!.value = haloW * 0.5 * this.widthMul;
      uc.uMatrix!.value = mvp;
      (uc.uResolution!.value as THREE.Vector2).set(w, h);
      uc.uOpacity!.value = Math.min(1, this.opacity * 1.6);
      uc.uHalfWidthPx!.value = coreW * 0.5 * this.widthMul;
    }
    // Save & restore GL state
    const gl = this.renderer.getContext();
    const blendEnabled = gl.isEnabled(gl.BLEND);
    const blendSrc = gl.getParameter(gl.BLEND_SRC_RGB);
    const blendDst = gl.getParameter(gl.BLEND_DST_RGB);
    const blendSrcA = gl.getParameter(gl.BLEND_SRC_ALPHA);
    const blendDstA = gl.getParameter(gl.BLEND_DST_ALPHA);

    this.renderer.resetState();
    this.renderer.render(this.scene, this.camera);
    this.renderer.resetState();

    if (blendEnabled) gl.enable(gl.BLEND); else gl.disable(gl.BLEND);
    gl.blendFuncSeparate(blendSrc, blendDst, blendSrcA, blendDstA);
  }

  /** Reverse-lookup tier 從 color value（為 slider rebuild 時找原 base width）*/
  private findTierByColor(c: THREE.Color): number {
    for (const [tier, col] of Object.entries(TIER_COLORS)) {
      if (col.equals(c)) return Number(tier);
    }
    return 0;
  }

  dispose() {
    for (const t of this.tierMeshes.values()) {
      this.scene.remove(t.meshHalo);
      this.scene.remove(t.meshCore);
      t.geometry.dispose();
      t.materialHalo.dispose();
      t.materialCore.dispose();
    }
    this.tierMeshes.clear();
    if (this.ownsRenderer) this.renderer?.dispose();
  }
}
