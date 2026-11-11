/**
 * City Sound Atlas — 地圖動畫（純 requestAnimationFrame，不經 React）。
 *
 * 語意界線（不可誇大）：
 * - 波紋、脈動環、雨滴漣漪、音符都是「示意此來源此刻有活動」，**不是聲壓範圍、不是 dB**；
 *   大小／頻率／透明度只跟引擎的 relativePotential（0–1）成比例。
 * - 位置一律來自來源原座標（contributionPlace）；位置未知（航跡缺口）不畫。
 * - 雷：閃光與「抵達」以時間軸跨過 flashTime／flashTime+距離÷聲速判定（示意，聲速固定）。
 *
 * 效能：
 * - 最多約 30 fps 寫一次 GeoJSON；沒有任何活動時不寫（畫面靜止）。
 * - 每種動畫都有上限（ANIM_CAPS）；圖層全關由 hook 呼叫 dispose() 停迴圈並移除圖層。
 * - 「當下」結果由 hook 以 4 Hz 推進來（update），這裡不重跑引擎查詢；
 *   只有活躍航機的位置每幀依時間軸重算（讓飛機沿航跡平滑移動）。
 */
import type { GeoJSONSource, Map as MapboxMap } from "mapbox-gl";
import type { Feature, FeatureCollection } from "geojson";
import { timeStore } from "../state/timeStore";
import { AVIATION, COMMON, THUNDER } from "./model/soundProfiles";
import { haversineM } from "./engines/geometryDistance";
import type { ReceiverQueryResult } from "./engines/receiverQuery";
import { contributionPlace } from "./soundAtlasData";
import { SOUND_FAMILY_COLORS, SOUND_FLASH_COLOR, SOUND_RECEIVER_COLOR, SOUND_UNKNOWN_COLOR } from "./soundAtlasColors";
import type { Receiver, SoundSourceFamily, SoundSourceRecord } from "./types";

export const ANIM_SOURCE = "sound-atlas-anim";
export const ANIM_LAYERS = {
  link: "sound-atlas-anim-link",
  circle: "sound-atlas-anim-circle",
  note: "sound-atlas-anim-note",
} as const;
const NOTE_IMAGE = "sound-atlas-note";

/** 同時動畫實例上限（超過就只畫潛勢最高的前幾個） */
export const ANIM_CAPS = { planes: 8, ripplesPerPlane: 3, rainDrops: 28, flashes: 12, notes: 16 } as const;

const FRAME_MIN_MS = 33;
const FLASH_MS = 300;
/** 落雷點標記保留時間（模擬秒；與波前淡出同量級，示意） */
const STRIKE_MARK_S = 60;
const RECEIVER_FLASH_MS = 450;
/** 時間軸一次跳太遠（拖曳、選場景）不觸發閃光，只在連續播放時觸發 */
const MAX_CROSSING_STEP_S = 120;
const M_PER_DEG = 111_195;
const RECEIVER_SHADOW = `0 0 0 3px ${SOUND_RECEIVER_COLOR}, 0 0 10px rgba(0,0,0,0.6)`;

export interface AnimatorState {
  receiver: Receiver | null;
  result: ReceiverQueryResult | null;
  records: Map<string, SoundSourceRecord>;
  thunderStrikes: { lon: number; lat: number; flashTime: number }[];
  flags: Record<SoundSourceFamily, boolean>;
  opacity: Record<SoundSourceFamily, number>;
}

/** 0–1 的小型決定性雜湊（雨滴位置用；同一格同一週期位置固定，避免閃爍） */
export function hash01(a: number, b: number): number {
  let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

/** 波紋相位：潛勢越高越快（週期 2.4 s → 1.0 s），回傳 0–1 */
export function ripplePhase(nowMs: number, potential: number, index: number, count: number): number {
  const period = 2400 - 1400 * Math.max(0, Math.min(1, potential));
  return ((nowMs / period + index / count) % 1 + 1) % 1;
}

/** 雨滴數量：只跟雨的相對潛勢成比例（無雨 0 顆；unknown 呼叫端不呼叫） */
export function rainDropCount(potential: number, cap: number = ANIM_CAPS.rainDrops): number {
  if (!(potential > 0)) return 0;
  return Math.max(1, Math.min(cap, Math.round(potential * cap)));
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

function makeNoteImage(): ImageData | null {
  const size = 40;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = SOUND_FAMILY_COLORS.waste_collection;
  // 手繪八分音符（不依賴字型有沒有 ♪）
  ctx.beginPath();
  ctx.ellipse(14, 29, 7, 5.5, -0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(19, 7, 3, 22);
  ctx.beginPath();
  ctx.moveTo(22, 7);
  ctx.quadraticCurveTo(32, 12, 30, 22);
  ctx.quadraticCurveTo(29, 15, 22, 14);
  ctx.closePath();
  ctx.fill();
  return ctx.getImageData(0, 0, size, size);
}

export function ensureAnimLayers(map: MapboxMap): void {
  if (!map.getSource(ANIM_SOURCE)) map.addSource(ANIM_SOURCE, { type: "geojson", data: { type: "FeatureCollection", features: [] } });
  if (!map.hasImage(NOTE_IMAGE)) {
    const img = makeNoteImage();
    if (img) map.addImage(NOTE_IMAGE, img, { pixelRatio: 2 });
  }
  if (!map.getLayer(ANIM_LAYERS.link)) {
    map.addLayer({
      id: ANIM_LAYERS.link, type: "line", source: ANIM_SOURCE,
      filter: ["==", ["get", "kind"], "link"],
      paint: { "line-color": ["get", "color"], "line-width": ["get", "width"], "line-opacity": ["get", "opacity"], "line-dasharray": [2, 1.5] },
    });
  }
  if (!map.getLayer(ANIM_LAYERS.circle)) {
    map.addLayer({
      id: ANIM_LAYERS.circle, type: "circle", source: ANIM_SOURCE,
      filter: ["==", ["get", "kind"], "circle"],
      paint: {
        "circle-radius": ["get", "r"],
        "circle-color": ["get", "fill"],
        "circle-opacity": ["get", "fillOpacity"],
        "circle-stroke-color": ["get", "stroke"],
        "circle-stroke-width": ["get", "strokeWidth"],
        "circle-stroke-opacity": ["get", "opacity"],
        "circle-blur": ["get", "blur"],
        "circle-pitch-alignment": "map",
      },
    });
  }
  if (!map.getLayer(ANIM_LAYERS.note)) {
    map.addLayer({
      id: ANIM_LAYERS.note, type: "symbol", source: ANIM_SOURCE,
      filter: ["==", ["get", "kind"], "note"],
      layout: { "icon-image": NOTE_IMAGE, "icon-size": ["get", "size"], "icon-allow-overlap": true, "icon-ignore-placement": true, "icon-offset": [0, -18] },
      paint: { "icon-opacity": ["get", "opacity"] },
    });
  }
}

export function removeAnimLayers(map: MapboxMap): void {
  for (const id of Object.values(ANIM_LAYERS)) if (map.getLayer(id)) map.removeLayer(id);
  if (map.getSource(ANIM_SOURCE)) map.removeSource(ANIM_SOURCE);
  if (map.hasImage(NOTE_IMAGE)) map.removeImage(NOTE_IMAGE);
}

type Props = Record<string, string | number>;
const pt = (lon: number, lat: number, properties: Props): Feature => ({ type: "Feature", geometry: { type: "Point", coordinates: [lon, lat] }, properties });

function circle(lon: number, lat: number, o: { r: number; fill?: string; fillOpacity?: number; stroke: string; strokeWidth: number; opacity: number; blur?: number }): Feature {
  return pt(lon, lat, {
    kind: "circle", r: o.r, fill: o.fill ?? "rgba(0,0,0,0)", fillOpacity: o.fillOpacity ?? 0,
    stroke: o.stroke, strokeWidth: o.strokeWidth, opacity: o.opacity, blur: o.blur ?? 0,
  });
}

/** 接收點標記 DOM：人形＋外圈家族環（環由動畫器每幀改 style，不經 React） */
export interface ReceiverElements {
  root: HTMLDivElement;
  core: HTMLDivElement;
  rings: Record<SoundSourceFamily, HTMLDivElement>;
}

export function createReceiverElements(): ReceiverElements {
  const root = document.createElement("div");
  root.setAttribute("role", "img");
  root.setAttribute("aria-label", "接收點（聆聽位置）");
  Object.assign(root.style, { position: "relative", width: "34px", height: "34px", cursor: "grab" });
  const rings = {} as Record<SoundSourceFamily, HTMLDivElement>;
  for (const fam of ["aviation", "rain", "thunder", "waste_collection"] as const) {
    const ring = document.createElement("div");
    Object.assign(ring.style, {
      position: "absolute", left: "0", top: "0", width: "34px", height: "34px", borderRadius: "50%",
      boxSizing: "border-box", border: `2px solid ${SOUND_FAMILY_COLORS[fam]}`, opacity: "0", pointerEvents: "none",
      willChange: "transform, opacity",
    });
    root.appendChild(ring);
    rings[fam] = ring;
  }
  const core = document.createElement("div");
  Object.assign(core.style, {
    position: "absolute", left: "5px", top: "5px", width: "24px", height: "24px", borderRadius: "50%",
    background: SOUND_FLASH_COLOR, boxShadow: RECEIVER_SHADOW,
    display: "flex", alignItems: "center", justifyContent: "center", transition: "box-shadow 120ms",
  });
  // 人形（頭＋肩）＋右側聲波弧：表示「在這裡聽」
  core.innerHTML =
    '<svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">' +
    '<circle cx="7" cy="5" r="3" fill="#0f172a"/>' +
    '<path d="M1.5 16.5c0-3.3 2.5-5.5 5.5-5.5s5.5 2.2 5.5 5.5z" fill="#0f172a"/>' +
    '<path d="M12.5 3.5a5 5 0 0 1 0 6" stroke="#be185d" stroke-width="1.6" fill="none" stroke-linecap="round"/>' +
    '<path d="M14.8 1.8a8 8 0 0 1 0 9.4" stroke="#be185d" stroke-width="1.4" fill="none" stroke-linecap="round"/>' +
    "</svg>";
  root.appendChild(core);
  return { root, core, rings };
}

export class SoundAtlasAnimator {
  private raf = 0;
  private lastFrame = 0;
  private lastWroteEmpty = true;
  private prevT: number | null = null;
  private flashes: { lon: number; lat: number; startMs: number }[] = [];
  private receiverFlashUntil = 0;
  private state: AnimatorState;
  /** 播放時的影格耗時（ms）：最近 120 幀，給效能紀錄用 */
  readonly frameMs: number[] = [];

  constructor(private map: MapboxMap, private receiverEls: () => ReceiverElements | null, initial: AnimatorState) {
    this.state = initial;
    this.raf = requestAnimationFrame(this.frame);
  }

  update(patch: Partial<AnimatorState>): void {
    this.state = { ...this.state, ...patch };
  }

  dispose(): void {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    const src = this.map.getSource(ANIM_SOURCE) as GeoJSONSource | undefined;
    src?.setData({ type: "FeatureCollection", features: [] });
  }

  private frame = (now: number): void => {
    this.raf = requestAnimationFrame(this.frame);
    if (now - this.lastFrame < FRAME_MIN_MS) return;
    this.lastFrame = now;
    const t0 = performance.now();
    const t = timeStore.getTime();
    this.detectThunderCrossings(t, now);
    const features = this.buildFeatures(t, now);
    this.updateReceiver(now);
    const src = this.map.getSource(ANIM_SOURCE) as GeoJSONSource | undefined;
    if (src && (features.length > 0 || !this.lastWroteEmpty)) {
      src.setData({ type: "FeatureCollection", features } satisfies FeatureCollection);
      this.lastWroteEmpty = features.length === 0;
    }
    this.frameMs.push(performance.now() - t0);
    if (this.frameMs.length > 120) this.frameMs.shift();
  };

  private detectThunderCrossings(t: number, nowMs: number): void {
    const prev = this.prevT;
    this.prevT = t;
    const { flags, thunderStrikes, receiver } = this.state;
    if (!flags.thunder || prev == null || t <= prev || t - prev > MAX_CROSSING_STEP_S) return;
    for (const s of thunderStrikes) {
      if (s.flashTime > prev && s.flashTime <= t) {
        this.flashes.push({ lon: s.lon, lat: s.lat, startMs: nowMs });
      }
      if (receiver) {
        const d = haversineM(s.lon, s.lat, receiver.longitude, receiver.latitude);
        if (d > THUNDER.candidateRadiusM.value) continue;
        const arrival = s.flashTime + d / COMMON.speedOfSoundMps.value;
        if (arrival > prev && arrival <= t) this.receiverFlashUntil = nowMs + RECEIVER_FLASH_MS;
      }
    }
    if (this.flashes.length > ANIM_CAPS.flashes) this.flashes.splice(0, this.flashes.length - ANIM_CAPS.flashes);
  }

  private buildFeatures(t: number, nowMs: number): Feature[] {
    const { receiver, result, records, flags, opacity } = this.state;
    const out: Feature[] = [];
    const op = (f: SoundSourceFamily) => clamp01(opacity[f]);

    // 雷：落雷點白光（約 0.3 s，牆鐘）
    this.flashes = this.flashes.filter((f) => nowMs - f.startMs < FLASH_MS);
    for (const f of this.flashes) {
      const k = (nowMs - f.startMs) / FLASH_MS;
      out.push(circle(f.lon, f.lat, { r: 8 + 34 * k, fill: SOUND_FLASH_COLOR, fillOpacity: (1 - k) * op("thunder"), stroke: SOUND_FLASH_COLOR, strokeWidth: 0, opacity: 0, blur: 0.6 }));
    }

    // 雷：閃光後到雷聲抵達前，落雷點本身還不在引擎結果（尚未聽到），標一個小點讓波前有起點
    if (flags.thunder) {
      let n = 0;
      for (const s of this.state.thunderStrikes) {
        const dt = t - s.flashTime;
        if (dt < 0 || dt > STRIKE_MARK_S) continue;
        out.push(circle(s.lon, s.lat, { r: 4, fill: SOUND_FAMILY_COLORS.thunder, fillOpacity: (1 - dt / STRIKE_MARK_S) * op("thunder"), stroke: SOUND_FLASH_COLOR, strokeWidth: 1, opacity: (1 - dt / STRIKE_MARK_S) * op("thunder") }));
        if (++n >= ANIM_CAPS.flashes) break;
      }
    }

    if (!receiver || !result) return out;
    const active = result.contributions.filter((c) => c.status === "active" && c.relativePotential != null && flags[c.family]);

    // 飛機：沿航跡移動＋同心波紋（遠方 < 顯示門檻只由點圖層畫淡點）
    const planes = active
      .filter((c) => c.family === "aviation" && c.relativePotential! >= AVIATION.displayMinPotential.value)
      .slice(0, ANIM_CAPS.planes);
    for (const c of planes) {
      const place = contributionPlace(records.get(c.sourceId), t);
      if (!place) continue;
      const p = c.relativePotential!;
      const o = op("aviation");
      out.push({
        type: "Feature",
        geometry: { type: "LineString", coordinates: [[receiver.longitude, receiver.latitude], [place.lon, place.lat]] },
        properties: { kind: "link", color: SOUND_FAMILY_COLORS.aviation, width: 1 + 2.5 * p, opacity: (0.25 + 0.75 * p) * o },
      });
      for (let i = 0; i < ANIM_CAPS.ripplesPerPlane; i++) {
        const ph = ripplePhase(nowMs, p, i, ANIM_CAPS.ripplesPerPlane);
        out.push(circle(place.lon, place.lat, {
          r: 7 + ph * (16 + 44 * p), stroke: SOUND_FAMILY_COLORS.aviation, strokeWidth: 1.5 + p, opacity: (1 - ph) * (0.25 + 0.65 * p) * o,
        }));
      }
      out.push(circle(place.lon, place.lat, { r: 5 + 4 * p, fill: SOUND_FAMILY_COLORS.aviation, fillOpacity: o, stroke: SOUND_FLASH_COLOR, strokeWidth: 1.5, opacity: o }));
    }

    // 雨：接收點周圍＋雨量站周圍的雨滴漣漪；密度只跟雨的潛勢成比例；unknown 不畫
    const rain = active.find((c) => c.family === "rain");
    if (rain) {
      const station = contributionPlace(records.get(rain.sourceId), t);
      const centres = [{ lon: receiver.longitude, lat: receiver.latitude }, ...(station ? [{ lon: station.lon, lat: station.lat }] : [])];
      const n = rainDropCount(rain.relativePotential!);
      const per = Math.max(1, Math.round(n / centres.length));
      const cycleMs = 1100;
      const cosLat = Math.cos(receiver.latitude * (Math.PI / 180));
      centres.forEach((ctr, ci) => {
        for (let i = 0; i < per; i++) {
          const phase = ((nowMs / cycleMs + i / per) % 1 + 1) % 1;
          const cycle = Math.floor(nowMs / cycleMs + i / per);
          const ang = hash01(i + ci * 97, cycle) * Math.PI * 2;
          const dist = 80 + Math.sqrt(hash01(cycle, i * 31 + ci)) * 1200;
          const lon = ctr.lon + (Math.cos(ang) * dist) / (M_PER_DEG * cosLat);
          const lat = ctr.lat + (Math.sin(ang) * dist) / M_PER_DEG;
          out.push(circle(lon, lat, { r: 3 + 13 * phase, stroke: SOUND_FAMILY_COLORS.rain, strokeWidth: 1.8, opacity: (1 - phase) * 0.95 * op("rain") }));
        }
      });
    }

    // 垃圾車：活躍停點的音符脈動
    const notes = active.filter((c) => c.family === "waste_collection").slice(0, ANIM_CAPS.notes);
    for (const c of notes) {
      const place = contributionPlace(records.get(c.sourceId), t);
      if (!place) continue;
      const p = c.relativePotential!;
      const pulse = 0.5 + 0.5 * Math.sin((nowMs / (900 - 400 * p)) * Math.PI * 2);
      out.push(pt(place.lon, place.lat, { kind: "note", size: 0.8 + 0.35 * pulse * (0.5 + p), opacity: (0.55 + 0.45 * pulse) * op("waste_collection") }));
    }
    return out;
  }

  /** 接收點外圈：活躍家族彩色脈動（強度∝潛勢）、unknown 灰色虛線靜止、全部無活動時靜止不顯示 */
  private updateReceiver(nowMs: number): void {
    const els = this.receiverEls();
    if (!els) return;
    const { result, flags } = this.state;
    for (const fam of ["aviation", "rain", "thunder", "waste_collection"] as const) {
      const ring = els.rings[fam];
      const fr = flags[fam] ? result?.families.find((f) => f.family === fam) : undefined;
      if (fr?.status === "active" && fr.relativePotential != null && fr.relativePotential > 0) {
        const p = fr.relativePotential;
        const idx = ["aviation", "rain", "thunder", "waste_collection"].indexOf(fam);
        const ph = ripplePhase(nowMs, p, idx, 4);
        ring.style.border = `${(1.5 + 2 * p).toFixed(1)}px solid ${SOUND_FAMILY_COLORS[fam]}`;
        ring.style.transform = `scale(${(1 + ph * (0.8 + 1.6 * p)).toFixed(3)})`;
        ring.style.opacity = ((1 - ph) * (0.35 + 0.65 * p)).toFixed(3);
      } else if (fr?.status === "unknown") {
        ring.style.border = `1.5px dashed ${SOUND_UNKNOWN_COLOR}`;
        ring.style.transform = `scale(${(1.25 + 0.18 * ["aviation", "rain", "thunder", "waste_collection"].indexOf(fam)).toFixed(2)})`;
        ring.style.opacity = "0.75";
      } else {
        ring.style.opacity = "0";
      }
    }
    const flashing = nowMs < this.receiverFlashUntil;
    els.core.style.boxShadow = flashing
      ? `0 0 0 3px ${SOUND_FAMILY_COLORS.thunder}, 0 0 26px 10px ${SOUND_FAMILY_COLORS.thunder}`
      : RECEIVER_SHADOW;
  }
}

/** 目前掛著的動畫器（效能紀錄、測試讀 frameMs 用）；圖層全關時為 null */
let currentAnimator: SoundAtlasAnimator | null = null;
export function setSoundAtlasAnimator(a: SoundAtlasAnimator | null): void {
  currentAnimator = a;
}
export function getSoundAtlasAnimator(): SoundAtlasAnimator | null {
  return currentAnimator;
}
