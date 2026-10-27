/** Image observations and a separate, assumed corridor scenario.
 * Camera positions, projected vehicles, and lanes are schematic, not calibrated.
 */
import { projectImagePoint } from './projection.js';
export const ORIGIN = { lon: 121.55281, lat: 25.03316 };
export const CAMERA_IDS = ['T000354', 'T000330', 'T000283'];
export const DEFAULT_VIEW_DIRECTIONS = { T000354: 'N', T000330: 'N', T000283: 'N' };
const GAP = 1.5;
/** Upper bound for short-gap continuation; UI slider max must equal this. */
export const MAX_PREDICTION_HORIZON = .8;
const cache = new WeakMap();
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export function cameraPosition(camera) {
  return { x: (camera.lon - ORIGIN.lon) * 100700, z: (ORIGIN.lat - camera.lat) * 111320 };
}
function valid(d) {
  return d && typeof d.id === 'string' && Array.isArray(d.bbox) && d.bbox.length === 4
    && d.bbox.every(v => Number.isFinite(v) && v >= 0 && v <= 1)
    && d.bbox[2] > d.bbox[0] && d.bbox[3] > d.bbox[1];
}
function edge(d) {
  return (d.bbox[0] <= .005 || d.bbox[2] >= .995) && d.bbox[2] - d.bbox[0] < .04;
}
function foreground(camera, d) {
  if (camera.id !== 'T000354') return false;
  // Initial manual image-space mask for a fixed foreground equipment head.
  // Re-evaluate per box: the tracker ID itself is never permanently excluded.
  const [x1, y1, x2, y2] = d.bbox;
  const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2;
  const overlapX = Math.max(0, Math.min(x2, .83) - Math.max(x1, .705));
  const overlapY = Math.max(0, Math.min(y2, .73) - Math.max(y1, .51));
  return cx >= .705 && cx <= .83 && cy >= .51 && cy <= .73
    && overlapX * overlapY >= (x2 - x1) * (y2 - y1) * .55;
}
function lastAt(items, time) {
  let lo = 0, hi = items.length;
  while (lo < hi) { const mid = (lo + hi) >>> 1; if (items[mid].t <= time) lo = mid + 1; else hi = mid; }
  return lo - 1;
}
export function pointInRoi(point, roi) {
  if (!Array.isArray(roi) || roi.length < 3) return true;
  let inside = false;
  for (let i = 0, j = roi.length - 1; i < roi.length; j = i++) {
    const a = roi[j], b = roi[i];
    if (!Array.isArray(a) || !Array.isArray(b)) return true;
    const cross = (point.x - a[0]) * (b[1] - a[1]) - (point.y - a[1]) * (b[0] - a[0]);
    if (Math.abs(cross) < 1e-9 && point.x >= Math.min(a[0], b[0]) - 1e-9
      && point.x <= Math.max(a[0], b[0]) + 1e-9
      && point.y >= Math.min(a[1], b[1]) - 1e-9
      && point.y <= Math.max(a[1], b[1]) + 1e-9) return true;
    if ((a[1] > point.y) !== (b[1] > point.y)
      && point.x < (b[0] - a[0]) * (point.y - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}
function index(camera) {
  if (cache.has(camera)) return cache.get(camera);
  const frames = (camera.frames || []).filter(f => Number.isFinite(f.t) && f.t >= 0).slice().sort((a, b) => a.t - b.t);
  // 只有「與前一幀相同」才算重複（A→B→A 的第二個 A 是新畫面）；uniqueContent 是對全部歷史雜湊的全域指標，不用來沿用偵測。
  const uniqueFrames = frames.filter(f => f.duplicateOfPrevious !== true);
  const byId = new Map(), excluded = [], excludedForeground = [];
  let lastSnapshot = new Map(), lastUniqueTime = -Infinity;
  for (const frame of frames) {
    const duplicate = frame.duplicateOfPrevious === true;
    if (duplicate) {
      // Reuse the last distinct image's accepted boxes, including their local
      // tracker IDs. Re-running a detector on identical pixels is not evidence.
      if (frame.t - lastUniqueTime <= GAP) for (const previous of lastSnapshot.values()) {
        byId.get(previous.id).push({ ...previous, t: frame.t,
          duplicateOfPrevious: true, uniqueContent: false });
      }
      continue;
    }
    lastUniqueTime = frame.t;
    const snapshot = new Map();
    for (const d of frame.detections || []) {
      if (!valid(d)) continue;
      if (edge(d)) { excluded.push({ t: frame.t }); continue; }
      if (foreground(camera, d)) { excludedForeground.push({ t: frame.t }); continue; }
      const sample = { t: frame.t, id: d.id, rawClassName: d.className,
        duplicateOfPrevious: false, uniqueContent: frame.uniqueContent ?? null,
        confidence: Number.isFinite(d.confidence) ? d.confidence : null,
        bottom: d.bbox[3], lateral: (d.bbox[0] + d.bbox[2]) / 2 };
      const samples = byId.get(d.id) || [];
      samples.push(sample);
      byId.set(d.id, samples);
      snapshot.set(d.id, sample);
    }
    lastSnapshot = snapshot;
  }
  const segments = [];
  let splitSegments = 0;
  for (const [id, samples] of byId) {
    let segment, ordinal = 0, stableClass = null, candidateClass = null, candidateCount = 0;
    for (const s of samples) {
      const prev = segment?.samples.at(-1);
      const dt = prev ? s.t - prev.t : Infinity;
      const jumped = prev && (Math.abs(s.bottom - prev.bottom) > .17
        || Math.abs(s.lateral - prev.lateral) > .22);
      if (!segment || dt <= 0 || dt > GAP || jumped) {
        if (segment) splitSegments++;
        segment = { id, index: ordinal++, samples: [] };
        segments.push(segment);
        stableClass = null; candidateClass = null; candidateCount = 0;
      }
      if (s.duplicateOfPrevious && segment.samples.length) {
        const before = segment.samples.at(-1);
        s.className = before.className;
        s.filteredBottom = before.filteredBottom;
        s.filteredLateral = before.filteredLateral;
        segment.samples.push(s);
        continue;
      }
      const rawClass = typeof s.rawClassName === 'string' && s.rawClassName.trim()
        ? s.rawClassName.trim().toLowerCase() : 'unknown';
      if (stableClass === null) stableClass = rawClass;
      else if (rawClass === stableClass) { candidateClass = null; candidateCount = 0; }
      else {
        candidateCount = candidateClass === rawClass ? candidateCount + 1 : 1;
        candidateClass = rawClass;
        if (candidateCount >= 3) { stableClass = rawClass; candidateClass = null; candidateCount = 0; }
      }
      s.className = stableClass;
      const before = segment.samples.at(-1);
      const alpha = before ? clamp(1 - Math.exp(-(s.t - before.t) / .35), .12, .72) : 1;
      s.filteredBottom = before ? before.filteredBottom + alpha * (s.bottom - before.filteredBottom) : s.bottom;
      s.filteredLateral = before ? before.filteredLateral + alpha * (s.lateral - before.filteredLateral) : s.lateral;
      segment.samples.push(s);
    }
  }
  const result = { frames, uniqueFrames, segments, excluded, excludedForeground, splitSegments,
    duplicateFrames: frames.length - uniqueFrames.length };
  cache.set(camera, result);
  return result;
}
export function cameraTrackIndex(camera) {
  return index(camera);
}
function viewDirection(camera, options) {
  const override = options.viewDirections?.[camera.id];
  const assumed = options.cameraConfigs?.[camera.id]?.assumedViewDirection;
  return ['E', 'W', 'N'].includes(override) ? override
    : ['E', 'W', 'N'].includes(assumed) ? assumed : DEFAULT_VIEW_DIRECTIONS[camera.id] || 'N';
}
function projectedMotion(camera, samples, at, smooth, view, config) {
  const s = samples[at];
  let first = at;
  while (first > 0 && s.t - samples[first - 1].t <= 1.2) first--;
  const b = samples[first], dt = s.t - b.t;
  const current = projected(camera, s, smooth, view, config);
  const previous = projected(camera, b, smooth, view, config);
  if (!current || !previous || dt <= 0) return { moving: false, vx: 0, vz: 0, heading: null };
  const dx = current.x - previous.x, dz = current.z - previous.z;
  const pixelDistance = Math.hypot(s.lateral - b.lateral, s.bottom - b.bottom);
  const moving = Math.hypot(dx, dz) >= Math.max(.8, dt * .55) && pixelDistance >= .005;
  if (!moving) return { moving: false, vx: 0, vz: 0, heading: null };
  const magnitude = Math.hypot(dx, dz) / dt;
  const ratio = Math.min(1, 18 / magnitude);
  const vx = dx / dt * ratio, vz = dz / dt * ratio;
  return { moving: true, vx, vz, heading: Math.atan2(vz, vx) };
}
function projected(camera, s, smooth, view, config) {
  const bottom = smooth ? s.filteredBottom : s.bottom;
  const lateral = smooth ? s.filteredLateral : s.lateral;
  return projectImagePoint(camera, { x: lateral, y: bottom }, config, view);
}
function localVehicles(camera, indexed, source, t, options, diagnostics) {
  if (camera.status !== 'ok' || !source.latest || source.status === 'stale') return [];
  const smooth = options.smooth !== false, view = viewDirection(camera, options), vehicles = [];
  const horizon = clamp(Number.isFinite(options.horizonSeconds) ? options.horizonSeconds : MAX_PREDICTION_HORIZON, 0, MAX_PREDICTION_HORIZON);
  const latestById = new Map();
  for (const segment of indexed.segments) {
    const at = lastAt(segment.samples, source.permittedTime);
    if (at < 0) continue;
    const prior = latestById.get(segment.id);
    if (!prior || segment.samples[at].t > prior.segment.samples[prior.at].t) {
      latestById.set(segment.id, { segment, at });
    }
  }
  for (const { segment, at } of latestById.values()) {
    const s = segment.samples[at], age = t - s.t;
    if (age < 0 || age > GAP) continue;
    const imagePoint = { x: s.lateral, y: s.bottom };
    const roi = options.cameraConfigs?.[camera.id]?.roi;
    if (Array.isArray(roi) && roi.length >= 3 && !pointInRoi(imagePoint, roi)) {
      diagnostics.excludedRoi++;
      continue;
    }
    const config = options.cameraConfigs?.[camera.id];
    const motion = projectedMotion(camera, segment.samples, at, smooth, view, config);
    const p = projected(camera, s, smooth, view, config);
    if (!p) continue;
    const next = segment.samples[at + 1];
    const nextFrame = indexed.frames[lastAt(indexed.frames, s.t) + 1];
    const q = next ? projected(camera, next, smooth, view, config) : null;
    // Adjacent camera frames are replay observations. A short same-ID gap
    // bridges with its later endpoint, explicitly labelled predicted.
    const adjacent = Boolean(next && nextFrame && next.t === nextFrame.t);
    const bracketed = next && q && next.t <= source.cutoff
      && next.t - s.t <= (adjacent ? 1.25 : .8) && t < next.t;
    const bridgedGap = bracketed && !adjacent;
    if (bracketed && smooth) {
      const a = clamp((t - s.t) / (next.t - s.t), 0, 1);
      p.x += (q.x - p.x) * a;
      p.z += (q.z - p.z) * a;
    }
    const predicted = age > .001 && (bridgedGap || !bracketed);
    if (predicted && age > horizon) continue;
    if (predicted && !bracketed && smooth) { p.x += motion.vx * age; p.z += motion.vz * age; }
    let heading = motion.heading;
    if (bridgedGap && q) {
      const start = projected(camera, s, smooth, view, config);
      if (start && Math.hypot(q.x - start.x, q.z - start.z) > .5) {
        heading = Math.atan2(q.z - start.z, q.x - start.x);
      }
    }
    for (let i = at - 1; heading === null && i >= Math.max(0, at - 6); i--) {
      heading = projectedMotion(camera, segment.samples, i, smooth, view, config).heading;
    }
    const kind = predicted ? 'predicted' : motion.moving ? 'observed' : 'stationary';
    const direction = heading === null ? null : Math.abs(Math.cos(heading)) >= Math.abs(Math.sin(heading))
      ? Math.cos(heading) >= 0 ? 'E' : 'W' : Math.sin(heading) >= 0 ? 'S' : 'N';
    vehicles.push({ key: `${camera.id}:${segment.id}:${segment.index}`, cameraId: camera.id,
      className: s.className, rawClassName: s.rawClassName, imagePoint, ...p,
      heading: heading ?? 0,
      ageSeconds: age, kind, opacity: predicted ? clamp(.85 * (1 - age / Math.max(horizon, .001)), .08, .85) : 1,
      sourceFrameTime: s.t, predictedSeconds: predicted ? age : 0, stationary: !motion.moving && !predicted,
      direction });
  }
  return vehicles;
}
function corridorVehicles(data, sources, t, options, diagnostics) {
  const direction = options.corridorDirection === 'W' ? 'W' : 'E';
  const sign = direction === 'E' ? 1 : -1;
  const ordered = (data?.cameras || []).filter(c => Number.isFinite(c.lon) && Number.isFinite(c.lat))
    .slice().sort((a, b) => cameraPosition(a).x - cameraPosition(b).x);
  if (!ordered.length) return [];
  const entrance = sign > 0 ? ordered[0] : ordered.at(-1);
  diagnostics.scenarioEntranceCameraId = entrance.id;
  if (entrance.status !== 'ok') return [];
  const source = sources.get(entrance.id);
  if (!source?.latest) return [];
  const speed = clamp(Number.isFinite(options.speedKmh) ? options.speedKmh : 25, 0, 60) / 3.6;
  const startX = cameraPosition(entrance).x;
  const minX = cameraPosition(ordered[0]).x - 100;
  const maxX = cameraPosition(ordered.at(-1)).x + 100;
  const vehicles = [], seededIds = new Set();
  for (const segment of index(entrance).segments) {
    if (seededIds.has(segment.id)) continue;
    let seed;
    for (let i = 1; i < segment.samples.length; i++) {
      const s = segment.samples[i];
      if (s.t > source.permittedTime) break;
      if (s.duplicateOfPrevious) continue;
      const motion = projectedMotion(entrance, segment.samples, i, options.smooth !== false,
        viewDirection(entrance, options), options.cameraConfigs?.[entrance.id]);
      if (motion.moving && Math.abs(motion.vx) > Math.abs(motion.vz)
        && Math.sign(motion.vx) === sign) {
        seed = s; break;
      }
    }
    if (!seed || seed.t > t) continue;
    const roi = options.cameraConfigs?.[entrance.id]?.roi;
    if (Array.isArray(roi) && roi.length >= 3
      && !pointInRoi({ x: seed.lateral, y: seed.bottom }, roi)) continue;
    seededIds.add(segment.id);
    const age = t - seed.t;
    if (speed === 0 && age > 15) continue;
    const x = startX + sign * speed * age;
    if (x < minX || x > maxX) continue;
    // Lane separation is purely visual; there is no cross-camera re-ID.
    const lane = clamp(Math.floor(seed.lateral * 3), 0, 2) - 1;
    vehicles.push({ key: `scenario:${direction}:${entrance.id}:${segment.id}:${segment.index}`,
      cameraId: entrance.id, sourceCameraId: entrance.id, className: seed.className,
      rawClassName: seed.rawClassName, imagePoint: { x: seed.lateral, y: seed.bottom },
      x, z: cameraPosition(entrance).z + sign * 3 + lane * 2.4,
      heading: sign > 0 ? 0 : Math.PI, ageSeconds: age, kind: 'scenario',
      opacity: .85, direction, seedTime: seed.t, scenarioSpeedKmh: speed * 3.6 });
  }
  diagnostics.scenarioSeeds = vehicles.length;
  return vehicles;
}
export function buildTrafficState(data, time, options = {}) {
  const t = Math.max(0, Number.isFinite(time) ? time : 0);
  const mode = options.mode === 'corridor' ? 'corridor' : 'observed';
  const diagnostics = { excludedEdgeFragments: 0, excludedForeground: 0, excludedRoi: 0,
    duplicateFrames: 0,
    splitSegments: 0, scenarioSeeds: 0,
    scenarioEntranceCameraId: null, projection: 'uncalibrated-camera-local-schematic',
    lanePlacement: 'visual-only', smoothing: options.smooth !== false ? 'causal-time-aware' : 'raw' };
  const sources = new Map(), cameraStates = [], local = [];
  for (const camera of data?.cameras || []) {
    const indexed = index(camera);
    const duration = indexed.frames.at(-1)?.t ?? 0;
    const cutoff = options.simulateOutage === camera.id ? duration / 2 : Infinity;
    const permittedTime = Math.min(t, cutoff);
    const frameAt = lastAt(indexed.frames, permittedTime);
    const latest = frameAt < 0 ? null : indexed.frames[frameAt];
    const contentAt = lastAt(indexed.uniqueFrames, permittedTime);
    const latestContent = contentAt < 0 ? null : indexed.uniqueFrames[contentAt];
    const status = camera.status !== 'ok' ? 'unavailable'
      : t > cutoff ? 'simulated-outage' : !latestContent ? 'waiting'
        : t - latestContent.t > GAP ? 'stale' : 'observed';
    const source = { cutoff, permittedTime, latest, status };
    sources.set(camera.id, source);
    const beforeRoi = diagnostics.excludedRoi;
    const vehicles = localVehicles(camera, indexed, source, t, options, diagnostics);
    local.push(...vehicles);
    const excludedEdgeFragments = lastAt(indexed.excluded, permittedTime) + 1;
    const excludedForeground = lastAt(indexed.excludedForeground, permittedTime) + 1;
    const duplicateFrames = indexed.frames.slice(0, lastAt(indexed.frames, permittedTime) + 1)
      .filter(f => f.duplicateOfPrevious === true || f.uniqueContent === false).length;
    diagnostics.excludedEdgeFragments += excludedEdgeFragments;
    diagnostics.excludedForeground += excludedForeground;
    diagnostics.duplicateFrames += duplicateFrames;
    diagnostics.splitSegments += indexed.segments.filter(s => s.index > 0 && s.samples[0].t <= permittedTime).length;
    cameraStates.push({ id: camera.id, status,
      observed: vehicles.filter(v => v.kind === 'observed').length,
      predicted: vehicles.filter(v => v.kind === 'predicted').length,
      stationary: vehicles.filter(v => v.kind === 'stationary').length,
      latestFrameTime: latest?.t ?? null, excludedEdgeFragments, excludedForeground, duplicateFrames,
      excludedRoi: diagnostics.excludedRoi - beforeRoi });
  }
  const scenario = mode === 'corridor' ? corridorVehicles(data, sources, t, options, diagnostics) : [];
  const vehicles = mode === 'corridor' ? scenario : local.filter(v => v.kind !== 'stationary' || options.showStationary !== false);
  const counts = { observed: mode === 'observed' ? local.filter(v => v.kind === 'observed').length : 0,
    predicted: mode === 'observed' ? local.filter(v => v.kind === 'predicted').length : 0,
    stationary: mode === 'observed' ? local.filter(v => v.kind === 'stationary').length : 0,
    scenario: scenario.length };
  const scenarioLabel = mode === 'corridor'
    ? `假設情境：入口鏡頭符合條件的移動觀測，沿信義路朝${options.corridorDirection === 'W' ? '西' : '東'}以固定速度行進；非跨鏡頭追蹤或實測車流。`
    : null;
  return { vehicles, counts, cameraStates, diagnostics, scenarioLabel };
}
