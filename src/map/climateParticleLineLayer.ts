import type { CustomLayerInterface, Map as MapboxMap } from "mapbox-gl";

export interface ClimateParticleLineLayerOptions {
  id: string;
  pngUrl: string;
  metaUrl: string;
  getIsVisible: () => boolean;
  getOpacity: () => number;
  getParticleCount: () => number;
  getAnimationSpeed: () => number;
  getLineWidth: () => number;
  /** 每 1 秒真實時間推進幾秒流體時間，只影響視覺速度。 */
  timeScaleSeconds: number;
  /** 粒子尾跡保存幾個歷史點。越大越接近 nullschool 長流線，但越吃 CPU/GPU buffer。 */
  trailPoints: number;
  /** m/s，用於 color ramp normalization。 */
  speedMax: number;
  /** alpha mask 侵蝕半徑（像素）。海流建議 1，避免近岸畫到陸地。 */
  maskErodePx?: number;
  /** 單段尾跡基礎 alpha。 */
  particleAlpha?: number;
  /** 粒子色帶（速度 0→1）。 */
  rampColors?: Record<number, string>;
}

export interface ClimateMeta {
  width: number;
  height: number;
  u_min: number;
  u_max: number;
  v_min: number;
  v_max: number;
  bbox: [number, number, number, number];
  dataset?: string;
  valid_at?: string;
}

export interface ClimateRasterData {
  meta: ClimateMeta;
  data: Uint8ClampedArray;
}

const DEFAULT_RAMP: Record<number, string> = {
  0.0: "#b6d7ff",
  0.35: "#b7f7cf",
  0.7: "#e9f8ff",
  1.0: "#ffffff",
};

const EARTH_METERS_PER_DEG_LAT = 110_540;
const EARTH_METERS_PER_DEG_LON_AT_EQUATOR = 111_320;
const MAX_FRAME_DT = 1 / 20;
const MIN_PARTICLES = 500;
const MAX_PARTICLES = 60_000;
const PI = Math.PI;

// 每段線的固定四角幾何（2 triangles = 6 vertices，(side, along)）；instanced 下只上傳一次。
const CORNERS = new Float32Array([
  -1, 0,   1, 0,   -1, 1,
  -1, 1,   1, 0,    1, 1,
]);
const INSTANCE_FLOATS = 8; // fromMerc.xy + toMerc.xy + rgba

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function resolvePublicAssetUrl(path: string): string {
  if (/^(https?:)?\/\//.test(path) || path.startsWith("data:")) return path;
  const cleanPath = path.replace(/^\.\//, "").replace(/^\//, "");
  const base = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
  return `${base}/${cleanPath}`;
}

async function fetchJson<T>(url: string): Promise<T> {
  const resolved = resolvePublicAssetUrl(url);
  try {
    const r = await fetch(resolved, { cache: "no-cache" });
    if (!r.ok) throw new Error(`${resolved} ${r.status}`);
    return r.json() as Promise<T>;
  } catch (e) {
    console.warn(`[ClimateParticleLine] fetch json failed: ${resolved}`, e);
    throw e;
  }
}

function parseHexColor(hex: string): [number, number, number] {
  const h = hex.replace("#", "").trim();
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h.padEnd(6, "0").slice(0, 6);
  return [
    Number.parseInt(full.slice(0, 2), 16) / 255,
    Number.parseInt(full.slice(2, 4), 16) / 255,
    Number.parseInt(full.slice(4, 6), 16) / 255,
  ];
}

function buildRamp(ramp: Record<number, string>): Array<[number, [number, number, number]]> {
  const stops = Object.entries(ramp)
    .map(([k, v]) => [Number(k), parseHexColor(v)] as [number, [number, number, number]])
    .filter(([k]) => Number.isFinite(k))
    .sort((a, b) => a[0] - b[0]);
  return stops.length ? stops : buildRamp(DEFAULT_RAMP);
}

function rampColor(stops: Array<[number, [number, number, number]]>, t: number): [number, number, number] {
  if (t <= stops[0]![0]) return stops[0]![1];
  for (let i = 1; i < stops.length; i++) {
    const [t1, c1] = stops[i]!;
    if (t <= t1) {
      const [t0, c0] = stops[i - 1]!;
      const f = clamp((t - t0) / Math.max(t1 - t0, 1e-6), 0, 1);
      return [
        c0[0] + (c1[0] - c0[0]) * f,
        c0[1] + (c1[1] - c0[1]) * f,
        c0[2] + (c1[2] - c0[2]) * f,
      ];
    }
  }
  return stops[stops.length - 1]![1];
}

function mercatorX(lon: number) {
  return (lon + 180) / 360;
}

function mercatorY(lat: number) {
  const latRad = clamp(lat, -85.051129, 85.051129) * PI / 180;
  return 0.5 - Math.log(Math.tan(PI / 4 + latRad / 2)) / (2 * PI);
}

function compileShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("createShader failed");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`ClimateParticleLine shader compile failed: ${log}`);
  }
  return shader;
}

function createProgram(gl: WebGL2RenderingContext): WebGLProgram {
  const vs = compileShader(gl, gl.VERTEX_SHADER, `
    precision highp float;
    attribute vec2 a_from;
    attribute vec2 a_to;
    attribute vec4 a_color;
    attribute float a_side;
    attribute float a_along;
    uniform mat4 u_matrix;
    uniform vec2 u_resolution;
    uniform float u_line_width;
    varying vec4 v_color;
    void main() {
      vec4 clipA = u_matrix * vec4(a_from, 0.0, 1.0);
      vec4 clipB = u_matrix * vec4(a_to, 0.0, 1.0);
      vec2 aNdc = clipA.xy / clipA.w;
      vec2 bNdc = clipB.xy / clipB.w;
      vec2 dirPx = (bNdc - aNdc) * u_resolution * 0.5;
      vec2 dir = dirPx / max(length(dirPx), 0.000001);
      vec2 normal = vec2(-dir.y, dir.x);
      vec4 clip = mix(clipA, clipB, a_along);
      clip.xy += normal * a_side * u_line_width / u_resolution * 2.0 * clip.w;
      gl_Position = clip;
      v_color = a_color;
    }
  `);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, `
    precision mediump float;
    varying vec4 v_color;
    void main() {
      gl_FragColor = v_color;
    }
  `);
  const program = gl.createProgram();
  if (!program) throw new Error("createProgram failed");
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(`ClimateParticleLine program link failed: ${log}`);
  }
  return program;
}

export async function loadClimateRaster(pngUrl: string, metaUrl: string): Promise<ClimateRasterData> {
  // 先讀 meta 拿 valid_at，PNG 帶 ?v= 破快取（S3 每日重烤 → 前端追得上）
  const meta = await fetchJson<ClimateMeta>(metaUrl);
  const resolved = resolvePublicAssetUrl(pngUrl) + (meta.valid_at ? `?v=${encodeURIComponent(meta.valid_at)}` : "");
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`failed to load image: ${resolved}`));
    img.src = resolved;
  });

  const canvas = document.createElement("canvas");
  canvas.width = meta.width;
  canvas.height = meta.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("2d canvas context unavailable");
  ctx.drawImage(image, 0, 0, meta.width, meta.height);
  return { meta, data: ctx.getImageData(0, 0, meta.width, meta.height).data };
}

class ClimateParticleLineState {
  private readonly meta: ClimateMeta;
  private readonly data: Uint8ClampedArray;
  private readonly isGlobalX: boolean;
  private readonly lonMin: number;
  private readonly latMin: number;
  private readonly lonMax: number;
  private readonly latMax: number;
  private readonly lonSpan: number;
  private readonly latSpan: number;
  private readonly maskErodePx: number;
  private readonly trailPoints: number;
  private readonly speedMax: number;
  private readonly ramp: Array<[number, [number, number, number]]>;
  private count = 0;
  private historyX = new Float32Array(0);
  private historyY = new Float32Array(0);
  // 快取 mercator 座標（避免 buildInstanceData 每幀重算 log/tan）；建立/前進歷史點時算一次。
  private historyMX = new Float32Array(0);
  private historyMY = new Float32Array(0);
  private historyValid = new Uint8Array(0);
  private ages = new Float32Array(0);
  private speedT = new Float32Array(0);
  private instances = new Float32Array(0);
  private spawnBounds: [number, number, number, number] | null = null;

  constructor(data: ClimateRasterData, opts: ClimateParticleLineLayerOptions) {
    this.meta = data.meta;
    this.data = data.data;
    this.isGlobalX = Math.abs(this.meta.bbox[2] - this.meta.bbox[0]) > 300;
    [this.lonMin, this.latMin, this.lonMax, this.latMax] = this.meta.bbox;
    this.lonSpan = Math.max(1e-6, this.lonMax - this.lonMin);
    this.latSpan = Math.max(1e-6, this.latMax - this.latMin);
    this.maskErodePx = Math.max(0, Math.floor(opts.maskErodePx ?? 0));
    this.trailPoints = clamp(Math.floor(opts.trailPoints), 2, 96);
    this.speedMax = Math.max(0.001, opts.speedMax);
    this.ramp = buildRamp(opts.rampColors ?? DEFAULT_RAMP);
  }

  setSpawnBounds(bounds: [number, number, number, number] | null) {
    this.spawnBounds = bounds;
  }

  resize(nextCountRaw: number) {
    const nextCount = clamp(Math.floor(nextCountRaw || 0), MIN_PARTICLES, MAX_PARTICLES);
    if (nextCount === this.count) return;
    this.count = nextCount;
    const pointCount = this.count * this.trailPoints;
    this.historyX = new Float32Array(pointCount);
    this.historyY = new Float32Array(pointCount);
    this.historyMX = new Float32Array(pointCount);
    this.historyMY = new Float32Array(pointCount);
    this.historyValid = new Uint8Array(pointCount);
    this.ages = new Float32Array(this.count);
    this.speedT = new Float32Array(this.count);
    // 每段一個 instance（8 floats）；四角幾何固定另存 static buffer。
    this.instances = new Float32Array(this.count * (this.trailPoints - 1) * INSTANCE_FLOATS);
    for (let i = 0; i < this.count; i++) this.resetParticle(i);
  }

  step(dt: number, flowSecondsPerRealSecond: number) {
    const flowSeconds = flowSecondsPerRealSecond * dt;
    for (let i = 0; i < this.count; i++) {
      const base = i * this.trailPoints;
      let x = this.historyX[base]!;
      let y = this.historyY[base]!;
      this.ages[i]! += dt * 60;

      if (this.spawnBounds && !this.isInSpawnBounds(x, y) && Math.random() < 0.04) {
        this.resetParticle(i);
        continue;
      }

      if (this.ages[i]! > 360 + Math.random() * 240 || !this.sampleValid(x, y)) {
        this.resetParticle(i);
        continue;
      }

      const vec = this.sampleVector(x, y);
      if (!vec.valid || vec.speed < 1e-5) {
        this.resetParticle(i);
        continue;
      }

      const lat = this.latMax - y * this.latSpan;
      const metersPerDegLon = Math.max(20_000, EARTH_METERS_PER_DEG_LON_AT_EQUATOR * Math.cos(lat * PI / 180));
      let nx = x + (vec.u * flowSeconds / metersPerDegLon) / this.lonSpan;
      const ny = y - (vec.v * flowSeconds / EARTH_METERS_PER_DEG_LAT) / this.latSpan;
      if (this.isGlobalX) nx = ((nx % 1) + 1) % 1;

      const crossedWrap = this.isGlobalX && Math.abs(nx - x) > 0.5;
      if (crossedWrap || !this.sampleValid(nx, ny)) {
        this.resetParticle(i);
        continue;
      }

      for (let s = this.trailPoints - 1; s >= 1; s--) {
        this.historyX[base + s] = this.historyX[base + s - 1]!;
        this.historyY[base + s] = this.historyY[base + s - 1]!;
        this.historyMX[base + s] = this.historyMX[base + s - 1]!;
        this.historyMY[base + s] = this.historyMY[base + s - 1]!;
        this.historyValid[base + s] = this.historyValid[base + s - 1]!;
      }
      this.historyX[base] = nx;
      this.historyY[base] = ny;
      const [mx, my] = this.mercatorFromNorm(nx, ny);
      this.historyMX[base] = mx;
      this.historyMY[base] = my;
      this.historyValid[base] = 1;
      this.speedT[i] = clamp(vec.speed / this.speedMax, 0, 1);
    }
  }

  /** 每段一個 instance（8 floats：fromMerc.xy, toMerc.xy, rgba）；四角展開交給 GPU instancing。 */
  buildInstanceData(opacity: number, particleAlpha: number): { data: Float32Array; instanceCount: number } {
    let ptr = 0;
    const layerOpacity = clamp(opacity, 0, 1);
    const baseAlpha = clamp(particleAlpha, 0.02, 1) * layerOpacity;
    const inv = 1 / Math.max(1, this.trailPoints - 1);
    for (let i = 0; i < this.count; i++) {
      const base = i * this.trailPoints;
      const [r, g, b] = rampColor(this.ramp, this.speedT[i]!);
      for (let s = 0; s < this.trailPoints - 1; s++) {
        if (!this.historyValid[base + s] || !this.historyValid[base + s + 1]) continue;
        const x0 = this.historyX[base + s]!;
        const x1 = this.historyX[base + s + 1]!;
        if (this.isGlobalX && Math.abs(x0 - x1) > 0.5) continue;
        if (this.maskErodePx > 0 && !this.sampleValid((x0 + x1) * 0.5, (this.historyY[base + s]! + this.historyY[base + s + 1]!) * 0.5)) continue;

        const fade = Math.pow(1 - s * inv, 1.35);
        const a = baseAlpha * fade;
        if (a <= 0.002) continue;
        // from = 較舊點 (base+s+1)，to = 較新點 (base+s)，用快取 mercator
        this.instances[ptr++] = this.historyMX[base + s + 1]!;
        this.instances[ptr++] = this.historyMY[base + s + 1]!;
        this.instances[ptr++] = this.historyMX[base + s]!;
        this.instances[ptr++] = this.historyMY[base + s]!;
        this.instances[ptr++] = r;
        this.instances[ptr++] = g;
        this.instances[ptr++] = b;
        this.instances[ptr++] = a;
      }
    }
    return { data: this.instances.subarray(0, ptr), instanceCount: ptr / INSTANCE_FLOATS };
  }

  private resetParticle(i: number) {
    const p = this.randomParticle();
    const base = i * this.trailPoints;
    const [mx, my] = this.mercatorFromNorm(p.x, p.y);
    for (let s = 0; s < this.trailPoints; s++) {
      this.historyX[base + s] = p.x;
      this.historyY[base + s] = p.y;
      this.historyMX[base + s] = mx;
      this.historyMY[base + s] = my;
      this.historyValid[base + s] = 1;
    }
    this.ages[i] = Math.random() * 240;
    this.speedT[i] = 0;
  }

  private randomParticle(): { x: number; y: number } {
    const tries = this.maskErodePx > 0 ? 128 : 64;
    for (let i = 0; i < tries; i++) {
      const fromViewport = !!this.spawnBounds && Math.random() < 0.9;
      const [x, y] = fromViewport ? this.randomInSpawnBounds() : [Math.random(), Math.random()];
      if (this.sampleValid(x, y)) return { x, y };
    }
    return { x: Math.random(), y: Math.random() };
  }

  private randomInSpawnBounds(): [number, number] {
    if (!this.spawnBounds) return [Math.random(), Math.random()];
    const [x0, y0, x1, y1] = this.spawnBounds;
    return [
      clamp(x0 + Math.random() * Math.max(0.001, x1 - x0), 0, 1),
      clamp(y0 + Math.random() * Math.max(0.001, y1 - y0), 0, 1),
    ];
  }

  private isInSpawnBounds(x: number, y: number): boolean {
    if (!this.spawnBounds) return true;
    const [x0, y0, x1, y1] = this.spawnBounds;
    return x >= x0 && x <= x1 && y >= y0 && y <= y1;
  }

  private mercatorFromNorm(x: number, y: number): [number, number] {
    const lon = this.lonMin + x * this.lonSpan;
    const lat = this.latMax - y * this.latSpan;
    return [mercatorX(lon), mercatorY(lat)];
  }

  private sampleRawPixel(px: number, py: number): [number, number, number] {
    const ix = clamp(px, 0, this.meta.width - 1);
    const iy = clamp(py, 0, this.meta.height - 1);
    const idx = (iy * this.meta.width + ix) * 4;
    return [this.data[idx] ?? 0, this.data[idx + 1] ?? 0, this.data[idx + 3] ?? 0];
  }

  private sampleValid(x: number, y: number): boolean {
    if (y < 0 || y > 1) return false;
    if (!this.isGlobalX && (x < 0 || x > 1)) return false;
    const xx = this.isGlobalX ? ((x % 1) + 1) % 1 : x;
    const px = Math.round(xx * (this.meta.width - 1));
    const py = Math.round(y * (this.meta.height - 1));
    const r = this.maskErodePx;
    if (r <= 0) return this.sampleRawPixel(px, py)[2] >= 128;
    for (let oy = -r; oy <= r; oy++) {
      for (let ox = -r; ox <= r; ox++) {
        if (this.sampleRawPixel(px + ox, py + oy)[2] < 128) return false;
      }
    }
    return true;
  }

  private sampleVector(x: number, y: number): { u: number; v: number; valid: boolean; speed: number } {
    if (!this.sampleValid(x, y)) return { u: 0, v: 0, valid: false, speed: 0 };
    const xx = this.isGlobalX ? ((x % 1) + 1) % 1 : x;
    const fx = xx * (this.meta.width - 1);
    const fy = clamp(y, 0, 1) * (this.meta.height - 1);
    const x0 = Math.floor(fx);
    const y0 = Math.floor(fy);
    const x1 = Math.min(x0 + 1, this.meta.width - 1);
    const y1 = Math.min(y0 + 1, this.meta.height - 1);
    const tx = fx - x0;
    const ty = fy - y0;
    const [r00, g00] = this.sampleRawPixel(x0, y0);
    const [r10, g10] = this.sampleRawPixel(x1, y0);
    const [r01, g01] = this.sampleRawPixel(x0, y1);
    const [r11, g11] = this.sampleRawPixel(x1, y1);
    const r = (r00 * (1 - tx) + r10 * tx) * (1 - ty) + (r01 * (1 - tx) + r11 * tx) * ty;
    const g = (g00 * (1 - tx) + g10 * tx) * (1 - ty) + (g01 * (1 - tx) + g11 * tx) * ty;
    const u = this.meta.u_min + (r / 255) * (this.meta.u_max - this.meta.u_min);
    const v = this.meta.v_min + (g / 255) * (this.meta.v_max - this.meta.v_min);
    return { u, v, valid: true, speed: Math.hypot(u, v) };
  }
}

function spawnBoundsForMap(map: MapboxMap | null, meta: ClimateMeta | null): [number, number, number, number] | null {
  if (!map || !meta) return null;
  const bounds = map.getBounds();
  if (!bounds) return null;
  const [lonMin, latMin, lonMax, latMax] = meta.bbox;
  const lonSpan = Math.max(1e-6, lonMax - lonMin);
  const latSpan = Math.max(1e-6, latMax - latMin);
  let west = Math.max(lonMin, bounds.getWest());
  let east = Math.min(lonMax, bounds.getEast());
  let south = Math.max(latMin, bounds.getSouth());
  let north = Math.min(latMax, bounds.getNorth());
  if (east <= west || north <= south) return null;
  const padLon = (east - west) * 0.35;
  const padLat = (north - south) * 0.35;
  west = Math.max(lonMin, west - padLon);
  east = Math.min(lonMax, east + padLon);
  south = Math.max(latMin, south - padLat);
  north = Math.min(latMax, north + padLat);
  return [
    clamp((west - lonMin) / lonSpan, 0, 1),
    clamp((latMax - north) / latSpan, 0, 1),
    clamp((east - lonMin) / lonSpan, 0, 1),
    clamp((latMax - south) / latSpan, 0, 1),
  ];
}

export function createClimateParticleLineLayer(opts: ClimateParticleLineLayerOptions): CustomLayerInterface {
  let map: MapboxMap | null = null;
  let gl: WebGL2RenderingContext | null = null;
  let program: WebGLProgram | null = null;
  let vao: WebGLVertexArrayObject | null = null;
  let cornerBuffer: WebGLBuffer | null = null;
  let instanceBuffer: WebGLBuffer | null = null;
  let aFrom = -1;
  let aTo = -1;
  let aColor = -1;
  let aSide = -1;
  let aAlong = -1;
  let uMatrix: WebGLUniformLocation | null = null;
  let uResolution: WebGLUniformLocation | null = null;
  let uLineWidth: WebGLUniformLocation | null = null;
  let state: ClimateParticleLineState | null = null;
  let meta: ClimateMeta | null = null;
  let dataReady = false;
  let loading = false;
  let disposed = false;
  let firstRenderLogged = false;
  let lastTs = 0;

  const loadData = () => {
    if (loading || dataReady) return;
    loading = true;
    loadClimateRaster(opts.pngUrl, opts.metaUrl)
      .then((data) => {
        if (disposed) return;
        meta = data.meta;
        state = new ClimateParticleLineState(data, opts);
        state.setSpawnBounds(spawnBoundsForMap(map, meta));
        state.resize(opts.getParticleCount());
        dataReady = true;
        console.log(`[ClimateParticleLine ${opts.id}] data ready`, data.meta.width, data.meta.height, data.meta.bbox);
        map?.triggerRepaint();
      })
      .catch((e) => console.warn(`[ClimateParticleLine ${opts.id}] load failed`, e));
  };

  return {
    id: opts.id,
    type: "custom" as const,
    renderingMode: "2d" as const,

    onAdd(mapInstance: MapboxMap, glCtx: WebGL2RenderingContext) {
      map = mapInstance;
      gl = glCtx;
      program = createProgram(gl);
      aFrom = gl.getAttribLocation(program, "a_from");
      aTo = gl.getAttribLocation(program, "a_to");
      aColor = gl.getAttribLocation(program, "a_color");
      aSide = gl.getAttribLocation(program, "a_side");
      aAlong = gl.getAttribLocation(program, "a_along");
      uMatrix = gl.getUniformLocation(program, "u_matrix");
      uResolution = gl.getUniformLocation(program, "u_resolution");
      uLineWidth = gl.getUniformLocation(program, "u_line_width");

      // VAO 封裝所有 attribute + divisor 設定，避免污染 mapbox 共用的 GL 狀態。
      vao = gl.createVertexArray();
      cornerBuffer = gl.createBuffer();
      instanceBuffer = gl.createBuffer();
      gl.bindVertexArray(vao);
      // 固定四角幾何（per-vertex，divisor 0）
      gl.bindBuffer(gl.ARRAY_BUFFER, cornerBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, CORNERS, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(aSide);
      gl.vertexAttribPointer(aSide, 1, gl.FLOAT, false, 2 * 4, 0);
      gl.vertexAttribDivisor(aSide, 0);
      gl.enableVertexAttribArray(aAlong);
      gl.vertexAttribPointer(aAlong, 1, gl.FLOAT, false, 2 * 4, 1 * 4);
      gl.vertexAttribDivisor(aAlong, 0);
      // per-instance 段資料（divisor 1）：fromMerc.xy, toMerc.xy, rgba
      gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuffer);
      const iStride = INSTANCE_FLOATS * 4;
      gl.enableVertexAttribArray(aFrom);
      gl.vertexAttribPointer(aFrom, 2, gl.FLOAT, false, iStride, 0);
      gl.vertexAttribDivisor(aFrom, 1);
      gl.enableVertexAttribArray(aTo);
      gl.vertexAttribPointer(aTo, 2, gl.FLOAT, false, iStride, 2 * 4);
      gl.vertexAttribDivisor(aTo, 1);
      gl.enableVertexAttribArray(aColor);
      gl.vertexAttribPointer(aColor, 4, gl.FLOAT, false, iStride, 4 * 4);
      gl.vertexAttribDivisor(aColor, 1);
      gl.bindVertexArray(null);
      loadData();
    },

    render(glCtx: WebGL2RenderingContext, matrix: number[]) {
      if (!opts.getIsVisible()) return;
      if (!dataReady || !state || !program || !vao || !instanceBuffer || !uMatrix || !uResolution || !uLineWidth) {
        loadData();
        map?.triggerRepaint();
        return;
      }

      state.setSpawnBounds(spawnBoundsForMap(map, meta));
      const requestedCount = opts.getParticleCount();
      state.resize(requestedCount);

      const now = performance.now();
      const dt = lastTs ? clamp((now - lastTs) / 1000, 0, MAX_FRAME_DT) : 1 / 60;
      lastTs = now;
      state.step(dt, opts.timeScaleSeconds * opts.getAnimationSpeed());
      const { data, instanceCount } = state.buildInstanceData(opts.getOpacity(), opts.particleAlpha ?? 0.28);
      if (instanceCount <= 0) {
        map?.triggerRepaint();
        return;
      }
      if (!firstRenderLogged) {
        firstRenderLogged = true;
        console.log(`[ClimateParticleLine ${opts.id}] first render`, { instanceCount, particleCount: opts.getParticleCount() });
      }

      glCtx.useProgram(program);
      glCtx.bindVertexArray(vao);
      glCtx.bindBuffer(glCtx.ARRAY_BUFFER, instanceBuffer);
      glCtx.bufferData(glCtx.ARRAY_BUFFER, data, glCtx.DYNAMIC_DRAW);
      glCtx.uniformMatrix4fv(uMatrix, false, matrix);
      glCtx.uniform2f(uResolution, glCtx.drawingBufferWidth, glCtx.drawingBufferHeight);
      glCtx.uniform1f(uLineWidth, clamp(opts.getLineWidth(), 0.5, 4.0) * (window.devicePixelRatio || 1));

      glCtx.disable(glCtx.DEPTH_TEST);
      glCtx.disable(glCtx.CULL_FACE);
      glCtx.enable(glCtx.BLEND);
      glCtx.blendFuncSeparate(glCtx.SRC_ALPHA, glCtx.ONE_MINUS_SRC_ALPHA, glCtx.ONE, glCtx.ONE_MINUS_SRC_ALPHA);
      glCtx.drawArraysInstanced(glCtx.TRIANGLES, 0, 6, instanceCount);
      glCtx.bindVertexArray(null);

      map?.triggerRepaint();
    },

    onRemove(_map: MapboxMap, glCtx: WebGL2RenderingContext) {
      disposed = true;
      if (cornerBuffer) glCtx.deleteBuffer(cornerBuffer);
      if (instanceBuffer) glCtx.deleteBuffer(instanceBuffer);
      if (vao) glCtx.deleteVertexArray(vao);
      if (program) glCtx.deleteProgram(program);
      cornerBuffer = null;
      instanceBuffer = null;
      vao = null;
      program = null;
      state = null;
      meta = null;
      map = null;
      gl = null;
    },
  };
}
