/** Camera-image analytics. Coordinates are normalized pixels, never road metres.
 * Events are local tracker observations, not cross-camera vehicle identities.
 */
import { cameraTrackIndex, pointInRoi } from './traffic.js';

const GAP = 1.5;
const DEADBAND = .008;
function lastAt(items, time) {
  let lo = 0, hi = items.length;
  while (lo < hi) { const m = (lo + hi) >>> 1; if (items[m].t <= time) lo = m + 1; else hi = m; }
  return lo - 1;
}
function validPoint(p) {
  return Array.isArray(p) && p.length === 2 && p.every(v => Number.isFinite(v) && v >= 0 && v <= 1);
}
function validRoi(roi) {
  return Array.isArray(roi) && roi.length >= 3 && roi.every(validPoint);
}
function validLine(line) {
  return Array.isArray(line) && line.length === 2 && line.every(validPoint)
    && Math.hypot(line[1][0] - line[0][0], line[1][1] - line[0][1]) > 1e-6;
}
function signedDistance(point, line) {
  const [a, b] = line;
  const dx = b[0] - a[0], dy = b[1] - a[1];
  return (dx * (point.y - a[1]) - dy * (point.x - a[0])) / Math.hypot(dx, dy);
}
function onLineSegment(point, line) {
  const [a, b] = line;
  const dx = b[0] - a[0], dy = b[1] - a[1], len2 = dx * dx + dy * dy;
  const u = ((point.x - a[0]) * dx + (point.y - a[1]) * dy) / len2;
  return u >= -1e-8 && u <= 1 + 1e-8;
}
function localId(cameraId, trackerId) {
  let h = 2166136261;
  for (const ch of `${cameraId}:${trackerId}`) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return `local-${(h >>> 0).toString(16).padStart(8, '0')}`;
}
function blankCounts() {
  return { occupancyByClass: null, occupancyTotal: null,
    crossings: null, crossingTotal: null };
}
export function analyzeCamera(camera, time, config = {}) {
  const t = Math.max(0, Number.isFinite(time) ? time : 0);
  const counts = blankCounts(), events = [];
  const diagnostics = { roiConfigured: validRoi(config.roi), lineConfigured: validLine(config.countLine),
    deadband: DEADBAND, excludedRoi: 0, excludedEdgeFragments: 0,
    excludedForeground: 0, duplicateFrames: 0, latestFrameTime: null,
    observationBasis: 'bbox-bottom-center' };
  const base = { counts, events, speedKmh: null, calibrationStatus: 'uncalibrated', diagnostics };
  if (!camera || camera.status !== 'ok') return { status: 'unavailable', ...base };
  const indexed = cameraTrackIndex(camera);
  if (!indexed.uniqueFrames.length) return { status: 'unavailable', ...base };
  const duration = indexed.frames.at(-1).t;
  const cutoff = Number.isFinite(config.cutoffTime) ? Math.max(0, config.cutoffTime)
    : config.simulateOutage ? duration / 2 : Infinity;
  const permitted = Math.min(t, cutoff);
  const frameAt = lastAt(indexed.frames, permitted);
  if (frameAt < 0) return { status: 'waiting', ...base };
  const latest = indexed.frames[frameAt];
  const contentAt = lastAt(indexed.uniqueFrames, permitted);
  const latestContent = contentAt < 0 ? null : indexed.uniqueFrames[contentAt];
  if (!latestContent) return { status: 'waiting', ...base };
  diagnostics.latestFrameTime = latest.t;
  diagnostics.duplicateFrames = indexed.frames.slice(0, lastAt(indexed.frames, permitted) + 1)
    .filter(f => f.duplicateOfPrevious === true || f.uniqueContent === false).length;
  diagnostics.excludedEdgeFragments = lastAt(indexed.excluded, permitted) + 1;
  diagnostics.excludedForeground = lastAt(indexed.excludedForeground, permitted) + 1;

  const stale = t > cutoff || t - latestContent.t > GAP;
  if (diagnostics.roiConfigured && !stale) {
    const current = new Map();
    for (const segment of indexed.segments) {
      const at = lastAt(segment.samples, latest.t);
      if (at < 0) continue;
      const sample = segment.samples[at];
      if (sample.t !== latest.t) continue; // Occupancy is a source-frame snapshot.
      const previous = current.get(segment.id);
      if (!previous || sample.confidence > previous.confidence) current.set(segment.id, sample);
    }
    const byClass = {};
    for (const sample of current.values()) {
      const point = { x: sample.lateral, y: sample.bottom };
      if (!pointInRoi(point, config.roi)) { diagnostics.excludedRoi++; continue; }
      byClass[sample.className] = (byClass[sample.className] || 0) + 1;
    }
    counts.occupancyByClass = byClass;
    counts.occupancyTotal = Object.values(byClass).reduce((sum, n) => sum + n, 0);
  }

  if (diagnostics.lineConfigured) {
    const used = new Set();
    for (const segment of indexed.segments) {
      let strong = null, side = 0, previousTime = null;
      for (const sample of segment.samples) {
        if (sample.t > permitted) break;
        if (sample.duplicateOfPrevious) continue;
        if (previousTime !== null && (sample.t <= previousTime || sample.t - previousTime > GAP)) {
          strong = null; side = 0;
        }
        previousTime = sample.t;
        const point = { x: sample.lateral, y: sample.bottom };
        const distance = signedDistance(point, config.countLine);
        const nextSide = distance > DEADBAND ? 1 : distance < -DEADBAND ? -1 : 0;
        if (!nextSide) continue;
        if (strong && nextSide !== side) {
          const fraction = Math.abs(strong.distance) / (Math.abs(strong.distance) + Math.abs(distance));
          const intersection = {
            x: strong.point.x + (point.x - strong.point.x) * fraction,
            y: strong.point.y + (point.y - strong.point.y) * fraction,
          };
          // A is the positive (left) side of the oriented line; B is right.
          const direction = side > 0 ? 'A→B' : 'B→A';
          const key = `${segment.id}:${direction}`;
          if (onLineSegment(intersection, config.countLine)
            && (!diagnostics.roiConfigured || pointInRoi(intersection, config.roi))
            && !used.has(key)) {
            events.push({ t: strong.sample.t + (sample.t - strong.sample.t) * fraction,
              observedAt: sample.t, id: localId(camera.id, segment.id),
              className: sample.className, rawClassName: sample.rawClassName,
              direction, point: intersection });
            used.add(key);
          }
        }
        strong = { point, distance, sample };
        side = nextSide;
      }
    }
    events.sort((a, b) => a.observedAt - b.observedAt || a.id.localeCompare(b.id));
    counts.crossings = { 'A→B': events.filter(e => e.direction === 'A→B').length,
      'B→A': events.filter(e => e.direction === 'B→A').length };
    counts.crossingTotal = events.length;
  }
  return { status: stale ? 'stale'
    : diagnostics.roiConfigured && diagnostics.lineConfigured ? 'ready' : 'unconfigured', ...base };
}
