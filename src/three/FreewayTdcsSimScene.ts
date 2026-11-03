/**
 * 雙北國道逐車模擬 scene（Mapbox shared-context，無私有 canvas；寫法同 GfwV4TrackScene）。
 * - 拖尾：每一小段一筆 instance，vertex shader 投影兩端後在螢幕空間撐成可調寬度的四邊形
 *   （WebGL 線寬固定 1 px，原型的「線寬」靠這個做到）。每塊（60 秒）只建一次 buffer，每幀只改 uniform。
 * - 高度：每節點一個高度（m，已乘地形誇張倍率）放在浮點貼圖，shader 依節點參照內插；
 *   地圖地形載入或倍率改變時只更新貼圖，不重建拖尾。
 * - 顏色：頂點只帶車速索引與車種，shader 依模式查表（車速 256 階貼圖／車種五色 uniform），換色不重建。
 * - 車頭：Points（中景），位置由 CPU 每幀內插；近景改畫 3D 長方體車（instanced box）。
 * 頂點存「相對投影原點」的 Mercator 座標，原點平移在 JS（double）併進投影矩陣，避免 float32 精度不足。
 */
import * as THREE from "three";

const COMMON = /* glsl */ `
uniform sampler2D uLut;
uniform vec3 uVt[5];
uniform float uMode;
vec3 carColor(vec2 ci) {
  if (uMode > 0.5) return uVt[int(ci.y + 0.5)];
  return texelFetch(uLut, ivec2(int(ci.x + 0.5), 0), 0).rgb;
}
`;
const HEIGHT = /* glsl */ `
uniform sampler2D uH;
uniform float uHW;
uniform float uMpu;
uniform float uLift;
float hAt(float i) {
  int ii = int(i + 0.5), w = int(uHW);
  return texelFetch(uH, ivec2(ii - (ii / w) * w, ii / w), 0).r;
}
float zRef(float r) {
  float i = floor(r);
  return mix(hAt(i), hAt(i + 1.0), r - i) * uMpu + uLift;
}
`;

const TRAIL_VS = /* glsl */ `
attribute vec4 aA;
attribute vec4 aB;
attribute vec4 aC;
uniform float uNow;
uniform float uWidth;
uniform vec2 uViewport;
${COMMON}
${HEIGHT}
varying float vAge;
varying vec3 vColor;
varying float vHide;
void main() {
  bool atA = position.x < 0.5;
  vec4 P = atA ? aA : aB;
  vec4 Q = atA ? aB : aA;
  vec4 cP = projectionMatrix * vec4(P.xy, zRef(P.z), 1.0);
  vec4 cQ = projectionMatrix * vec4(Q.xy, zRef(Q.z), 1.0);
  vec2 sP = cP.xy / cP.w * uViewport, sQ = cQ.xy / cQ.w * uViewport;
  vec2 d = atA ? sQ - sP : sP - sQ;
  float L = length(d);
  vec2 n = L > 1e-6 ? vec2(-d.y, d.x) / L : vec2(0.0, 1.0);
  cP.xy += n * position.y * uWidth / uViewport * cP.w;
  gl_Position = cP;
  vAge = uNow - P.w;
  vColor = carColor(aC.xy);
  vHide = aC.z;
}`;
const TRAIL_FS = /* glsl */ `
uniform float uTrail;
uniform float uOpacity;
uniform float uShowTun;
varying float vAge;
varying vec3 vColor;
varying float vHide;
void main() {
  if ((vHide > 0.5 && uShowTun < 0.5) || vAge < 0.0 || vAge > uTrail) discard;
  float a = 1.0 - vAge / uTrail;
  gl_FragColor = vec4(vColor, a * uOpacity);
}`;

const HEAD_VS = /* glsl */ `
attribute vec2 aCI;
attribute float aSel;
uniform float uSize;
uniform float uNear;
uniform float uPulse;
uniform float uDpr;
${COMMON}
varying vec3 vColor;
varying float vSel;
varying float vRad;
void main() {
  vColor = carColor(aCI);
  vSel = aSel;
  if (uNear > 0.5 && aSel < 0.5) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; return; }
  // 跟隨中的車：黃色脈動光暈（半徑 26–36 px）＋白圈（原型同款）
  float s = aSel > 0.5 ? 2.0 * (26.0 + 10.0 * uPulse) * uDpr : uSize;
  gl_PointSize = s;
  vRad = s * 0.5;
  gl_Position = projectionMatrix * vec4(position, 1.0);
  // 跟隨光暈是平面圖示：畫在最前面，避免下半圈被鏡頭前方的地形深度切掉（隧道內也標得出位置）
  if (aSel > 0.5) gl_Position.z = -0.999 * gl_Position.w;
}`;
const HEAD_FS = /* glsl */ `
uniform float uOpacity;
uniform vec3 uStroke;
uniform float uSize;
uniform float uPulse;
uniform float uDpr;
uniform float uNear;
varying vec3 vColor;
varying float vSel;
varying float vRad;
void main() {
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  float r = length(p);
  if (r > 1.0) discard;
  if (vSel > 0.5) {
    float rpx = r * vRad;
    float ring = 13.0 * uDpr, core = uNear > 0.5 ? 0.0 : max(uSize * 0.6, 4.0 * uDpr);
    if (rpx < core) { gl_FragColor = vec4(vColor, 1.0); return; }
    if (abs(rpx - ring) < 1.5 * uDpr) { gl_FragColor = vec4(1.0); return; }
    float a = (0.35 + 0.27 * uPulse) * (1.0 - rpx / vRad);
    gl_FragColor = vec4(0.98, 0.8, 0.08, a);
    return;
  }
  // 其餘：底圖色細描邊（map-layers P-2）
  vec3 c = r > 0.72 ? uStroke : vColor;
  gl_FragColor = vec4(c, uOpacity);
}`;

const CAR_VS = /* glsl */ `
attribute vec4 aI;
attribute vec2 aCI;
uniform vec3 uDim[5];
uniform float uMpu;
${COMMON}
varying vec3 vColor;
varying float vShade;
void main() {
  vec3 dim = uDim[int(aCI.y + 0.5)];
  vec3 p = position * dim;
  float c = cos(aI.w), s = sin(aI.w);
  vec2 r = vec2(c * p.x - s * p.y, s * p.x + c * p.y);
  vec3 nrm = vec3(c * normal.x - s * normal.y, s * normal.x + c * normal.y, normal.z);
  vShade = 0.5 + 0.5 * max(dot(nrm, normalize(vec3(0.35, -0.45, 0.82))), 0.0);
  vColor = carColor(aCI);
  gl_Position = projectionMatrix * vec4(aI.xy + r * uMpu, aI.z + p.z * uMpu, 1.0);
}`;
const CAR_FS = /* glsl */ `
uniform float uOpacity;
varying vec3 vColor;
varying float vShade;
void main() {
  gl_FragColor = vec4(vColor * vShade, uOpacity);
}`;

export interface FreewayTdcsFrame {
  now: number;
  trail: number;
  trailOpacity: number;
  widthPx: number;
  opacity: number;
  sizePx: number;
  headCount: number;
  carCount: number;
  near: boolean;
  isDark: boolean;
  pulse: number;
}

export class FreewayTdcsSimScene {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.Camera();
  private renderer: THREE.WebGLRenderer | null = null;
  private readonly m = new THREE.Matrix4();
  private readonly t = new THREE.Matrix4();
  private readonly trailMat: THREE.ShaderMaterial;
  private readonly headMat: THREE.ShaderMaterial;
  private readonly carMat: THREE.ShaderMaterial;
  private trailGeom: THREE.InstancedBufferGeometry | null = null;
  private trailMesh: THREE.Mesh | null = null;
  private trailKey = "";
  private readonly headGeom = new THREE.BufferGeometry();
  private readonly headPoints: THREE.Points;
  private readonly carGeom: THREE.InstancedBufferGeometry;
  private readonly carMesh: THREE.Mesh;
  /** 車頭：相對原點 Mercator xyz（z 已含路面高度） */
  readonly headPos: Float32Array;
  /** 車頭顏色索引：[車速索引, 車種] */
  readonly headCI: Float32Array;
  readonly headSel: Float32Array;
  /** 3D 車：[x, y, z, 方位角（Mercator 平面，rad）]＋[車速索引, 車種] */
  readonly carI: Float32Array;
  readonly carCI: Float32Array;
  private readonly posAttr: THREE.BufferAttribute;
  private readonly ciAttr: THREE.BufferAttribute;
  private readonly selAttr: THREE.BufferAttribute;
  private readonly carIAttr: THREE.InstancedBufferAttribute;
  private readonly carCIAttr: THREE.InstancedBufferAttribute;
  private readonly lutTex: THREE.DataTexture;
  private heightTex: THREE.DataTexture | null = null;
  private readonly shared: Record<string, THREE.IUniform>;

  constructor(readonly capacity: number) {
    this.lutTex = new THREE.DataTexture(new Uint8Array(256 * 4), 256, 1, THREE.RGBAFormat, THREE.UnsignedByteType);
    this.lutTex.magFilter = THREE.NearestFilter; this.lutTex.minFilter = THREE.NearestFilter;
    this.lutTex.needsUpdate = true;
    const emptyH = new THREE.DataTexture(new Float32Array(4), 2, 2, THREE.RedFormat, THREE.FloatType);
    emptyH.magFilter = THREE.NearestFilter; emptyH.minFilter = THREE.NearestFilter; emptyH.needsUpdate = true;
    // 三個材質共用同一組 uniform 物件（改一次三邊生效）
    this.shared = {
      uLut: { value: this.lutTex },
      uVt: { value: [0, 1, 2, 3, 4].map(() => new THREE.Vector3(1, 1, 1)) },
      uMode: { value: 0 },
      uH: { value: emptyH },
      uHW: { value: 2 },
      uMpu: { value: 0 },
      uLift: { value: 0 },
      uOpacity: { value: 1 },
    };
    const depth = { transparent: true, depthTest: true, depthWrite: false };
    this.trailMat = new THREE.ShaderMaterial({
      ...depth, vertexShader: TRAIL_VS, fragmentShader: TRAIL_FS,
      uniforms: {
        ...this.shared,
        uNow: { value: 0 }, uTrail: { value: 60 }, uOpacity: { value: 0.8 }, uWidth: { value: 2 }, uShowTun: { value: 0 },
        uViewport: { value: new THREE.Vector2(1, 1) },
      },
    });
    this.headMat = new THREE.ShaderMaterial({
      ...depth, vertexShader: HEAD_VS, fragmentShader: HEAD_FS,
      uniforms: {
        ...this.shared,
        uSize: { value: 4 }, uOpacity: { value: 1 }, uStroke: { value: new THREE.Color("#0a0a14") },
        uNear: { value: 0 }, uPulse: { value: 0 }, uDpr: { value: 1 },
      },
    });
    this.carMat = new THREE.ShaderMaterial({
      transparent: true, depthTest: true, depthWrite: true, side: THREE.DoubleSide,
      vertexShader: CAR_VS, fragmentShader: CAR_FS,
      uniforms: {
        ...this.shared,
        uOpacity: { value: 1 },
        uDim: { value: [0, 1, 2, 3, 4].map(() => new THREE.Vector3(1, 1, 1)) },
      },
    });

    // 拖尾：共用四邊形（x＝端點 0/1，y＝左右 ±1）
    this.headPos = new Float32Array(capacity * 3);
    this.headCI = new Float32Array(capacity * 2);
    this.headSel = new Float32Array(capacity);
    this.posAttr = new THREE.BufferAttribute(this.headPos, 3).setUsage(THREE.DynamicDrawUsage);
    this.ciAttr = new THREE.BufferAttribute(this.headCI, 2).setUsage(THREE.DynamicDrawUsage);
    this.selAttr = new THREE.BufferAttribute(this.headSel, 1).setUsage(THREE.DynamicDrawUsage);
    this.headGeom.setAttribute("position", this.posAttr);
    this.headGeom.setAttribute("aCI", this.ciAttr);
    this.headGeom.setAttribute("aSel", this.selAttr);
    this.headGeom.setDrawRange(0, 0);
    this.headPoints = new THREE.Points(this.headGeom, this.headMat);
    this.headPoints.frustumCulled = false;
    this.headPoints.renderOrder = 3;
    this.scene.add(this.headPoints);

    // 3D 車：單位長方體，底面在 z=0（x＝車長方向）
    const box = new THREE.BoxGeometry(1, 1, 1).translate(0, 0, 0.5);
    this.carGeom = new THREE.InstancedBufferGeometry();
    this.carGeom.index = box.index;
    this.carGeom.setAttribute("position", box.getAttribute("position"));
    this.carGeom.setAttribute("normal", box.getAttribute("normal"));
    this.carI = new Float32Array(capacity * 4);
    this.carCI = new Float32Array(capacity * 2);
    this.carIAttr = new THREE.InstancedBufferAttribute(this.carI, 4).setUsage(THREE.DynamicDrawUsage);
    this.carCIAttr = new THREE.InstancedBufferAttribute(this.carCI, 2).setUsage(THREE.DynamicDrawUsage);
    this.carGeom.setAttribute("aI", this.carIAttr);
    this.carGeom.setAttribute("aCI", this.carCIAttr);
    this.carGeom.instanceCount = 0;
    this.carMesh = new THREE.Mesh(this.carGeom, this.carMat);
    this.carMesh.frustumCulled = false;
    this.carMesh.renderOrder = 2;
    this.scene.add(this.carMesh);
  }

  init(gl: WebGLRenderingContext): void {
    this.renderer = new THREE.WebGLRenderer({
      canvas: gl.canvas as HTMLCanvasElement,
      context: gl as unknown as WebGL2RenderingContext,
      antialias: true,
    });
    this.renderer.autoClear = false;
  }

  /** 換拖尾塊（key 相同不重建） */
  setTrails(key: string, a: Float32Array, b: Float32Array, c: Uint8Array, count: number): void {
    if (key === this.trailKey) return;
    this.trailKey = key;
    if (this.trailMesh) { this.scene.remove(this.trailMesh); this.trailGeom?.dispose(); this.trailMesh = null; this.trailGeom = null; }
    if (count === 0) return;
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array([0, -1, 0, 0, 1, 0, 1, -1, 0, 1, 1, 0]), 3));
    g.setIndex([0, 2, 1, 1, 2, 3]);
    g.setAttribute("aA", new THREE.InstancedBufferAttribute(a, 4));
    g.setAttribute("aB", new THREE.InstancedBufferAttribute(b, 4));
    g.setAttribute("aC", new THREE.InstancedBufferAttribute(c, 4));
    g.instanceCount = count;
    const mesh = new THREE.Mesh(g, this.trailMat);
    mesh.frustumCulled = false;
    mesh.renderOrder = 1;
    this.trailGeom = g; this.trailMesh = mesh;
    this.scene.add(mesh);
  }

  /** 節點高度（m，已乘誇張倍率）→ 浮點貼圖 */
  setHeights(h: Float32Array): void {
    const w = 4096, rows = Math.ceil((h.length + 1) / w);
    const data = new Float32Array(w * rows);
    data.set(h);
    if (h.length > 0) data[h.length] = h[h.length - 1]!;
    this.heightTex?.dispose();
    const tex = new THREE.DataTexture(data, w, rows, THREE.RedFormat, THREE.FloatType);
    tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter; tex.needsUpdate = true;
    this.heightTex = tex;
    this.shared.uH!.value = tex;
    this.shared.uHW!.value = w;
  }

  /** 顏色：車速色表（256×RGBA）、車種五色、模式 */
  setColors(lut: Uint8Array, vtRgb: readonly (readonly [number, number, number])[], mode: "speed" | "type"): void {
    (this.lutTex.image.data as Uint8Array).set(lut);
    this.lutTex.needsUpdate = true;
    const vt = this.shared.uVt!.value as THREE.Vector3[];
    vtRgb.forEach((c, i) => vt[i]?.set(c[0] / 255, c[1] / 255, c[2] / 255));
    this.shared.uMode!.value = mode === "type" ? 1 : 0;
  }

  setGeo(mpu: number, liftMerc: number, dims: readonly (readonly [number, number, number])[]): void {
    this.shared.uMpu!.value = mpu;
    this.shared.uLift!.value = liftMerc;
    const d = this.carMat.uniforms.uDim!.value as THREE.Vector3[];
    dims.forEach((v, i) => d[i]?.set(v[0], v[1], v[2]));
  }

  /**
   * 隧道遮擋實驗開關：depthTest 關＝一律畫在最上層（第一輪做法）；showTunnel 開＝隧道內也畫（看地形能不能擋住）。
   */
  setDebug(depthTest: boolean, showTunnel: boolean): void {
    for (const m of [this.trailMat, this.headMat, this.carMat]) m.depthTest = depthTest;
    this.trailMat.uniforms.uShowTun!.value = showTunnel ? 1 : 0;
  }

  setFrame(f: FreewayTdcsFrame, viewportW: number, viewportH: number, dpr: number): void {
    const tu = this.trailMat.uniforms;
    tu.uNow!.value = f.now;
    tu.uTrail!.value = Math.max(f.trail, 0.001);
    tu.uOpacity!.value = f.trailOpacity;
    tu.uWidth!.value = f.widthPx * dpr;
    (tu.uViewport!.value as THREE.Vector2).set(viewportW, viewportH);
    if (this.trailMesh) this.trailMesh.visible = f.trail > 0;
    const hu = this.headMat.uniforms;
    hu.uSize!.value = f.sizePx * dpr;
    hu.uOpacity!.value = f.opacity;
    hu.uNear!.value = f.near ? 1 : 0;
    hu.uPulse!.value = f.pulse;
    hu.uDpr!.value = dpr;
    (hu.uStroke!.value as THREE.Color).set(f.isDark ? "#0a0a14" : "#ffffff");
    this.carMat.uniforms.uOpacity!.value = f.opacity;
    this.headGeom.setDrawRange(0, f.headCount);
    this.posAttr.needsUpdate = true; this.ciAttr.needsUpdate = true; this.selAttr.needsUpdate = true;
    this.carGeom.instanceCount = f.carCount;
    this.carMesh.visible = f.carCount > 0;
    if (f.carCount > 0) { this.carIAttr.needsUpdate = true; this.carCIAttr.needsUpdate = true; }
  }

  render(matrix: number[], originX: number, originY: number): void {
    if (!this.renderer) return;
    const gl = this.renderer.getContext();
    const blendEnabled = gl.isEnabled(gl.BLEND);
    const blendSrc = gl.getParameter(gl.BLEND_SRC_RGB);
    const blendDst = gl.getParameter(gl.BLEND_DST_RGB);
    const blendSrcA = gl.getParameter(gl.BLEND_SRC_ALPHA);
    const blendDstA = gl.getParameter(gl.BLEND_DST_ALPHA);
    this.m.fromArray(matrix).multiply(this.t.makeTranslation(originX, originY, 0));
    this.camera.projectionMatrix.copy(this.m);
    this.renderer.resetState();
    this.renderer.render(this.scene, this.camera);
    this.renderer.resetState();
    if (blendEnabled) gl.enable(gl.BLEND); else gl.disable(gl.BLEND);
    gl.blendFuncSeparate(blendSrc, blendDst, blendSrcA, blendDstA);
  }

  dispose(): void {
    if (this.trailMesh) this.scene.remove(this.trailMesh);
    this.trailGeom?.dispose();
    this.headGeom.dispose();
    this.carGeom.dispose();
    this.trailMat.dispose();
    this.headMat.dispose();
    this.carMat.dispose();
    this.lutTex.dispose();
    this.heightTex?.dispose();
    this.renderer?.dispose();
    this.renderer = null;
  }
}
