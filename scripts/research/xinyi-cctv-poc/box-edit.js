/** Pure helpers for correcting model boxes into reviewer truth boxes.
 * Boxes are normalized [x1, y1, x2, y2] in 0..1 image coordinates.
 */
export const TRUTH_SCHEMA = 'frame-box-truth';
export const TRUTH_CLASSES = ['car', 'motorcycle', 'bus', 'truck'];
// Emergency-vehicle tag rides on a normal box (class stays car/truck/bus); kept for a later crop classifier.
export const EMERGENCY_TAGS = ['ambulance', 'police', 'fire'];
// 160.0–173.8s is an unbroken run of 70 distinct-content frames in the 9/29 354 batch.
export const DEFAULT_REVIEW = { start: 160, end: 220, count: 15, consecutive: true };
const MIN_SIZE = .006;
const clamp01 = v => Math.max(0, Math.min(1, v));

/** Distinct-content frames inside [start, end]: the first `count` in a row when
 * `consecutive`, otherwise evenly spaced. Returns frame indices. */
export function selectFrames(frames, { start, end, count, consecutive = false } = DEFAULT_REVIEW) {
  const candidates = [];
  frames.forEach((f, i) => {
    if (f.t >= start && f.t <= end && f.duplicateOfPrevious !== true && f.uniqueContent !== false) candidates.push(i);
  });
  if (consecutive || candidates.length <= count) return candidates.slice(0, count);
  const picked = [];
  for (let k = 0; k < count; k++) picked.push(candidates[Math.round(k * (candidates.length - 1) / (count - 1))]);
  return [...new Set(picked)];
}

/** Start time of the longest unbroken run of distinct-content frames. */
export function longestRunStart(frames) {
  let best = null, bestLength = 0, start = null, length = 0;
  for (const f of frames) {
    if (f.duplicateOfPrevious === true || f.uniqueContent === false) { start = null; length = 0; continue; }
    if (start === null) start = f.t;
    length++;
    if (length > bestLength) { best = start; bestLength = length; }
  }
  return { start: best, length: bestLength };
}

/** Model detector boxes become editable truth candidates, keeping their origin. */
export function boxesFromDetections(detections = []) {
  return detections
    .filter(d => Array.isArray(d?.bbox) && d.bbox.length === 4 && d.bbox.every(Number.isFinite))
    .map((d, i) => ({ id: `m${i}`, bbox: normalizeBox(d.bbox), className: TRUTH_CLASSES.includes(d.className) ? d.className : 'car',
      origin: 'model', modelClassName: d.className ?? null, modelConfidence: d.confidence ?? null, edited: false,
      // suggested = low-confidence rider candidate; reviewer must confirm (class key) or delete.
      suggested: d.suggested === true }));
}

export function normalizeBox([x1, y1, x2, y2]) {
  const a = [clamp01(Math.min(x1, x2)), clamp01(Math.min(y1, y2)), clamp01(Math.max(x1, x2)), clamp01(Math.max(y1, y2))];
  if (a[2] - a[0] < MIN_SIZE) a[2] = Math.min(1, a[0] + MIN_SIZE);
  if (a[3] - a[1] < MIN_SIZE) a[3] = Math.min(1, a[1] + MIN_SIZE);
  return a;
}

/** Move keeps size and stays inside the image. */
export function moveBox(bbox, dx, dy) {
  const w = bbox[2] - bbox[0], h = bbox[3] - bbox[1];
  const x1 = Math.max(0, Math.min(1 - w, bbox[0] + dx)), y1 = Math.max(0, Math.min(1 - h, bbox[1] + dy));
  return [x1, y1, x1 + w, y1 + h];
}

/** Drag one corner ('nw' | 'ne' | 'sw' | 'se') to a new point. */
export function resizeBox(bbox, corner, x, y) {
  const b = [...bbox];
  if (corner.includes('w')) b[0] = x; else b[2] = x;
  if (corner.includes('n')) b[1] = y; else b[3] = y;
  return normalizeBox(b);
}

export function newReviewFrame(frame, index) {
  return { frameIndex: index, t: frame.t ?? null, imageUrl: frame.imageUrl ?? null, reviewed: false,
    cameraId: frame.cameraId ?? null, receivedAt: frame.receivedAt ?? null,
    boxes: boxesFromDetections(frame.detectorDetections), deletedModelBoxes: [] };
}

export function deleteBox(reviewFrame, id) {
  const box = reviewFrame.boxes.find(b => b.id === id);
  if (!box) return;
  reviewFrame.boxes = reviewFrame.boxes.filter(b => b.id !== id);
  if (box.origin === 'model') reviewFrame.deletedModelBoxes.push({ id: box.id, bbox: box.bbox, modelClassName: box.modelClassName });
}

export function addBox(reviewFrame, bbox, className = 'car') {
  let n = reviewFrame.boxes.length + reviewFrame.deletedModelBoxes.length;
  while (reviewFrame.boxes.some(b => b.id === `a${n}`)) n++;
  const box = { id: `a${n}`, bbox: normalizeBox(bbox), className: TRUTH_CLASSES.includes(className) ? className : 'car',
    origin: 'added', modelClassName: null, modelConfidence: null, edited: true };
  reviewFrame.boxes.push(box);
  return box;
}

/** E key: none → ambulance → police → fire → none. */
export function cycleEmergency(box) {
  const next = EMERGENCY_TAGS[EMERGENCY_TAGS.indexOf(box.emergency ?? null) + 1] ?? null;
  if (next) box.emergency = next; else delete box.emergency;
  return box.emergency ?? null;
}

export function summarize(review) {
  const frames = review.frames;
  return {
    frames: frames.length, reviewed: frames.filter(f => f.reviewed).length,
    boxes: frames.reduce((n, f) => n + f.boxes.length, 0),
    added: frames.reduce((n, f) => n + f.boxes.filter(b => b.origin === 'added').length, 0),
    deleted: frames.reduce((n, f) => n + f.deletedModelBoxes.length, 0),
    reclassified: frames.reduce((n, f) => n + f.boxes.filter(b => b.origin === 'model' && b.className !== b.modelClassName).length, 0),
    unconfirmedSuggestions: frames.reduce((n, f) => n + f.boxes.filter(b => b.suggested).length, 0),
    emergency: frames.reduce((n, f) => n + f.boxes.filter(b => b.emergency).length, 0),
  };
}
