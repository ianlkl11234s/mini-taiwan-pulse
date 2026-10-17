/** Per-vehicle manual annotation (keyframe points), independent of tracker output.
 * A keyframe is one reviewer click on the vehicle's ground-contact point
 * (bottom-centre) in normalized image coordinates at a replay frame time.
 */
export const ANNOTATION_SCHEMA = 'vehicle-keyframe-annotation';
export const ANNOTATION_CLASSES = ['car', 'motorcycle', 'bus', 'truck', 'unknown'];
export const VISIBILITY = ['visible', 'occluded', 'uncertain'];
export const ENTRY_STATES = ['unknown', 'edge', 'already-visible'];
export const EXIT_STATES = ['unknown', 'edge', 'still-visible', 'lost'];
// 160–220s has the most distinct-content frames (186/300) in the 9/29 354 batch.
export const DEFAULT_WINDOW = { start: 160, end: 220 };
const SAME_TIME = 1e-6;

export function createAnnotation(meta = {}) {
  return {
    schemaVersion: 1, type: ANNOTATION_SCHEMA,
    cameraId: meta.cameraId ?? null, captureRunId: meta.captureRunId ?? null,
    sourceData: meta.sourceData ?? null, window: { ...DEFAULT_WINDOW },
    pass: 'first', annotator: '', allVisibleVehiclesAnnotated: false, vehicles: [],
  };
}

export function addVehicle(annotation, className = 'car') {
  const used = new Set(annotation.vehicles.map(v => v.id));
  let n = annotation.vehicles.length + 1;
  while (used.has(`V${n}`)) n++;
  const vehicle = { id: `V${n}`, className: ANNOTATION_CLASSES.includes(className) ? className : 'unknown',
    entry: 'unknown', exit: 'unknown', notes: '', keyframes: [] };
  annotation.vehicles.push(vehicle);
  return vehicle;
}

export function removeVehicle(annotation, id) {
  annotation.vehicles = annotation.vehicles.filter(v => v.id !== id);
}

/** Insert or replace the keyframe at the same frame time; keeps time order. */
export function setKeyframe(vehicle, { t, x, y, visibility = 'visible', duplicateFrame = false }) {
  if (![t, x, y].every(Number.isFinite) || x < 0 || x > 1 || y < 0 || y > 1) throw new Error('keyframe needs finite t and x/y in 0..1');
  const keyframe = { t: Number(t), x: Number(x), y: Number(y),
    visibility: VISIBILITY.includes(visibility) ? visibility : 'uncertain', duplicateFrame: duplicateFrame === true };
  const index = vehicle.keyframes.findIndex(k => Math.abs(k.t - keyframe.t) < SAME_TIME);
  if (index >= 0) vehicle.keyframes[index] = keyframe;
  else vehicle.keyframes.push(keyframe);
  vehicle.keyframes.sort((a, b) => a.t - b.t);
  return keyframe;
}

export function removeKeyframe(vehicle, t) {
  vehicle.keyframes = vehicle.keyframes.filter(k => Math.abs(k.t - t) >= SAME_TIME);
}

/** Exact keyframe, or linear interpolation between neighbours; null outside the annotated span. */
export function positionAt(vehicle, t) {
  const frames = vehicle.keyframes;
  if (!frames.length || t < frames[0].t - SAME_TIME || t > frames.at(-1).t + SAME_TIME) return null;
  for (let i = 0; i < frames.length; i++) {
    const k = frames[i];
    if (Math.abs(k.t - t) < SAME_TIME) return { x: k.x, y: k.y, visibility: k.visibility, interpolated: false };
    const next = frames[i + 1];
    if (next && t > k.t && t < next.t) {
      const a = (t - k.t) / (next.t - k.t);
      return { x: k.x + (next.x - k.x) * a, y: k.y + (next.y - k.y) * a, visibility: 'interpolated', interpolated: true };
    }
  }
  return null;
}

/** Returns a list of human-readable problems; empty means structurally valid. */
export function validateAnnotation(annotation) {
  const errors = [];
  const { start, end } = annotation.window ?? {};
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) errors.push('標註時間窗需有效（終點大於起點）');
  const ids = new Set();
  for (const v of annotation.vehicles ?? []) {
    if (ids.has(v.id)) errors.push(`車輛編號重複：${v.id}`);
    ids.add(v.id);
    if (!ANNOTATION_CLASSES.includes(v.className)) errors.push(`${v.id} 車種不在允許清單`);
    if (!v.keyframes?.length) errors.push(`${v.id} 沒有任何關鍵幀`);
    for (const k of v.keyframes ?? []) {
      if (Number.isFinite(start) && Number.isFinite(end) && (k.t < start - SAME_TIME || k.t > end + SAME_TIME)) {
        errors.push(`${v.id} 關鍵幀 ${k.t.toFixed(1)} 秒超出標註時間窗`);
      }
    }
  }
  return errors;
}
