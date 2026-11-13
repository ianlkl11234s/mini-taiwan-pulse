/**
 * 2026 選舉活動：同一代表點 2 場以上的圖示（中心深色圓＋白字場次數，外環依各陣營場次比例分段上色）。
 * 使用者 2026-11-08 核准設計稿「A＋B 版」；畫法照設計原型 donutImage。
 * 同一確切地點 2 場以上（precision＝"venue"，2026-11-12）：不畫精度外環與範圍面（外環＝不是活動地點），
 * 改畫實心分色圓（各陣營場次比例的扇形）＋中間場次數，沿用場館點「實心」的語意；大小規則與代表點相同（依場次數）。
 * 圖示依「陣營計數＋精度＋是否全已舉辦」做 key，同 key 只畫一次（map.addImage，pixelRatio 2）。
 */
import type { Map as MapboxMap } from "mapbox-gl";
import {
  ELECTION_CAMPS,
  ELECTION_CAMP_COLOR,
  ELECTION_RING_FILL_OPACITY,
  ELECTION_RING_OFFSET,
  type ElectionApproxPrecision,
  type ElectionCampKey,
} from "../data/electionEventsTypes";

export interface ElectionGroupIconSpec {
  counts: Partial<Record<ElectionCampKey, number>>;
  /** 代表點精度；"venue"＝確切地點多場 */
  precision: ElectionApproxPrecision | "venue";
  allPast: boolean;
}

const ICON_PREFIX = "election-grp-";
const PIXEL_RATIO = 2;
/** 中心圓與字色（地圖圖示與圖例示意共用） */
export const ELECTION_GROUP_ICON_COLORS = {
  centerFill: "rgba(10,10,20,0.9)",
  centerStroke: "rgba(255,255,255,0.35)",
  label: "#f3f4f6",
} as const;
const CENTER_FILL = ELECTION_GROUP_ICON_COLORS.centerFill;
const CENTER_STROKE = ELECTION_GROUP_ICON_COLORS.centerStroke;
const LABEL_COLOR = ELECTION_GROUP_ICON_COLORS.label;
/** 全部已過的淡化：與單點已過透明度等比（原 0.5 配單點 0.35；單點改 0.6 後約 0.86） */
const PAST_ALPHA = 0.86;

/** 圖示 id：同樣的陣營組合、精度、已舉辦狀態共用一張 */
export function electionGroupIconId(spec: ElectionGroupIconSpec): string {
  const camps = ELECTION_CAMPS.map((c) => c.key).filter((k) => (spec.counts[k] ?? 0) > 0)
    .map((k) => `${k}${spec.counts[k]}`).join("_");
  return `${ICON_PREFIX}${spec.precision}-${spec.allPast ? 1 : 0}-${camps}`;
}

export function isElectionGroupIconId(id: string): boolean {
  return id.startsWith(ICON_PREFIX);
}

/**
 * 外環各陣營弧段（從正上方順時針）。段間留 0.06 rad 縫，但縫不超過該段寬的一半：
 * 場次很多（n≥105）時某陣營只 1 場，段寬 2π/n 小於縫，否則 start>end 會讓 arc 繞近整圈蓋掉其他段（review F043）。
 */
export function electionRingSegments(
  counts: Partial<Record<ElectionCampKey, number>>,
  order: readonly ElectionCampKey[],
): { key: ElectionCampKey; start: number; end: number }[] {
  const n = order.reduce((s, k) => s + (counts[k] ?? 0), 0);
  if (n === 0) return [];
  const baseGap = order.length > 1 ? 0.06 : 0;
  const out: { key: ElectionCampKey; start: number; end: number }[] = [];
  let a0 = -Math.PI / 2;
  for (const key of order) {
    const a1 = a0 + (2 * Math.PI * (counts[key] ?? 0)) / n;
    const gap = Math.min(baseGap, (a1 - a0) * 0.5);
    out.push({ key, start: a0 + gap / 2, end: a1 - gap / 2 });
    a0 = a1;
  }
  return out;
}

function drawIcon(spec: ElectionGroupIconSpec): { width: number; height: number; data: Uint8Array } | null {
  if (typeof document === "undefined") return null;
  const order = ELECTION_CAMPS.map((c) => c.key).filter((k) => (spec.counts[k] ?? 0) > 0);
  const n = order.reduce((s, k) => s + (spec.counts[k] ?? 0), 0);
  if (n === 0) return null;
  const isCity = spec.precision === "city_centroid";
  const rc = (isCity ? 7 : 6) + Math.min(4, 1.1 * Math.sqrt(n));
  const R = spec.precision === "venue" ? rc : rc + ELECTION_RING_OFFSET[spec.precision];
  const size = Math.ceil(2 * (R + 3)) * PIXEL_RATIO;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const g = canvas.getContext("2d");
  if (!g) return null;
  g.scale(PIXEL_RATIO, PIXEL_RATIO);
  const C = size / PIXEL_RATIO / 2;
  const alpha = spec.allPast ? PAST_ALPHA : 1;
  if (spec.precision === "venue") {
    drawVenuePie(g, C, rc, spec.counts, order, n, alpha);
  } else {
    drawApproxDonut(g, C, rc, R, spec.counts, order, n, alpha, isCity);
  }

  const img = g.getImageData(0, 0, size, size);
  return { width: size, height: size, data: new Uint8Array(img.data.buffer) };
}

function drawCount(g: CanvasRenderingContext2D, C: number, n: number): void {
  g.fillStyle = LABEL_COLOR;
  g.font = `600 ${n >= 10 ? 9.5 : 10.5}px Menlo, monospace`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(String(n), C, C + 0.5);
}

/** 確切地點多場：實心扇形（陣營比例）＋深色描邊＋中間深色小圓底的場次數（淺色陣營色上也讀得到） */
function drawVenuePie(
  g: CanvasRenderingContext2D, C: number, r: number,
  counts: Partial<Record<ElectionCampKey, number>>, order: readonly ElectionCampKey[], n: number, alpha: number,
): void {
  g.globalAlpha = alpha;
  let a0 = -Math.PI / 2;
  for (const key of order) {
    const a1 = a0 + (2 * Math.PI * (counts[key] ?? 0)) / n;
    g.beginPath(); g.moveTo(C, C); g.arc(C, C, r, a0, a1); g.closePath();
    g.fillStyle = ELECTION_CAMP_COLOR[key]; g.fill();
    a0 = a1;
  }
  g.beginPath(); g.arc(C, C, r, 0, 2 * Math.PI);
  g.lineWidth = 1.2; g.strokeStyle = CENTER_FILL; g.stroke();
  g.beginPath(); g.arc(C, C, r * 0.62, 0, 2 * Math.PI); g.fillStyle = CENTER_FILL; g.fill();
  drawCount(g, C, n);
}

/** 代表點多場：淡範圍面＋分段外環（與中心留間距）＋中心深色圓與場次數 */
function drawApproxDonut(
  g: CanvasRenderingContext2D, C: number, rc: number, R: number,
  counts: Partial<Record<ElectionCampKey, number>>, order: readonly ElectionCampKey[], n: number, alpha: number, isCity: boolean,
): void {
  const dominant = order.slice().sort((a, b) => (counts[b] ?? 0) - (counts[a] ?? 0))[0]!;

  // 很淡的範圍面（主陣營色）：「大約在這一圈裡」
  g.globalAlpha = alpha * ELECTION_RING_FILL_OPACITY.upcoming;
  g.beginPath(); g.arc(C, C, R, 0, 2 * Math.PI); g.fillStyle = ELECTION_CAMP_COLOR[dominant]; g.fill();

  // 外環：依陣營場次比例分段
  g.globalAlpha = alpha;
  g.lineWidth = isCity ? 2.4 : 2;
  for (const { key, start, end } of electionRingSegments(counts, order)) {
    g.beginPath(); g.arc(C, C, R, start, end); g.strokeStyle = ELECTION_CAMP_COLOR[key]; g.stroke();
  }

  // 中心深色圓＋場次數
  g.beginPath(); g.arc(C, C, rc, 0, 2 * Math.PI); g.fillStyle = CENTER_FILL; g.fill();
  g.lineWidth = 1; g.strokeStyle = CENTER_STROKE; g.stroke();
  drawCount(g, C, n);
}

/** 確保圖示已加到地圖（換底圖後 style 會清空 image，所以每次 setData 前與 styleimagemissing 都會呼叫） */
export function ensureElectionGroupIcon(map: MapboxMap, id: string, spec: ElectionGroupIconSpec): void {
  if (map.hasImage(id)) return;
  const img = drawIcon(spec);
  if (!img) return;
  try {
    map.addImage(id, img, { pixelRatio: PIXEL_RATIO });
  } catch (err) {
    console.warn("[ElectionEvents] addImage failed", err);
  }
}
