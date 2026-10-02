import test from 'node:test';
import assert from 'node:assert/strict';
import { addVehicle, createAnnotation, positionAt, removeKeyframe, removeVehicle, setKeyframe, validateAnnotation } from './annotation.js';

test('vehicle ids stay unique after removal', () => {
  const a = createAnnotation({ cameraId: 'T000354' });
  addVehicle(a, 'car'); addVehicle(a, 'bus'); removeVehicle(a, 'V1');
  assert.equal(addVehicle(a, 'motorcycle').id, 'V3');
  assert.equal(addVehicle(a, 'spaceship').className, 'unknown');
});

test('keyframe at the same time replaces, others stay sorted', () => {
  const v = addVehicle(createAnnotation(), 'car');
  setKeyframe(v, { t: 102, x: .5, y: .5 });
  setKeyframe(v, { t: 101, x: .4, y: .5 });
  setKeyframe(v, { t: 102, x: .6, y: .5, visibility: 'occluded' });
  assert.deepEqual(v.keyframes.map(k => [k.t, k.x, k.visibility]), [[101, .4, 'visible'], [102, .6, 'occluded']]);
  removeKeyframe(v, 101);
  assert.equal(v.keyframes.length, 1);
  assert.throws(() => setKeyframe(v, { t: 103, x: 1.2, y: .5 }));
});

test('position interpolates only inside the annotated span', () => {
  const v = addVehicle(createAnnotation(), 'car');
  setKeyframe(v, { t: 100, x: .2, y: .4 });
  setKeyframe(v, { t: 102, x: .6, y: .8 });
  const mid = positionAt(v, 101);
  assert.ok(Math.abs(mid.x - .4) < 1e-9 && Math.abs(mid.y - .6) < 1e-9 && mid.interpolated);
  assert.equal(positionAt(v, 100).interpolated, false);
  assert.equal(positionAt(v, 99.8), null);
  assert.equal(positionAt(v, 102.2), null);
});

test('validation reports empty vehicles and keyframes outside the window', () => {
  const a = createAnnotation();
  const v = addVehicle(a, 'car');
  assert.match(validateAnnotation(a).join(), /V1 沒有任何關鍵幀/);
  setKeyframe(v, { t: 230, x: .5, y: .5 });
  assert.match(validateAnnotation(a).join(), /超出標註時間窗/);
  a.window = { start: 160, end: 240 };
  assert.deepEqual(validateAnnotation(a), []);
});
