import type { FrameBudget, FrameHead, FrameTrail, TrackFrame, TrackPack, TrackPoint } from "./types";

interface TimedPosition { lon: number; lat: number; epoch: number }

function coordinateAt(points: readonly TrackPoint[], epoch: number): TimedPosition | null {
  if (epoch < points[0]!.epoch || epoch > points[points.length - 1]!.epoch) return null;
  let low = 0;
  let high = points.length - 1;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const point = points[mid]!;
    if (point.epoch === epoch) return point;
    if (point.epoch < epoch) low = mid + 1;
    else high = mid - 1;
  }
  const left = points[high];
  const right = points[low];
  if (!left || !right || right.epoch <= left.epoch) return null;
  const ratio = (epoch - left.epoch) / (right.epoch - left.epoch);
  return { lon: left.lon + (right.lon - left.lon) * ratio, lat: left.lat + (right.lat - left.lat) * ratio, epoch };
}

function trailSlice(points: readonly TrackPoint[], fromEpoch: number, toEpoch: number): Array<[number, number]> {
  const start = coordinateAt(points, fromEpoch);
  const end = coordinateAt(points, toEpoch);
  if (!start || !end || fromEpoch >= toEpoch) return [];
  const coordinates: Array<[number, number]> = [[start.lon, start.lat]];
  for (const point of points) {
    if (point.epoch > fromEpoch && point.epoch < toEpoch) coordinates.push([point.lon, point.lat]);
  }
  coordinates.push([end.lon, end.lat]);
  return coordinates;
}

export function buildTrackFrame(
  packs: readonly TrackPack[],
  selectedEpoch: number,
  trailSeconds: number,
  budget: FrameBudget,
): TrackFrame {
  const headGroups = new Map<string, FrameHead>();
  const allTrails: FrameTrail[] = [];
  let visibleTrailVertices = 0;
  for (const pack of packs) {
    for (const segment of pack.segments) {
      const points = segment.points;
      const first = points[0]!.epoch;
      const last = points[points.length - 1]!.epoch;
      const head = coordinateAt(points, selectedEpoch);
      if (head) {
        const key = `${head.lon},${head.lat}`;
        const group = headGroups.get(key) ?? { lon: head.lon, lat: head.lat, members: [], buckets: [] };
        // Complete member identity is retained even if the group is later outside render budget.
        if (!group.members.some((member) => member.vesselId === segment.vessel.vesselId)) group.members.push(segment.vessel);
        if (!group.buckets.includes(pack.bucket)) group.buckets.push(pack.bucket);
        headGroups.set(key, group);
      }
      const from = Math.max(first, selectedEpoch - trailSeconds);
      const to = Math.min(last, selectedEpoch);
      const coordinates = trailSlice(points, from, to);
      if (coordinates.length >= 2) {
        visibleTrailVertices += coordinates.length;
        allTrails.push({ trackId: segment.trackId, bucket: pack.bucket, coordinates });
      }
    }
  }
  const allHeads = [...headGroups.values()];
  const heads = allHeads.slice(0, budget.maxHeads);
  const trails: FrameTrail[] = [];
  let renderedTrailVertices = 0;
  for (const trail of allTrails) {
    if (renderedTrailVertices + trail.coordinates.length > budget.maxTrailVertices) break;
    trails.push(trail);
    renderedTrailVertices += trail.coordinates.length;
  }
  return {
    heads,
    trails,
    visibleHeadGroups: allHeads.length,
    visibleMembers: allHeads.reduce((sum, head) => sum + head.members.length, 0),
    visibleTrailVertices,
    renderedHeadGroups: heads.length,
    renderedTrailVertices,
    overBudgetHeads: Math.max(0, allHeads.length - heads.length),
    overBudgetTrailVertices: Math.max(0, visibleTrailVertices - renderedTrailVertices),
  };
}

export function secondsForWindow(value: "0.5" | "1" | "3"): number {
  return Number(value) * 3_600;
}

export const __frameTestOnly = { coordinateAt, trailSlice };
