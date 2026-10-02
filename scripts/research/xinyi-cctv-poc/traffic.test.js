import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildTrafficState, cameraPosition, MAX_PREDICTION_HORIZON } from './traffic.js';

const box = (bottom, id = 'a', x = .45) => ({
  id, className: 'car', confidence: .8, bbox: [x, bottom - .12, x + .1, bottom],
});
const camera = (id = 'T000330', bottoms = [.5, .55, .6], status = 'ok', lon = 121.55281) => ({
  id, lon, lat: 25.03316, roadDirection: 'E', status,
  frames: bottoms.map((b, t) => ({ t, detections: b == null ? [] : [box(b)] })),
});
const data = (...cameras) => ({ cameras });
const state = (source, t, options = {}) => buildTrafficState(source, t, { horizonSeconds: MAX_PREDICTION_HORIZON, ...options });
const near = (a, b, e = 1e-8) => assert.ok(Math.abs(a - b) < e, `${a} != ${b}`);

test('continuous replay interpolation, finite velocity, stable key and raw comparison', () => {
  const source = data(camera());
  const options = { viewDirections: { T000330: 'E' } };
  const a = state(source, 1, options), middle = state(source, 1.5, options), b = state(source, 2, options);
  assert.equal(middle.vehicles[0].kind, 'observed');
  assert.equal(middle.vehicles[0].key, a.vehicles[0].key);
  assert.equal(middle.vehicles[0].key, b.vehicles[0].key);
  assert.ok(middle.vehicles[0].x < a.vehicles[0].x && middle.vehicles[0].x > b.vehicles[0].x);
  assert.ok(Number.isFinite((middle.vehicles[0].x - a.vehicles[0].x) / .5));
  const raw = state(source, 1.5, { ...options, smooth: false });
  near(raw.vehicles[0].x, 45);
  assert.notEqual(raw.vehicles[0].x, middle.vehicles[0].x);
});

test('zero-delta samples do not freeze a later moving track', () => {
  const source = data(camera('T000330', [.5, .5, .56, .62]));
  const options = { viewDirections: { T000330: 'E' } };
  assert.equal(state(source, 1, options).counts.stationary, 1);
  assert.equal(state(source, 2, options).counts.observed, 1);
  assert.equal(state(source, 2.5, options).vehicles[0].kind, 'observed');
  assert.ok(state(source, 2.5, options).vehicles[0].x < state(source, 2, options).vehicles[0].x);
});

test('short missing gaps are predicted and expire; horizon zero disables them', () => {
  const source = data(camera('T000330', [.5, .56, null, null]));
  assert.equal(state(source, 1.5).vehicles[0].kind, 'predicted');
  assert.equal(state(source, 1.5, { horizonSeconds: 0 }).vehicles.length, 0);
  assert.equal(state(source, 3).vehicles.length, 0);
});

test('outlier and long gap split tracker segments, without a teleport stitch', () => {
  const source = data(camera('T000330', [.5, .55, .9, .91]));
  const before = state(source, 1).vehicles[0];
  const after = state(source, 2).vehicles[0];
  assert.notEqual(before.key, after.key);
  assert.equal(state(source, 2).diagnostics.splitSegments, 1);
  const longer = data(camera('T000330', [.5, .55, null, null, .58]));
  assert.notEqual(state(longer, 1).vehicles[0].key, state(longer, 4).vehicles[0].key);
});

test('stationary observations are marked, toggleable, and never predicted', () => {
  const source = data(camera('T000330', [.5, .5, .5]));
  assert.equal(state(source, 2).counts.stationary, 1);
  assert.equal(state(source, 2).vehicles[0].kind, 'stationary');
  const hidden = state(source, 2, { showStationary: false });
  assert.equal(hidden.counts.stationary, 1);
  assert.equal(hidden.vehicles.length, 0);
  assert.equal(hidden.counts.predicted, 0);
});

test('edge fragments and T354 manually masked foreground are excluded with diagnostics', () => {
  const c = camera('T000354', [.5]);
  c.frames[0].detections = [
    { ...box(.48, 'edge', 0), bbox: [0, .42, .02, .48] },
    { ...box(.72, 'equipment', .707), bbox: [.707, .514, .826, .718] },
    box(.6, 'valid', .45),
  ];
  const result = state(data(c), 0);
  assert.equal(result.diagnostics.excludedEdgeFragments, 1);
  assert.equal(result.diagnostics.excludedForeground, 1);
  assert.equal(result.counts.stationary, 1);
  assert.equal(result.vehicles[0].key.includes('valid'), true);
});

test('same tracker ID from different cameras remains local; unavailable adds no vehicles', () => {
  const left = camera('T000354', [.5, .56], 'ok', 121.54833);
  const right = camera('T000330', [.5, .56]);
  const result = state(data(left, right), 1);
  assert.equal(new Set(result.vehicles.map(v => v.key)).size, 2);
  assert.ok(cameraPosition(left).x < cameraPosition(right).x);
  assert.equal(state(data(camera('T000330', [.5, .56], 'unavailable')), 1).vehicles.length, 0);
});

test('camera view direction is independent of road metadata', () => {
  const a = camera('T000330', [.5, .56]);
  const b = camera('T000330', [.5, .56]);
  b.roadDirection = 'W';
  assert.deepEqual(state(data(a), 1).vehicles, state(data(b), 1).vehicles);
  const override = state(data(a), 1, { viewDirections: { T000330: 'W' } });
  assert.notEqual(override.vehicles[0].x, state(data(a), 1).vehicles[0].x);
  const assumed = state(data(a), 1, { cameraConfigs: { T000330: { assumedViewDirection: 'W' } } });
  near(assumed.vehicles[0].x, override.vehicles[0].x);
  const explicit = state(data(a), 1, { cameraConfigs: { T000330: { assumedViewDirection: 'W' } },
    viewDirections: { T000330: 'N' } });
  near(explicit.vehicles[0].x, state(data(a), 1).vehicles[0].x);
});

test('outage future changes cannot alter filter, sign, lane, or corridor seed', () => {
  const make = (future) => {
    const c = camera('T000354', [.5, .55, .6, future, future], 'ok', 121.54833);
    c.frames[4].t = 4;
    return data(c, camera('T000330', [null, null, null, null, null], 'unavailable', 121.55281));
  };
  for (const mode of ['observed', 'corridor']) {
    const options = { mode, simulateOutage: 'T000354', corridorDirection: 'E',
      viewDirections: { T000354: 'W' } };
    const a = state(make(.66), 2.8, options);
    const b = state(make(.9), 2.8, options);
    assert.deepEqual(a, b);
  }
});

test('corridor particles use entrance observations only and progress in selected direction', () => {
  const west = camera('T000354', [.5, .56, .62], 'ok', 121.54833);
  west.roadDirection = 'W';
  const middle = camera('T000330', [.5, .56, .62], 'ok', 121.55281);
  const east = camera('T000283', [.5, .56, .62], 'ok', 121.557);
  const source = data(west, middle, east);
  for (const direction of ['E', 'W']) {
    const options = { mode: 'corridor', corridorDirection: direction, speedKmh: 36,
      viewDirections: { T000354: 'W', T000330: 'E', T000283: 'E' } };
    assert.equal(state(source, 0, options).counts.scenario, 0);
    const a = state(source, 1, options), b = state(source, 3, options);
    assert.equal(a.counts.scenario, 1);
    assert.equal(b.counts.scenario, 1);
    near(b.vehicles[0].x - a.vehicles[0].x, direction === 'E' ? 20 : -20);
    assert.equal(a.counts.observed, 0);
    assert.match(a.scenarioLabel, /假設情境/);
  }
});

test('corridor zero speed stays stopped; no eligible entrance means no particles', () => {
  const west = camera('T000354', [.5, .56], 'ok', 121.54833);
  west.roadDirection = 'W';
  const source = data(west,
    camera('T000330', [.5, .56], 'ok', 121.55281));
  const options = { mode: 'corridor', corridorDirection: 'E', speedKmh: 0,
    viewDirections: { T000354: 'W' } };
  near(state(source, 1, options).vehicles[0].x, state(source, 4, options).vehicles[0].x);
  const emptyWest = camera('T000354', [.5, .5], 'ok', 121.54833);
  emptyWest.roadDirection = 'W';
  const noEntrance = data(emptyWest,
    camera('T000330', [.5, .56], 'ok', 121.55281));
  assert.equal(state(noEntrance, 2, { mode: 'corridor' }).vehicles.length, 0);
});


test('unavailable entrance cannot silently fall back to an interior camera', () => {
  const west = camera('T000354', [.5, .56], 'unavailable', 121.54833);
  const middle = camera('T000330', [.5, .56], 'ok', 121.55281);
  const result = state(data(west, middle), 1, { mode: 'corridor', corridorDirection: 'E' });
  assert.equal(result.diagnostics.scenarioEntranceCameraId, 'T000354');
  assert.equal(result.vehicles.length, 0);
});

test('north-facing tracks use projected 2D heading through an east-to-north turn', () => {
  const c = camera('T000330', []);
  c.frames = [
    { t: 0, detections: [box(.5, 'turn', .35)] },
    { t: .5, detections: [box(.5, 'turn', .55)] },
    { t: 1, detections: [box(.45, 'turn', .55)] },
    { t: 1.5, detections: [box(.4, 'turn', .55)] },
  ];
  const source = data(c), opts = { viewDirections: { T000330: 'N' } };
  const east = state(source, .5, opts).vehicles[0];
  const before = state(source, 1, opts).vehicles[0];
  const north = state(source, 1.5, opts).vehicles[0];
  assert.equal(east.kind, 'observed');
  assert.ok(Math.cos(east.heading) > .8);
  assert.ok(Math.sin(north.heading) < -.8);
  const dx = north.x - before.x, dz = north.z - before.z;
  // main.js applies rotation.y = -heading to a mesh facing +x.
  const renderedForward = { x: Math.cos(north.heading), z: Math.sin(north.heading) };
  assert.ok(renderedForward.x * dx + renderedForward.z * dz > 0);
});

test('same-ID short missing frame is bridged as predicted, never observed', () => {
  const c = camera('T000330', []);
  c.frames = [
    { t: 0, detections: [box(.5)] },
    { t: .2, detections: [box(.55)] },
    { t: .4, detections: [] },
    { t: .6, detections: [box(.6)] },
  ];
  const source = data(c), opts = { viewDirections: { T000330: 'N' } };
  const a = state(source, .2, opts).vehicles[0];
  const gap = state(source, .5, opts);
  const b = state(source, .6, opts).vehicles[0];
  assert.equal(gap.counts.observed, 0);
  assert.equal(gap.counts.predicted, 1);
  assert.equal(gap.vehicles[0].kind, 'predicted');
  assert.equal(gap.vehicles[0].key, a.key);
  assert.equal(gap.vehicles[0].key, b.key);
  assert.ok(gap.vehicles[0].z > Math.min(a.z, b.z) && gap.vehicles[0].z < Math.max(a.z, b.z));
  const switched = structuredClone(source);
  switched.cameras[0].frames[3].detections[0].id = 'different';
  assert.ok(state(switched, .6, opts).vehicles.some(v => v.key !== a.key && v.cameraId === a.cameraId));
});

test('perspective gap continuation is bounded and stationary hold is also predicted', () => {
  const moving = camera('T000330', []);
  moving.frames = [
    { t: 0, detections: [box(.5)] },
    { t: .2, detections: [box(.55)] },
    { t: .4, detections: [] }, { t: .6, detections: [] },
    { t: .8, detections: [] }, { t: 1, detections: [] },
  ];
  const config = { perspectiveQuad: [[.3,.2],[.7,.2],[.9,.9],[.1,.9]],
    approximateWidthMeters: 24, approximateLengthMeters: 85, assumedViewDirection: 'N' };
  const opts = { cameraConfigs: { T000330: config }, horizonSeconds: .8 };
  assert.equal(state(data(moving), .7, opts).vehicles[0].kind, 'predicted');
  assert.ok(Number.isFinite(state(data(moving), .7, opts).vehicles[0].z));
  assert.equal(state(data(moving), 1.1, opts).vehicles.length, 0);
  const parked = structuredClone(moving);
  parked.frames[1].detections[0] = box(.5);
  assert.equal(state(data(parked), .6, opts).vehicles[0].kind, 'predicted');
  assert.equal(state(data(parked), 1.1, opts).vehicles.length, 0);
});

test('simulated outage cannot bridge to a future sample or use its heading', () => {
  const make = future => {
    const c = camera('T000330', []);
    c.frames = [
      { t: 0, detections: [box(.5)] },
      { t: .2, detections: [box(.54)] },
      { t: .4, detections: [box(.58)] },
      { t: .6, detections: [box(future)] },
      { t: .8, detections: [box(future)] },
    ];
    return data(c);
  };
  const opts = { viewDirections: { T000330: 'N' }, simulateOutage: 'T000330' };
  const a = state(make(.62), .55, opts), b = state(make(.4), .55, opts);
  assert.deepEqual(a, b);
  assert.equal(a.vehicles[0].kind, 'predicted');
});

test('north-facing corridor seeds only east/west-dominant entrance motion', () => {
  const west = camera('T000354', []);
  west.lon = 121.54833;
  west.frames = [
    { t: 0, detections: [box(.5, 'north', .4)] },
    { t: .5, detections: [box(.45, 'north', .4)] },
  ];
  const east = camera('T000283', []);
  east.lon = 121.557;
  const source = data(west, east);
  const opts = { mode: 'corridor', corridorDirection: 'E', viewDirections: { T000354: 'N' } };
  assert.equal(state(source, .5, opts).counts.scenario, 0);
  const eastbound = structuredClone(source);
  eastbound.cameras[0].frames[1].detections[0] = box(.5, 'north', .58);
  assert.equal(state(eastbound, .5, opts).counts.scenario, 1);
});

test('prediction horizon is capped by core and UI slider exposes the same cap', () => {
  const source = data(camera('T000330', [.5, .56, null, null]));
  // Last observation t=1; at t=1.9 the gap age 0.9s exceeds the 0.8s cap.
  assert.equal(state(source, 1.7, { horizonSeconds: 5 }).vehicles[0].kind, 'predicted');
  assert.equal(state(source, 1.9, { horizonSeconds: 5 }).vehicles.length, 0);
  const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
  const slider = html.match(/<input id="horizon"[^>]*>/)[0];
  assert.equal(Number(slider.match(/max="([^"]+)"/)[1]), MAX_PREDICTION_HORIZON);
  assert.ok(Number(slider.match(/value="([^"]+)"/)[1]) <= MAX_PREDICTION_HORIZON);
});
