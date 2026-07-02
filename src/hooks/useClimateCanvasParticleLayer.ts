import { useEffect, useRef } from "react";
import type { Map as MapboxMap, CanvasSource } from "mapbox-gl";

export interface ClimateCanvasParticleLayerOptions {
  layerId: string;
  pngUrl: string;
  metaUrl: string;
  visible: boolean;
  opacity: number;
  animationSpeed: number;
  particleCount: number;
  speedMax?: number;
  rampColors?: Record<number, string>;
  /** 每 1 秒真實時間要推進幾秒流體時間；只影響視覺速度。 */
  timeScaleSeconds?: number;
}

interface ClimateMeta {
  width: number;
  height: number;
  u_min: number;
  u_max: number;
  v_min: number;
  v_max: number;
  bbox: [number, number, number, number];
  valid_at?: string;
}

interface Particle {
  x: number;
  y: number;
  px: number;
  py: number;
  age: number;
}

const DEFAULT_RAMP: Record<number, string> = {
  0.0: "#3288bd",
  0.1: "#66c2a5",
  0.2: "#abdda4",
  0.4: "#e6f598",
  0.6: "#fee08b",
  0.7: "#fdae61",
  0.85: "#f46d43",
  1.0: "#d53e4f",
};

const MAX_CANVAS_WIDTH = 1440;
const MAX_CANVAS_HEIGHT = 900;
const MAX_RESPAWN_TRIES = 24;
const EARTH_METERS_PER_DEG_LAT = 110_540;
const EARTH_METERS_PER_DEG_LON_AT_EQUATOR = 111_320;
const MAX_FRAME_DT = 1 / 20;

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function parseHexColor(hex: string): [number, number, number] {
  const h = hex.replace("#", "").trim();
  const full = h.length === 3
    ? h.split("").map((c) => c + c).join("")
    : h.padEnd(6, "0").slice(0, 6);
  return [
    Number.parseInt(full.slice(0, 2), 16),
    Number.parseInt(full.slice(2, 4), 16),
    Number.parseInt(full.slice(4, 6), 16),
  ];
}

function colorFromRamp(ramp: Record<number, string>, t: number): string {
  const stops = Object.entries(ramp)
    .map(([k, v]) => [Number(k), v] as const)
    .filter(([k]) => Number.isFinite(k))
    .sort((a, b) => a[0] - b[0]);
  if (!stops.length) return "rgba(255,255,255,0.85)";
  if (t <= stops[0]![0]) {
    const [r, g, b] = parseHexColor(stops[0]![1]);
    return `rgba(${r},${g},${b},0.9)`;
  }
  for (let i = 1; i < stops.length; i++) {
    const [t1, c1] = stops[i]!;
    if (t <= t1) {
      const [t0, c0] = stops[i - 1]!;
      const f = clamp((t - t0) / Math.max(t1 - t0, 1e-6), 0, 1);
      const a = parseHexColor(c0);
      const b = parseHexColor(c1);
      const r = Math.round(a[0] + (b[0] - a[0]) * f);
      const g = Math.round(a[1] + (b[1] - a[1]) * f);
      const bl = Math.round(a[2] + (b[2] - a[2]) * f);
      return `rgba(${r},${g},${bl},0.9)`;
    }
  }
  const [r, g, b] = parseHexColor(stops[stops.length - 1]![1]);
  return `rgba(${r},${g},${b},0.9)`;
}

function canvasSizeFor(meta: ClimateMeta): [number, number] {
  const s = Math.min(1, MAX_CANVAS_WIDTH / meta.width, MAX_CANVAS_HEIGHT / meta.height);
  return [Math.max(2, Math.round(meta.width * s)), Math.max(2, Math.round(meta.height * s))];
}

function coordinatesFor(meta: ClimateMeta): [[number, number], [number, number], [number, number], [number, number]] {
  const [lonMin, latMin, lonMax, latMax] = meta.bbox;
  // WebMercator native raster/canvas sources不吃 ±90；globe 也用略縮緯度避免極區奇點。
  const north = clamp(latMax, -85.051129, 85.051129);
  const south = clamp(latMin, -85.051129, 85.051129);
  return [
    [lonMin, north],
    [lonMax, north],
    [lonMax, south],
    [lonMin, south],
  ];
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`failed to load image: ${src}`));
    img.src = src;
  });
}

class ClimateCanvasParticleAnimator {
  readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly data: Uint8ClampedArray;
  private readonly meta: ClimateMeta;
  private readonly particles: Particle[] = [];
  private readonly isGlobalX: boolean;
  private readonly ramp: Record<number, string>;
  private readonly speedMax: number;
  private readonly getParticleCount: () => number;
  private readonly getAnimationSpeed: () => number;
  private readonly getOpacity: () => number;
  private readonly getTimeScaleSeconds: () => number;
  private raf = 0;
  private running = false;
  private lastTs = 0;
  private lastRequestedCount = 0;

  constructor(args: {
    meta: ClimateMeta;
    image: HTMLImageElement;
    ramp: Record<number, string>;
    speedMax: number;
    getParticleCount: () => number;
    getAnimationSpeed: () => number;
    getOpacity: () => number;
    getTimeScaleSeconds: () => number;
    onFrame: () => void;
  }) {
    this.meta = args.meta;
    this.ramp = args.ramp;
    this.speedMax = args.speedMax;
    this.getParticleCount = args.getParticleCount;
    this.getAnimationSpeed = args.getAnimationSpeed;
    this.getOpacity = args.getOpacity;
    this.getTimeScaleSeconds = args.getTimeScaleSeconds;
    this.onFrame = args.onFrame;
    this.isGlobalX = Math.abs(args.meta.bbox[2] - args.meta.bbox[0]) > 300;

    const [w, h] = canvasSizeFor(args.meta);
    this.canvas = document.createElement("canvas");
    this.canvas.width = w;
    this.canvas.height = h;
    const ctx = this.canvas.getContext("2d", { alpha: true });
    if (!ctx) throw new Error("2d canvas context unavailable");
    this.ctx = ctx;

    const dataCanvas = document.createElement("canvas");
    dataCanvas.width = args.meta.width;
    dataCanvas.height = args.meta.height;
    const dataCtx = dataCanvas.getContext("2d", { willReadFrequently: true });
    if (!dataCtx) throw new Error("data canvas context unavailable");
    dataCtx.drawImage(args.image, 0, 0, args.meta.width, args.meta.height);
    this.data = dataCtx.getImageData(0, 0, args.meta.width, args.meta.height).data;

    this.resizeParticles(this.getParticleCount());
  }

  private readonly onFrame: () => void;

  start() {
    if (this.running) return;
    this.running = true;
    this.lastTs = performance.now();
    const tick = (ts: number) => {
      if (!this.running) return;
      const dt = clamp((ts - this.lastTs) / 1000, 0, MAX_FRAME_DT);
      this.lastTs = ts;
      this.step(dt);
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  stop() {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  private resizeParticles(count: number) {
    const next = clamp(Math.floor(count || 0), 100, 30_000);
    if (next === this.lastRequestedCount && this.particles.length === next) return;
    this.lastRequestedCount = next;
    if (this.particles.length > next) {
      this.particles.length = next;
      return;
    }
    while (this.particles.length < next) {
      this.particles.push(this.randomParticle());
    }
  }

  private randomParticle(): Particle {
    for (let i = 0; i < MAX_RESPAWN_TRIES; i++) {
      const x = Math.random();
      const y = Math.random();
      if (this.sampleValid(x, y)) return { x, y, px: x, py: y, age: Math.random() * 120 };
    }
    const x = Math.random();
    const y = Math.random();
    return { x, y, px: x, py: y, age: 0 };
  }

  private sampleRaw(x: number, y: number): [number, number, number] {
    const px = clamp(Math.floor(x * (this.meta.width - 1)), 0, this.meta.width - 1);
    const py = clamp(Math.floor(y * (this.meta.height - 1)), 0, this.meta.height - 1);
    const i = (py * this.meta.width + px) * 4;
    return [this.data[i] ?? 0, this.data[i + 1] ?? 0, this.data[i + 3] ?? 0];
  }

  private sampleValid(x: number, y: number): boolean {
    if (y < 0 || y > 1) return false;
    if (!this.isGlobalX && (x < 0 || x > 1)) return false;
    const xx = this.isGlobalX ? ((x % 1) + 1) % 1 : x;
    return this.sampleRaw(xx, y)[2] >= 128;
  }

  private sampleVector(x: number, y: number): { u: number; v: number; valid: boolean; speed: number } {
    const xx = this.isGlobalX ? ((x % 1) + 1) % 1 : x;
    const [r, g, a] = this.sampleRaw(xx, y);
    const valid = a >= 128;
    const u = this.meta.u_min + (r / 255) * (this.meta.u_max - this.meta.u_min);
    const v = this.meta.v_min + (g / 255) * (this.meta.v_max - this.meta.v_min);
    return { u, v, valid, speed: Math.hypot(u, v) };
  }

  private step(dt: number) {
    this.resizeParticles(this.getParticleCount());

    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    // 先用 alpha 衰減舊軌跡，讓 canvas source 本身保持透明，可被 Mapbox drape 到 globe 上。
    ctx.save();
    ctx.globalCompositeOperation = "destination-in";
    ctx.fillStyle = "rgba(0,0,0,0.965)";
    ctx.fillRect(0, 0, w, h);
    ctx.restore();

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.lineWidth = Math.max(0.65, Math.min(1.5, w / 1000));
    ctx.lineCap = "round";

    const [lonMin, latMin, lonMax, latMax] = this.meta.bbox;
    const lonSpan = Math.max(1e-6, lonMax - lonMin);
    const latSpan = Math.max(1e-6, latMax - latMin);
    const flowSeconds = this.getTimeScaleSeconds() * this.getAnimationSpeed() * dt;
    const layerOpacity = clamp(this.getOpacity(), 0, 1);

    for (const p of this.particles) {
      p.age += dt * 60;
      if (p.age > 180 + Math.random() * 120 || !this.sampleValid(p.x, p.y)) {
        Object.assign(p, this.randomParticle());
        continue;
      }

      const vec = this.sampleVector(p.x, p.y);
      if (!vec.valid) {
        Object.assign(p, this.randomParticle());
        continue;
      }

      const lat = latMax - p.y * latSpan;
      const metersPerDegLon = Math.max(20_000, EARTH_METERS_PER_DEG_LON_AT_EQUATOR * Math.cos(lat * Math.PI / 180));
      const dx = (vec.u * flowSeconds / metersPerDegLon) / lonSpan;
      const dy = -(vec.v * flowSeconds / EARTH_METERS_PER_DEG_LAT) / latSpan;
      let nx = p.x + dx;
      const ny = p.y + dy;

      if (this.isGlobalX) nx = ((nx % 1) + 1) % 1;
      if (!this.sampleValid(nx, ny)) {
        Object.assign(p, this.randomParticle());
        continue;
      }

      const speedT = clamp(vec.speed / Math.max(0.001, this.speedMax), 0, 1);
      ctx.strokeStyle = colorFromRamp(this.ramp, speedT).replace("0.9)", `${0.25 + 0.65 * layerOpacity})`);

      // 跨 antimeridian 時不要畫一條穿越整張貼圖的長線。
      if (this.isGlobalX && Math.abs(nx - p.x) > 0.5) {
        p.px = nx;
        p.py = ny;
        p.x = nx;
        p.y = ny;
        continue;
      }

      ctx.beginPath();
      ctx.moveTo(p.x * w, p.y * h);
      ctx.lineTo(nx * w, ny * h);
      ctx.stroke();

      p.px = p.x;
      p.py = p.y;
      p.x = nx;
      p.y = ny;
    }
    ctx.restore();

    this.onFrame();
  }
}

export function useClimateCanvasParticleLayer(
  mapRef: React.RefObject<MapboxMap | null>,
  o: ClimateCanvasParticleLayerOptions,
) {
  const visibleRef = useRef(o.visible);
  const opacityRef = useRef(o.opacity);
  const speedRef = useRef(o.animationSpeed);
  const countRef = useRef(o.particleCount);
  const timeScaleRef = useRef(o.timeScaleSeconds ?? 3600);
  const animatorRef = useRef<ClimateCanvasParticleAnimator | null>(null);

  visibleRef.current = o.visible;
  opacityRef.current = o.opacity;
  speedRef.current = o.animationSpeed;
  countRef.current = o.particleCount;
  timeScaleRef.current = o.timeScaleSeconds ?? 3600;

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !o.visible) return;

    const sourceId = `${o.layerId}-source`;
    let cancelled = false;

    async function addLayer() {
      if (!map || cancelled) return;
      if (map.getLayer(o.layerId) && map.getSource(sourceId)) return;

      // 先讀 meta 拿 valid_at，PNG 帶 ?v= 破快取（S3 每日重烤 → 前端追得上，見 climateFieldSampler 同款）
      const meta = await fetch(o.metaUrl, { cache: "no-cache" }).then((r) => {
        if (!r.ok) throw new Error(`${o.metaUrl} ${r.status}`);
        return r.json() as Promise<ClimateMeta>;
      });
      const image = await loadImage(o.pngUrl + (meta.valid_at ? `?v=${encodeURIComponent(meta.valid_at)}` : ""));
      if (cancelled || !map) return;

      const animator = new ClimateCanvasParticleAnimator({
        meta,
        image,
        ramp: o.rampColors ?? DEFAULT_RAMP,
        speedMax: o.speedMax ?? Math.max(Math.hypot(meta.u_min, meta.v_min), Math.hypot(meta.u_max, meta.v_max)),
        getParticleCount: () => countRef.current,
        getAnimationSpeed: () => speedRef.current,
        getOpacity: () => opacityRef.current,
        getTimeScaleSeconds: () => timeScaleRef.current,
        onFrame: () => map?.triggerRepaint(),
      });
      animatorRef.current = animator;

      if (!map.getSource(sourceId)) {
        map.addSource(sourceId, {
          type: "canvas",
          canvas: animator.canvas,
          coordinates: coordinatesFor(meta),
          animate: true,
        // mapbox-gl typings currently omit CanvasSourceSpecification. Runtime API supports it.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any);
      }
      if (!map.getLayer(o.layerId)) {
        map.addLayer({
          id: o.layerId,
          type: "raster",
          source: sourceId,
          paint: {
            "raster-opacity": opacityRef.current,
            "raster-fade-duration": 0,
            "raster-resampling": "linear",
          },
        });
      }
      animator.start();
    }

    const safeAddLayer = () => {
      void addLayer().catch((e) => console.warn(`[ClimateCanvasParticle ${o.layerId}] add failed`, e));
    };

    if (map.isStyleLoaded()) safeAddLayer();
    else map.once("load", safeAddLayer);
    map.on("style.load", safeAddLayer);

    return () => {
      cancelled = true;
      map.off("style.load", safeAddLayer);
      animatorRef.current?.stop();
      animatorRef.current = null;
      try {
        if (map.getLayer(o.layerId)) map.removeLayer(o.layerId);
        if (map.getSource(sourceId)) map.removeSource(sourceId);
      } catch {
        // style reload 中可能已被清掉
      }
    };
    // rampColors / speedMax / timeScaleSeconds 在 animator 建立時消費；slider 用 ref 即時讀。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapRef, o.layerId, o.pngUrl, o.metaUrl, o.visible]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.getLayer(o.layerId)) return;
    try {
      map.setPaintProperty(o.layerId, "raster-opacity", o.visible ? o.opacity : 0);
      const source = map.getSource(`${o.layerId}-source`) as CanvasSource | undefined;
      if (o.visible) {
        source?.play?.();
        animatorRef.current?.start();
      } else {
        source?.pause?.();
        animatorRef.current?.stop();
      }
    } catch {
      // source/layer 正在 style reload 時忽略，下一輪 style.load 會補回
    }
  }, [mapRef, o.layerId, o.visible, o.opacity]);
}
