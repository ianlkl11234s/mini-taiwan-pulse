import test from 'node:test';
import assert from 'node:assert/strict';
import { longestRunStart, addBox, boxesFromDetections, deleteBox, moveBox, newReviewFrame, resizeBox, selectFrames, summarize } from './box-edit.js';

test('selects evenly spaced distinct frames inside the window', () => {
  const frames = Array.from({ length: 50 }, (_, i) => ({ t: 150 + i, duplicateOfPrevious: i % 5 === 1 }));
  const picked = selectFrames(frames, { start: 160, end: 199, count: 4 });
  assert.equal(picked.length, 4);
  assert.ok(picked.every(i => frames[i].t >= 160 && frames[i].t <= 199 && !frames[i].duplicateOfPrevious));
  assert.equal(frames[picked[0]].t, 160);
  const run = selectFrames(frames, { start: 160, end: 199, count: 3, consecutive: true });
  assert.deepEqual(run.map(i => frames[i].t), [160, 162, 163]);
});

test('move keeps size inside image; resize normalizes flipped corners', () => {
  assert.deepEqual(moveBox([.9, .9, 1, 1], .5, .5).map(v => +v.toFixed(6)), [.9, .9, 1, 1]);
  const r = resizeBox([.2, .2, .4, .4], 'se', .1, .1);
  assert.deepEqual(r, [.1, .1, .2, .2]);
});

test('delete remembers model boxes; add and reclassify are summarized', () => {
  const frame = newReviewFrame({ t: 160, detectorDetections: [
    { className: 'truck', confidence: .3, bbox: [.1, .1, .2, .2] },
    { className: 'car', confidence: .9, bbox: [.5, .5, .6, .6] }] }, 7);
  frame.boxes[0].className = 'motorcycle';
  deleteBox(frame, 'm1');
  addBox(frame, [.7, .7, .8, .8], 'bus');
  const s = summarize({ frames: [frame] });
  assert.deepEqual(s, { frames: 1, reviewed: 0, boxes: 2, added: 1, deleted: 1, reclassified: 1, unconfirmedSuggestions: 0 });
  assert.equal(frame.deletedModelBoxes[0].modelClassName, 'car');
  assert.equal(boxesFromDetections([{ bbox: [0, 0, NaN, 1] }]).length, 0);
});

test('finds the longest unbroken distinct run', () => {
  const dup = [false, true, false, false, false, true, false, false];
  const frames = dup.map((d, i) => ({ t: i, duplicateOfPrevious: d }));
  assert.deepEqual(longestRunStart(frames), { start: 2, length: 3 });
});
