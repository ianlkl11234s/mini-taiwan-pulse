import type { GfwV4MvtPoint } from "./gfwV4SpatialMvt";

export interface GfwV4SpatialObservation extends GfwV4MvtPoint { bucket: number; }
export interface GfwV4SpatialHitGroup {
  lon: number; lat: number; members: Record<string, unknown>[]; trackIds: string[]; buckets: number[];
}
export interface GfwV4BuiltSpatialFrame {
  points: Float32Array; buckets: Uint8Array; memberCounts: Uint16Array;
  pointAlphas: Uint8Array;
  segments: Float32Array; segmentBuckets: Uint8Array; segmentAlphas: Uint8Array;
  hitGroups: GfwV4SpatialHitGroup[];
}

// The fixed-z6 MVT point geometry is quantized, while to_lon / to_lat remain
// original numeric properties. At z6/extent 4096 one geometry step is about
// 0.00137 degrees at the equator, so exact floating-point equality would split
// every otherwise-valid track at an hour boundary. This remains far below the
// 0.1-degree source grid and only permits the expected MVT quantization drift.
const MVT_Z6_COORDINATE_TOLERANCE_DEGREES = 0.002;
/** Five simulated minutes = 10s at 30x, 1s at 300x. */
export const GFW_V4_TRACK_LIFECYCLE_FADE_SECONDS = 5 * 60;
const sameCoordinate = (aLon: number, aLat: number, bLon: number, bLat: number) =>
  Math.abs(aLon - bLon) <= MVT_Z6_COORDINATE_TOLERANCE_DEGREES
  && Math.abs(aLat - bLat) <= MVT_Z6_COORDINATE_TOLERANCE_DEGREES;
const pointAt = (from: { lon: number; lat: number; epoch: number }, to: { lon: number; lat: number; epoch: number }, epoch: number) => {
  const ratio = Math.max(0, Math.min(1, (epoch - from.epoch) / (to.epoch - from.epoch)));
  return { lon: from.lon + (to.lon - from.lon) * ratio, lat: from.lat + (to.lat - from.lat) * ratio, epoch };
};
const successor = (point: GfwV4SpatialObservation) => point.toLon === null || point.toLat === null || point.toEpoch === null || point.toEpoch <= point.observedEpoch
  ? null : { lon: point.toLon, lat: point.toLat, epoch: point.toEpoch };
const alphaByte = (value: number) => Math.round(Math.max(0, Math.min(1, value)) * 0xff);

/**
 * Builds only geometry valid at `epoch`: heads interpolate from the selected-H
 * observation to its validated successor, while trails end exactly at now.
 * No line endpoint can lie after epoch.
 */
export function buildGfwV4SpatialFrame(
  observations: readonly GfwV4SpatialObservation[],
  epoch: number,
  trailingSeconds: number,
): GfwV4BuiltSpatialFrame {
  const selectedHour = Math.floor(epoch / 3600) * 3600;
  const byTrack = new Map<string, GfwV4SpatialObservation[]>();
  for (const observation of observations) {
    const key = `${observation.bucket}|${observation.vesselId}|${observation.trackId}`;
    const list = byTrack.get(key) ?? [];
    list.push(observation); byTrack.set(key, list);
  }
  for (const list of byTrack.values()) list.sort((a, b) => a.observedEpoch - b.observedEpoch);

  const groups = new Map<string, { group: GfwV4SpatialHitGroup; alpha: number }>();
  const rawSegments: number[] = [], segmentBuckets: number[] = [], segmentAlphas: number[] = [];
  for (const [key, list] of byTrack) {
    const current = list.find((item) => item.observedEpoch === selectedHour);
    if (!current) continue;
    const next = successor(current);
    // Prefer the decoded child geometry as the shared knot when it is present.
    // This keeps the pre-boundary head and post-boundary trail on the same MVT
    // coordinate instead of introducing a small quantization snap at rollover.
    const nextObservation = next
      ? list.find((item) => item.observedEpoch === next.epoch
        && sameCoordinate(next.lon, next.lat, item.lon, item.lat))
      : undefined;
    const canonicalNext = nextObservation
      ? { lon: nextObservation.lon, lat: nextObservation.lat, epoch: nextObservation.observedEpoch }
      : next;
    const head = canonicalNext && epoch > current.observedEpoch && epoch <= canonicalNext.epoch
      ? pointAt({ lon: current.lon, lat: current.lat, epoch: current.observedEpoch }, canonicalNext, epoch)
      : { lon: current.lon, lat: current.lat, epoch: current.observedEpoch };
    // Reconstruct only continuous predecessor links. A missing / invalid link is
    // a hard split; it cannot be bridged by visual interpolation.
    const chain: Array<{ lon: number; lat: number; epoch: number }> = [{ lon: current.lon, lat: current.lat, epoch: current.observedEpoch }];
    let child = current;
    for (let index = list.indexOf(current) - 1; index >= 0; index -= 1) {
      const previous = list[index]!; const previousNext = successor(previous);
      if (!previousNext || previousNext.epoch !== child.observedEpoch || !sameCoordinate(previousNext.lon, previousNext.lat, child.lon, child.lat)) break;
      chain.unshift({ lon: previous.lon, lat: previous.lat, epoch: previous.observedEpoch }); child = previous;
    }
    // A lifecycle fade represents the start/end of observation support, not a
    // claim that the physical vessel was created, destroyed, or stationary.
    // Continuous tracks stay fully opaque across the hour boundary.
    const hourProgress = Math.max(0, Math.min(3600, epoch - selectedHour));
    const fadeIn = chain.length > 1 ? 1 : hourProgress / GFW_V4_TRACK_LIFECYCLE_FADE_SECONDS;
    const fadeOut = nextObservation ? 1 : (3600 - hourProgress) / GFW_V4_TRACK_LIFECYCLE_FADE_SECONDS;
    const lifecycleAlpha = alphaByte(Math.min(fadeIn, fadeOut));

    const groupKey = `${head.lon.toFixed(7)}|${head.lat.toFixed(7)}`;
    const entry = groups.get(groupKey) ?? {
      group: { lon: head.lon, lat: head.lat, members: [], trackIds: [], buckets: [] },
      alpha: 0,
    };
    entry.group.members.push({ vessel_id: current.vesselId, mmsi: current.mmsi, ship_name: current.shipName, vessel_type: current.vesselType, flag: current.flag, ship_type_bucket: current.shipTypeBucket, observed_at: current.observedAt, observed_epoch: current.observedEpoch });
    entry.group.trackIds.push(current.trackId); entry.group.buckets.push(current.bucket);
    // Same-coordinate vessels share one marker. Keep it visible whenever any
    // member remains continuously observed.
    entry.alpha = Math.max(entry.alpha, lifecycleAlpha); groups.set(groupKey, entry);

    if (head.epoch > chain[chain.length - 1]!.epoch) chain.push(head);
    const start = epoch - Math.max(0, trailingSeconds);
    for (let index = 0; index < chain.length - 1; index += 1) {
      const from = chain[index]!, to = chain[index + 1]!;
      if (to.epoch < start || from.epoch > epoch) continue;
      const clippedFrom = from.epoch < start ? pointAt(from, to, start) : from;
      const clippedTo = to.epoch > epoch ? pointAt(from, to, epoch) : to;
      if (clippedTo.epoch <= clippedFrom.epoch) continue;
      rawSegments.push(clippedFrom.lon, clippedFrom.lat, clippedTo.lon, clippedTo.lat);
      segmentBuckets.push(current.bucket); segmentAlphas.push(lifecycleAlpha);
    }
    void key;
  }
  const entries = [...groups.values()];
  const hitGroups = entries.map((entry) => entry.group);
  const points = new Float32Array(hitGroups.length * 2), buckets = new Uint8Array(hitGroups.length), memberCounts = new Uint16Array(hitGroups.length);
  const pointAlphas = new Uint8Array(hitGroups.length);
  hitGroups.forEach((group, index) => {
    points[index * 2] = group.lon; points[index * 2 + 1] = group.lat;
    buckets[index] = group.buckets.every((bucket) => bucket === group.buckets[0]) ? (group.buckets[0] ?? 5) : 6;
    memberCounts[index] = Math.min(0xffff, group.members.length);
    pointAlphas[index] = entries[index]!.alpha;
  });
  return {
    points, buckets, memberCounts, pointAlphas,
    segments: new Float32Array(rawSegments),
    segmentBuckets: new Uint8Array(segmentBuckets),
    segmentAlphas: new Uint8Array(segmentAlphas),
    hitGroups,
  };
}
