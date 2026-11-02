/**
 * 雙北國道逐車模擬 scene（Mapbox shared-context，無私有 canvas；寫法同 GfwV4TrackScene）。
 * - 拖尾：LineSegments，頂點帶時間；每塊（60 秒）只建一次 buffer，每幀只改時間 uniform，
 *   shader 丟掉「還沒到」與「超過拖尾秒數」的片段並依年齡淡出（等同原型 deck.gl TripsLayer）。
 *   WebGL 線寬固定 1 px（與原型可調像素寬不同）。
 * - 車頭：Points，位置由 CPU 每幀依時間內插（≤ 1.5 萬台），固定容量 buffer 重複使用。
 * 頂點存「相對投影原點」的 Mercator 座標，原點平移在 JS（double）併進投影矩陣，避免 float32 精度不足。
 */
import * as THREE from "three";

const TRAIL_VS = /* glsl */ `
attribute float aTime;
attribute vec3 aColor;
uniform float uNow;
varying float vAge;
varying vec3 vColor;
void main() {
  vAge = uNow - aTime;
  vColor = aColor;
  gl_Position = projectionMatrix * vec4(position, 1.0);
}`;
const TRAIL_FS = /* glsl */ `
uniform float uTrail;
uniform float uOpacity;
varying float vAge;
varying vec3 vColor;
void main() {
  if (vAge < 0.0 || vAge > uTrail) discard;
  float a = 1.0 - vAge / uTrail;
  gl_FragColor = vec4(vColor, a * uOpacity);
}`;
const HEAD_VS = /* glsl */ `
attribute vec3 aColor;
attribute float aSel;
uniform float uSize;
varying vec3 vColor;
varying float vSel;
void main() {
  vColor = aColor;
  vSel = aSel;
  gl_PointSize = uSize * (aSel > 0.5 ? 2.2 : 1.0);
  gl_Position = projectionMatrix * vec4(position, 1.0);
}`;
const HEAD_FS = /* glsl */ `
uniform float uOpacity;
uniform vec3 uStroke;
varying vec3 vColor;
varying float vSel;
void main() {
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  float r = length(p);
  if (r > 1.0) discard;
  // 選取中的車：白色外圈；其餘：底圖色細描邊（map-layers P-2）
  vec3 edge = vSel > 0.5 ? vec3(1.0) : uStroke;
  float ring = vSel > 0.5 ? 0.62 : 0.72;
  vec3 c = r > ring ? edge : vColor;
  gl_FragColor = vec4(c, uOpacity);
}`;

export class FreewayTdcsSimScene {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.Camera();
  private renderer: THREE.WebGLRenderer | null = null;
  private readonly m = new THREE.Matrix4();
  private readonly t = new THREE.Matrix4();
  private readonly trailMat: THREE.ShaderMaterial;
  private readonly headMat: THREE.ShaderMaterial;
  private trailGeom: THREE.BufferGeometry | null = null;
  private trailLines: THREE.LineSegments | null = null;
  private trailKey = "";
  private readonly headGeom = new THREE.BufferGeometry();
  private readonly headPoints: THREE.Points;
  readonly headPos: Float32Array;
  readonly headCol: Uint8Array;
  readonly headSel: Float32Array;
  private readonly posAttr: THREE.BufferAttribute;
  private readonly colAttr: THREE.BufferAttribute;
  private readonly selAttr: THREE.BufferAttribute;

  constructor(readonly capacity: number) {
    const common = { transparent: true, depthTest: false, depthWrite: false };
    this.trailMat = new THREE.ShaderMaterial({
      ...common, vertexShader: TRAIL_VS, fragmentShader: TRAIL_FS,
      uniforms: { uNow: { value: 0 }, uTrail: { value: 60 }, uOpacity: { value: 0.8 } },
    });
    this.headMat = new THREE.ShaderMaterial({
      ...common, vertexShader: HEAD_VS, fragmentShader: HEAD_FS,
      uniforms: { uSize: { value: 4 }, uOpacity: { value: 1 }, uStroke: { value: new THREE.Color("#0a0a14") } },
    });
    this.headPos = new Float32Array(capacity * 3);
    this.headCol = new Uint8Array(capacity * 3);
    this.headSel = new Float32Array(capacity);
    this.posAttr = new THREE.BufferAttribute(this.headPos, 3).setUsage(THREE.DynamicDrawUsage);
    this.colAttr = new THREE.BufferAttribute(this.headCol, 3, true).setUsage(THREE.DynamicDrawUsage);
    this.selAttr = new THREE.BufferAttribute(this.headSel, 1).setUsage(THREE.DynamicDrawUsage);
    this.headGeom.setAttribute("position", this.posAttr);
    this.headGeom.setAttribute("aColor", this.colAttr);
    this.headGeom.setAttribute("aSel", this.selAttr);
    this.headGeom.setDrawRange(0, 0);
    this.headPoints = new THREE.Points(this.headGeom, this.headMat);
    this.headPoints.frustumCulled = false;
    this.headPoints.renderOrder = 2;
    this.scene.add(this.headPoints);
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
  setTrails(key: string, positions: Float32Array, times: Float32Array, colors: Uint8Array, count: number): void {
    if (key === this.trailKey) return;
    this.trailKey = key;
    if (this.trailLines) { this.scene.remove(this.trailLines); this.trailGeom?.dispose(); this.trailLines = null; this.trailGeom = null; }
    if (count === 0) return;
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    g.setAttribute("aTime", new THREE.BufferAttribute(times, 1));
    g.setAttribute("aColor", new THREE.BufferAttribute(colors, 3, true));
    const lines = new THREE.LineSegments(g, this.trailMat);
    lines.frustumCulled = false;
    lines.renderOrder = 1;
    this.trailGeom = g; this.trailLines = lines;
    this.scene.add(lines);
  }

  setFrame(now: number, trail: number, opacity: number, sizePx: number, headCount: number, isDark: boolean): void {
    this.trailMat.uniforms.uNow!.value = now;
    this.trailMat.uniforms.uTrail!.value = Math.max(trail, 0.001);
    this.trailMat.uniforms.uOpacity!.value = 0.85 * opacity;
    if (this.trailLines) this.trailLines.visible = trail > 0;
    this.headMat.uniforms.uSize!.value = sizePx;
    this.headMat.uniforms.uOpacity!.value = opacity;
    (this.headMat.uniforms.uStroke!.value as THREE.Color).set(isDark ? "#0a0a14" : "#ffffff");
    this.headGeom.setDrawRange(0, headCount);
    this.posAttr.needsUpdate = true; this.colAttr.needsUpdate = true; this.selAttr.needsUpdate = true;
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
    if (this.trailLines) this.scene.remove(this.trailLines);
    this.trailGeom?.dispose();
    this.headGeom.dispose();
    this.trailMat.dispose();
    this.headMat.dispose();
    this.renderer?.dispose();
    this.renderer = null;
  }
}
