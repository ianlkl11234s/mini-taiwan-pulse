import test from 'node:test';
import assert from 'node:assert/strict';
import { fitCalibration, projectCalibrated } from './calibration.js';

const known = ([x, y]) => {
  const denominator = 1 + .2 * x - .15 * y;
  return [(100 * x + 20 * y + 2) / denominator,
    (-30 * x + 80 * y + 5) / denominator];
};
const images = [[.1, .1], [.9, .1], [.9, .9], [.1, .9], [.3, .6], [.7, .4]];
const fitPoints = images.map(image => ({ image, ground: known(image), role: 'fit' }));
const near = (actual, expected, tolerance = 1e-6) =>
  assert.ok(Math.abs(actual - expected) < tolerance, `${actual} != ${expected}`);

test('known projective transform fits arbitrary correspondences and projects metres', () => {
  const calibration = fitCalibration(fitPoints);
  assert.equal(calibration.status, 'fit');
  assert.equal(calibration.validationStatus, 'no-checks');
  assert.equal(calibration.check, null);
  assert.equal(calibration.fit.count, 6);
  assert.ok(calibration.fit.rmseMeters < 1e-7);
  assert.equal(calibration.matrix.length, 9);
  const image = { x: .43, y: .57 };
  const result = projectCalibrated(image, calibration);
  near(result.eastMeters, known([image.x, image.y])[0]);
  near(result.northMeters, known([image.x, image.y])[1]);
  assert.deepEqual(calibration.dimensions,
    { image: 'normalized-0..1', ground: 'metres-east-north' });
});

test('independent check residual is separate from fit residual', () => {
  const checkImage = [.45, .65], truth = known(checkImage);
  const fitOnly = fitCalibration(fitPoints);
  const calibration = fitCalibration([...fitPoints,
    { image: checkImage, ground: [truth[0] + .3, truth[1] - .4], role: 'check' }]);
  assert.equal(calibration.status, 'fit');
  assert.deepEqual(calibration.matrix, fitOnly.matrix);
  assert.equal(calibration.validationStatus, 'checks-reported');
  assert.ok(calibration.fit.rmseMeters < 1e-7);
  near(calibration.check.rmseMeters, .5);
  near(calibration.check.maxErrorMeters, .5);
  assert.equal(calibration.perPointErrors.at(-1).role, 'check');
  near(calibration.perPointErrors.at(-1).errorMeters, .5);
});

test('overdetermined noisy fit uses least squares without hiding fit error', () => {
  const noisy = fitPoints.map((p, i) => ({ ...p,
    ground: [p.ground[0] + (i % 2 ? .2 : -.2), p.ground[1] + (i % 3 ? .1 : -.1)] }));
  const calibration = fitCalibration(noisy);
  assert.equal(calibration.status, 'fit');
  assert.ok(calibration.fit.rmseMeters > .01 && calibration.fit.rmseMeters < .5);
  assert.equal(calibration.fit.count, noisy.length);
});

test('fewer than four fit points and invalid coordinates fail closed', () => {
  const tooFew = fitCalibration([...fitPoints.slice(0, 3),
    { image: [.5, .5], ground: known([.5, .5]), role: 'check' }]);
  assert.equal(tooFew.status, 'invalid');
  assert.equal(tooFew.matrix, null);
  assert.equal(projectCalibrated({ x: .5, y: .5 }, tooFew), null);
  assert.equal(fitCalibration([...fitPoints.slice(0, 4),
    { image: [NaN, .5], ground: [1, 2], role: 'check' }]).status, 'invalid');
  assert.equal(fitCalibration([...fitPoints.slice(0, 4),
    { image: [1.2, .5], ground: [1, 2], role: 'check' }]).status, 'invalid');
  assert.equal(projectCalibrated({ x: 1.2, y: .5 }, fitCalibration(fitPoints)), null);
});

test('collinear image or ground controls and duplicate controls fail closed', () => {
  const collinearImage = [.1, .3, .5, .7].map(x => ({
    image: [x, .5], ground: [x * 100, x * 20], role: 'fit' }));
  assert.equal(fitCalibration(collinearImage).status, 'invalid');
  const collinearGround = fitPoints.slice(0, 4).map((p, i) => ({
    ...p, ground: [i * 10, i * 2] }));
  assert.equal(fitCalibration(collinearGround).status, 'invalid');
  const duplicated = Array(4).fill(null).map(() => ({
    image: [.5, .5], ground: [2, 3], role: 'fit' }));
  assert.equal(fitCalibration(duplicated).status, 'invalid');
});

test('a reused fit control cannot masquerade as an independent check', () => {
  const result = fitCalibration([...fitPoints, { ...fitPoints[0], role: 'check' }]);
  assert.equal(result.status, 'invalid');
  assert.equal(result.reason, 'check-point-reuses-fit-control');
});
