import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeCamera } from './analytics.js';
import { buildTrafficState } from './traffic.js';

const roi = [[.35, .4], [.65, .4], [.65, .8], [.35, .8]];
const line = [[.5, .4], [.5, .8]];
const config = { roi, countLine: line };
const detection = (x, className = 'car', id = 'track-a', bottom = .6) => ({
  id, className, confidence: .8, bbox: [x - .05, bottom - .15, x + .05, bottom],
});
const camera = (xs, classes = []) => ({
  id: 'T000330', lon: 121.55281, lat: 25.03316, roadDirection: 'E', status: 'ok',
  frames: xs.map((x, i) => ({ t: i * .5, detections: x == null ? [] : [detection(x, classes[i] || 'car')] })),
});

test('crossing deadband and jitter produce one event per direction per local track', () => {
  const c = camera([.44, .47, .497, .503, .54, .52, .49, .46, .56]);
  const result = analyzeCamera(c, 4, config);
  assert.equal(result.status, 'ready');
  assert.deepEqual(result.counts.crossings, { 'A→B': 1, 'B→A': 1 });
  assert.equal(result.events.length, 2);
  assert.ok(result.events.every(e => e.point.x >= .5 - 1e-8 && e.point.x <= .5 + 1e-8));
  assert.ok(result.events.every(e => e.id.startsWith('local-') && e.id !== 'track-a'));
  assert.equal(result.speedKmh, null);
  assert.equal(result.calibrationStatus, 'uncalibrated');
});

test('occupancy is latest source-frame snapshot by stable class; ROI also excludes 3D glyph', () => {
  const c = camera([.45, .48, .7], ['car', 'bus', 'car']);
  const a = analyzeCamera(c, .5, config);
  assert.deepEqual(a.counts.occupancyByClass, { car: 1 });
  assert.equal(a.counts.occupancyTotal, 1);
  const state = buildTrafficState({ cameras: [c] }, 1, { cameraConfigs: { T000330: config } });
  assert.equal(state.vehicles.length, 0);
  assert.equal(state.diagnostics.excludedRoi, 1);
  const b = analyzeCamera(c, 1, config);
  assert.equal(b.counts.occupancyTotal, 0);
  assert.deepEqual(b.counts.occupancyByClass, {});
});

test('persistent class change requires three consecutive samples; raw label remains available', () => {
  const c = camera([.45, .45, .45, .45, .45, .45], ['car', 'bus', 'car', 'bus', 'bus', 'bus']);
  const source = { cameras: [c] };
  const one = buildTrafficState(source, .5).vehicles[0];
  assert.equal(one.className, 'car');
  assert.equal(one.rawClassName, 'bus');
  assert.equal(analyzeCamera(c, 2, config).counts.occupancyByClass.car, 1);
  const final = buildTrafficState(source, 2.5).vehicles[0];
  assert.equal(final.className, 'bus');
  assert.equal(analyzeCamera(c, 2.5, config).counts.occupancyByClass.bus, 1);
});

test('line intersection must lie on finite segment; duplicate frame cannot make an event', () => {
  const c = camera([.45, .55]);
  const off = analyzeCamera(c, .5, { roi, countLine: [[.5, .1], [.5, .2]] });
  assert.equal(off.counts.crossingTotal, 0);
  c.frames.push({ t: .5, detections: [detection(.45)] });
  const duplicate = analyzeCamera(c, .5, config);
  assert.equal(duplicate.counts.crossingTotal, 1);
});

test('gap over 1.5 seconds cannot be stitched into a crossing', () => {
  const c = camera([.45, null, null, null, .55]);
  const result = analyzeCamera(c, 2, config);
  assert.equal(result.counts.crossingTotal, 0);
});

test('near-line stopped jitter and duplicate image content do not confirm motion or class', () => {
  const c = camera([.496, .502, .498, .501, .497, .503], ['car', 'bus', 'bus', 'bus', 'car', 'car']);
  c.frames[1].duplicateOfPrevious = true;
  c.frames[1].uniqueContent = false;
  c.frames[2].duplicateOfPrevious = true;
  c.frames[2].uniqueContent = false;
  c.frames[3].duplicateOfPrevious = true;
  c.frames[3].uniqueContent = false;
  const result = analyzeCamera(c, 2.5, config);
  assert.equal(result.counts.crossingTotal, 0);
  assert.equal(result.counts.occupancyByClass.car, 1);
  assert.equal(result.diagnostics.duplicateFrames, 3);
  assert.equal(buildTrafficState({ cameras: [c] }, 2.5).vehicles[0].className, 'car');
});

test('latest duplicate frame retains occupancy and an observed 3D snapshot', () => {
  const c = camera([.45, .47, null]);
  c.frames[1].detections = [detection(.47, 'car', 'track-a', .66)];
  c.frames[2].duplicateOfPrevious = true;
  c.frames[2].uniqueContent = false;
  const result = analyzeCamera(c, 1, config);
  assert.equal(result.status, 'ready');
  assert.equal(result.counts.occupancyTotal, 1);
  const vehicle = buildTrafficState({ cameras: [c] }, 1).vehicles[0];
  assert.ok(vehicle);
  assert.equal(vehicle.kind, 'observed');
  assert.equal(vehicle.rawClassName, 'car');
  assert.equal(result.diagnostics.duplicateFrames, 1);
});

test('long repeated content expires instead of reporting fresh occupancy', () => {
  const c = camera([.45, null, null, null, null]);
  for (const frame of c.frames.slice(1)) {
    frame.duplicateOfPrevious = true;
    frame.uniqueContent = false;
  }
  const analytics = analyzeCamera(c, 2, config);
  assert.equal(analytics.status, 'stale');
  assert.equal(analytics.counts.occupancyTotal, null);
  const scene = buildTrafficState({ cameras: [c] }, 2);
  assert.equal(scene.cameraStates[0].status, 'stale');
  assert.equal(scene.vehicles.length, 0);
});

test('stale and outage snapshots have unknown occupancy while prior crossings remain', () => {
  const c = camera([.45, .55, null, null, null]);
  const stale = analyzeCamera(c, 4, config);
  assert.equal(stale.status, 'stale');
  assert.equal(stale.counts.occupancyByClass, null);
  assert.equal(stale.counts.occupancyTotal, null);
  assert.equal(stale.counts.crossingTotal, 1);
  const outage = analyzeCamera(c, 2.1, { ...config, simulateOutage: true });
  assert.equal(outage.status, 'stale');
  assert.equal(outage.counts.occupancyTotal, null);
  assert.equal(outage.counts.crossingTotal, 1);
});

test('unconfigured, missing and unavailable states keep unknown counts null', () => {
  const c = camera([.45]);
  const unconfigured = analyzeCamera(c, 0);
  assert.equal(unconfigured.status, 'unconfigured');
  assert.equal(unconfigured.counts.occupancyByClass, null);
  assert.equal(unconfigured.counts.crossings, null);
  const unavailable = analyzeCamera({ ...c, status: 'unavailable' }, 0, config);
  assert.equal(unavailable.status, 'unavailable');
  assert.equal(unavailable.counts.occupancyTotal, null);
  assert.equal(analyzeCamera(null, 0, config).counts.crossingTotal, null);
});

test('future samples beyond playback or outage cutoff do not change counts or class', () => {
  const make = future => {
    const c = camera([.45, .46, .47, future, future], ['car', 'bus', 'car', 'bus', 'bus']);
    c.frames[3].t = 3;
    c.frames[4].t = 4;
    return c;
  };
  const a = analyzeCamera(make(.56), 2.8, { ...config, simulateOutage: true });
  const b = analyzeCamera(make(.8), 2.8, { ...config, simulateOutage: true });
  assert.deepEqual(a, b);
  assert.equal(analyzeCamera(make(.56), .8, config).counts.crossingTotal, 0);
});

test('approximate perspective dimensions never become measured speed', () => {
  const c = camera([.45, .55]);
  const result = analyzeCamera(c, .5, { ...config, calibration: {
    approximateLengthMeters: 100, approximateWidthMeters: 24,
  } });
  assert.equal(result.speedKmh, null);
  assert.equal(result.calibrationStatus, 'uncalibrated');
});
