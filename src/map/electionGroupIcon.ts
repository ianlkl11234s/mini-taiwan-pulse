/**
 * 2026 選舉活動：同一代表點 2 場以上的圖示（中心深色圓＋白字場次數，外環依各陣營場次比例分段上色）。
 * 使用者 2026-11-08 核准設計稿「A＋B 版」；畫法照設計原型 donutImage。
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
  precision: ElectionApproxPrecision;
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
const PAST_ALPHA = 0.5;

/** 圖示 id：同樣的陣營組合、精度、已舉辦狀態共用一張 */
export function electionGroupIconId(spec: ElectionGroupIconSpec): string {
  const camps = ELECTION_CAMPS.map((c) => c.key).filter((k) => (spec.counts[k] ?? 0) > 0)
    .map((k) => `${k}${spec.counts[k]}`).join("_");
  return `${ICON_PREFIX}${spec.precision}-${spec.allPast ? 1 : 0}-${camps}`;
}

export function isElectionGroupIconId(id: string): boolean {
  return id.startsWith(ICON_PREFIX);
}

function drawIcon(spec: ElectionGroupIconSpec): { width: number; height: number; data: Uint8Array } | null {
  if (typeof document === "undefined") return null;
  const order = ELECTION_CAMPS.map((c) => c.key).filter((k) => (spec.counts[k] ?? 0) > 0);
  const n = order.reduce((s, k) => s + (spec.counts[k] ?? 0), 0);
  if (n === 0) return null;
  const isCity = spec.precision === "city_centroid";
  const rc = (isCity ? 7 : 6) + Math.min(4, 1.1 * Math.sqrt(n));
  const R = rc + ELECTION_RING_OFFSET[spec.precision];
  const size = Math.ceil(2 * (R + 3)) * PIXEL_RATIO;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const g = canvas.getContext("2d");
  if (!g) return null;
  g.scale(PIXEL_RATIO, PIXEL_RATIO);
  const C = size / PIXEL_RATIO / 2;
  const alpha = spec.allPast ? PAST_ALPHA : 1;
  const dominant = order.slice().sort((a, b) => (spec.counts[b] ?? 0) - (spec.counts[a] ?? 0))[0]!;

  // 很淡的範圍面（主陣營色）：「大約在這一圈裡」
  g.globalAlpha = alpha * ELECTION_RING_FILL_OPACITY.upcoming;
  g.beginPath(); g.arc(C, C, R, 0, 2 * Math.PI); g.fillStyle = ELECTION_CAMP_COLOR[dominant]; g.fill();

  // 外環：依陣營場次比例分段
  g.globalAlpha = alpha;
  g.lineWidth = isCity ? 2.4 : 2;
  const gap = order.length > 1 ? 0.06 : 0;
  let a0 = -Math.PI / 2;
  for (const k of order) {
    const a1 = a0 + (2 * Math.PI * (spec.counts[k] ?? 0)) / n;
    g.beginPath(); g.arc(C, C, R, a0 + gap / 2, a1 - gap / 2); g.strokeStyle = ELECTION_CAMP_COLOR[k]; g.stroke();
    a0 = a1;
  }

  // 中心深色圓＋場次數
  g.beginPath(); g.arc(C, C, rc, 0, 2 * Math.PI); g.fillStyle = CENTER_FILL; g.fill();
  g.lineWidth = 1; g.strokeStyle = CENTER_STROKE; g.stroke();
  g.fillStyle = LABEL_COLOR;
  g.font = `600 ${n >= 10 ? 9.5 : 10.5}px Menlo, monospace`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(String(n), C, C + 0.5);

  const img = g.getImageData(0, 0, size, size);
  return { width: size, height: size, data: new Uint8Array(img.data.buffer) };
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
