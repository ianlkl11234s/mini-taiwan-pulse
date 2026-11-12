/**
 * 2026 選舉活動：確切地點（地址／地標／路口）同座標多場，拉近（z≥13）時展開成各場自己的點，
 * 緊密排成一小簇（無連線、無中心點；使用者 2026-11-12 在預覽 E 版選定）。拉遠維持數字合成圖示。
 *
 * - 位移是固定螢幕 px（icon-offset，不改資料座標），所以縮放時不會漂開；大小滑桿（icon-size）等比放大點與位移。
 * - 點的大小與 overlay circle 子圖層 z≥12 時相同：規模基準半徑 × 1.25（已過 × 0.7）。
 * - 排法：由新到舊從正上方順時針；相鄰兩點依各自半徑相切（間距 SPREAD_GAP），大點只撐開自己兩側，不撐開整圈。
 * - 退回規則：超過 SPREAD_MAX_N 場不展開（各縮放都畫數字圖示，點開清單）：場數再多，一簇點會大到蓋住周邊、
 *   也難逐一點選，清單比較好讀。（預覽版 9–12 場改用寬間距、>12 不展開；正式版的相切排法不分場數，所以只保留這一條。）
 * - 位移寫在要素屬性：`_ofs`（[dx, dy]，給 icon-offset 讀）與 `_dx`／`_dy`（數值，給點擊排序與選取圈讀；
 *   queryRenderedFeatures 回傳的巢狀屬性會變成字串，數值屬性不會）。
 */
import type { Map as MapboxMap, MapboxGeoJSONFeature } from "mapbox-gl";
import {
  ELECTION_CAMP_COLOR,
  ELECTION_PAST_OPACITY,
  ELECTION_PAST_RADIUS,
  ELECTION_TIER_RADIUS,
  type ElectionCampKey,
} from "../data/electionEventsTypes";
import { MAP_SEAM, POINT_STROKE_DATA_ENCODED } from "./mapStyleScale";

/** 展開的縮放門檻（含）；門檻前後 ±SPREAD_FADE 以透明度交叉淡入淡出 */
export const SPREAD_MINZOOM = 13;
export const SPREAD_FADE = 0.15;
export const SPREAD_MAX_N = 8;
export const SPREAD_GAP = 1;
/** 與 overlay circle 子圖層 z≥12 的半徑倍率相同 */
const NEAR_RADIUS_FACTOR = 1.25;
const PIXEL_RATIO = 2;

export type ElectionTier = "L" | "M" | "S";

export function electionTier(v: unknown): ElectionTier {
  return v === "L" || v === "M" ? v : "S";
}

/** 展開點的半徑（px，大小滑桿 1 倍時） */
export function spreadDotRadius(tier: ElectionTier, past: boolean): number {
  return ELECTION_TIER_RADIUS[tier] * NEAR_RADIUS_FACTOR * (past ? ELECTION_PAST_RADIUS : 1);
}

/**
 * 依各點半徑排成一圈，相鄰兩點相切（中心距＝r_i＋r_{i+1}＋gap）。
 * 以二分法找圈半徑 R，使相鄰夾角總和＝2π；若大小差太多（最小可行 R 時夾角總和仍不到 2π），
 * 就用最小 R，把剩下的角度平均分給每個間隔。回傳各點位移（px，整數；y 向下為正）。
 */
export function spreadLayout(radii: readonly number[], gap = SPREAD_GAP): [number, number][] {
  const n = radii.length;
  if (n === 0) return [];
  if (n === 1) return [[0, 0]];
  const chord = radii.map((r, i) => r + radii[(i + 1) % n]! + gap);
  const angleSum = (R: number) => chord.reduce((s, c) => s + 2 * Math.asin(Math.min(1, c / (2 * R))), 0);
  let lo = Math.max(...chord) / 2;
  let R = lo;
  if (angleSum(lo) > 2 * Math.PI) {
    let hi = lo * 4 + 50;
    for (let k = 0; k < 60; k++) {
      const mid = (lo + hi) / 2;
      if (angleSum(mid) > 2 * Math.PI) lo = mid; else hi = mid;
    }
    R = hi;
  }
  const steps = chord.map((c) => 2 * Math.asin(Math.min(1, c / (2 * R))));
  const extra = (2 * Math.PI - steps.reduce((s, a) => s + a, 0)) / n;
  const out: [number, number][] = [];
  let a = -Math.PI / 2;
  for (let i = 0; i < n; i++) {
    out.push([roundPx(R * Math.cos(a)), roundPx(R * Math.sin(a))]);
    a += steps[i]! + extra;
  }
  return out;
}

/** 對稱取整（±0.5 都往外），並去掉 -0 */
function roundPx(v: number): number {
  return Math.sign(v) * Math.round(Math.abs(v)) || 0;
}

/** 展開點的位移（px，大小滑桿 1 倍時）；不是展開點回 null */
export function spreadOffsetOf(props: Record<string, unknown> | null | undefined): [number, number] | null {
  const dx = props?._dx;
  const dy = props?._dy;
  return typeof dx === "number" && typeof dy === "number" && Number.isFinite(dx) && Number.isFinite(dy) ? [dx, dy] : null;
}

// ── 單場點圖示（同 overlay circle 子圖層的語意：色＝陣營、大小＝規模、已過淡且小、取消／延期空心）──
export interface SpreadDotSpec { camp: ElectionCampKey; tier: ElectionTier; past: boolean; hollow: boolean }

const ICON_PREFIX = "election-spread-";
/** 圖示 id 不含底圖主題；layout 依主題接 "-d"／"-l" 後綴（描邊色依底圖） */
export function spreadDotIconId(s: SpreadDotSpec): string {
  return `${ICON_PREFIX}${s.camp}-${s.tier}-${s.past ? 1 : 0}-${s.hollow ? 1 : 0}`;
}
export function isSpreadDotIconId(id: string): boolean {
  return id.startsWith(ICON_PREFIX);
}

function drawDot(s: SpreadDotSpec, dark: boolean): { width: number; height: number; data: Uint8Array } | null {
  if (typeof document === "undefined") return null;
  const r = spreadDotRadius(s.tier, s.past);
  const size = Math.ceil(2 * (r + 2)) * PIXEL_RATIO;
  const cv = document.createElement("canvas");
  cv.width = size; cv.height = size;
  const g = cv.getContext("2d");
  if (!g) return null;
  g.scale(PIXEL_RATIO, PIXEL_RATIO);
  const C = size / PIXEL_RATIO / 2;
  const fade = s.past ? ELECTION_PAST_OPACITY : 1;
  const color = ELECTION_CAMP_COLOR[s.camp];
  g.beginPath(); g.arc(C, C, r, 0, 2 * Math.PI);
  if (s.hollow) {
    g.globalAlpha = fade;
    g.lineWidth = 2; g.strokeStyle = color; g.stroke();
  } else {
    g.globalAlpha = fade;
    g.fillStyle = color; g.fill();
    const theme = dark ? "dark" : "light";
    g.globalAlpha = s.past ? fade : POINT_STROKE_DATA_ENCODED.opacity[theme];
    g.lineWidth = 1; g.strokeStyle = MAP_SEAM[theme]; g.stroke();
  }
  return { width: size, height: size, data: new Uint8Array(g.getImageData(0, 0, size, size).data.buffer) };
}

/** 兩種底圖的圖示都備好（換底圖不必重算資料；styleimagemissing 也會呼叫） */
export function ensureSpreadDotIcon(map: MapboxMap, id: string, spec: SpreadDotSpec): void {
  for (const [suffix, dark] of [["-d", true], ["-l", false]] as const) {
    const full = `${id}${suffix}`;
    if (map.hasImage(full)) continue;
    const img = drawDot(spec, dark);
    if (!img) continue;
    try {
      map.addImage(full, img, { pixelRatio: PIXEL_RATIO });
    } catch (err) {
      console.warn("[ElectionEvents] addImage failed", err);
    }
  }
}

/**
 * 依目前縮放丟掉「看不到的那一半」：z≥門檻時數字圖示（`_spr`）已淡出、z<門檻時展開點（`_sp`）還沒出現，
 * 都不該回答點擊；再依距離排序（見 sortElectionHitsByDistance）。
 */
export function pickElectionHits(
  map: Pick<MapboxMap, "project" | "getZoom">,
  features: MapboxGeoJSONFeature[],
  point: { x: number; y: number },
  scale = 1,
): MapboxGeoJSONFeature[] {
  const near = map.getZoom() >= SPREAD_MINZOOM;
  const visible = features.filter((f) => (near ? f.properties?._spr !== 1 : f.properties?._sp !== 1));
  return sortElectionHitsByDistance(map, visible, point, scale);
}

/**
 * 點擊命中：展開點彼此相切、容差框會同時框到隔壁場。展開點依「點中心（錨點＋位移×大小滑桿）到游標的距離」排序，
 * 最近的優先；其他命中（數字圖示、單點）排在展開點之後，維持原順序。
 */
export function sortElectionHitsByDistance(
  map: Pick<MapboxMap, "project">,
  features: MapboxGeoJSONFeature[],
  point: { x: number; y: number },
  scale = 1,
): MapboxGeoJSONFeature[] {
  const dist = (f: MapboxGeoJSONFeature): number => {
    const off = spreadOffsetOf(f.properties);
    const g = f.geometry;
    if (!off || g?.type !== "Point") return Number.POSITIVE_INFINITY;
    const p = map.project(g.coordinates as [number, number]);
    return Math.hypot(p.x + off[0] * scale - point.x, p.y + off[1] * scale - point.y);
  };
  return features
    .map((f, i) => ({ f, i, d: dist(f) }))
    .sort((a, b) => (a.d === b.d ? a.i - b.i : a.d - b.d))
    .map((x) => x.f);
}

