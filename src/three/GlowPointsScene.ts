import * as THREE from "three";
import { toMercator } from "../utils/coordinates";

/**
 * 通用 Point bloom 場景 — 只吃 {lon, lat, colorHex, sizeNorm(0-1)}[]，不綁業務資料。
 *
 * 一支 Points draw call + 單 shader 疊 3 段 halo（core / mid / far）+ AdditiveBlending。
 * 相鄰點光暈疊加自然爆白，模仿 UnrealBloomPass 效果，零新依賴。
 *
 * 想 bloom 化任何 Point layer：轉成 GlowPoint[] 餵進來即可。
 * - 發電廠 → fuelColorOf(fuel_type) + capacity_mw normalize
 * - 變電所 → SUBSTATION_CLASS_COLORS + voltage
 * - 消防局 / 學校 / 任何 POI 皆可套
 */

export interface GlowPoint {
  lon: number;
  lat: number;
  colorHex: string;
  /** 0~1 之間的相對大小，映射到 MIN..MAX_POINT_SIZE 像素 */
  sizeNorm: number;
}

const MAX_POINT_COUNT = 4096;
const MIN_POINT_SIZE = 24;
const MAX_POINT_SIZE = 128;

const VERT = /* glsl */ `
attribute vec3 aColor;
attribute float aSize;
uniform float uPixelRatio;
uniform float uTime;
uniform float uZoomScale;   // 由 map.getZoom() 換算來，1.0 = 參考 zoom
uniform float uSizeMul;     // 使用者 slider，1.0 = 預設
varying vec3 vColor;
void main() {
  vColor = aColor;
  vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPos;
  float pulse = 0.9 + 0.1 * sin(uTime * 1.8 + position.x * 200.0);
  gl_PointSize = aSize * uPixelRatio * pulse * uZoomScale * uSizeMul;
}
`;

const FRAG = /* glsl */ `
precision highp float;
uniform float uOpacity;
uniform float uCoreBoost;
varying vec3 vColor;
void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float d = length(uv) * 2.0;
  if (d > 1.0) discard;
  float core = smoothstep(0.18, 0.0,  d);
  float mid  = smoothstep(0.55, 0.18, d) * 0.55;
  float far  = smoothstep(1.0,  0.55, d) * 0.22;
  float a = (core + mid + far) * uOpacity;
  vec3 col = mix(vColor, vec3(1.0), core * uCoreBoost);
  gl_FragColor = vec4(col, a);
}
`;

interface Instance {
  mc: { x: number; y: number; z: number };
  color: THREE.Color;
  sizePx: number;
}

export interface GlowPointsSceneOptions {
  minSizePx?: number;
  maxSizePx?: number;
  /** 0-1，中心推向白色的力道，越大越像爆光 */
  coreBoost?: number;
}

export class GlowPointsScene {
  private renderer!: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.Camera();
  private points: THREE.Points | null = null;
  private geometry: THREE.BufferGeometry | null = null;
  private material: THREE.ShaderMaterial | null = null;
  private instances: Instance[] = [];
  private ownsRenderer = false;
  private startTime = performance.now();
  private minSize: number;
  private maxSize: number;
  private coreBoost: number;

  constructor(opts: GlowPointsSceneOptions = {}) {
    this.minSize = opts.minSizePx ?? MIN_POINT_SIZE;
    this.maxSize = opts.maxSizePx ?? MAX_POINT_SIZE;
    this.coreBoost = opts.coreBoost ?? 0.85;
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
    this.buildMesh();
  }

  private buildMesh() {
    this.disposeMesh();
    this.geometry = new THREE.BufferGeometry();
    const pos = new Float32Array(MAX_POINT_COUNT * 3);
    const col = new Float32Array(MAX_POINT_COUNT * 3);
    const size = new Float32Array(MAX_POINT_COUNT);
    this.geometry.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    this.geometry.setAttribute("aColor", new THREE.BufferAttribute(col, 3));
    this.geometry.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
    this.geometry.setDrawRange(0, 0);
    this.geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), Infinity);

    this.material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        uOpacity: { value: 0.9 },
        uTime: { value: 0 },
        uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) },
        uCoreBoost: { value: this.coreBoost },
        uZoomScale: { value: 1 },
        uSizeMul: { value: 1 },
      },
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
    });

    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false;
    this.scene.add(this.points);
  }

  setData(rows: GlowPoint[]) {
    if (!this.geometry) return;
    const filtered = rows.filter(
      (r) => Number.isFinite(r.lon) && Number.isFinite(r.lat),
    );
    this.instances = filtered.slice(0, MAX_POINT_COUNT).map((r) => {
      const mc = toMercator(r.lat, r.lon, 0);
      const norm = Math.max(0, Math.min(1, r.sizeNorm));
      const sizePx = this.minSize + (this.maxSize - this.minSize) * norm;
      return {
        mc,
        color: new THREE.Color(r.colorHex),
        sizePx,
      };
    });

    const posAttr = this.geometry.getAttribute("position") as THREE.BufferAttribute;
    const colAttr = this.geometry.getAttribute("aColor") as THREE.BufferAttribute;
    const sizeAttr = this.geometry.getAttribute("aSize") as THREE.BufferAttribute;

    for (let i = 0; i < this.instances.length; i++) {
      const p = this.instances[i]!;
      posAttr.setXYZ(i, p.mc.x, p.mc.y, p.mc.z);
      colAttr.setXYZ(i, p.color.r, p.color.g, p.color.b);
      sizeAttr.setX(i, p.sizePx);
    }
    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
    sizeAttr.needsUpdate = true;
    this.geometry.setDrawRange(0, this.instances.length);
  }

  setOpacity(o: number) {
    if (!this.material) return;
    this.material.uniforms.uOpacity!.value = Math.max(0, Math.min(1, o));
  }

  /** Mapbox zoom → 光暈縮放（zoom < REF 縮小、> REF 放大） */
  setZoom(zoom: number, referenceZoom = 10) {
    if (!this.material) return;
    // zoom 每 -1 光暈 ×0.6，zoom 每 +1 光暈 ×1.4；clamp 避免極端
    const raw = Math.pow(1.5, zoom - referenceZoom);
    this.material.uniforms.uZoomScale!.value = Math.max(0.15, Math.min(3.5, raw));
  }

  setSizeMul(m: number) {
    if (!this.material) return;
    this.material.uniforms.uSizeMul!.value = Math.max(0.1, Math.min(5, m));
  }

  setCoreBoost(b: number) {
    if (!this.material) return;
    this.coreBoost = Math.max(0, Math.min(1, b));
    this.material.uniforms.uCoreBoost!.value = this.coreBoost;
  }

  setVisible(v: boolean) {
    if (this.points) this.points.visible = v;
  }

  render(matrix: number[]): boolean {
    if (!this.material) return false;
    const gl = this.renderer.getContext();
    const blendEnabled = gl.isEnabled(gl.BLEND);
    const blendSrc = gl.getParameter(gl.BLEND_SRC_RGB);
    const blendDst = gl.getParameter(gl.BLEND_DST_RGB);
    const blendSrcA = gl.getParameter(gl.BLEND_SRC_ALPHA);
    const blendDstA = gl.getParameter(gl.BLEND_DST_ALPHA);

    this.camera.projectionMatrix = new THREE.Matrix4().fromArray(matrix);
    this.material.uniforms.uTime!.value = (performance.now() - this.startTime) / 1000;

    this.renderer.resetState();
    this.renderer.render(this.scene, this.camera);
    this.renderer.resetState();

    if (blendEnabled) gl.enable(gl.BLEND);
    else gl.disable(gl.BLEND);
    gl.blendFuncSeparate(blendSrc, blendDst, blendSrcA, blendDstA);

    return true;
  }

  private disposeMesh() {
    if (this.points) {
      this.scene.remove(this.points);
      this.points = null;
    }
    if (this.geometry) {
      this.geometry.dispose();
      this.geometry = null;
    }
    if (this.material) {
      this.material.dispose();
      this.material = null;
    }
  }

  dispose() {
    this.disposeMesh();
    if (this.ownsRenderer) this.renderer?.dispose();
  }
}
