import * as THREE from "three";

/**
 * 垃圾車音符 GPU billboard particle（方案 B）
 *
 * 設計：
 *   - THREE.Points + custom shader（自動 screen-space billboard）
 *   - 環形 buffer reuse instance slot（max 1000 notes）
 *   - 每個 note 帶 attributes: aOrigin (xyz)、aSpawnTime、aSymbol (0~3)、aSeed (sway 種子)
 *   - vertex shader 內 (uTime - aSpawnTime) / lifespan 算位置/大小
 *   - fragment shader 從 atlas texture sample 4 個音符之一（♪ ♫ ♬ ♩）
 *
 * Spawn 來源：WasteTruckScene.getCollectingPositions() — 只對 collecting 狀態車噴
 * Spawn rate：每車每 ~600ms 一個（uSpawnIntervalMs）
 *
 * 與 wasteTruck 同 toggle，不獨立開關（status.md 決策）
 */

const MAX_NOTES = 1000;
const LIFESPAN_MS = 2200;        // 每個音符存活 2.2 秒
const SPAWN_INTERVAL_MS = 800;   // 每車每 800ms 噴一個
const RISE_HEIGHT_M = 120;       // 上升高度（z11 zoom 看得到）
const SWAY_AMPL_M = 12;          // 左右搖擺幅度
const ORBIT_RADIUS_M = 24;       // 音符繞光點半徑
const POINT_SIZE_PX = 38;        // 音符螢幕尺寸

// Mercator 1m → unit（緯度 24° 台灣：1m = 1 / (40075016 * cos(24°)) ≈ 2.74e-8）
const METERS_TO_UNIT = 2.74e-8;

/** 動態畫 4 個音符到 atlas texture（128 x 32，每符號 32x32） */
function buildNoteAtlas(): THREE.Texture {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 32;
  const ctx = canvas.getContext("2d")!;
  const symbols = ["♪", "♫", "♬", "♩"];
  ctx.fillStyle = "rgba(0,0,0,0)";
  ctx.fillRect(0, 0, 128, 32);
  ctx.font = "bold 26px serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#ffffff";
  ctx.shadowColor = "rgba(0,0,0,0.5)";
  ctx.shadowBlur = 2;
  for (let i = 0; i < 4; i++) {
    ctx.fillText(symbols[i]!, 16 + i * 32, 18);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

const VERTEX_SHADER = /* glsl */`
precision highp float;

attribute float aSpawnTime;
attribute float aSymbol;
attribute float aSeed;

uniform float uTime;
uniform float uLifespanMs;
uniform float uBaseHeight;
uniform float uRiseHeight;
uniform float uSwayAmpl;
uniform float uOrbitRadius;
uniform float uPointSize;
uniform vec2  uViewport;

varying float vT;
varying float vSymbol;

void main() {
  float dt = (uTime - aSpawnTime);
  float t = clamp(dt / uLifespanMs, 0.0, 1.0);
  vT = t;
  vSymbol = aSymbol;

  // 位置：原點上方繞圈 + 緩慢上升
  // mapbox custom layer 座標系統：z = altitude (向上)
  vec3 pos = position;
  if (dt >= 0.0 && dt < uLifespanMs) {
    float orbitPhase = aSeed * 6.2831853 + t * 9.42477796;
    float swayPhase = aSeed * 6.2831853 + t * 12.5663706;
    float orbitCurve = 0.75 + 0.25 * sin(t * 3.14159265);
    pos.x += cos(orbitPhase) * uOrbitRadius * orbitCurve
          + sin(swayPhase) * uSwayAmpl * 0.35;
    pos.y += sin(orbitPhase) * uOrbitRadius * 0.65 * orbitCurve
          + cos(swayPhase * 0.7) * uSwayAmpl * 0.25;
    pos.z += uBaseHeight + t * uRiseHeight;
  } else {
    // 過期 → 推到極遠處避免渲染
    pos.z = -1e10;
  }

  vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mvPosition;

  // PointSize 隨 t 略微變大後縮小（pop-in 感）
  float sizeCurve = sin(t * 3.14159265);  // 0→1→0
  gl_PointSize = uPointSize * (0.6 + 0.4 * sizeCurve);
}
`;

const FRAGMENT_SHADER = /* glsl */`
precision mediump float;

uniform sampler2D uAtlas;
uniform vec3      uColor;       // 音符主色（匹配 wasteTruck 琥珀色，可外部設）
varying float vT;
varying float vSymbol;

void main() {
  if (vT >= 1.0 || vT <= 0.0) discard;

  // 4 個音符 atlas，u 範圍 [0,1] 切 4 段
  float idx = floor(vSymbol + 0.5);
  vec2 uv = gl_PointCoord;
  // PointCoord y 在 WebGL 是上下顛倒的，反轉
  uv.y = 1.0 - uv.y;
  uv.x = (idx + uv.x) / 4.0;

  vec4 c = texture2D(uAtlas, uv);

  // 透明度曲線：淡入快、淡出慢
  float alpha = c.a;
  float fade = vT < 0.2 ? (vT / 0.2) : (1.0 - (vT - 0.2) / 0.8);
  alpha *= fade;

  if (alpha < 0.02) discard;
  // atlas 是白色音符 → 用 uColor 染色，保留 alpha 形狀
  gl_FragColor = vec4(uColor, alpha);
}
`;

export class WasteMusicNoteScene {
  scene: THREE.Scene;
  camera: THREE.Camera;
  renderer!: THREE.WebGLRenderer;

  private points: THREE.Points | null = null;
  private material: THREE.ShaderMaterial | null = null;
  private geometry: THREE.BufferGeometry | null = null;
  private positionAttr: THREE.BufferAttribute | null = null;
  private spawnTimeAttr: THREE.BufferAttribute | null = null;
  private symbolAttr: THREE.BufferAttribute | null = null;
  private seedAttr: THREE.BufferAttribute | null = null;

  private lastMatrix: THREE.Matrix4 | null = null;

  /** 環形 buffer 寫入位置 */
  private writeIdx = 0;
  /** 每車上次 spawn 時間 (相對 ms，從 init 起算) */
  private lastSpawnPerTruck = new Map<string, number>();
  /** 是否已初始化 */
  private inited = false;
  /** 起始時間 (epoch ms)，用來計算相對時間，避免 float32 精度爆炸 */
  private t0Ms = 0;

  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.Camera();
  }

  init(gl: WebGLRenderingContext) {
    this.t0Ms = Date.now();
    this.renderer = new THREE.WebGLRenderer({
      canvas: gl.canvas as HTMLCanvasElement,
      context: gl as unknown as WebGL2RenderingContext,
      antialias: true,
    });
    this.renderer.autoClear = false;

    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(MAX_NOTES * 3);
    // 初始全部丟到極遠處（不會渲染）
    for (let i = 0; i < MAX_NOTES; i++) {
      positions[i * 3 + 2] = -1e10;
    }
    const spawnTimes = new Float32Array(MAX_NOTES).fill(-1e10);
    const symbols = new Float32Array(MAX_NOTES);
    const seeds = new Float32Array(MAX_NOTES);
    for (let i = 0; i < MAX_NOTES; i++) {
      symbols[i] = i % 4;
      seeds[i] = Math.random();
    }

    this.positionAttr = new THREE.BufferAttribute(positions, 3);
    this.spawnTimeAttr = new THREE.BufferAttribute(spawnTimes, 1);
    this.symbolAttr = new THREE.BufferAttribute(symbols, 1);
    this.seedAttr = new THREE.BufferAttribute(seeds, 1);
    this.positionAttr.setUsage(THREE.DynamicDrawUsage);
    this.spawnTimeAttr.setUsage(THREE.DynamicDrawUsage);
    this.symbolAttr.setUsage(THREE.DynamicDrawUsage);

    geo.setAttribute("position", this.positionAttr);
    geo.setAttribute("aSpawnTime", this.spawnTimeAttr);
    geo.setAttribute("aSymbol", this.symbolAttr);
    geo.setAttribute("aSeed", this.seedAttr);
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e20);

    const atlas = buildNoteAtlas();

    const mat = new THREE.ShaderMaterial({
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.NormalBlending,
      uniforms: {
        uTime:        { value: 0 },
        uLifespanMs:  { value: LIFESPAN_MS },
        uBaseHeight:  { value: 70 * METERS_TO_UNIT },
        uRiseHeight:  { value: RISE_HEIGHT_M * METERS_TO_UNIT },
        uSwayAmpl:    { value: SWAY_AMPL_M * METERS_TO_UNIT },
        uOrbitRadius: { value: ORBIT_RADIUS_M * METERS_TO_UNIT },
        uPointSize:   { value: POINT_SIZE_PX },
        uViewport:    { value: new THREE.Vector2(1, 1) },
        uAtlas:       { value: atlas },
        uColor:       { value: new THREE.Color("#fff8d6") },
      },
    });

    this.geometry = geo;
    this.material = mat;
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.scene.add(this.points);
    this.inited = true;
  }

  /**
   * 對目前在 collecting 的 trucks 做 spawn 判定
   * @param trucks 已平滑的 truck Mercator 位置（從 WasteTruckScene.getCollectingPositions() 來）
   * @param nowMs Date.now()
   */
  spawnFromTrucks(
    trucks: Array<{ vehicle_no: string; x: number; y: number; z: number }>,
    nowMs: number,
  ) {
    if (!this.inited || !this.positionAttr || !this.spawnTimeAttr || !this.symbolAttr) return;

    // 轉成相對時間，避免 float32 精度炸（epoch ms ~1.78e12 超過 float32 有效位數）
    const tRel = nowMs - this.t0Ms;

    let dirty = false;
    for (const t of trucks) {
      const last = this.lastSpawnPerTruck.get(t.vehicle_no) ?? -1e9;
      if (tRel - last < SPAWN_INTERVAL_MS) continue;
      this.lastSpawnPerTruck.set(t.vehicle_no, tRel);

      const idx = this.writeIdx;
      this.writeIdx = (this.writeIdx + 1) % MAX_NOTES;

      this.positionAttr.setXYZ(idx, t.x, t.y, t.z);
      this.spawnTimeAttr.setX(idx, tRel);
      // 隨機選一個音符（0~3）
      this.symbolAttr.setX(idx, Math.floor(Math.random() * 4));
      dirty = true;
    }

    if (dirty) {
      this.positionAttr.needsUpdate = true;
      this.spawnTimeAttr.needsUpdate = true;
      this.symbolAttr.needsUpdate = true;
    }

    // GC inactive trucks（避免 lastSpawnPerTruck 無限長）
    if (this.lastSpawnPerTruck.size > trucks.length * 3 + 50) {
      const active = new Set(trucks.map((x) => x.vehicle_no));
      for (const k of this.lastSpawnPerTruck.keys()) {
        if (!active.has(k)) this.lastSpawnPerTruck.delete(k);
      }
    }
  }

  setViewport(w: number, h: number) {
    if (this.material) {
      (this.material.uniforms.uViewport!.value as THREE.Vector2).set(w, h);
    }
  }

  setPointSize(px: number) {
    if (this.material) this.material.uniforms.uPointSize!.value = px;
  }

  /** size multiplier (0.5 ~ 3)，base 38px */
  setSizeMultiplier(mul: number) {
    if (this.material) this.material.uniforms.uPointSize!.value = POINT_SIZE_PX * mul;
  }

  /** 音符起始高度（公尺），讓音符浮在光點上方 */
  setBaseHeightMeters(meters: number) {
    if (this.material) this.material.uniforms.uBaseHeight!.value = meters * METERS_TO_UNIT;
  }

  /** 音符顏色（hex）— 預設 wasteTruck 主視覺琥珀 */
  setColor(hex: string) {
    if (this.material) {
      (this.material.uniforms.uColor!.value as THREE.Color).set(hex);
    }
  }

  render(matrix: number[], nowMs: number) {
    if (!this.material) return;
    this.material.uniforms.uTime!.value = nowMs - this.t0Ms;

    const gl = this.renderer.getContext();
    const blendEnabled = gl.isEnabled(gl.BLEND);
    const blendSrc = gl.getParameter(gl.BLEND_SRC_RGB);
    const blendDst = gl.getParameter(gl.BLEND_DST_RGB);
    const blendSrcA = gl.getParameter(gl.BLEND_SRC_ALPHA);
    const blendDstA = gl.getParameter(gl.BLEND_DST_ALPHA);

    if (!this.lastMatrix) this.lastMatrix = new THREE.Matrix4();
    this.lastMatrix.fromArray(matrix);
    this.camera.projectionMatrix.copy(this.lastMatrix);
    this.renderer.resetState();
    this.renderer.render(this.scene, this.camera);
    this.renderer.resetState();

    if (blendEnabled) gl.enable(gl.BLEND);
    else gl.disable(gl.BLEND);
    gl.blendFuncSeparate(blendSrc, blendDst, blendSrcA, blendDstA);
  }

  dispose() {
    if (this.points) {
      this.scene.remove(this.points);
      this.points = null;
    }
    this.geometry?.dispose();
    this.material?.dispose();
    if (this.material?.uniforms.uAtlas?.value) {
      (this.material.uniforms.uAtlas.value as THREE.Texture).dispose();
    }
    this.renderer?.dispose();
    this.lastSpawnPerTruck.clear();
  }
}
