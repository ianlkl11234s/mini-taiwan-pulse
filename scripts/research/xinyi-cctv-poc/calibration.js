/** Image → local ground homography from measured correspondences.
 * Fitting and residuals do not establish that ground controls are trustworthy.
 */
const DIMENSIONS = Object.freeze({ image: 'normalized-0..1', ground: 'metres-east-north' });
const finitePair = pair => Array.isArray(pair) && pair.length === 2 && pair.every(Number.isFinite);
function invalid(reason) {
  return { status: 'invalid', reason, matrix: null, dimensions: DIMENSIONS,
    fit: null, check: null, perPointErrors: [], validationStatus: 'invalid' };
}
function spread(points) {
  const mx = points.reduce((s, p) => s + p[0], 0) / points.length;
  const my = points.reduce((s, p) => s + p[1], 0) / points.length;
  let xx = 0, yy = 0, xy = 0, meanDistance = 0;
  for (const [x, y] of points) {
    const dx = x - mx, dy = y - my;
    xx += dx * dx; yy += dy * dy; xy += dx * dy;
    meanDistance += Math.hypot(dx, dy);
  }
  xx /= points.length; yy /= points.length; xy /= points.length;
  meanDistance /= points.length;
  const trace = xx + yy;
  if (meanDistance < 1e-10 || trace < 1e-20
    || (xx * yy - xy * xy) / (trace * trace) < 1e-5) return null;
  const scale = Math.SQRT2 / meanDistance;
  return { mx, my, scale };
}
function normalized(pair, transform) {
  return [(pair[0] - transform.mx) * transform.scale,
    (pair[1] - transform.my) * transform.scale];
}
function multiply(a, b) {
  const out = Array(9).fill(0);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++)
    for (let k = 0; k < 3; k++) out[r * 3 + c] += a[r * 3 + k] * b[k * 3 + c];
  return out;
}
/** Pivoted Householder QR for the normalized 2N × 8 least-squares system. */
function leastSquares(rows, values) {
  const m = rows.length, n = 8;
  const columns = Array.from({ length: n }, (_, j) => rows.map(row => row[j]));
  const rhs = values.slice(), order = Array.from({ length: n }, (_, i) => i);
  let largest = 0, smallest = Infinity;
  for (let k = 0; k < n; k++) {
    let selected = k, best = -1;
    for (let j = k; j < n; j++) {
      let norm2 = 0;
      for (let i = k; i < m; i++) norm2 += columns[j][i] ** 2;
      if (norm2 > best) { best = norm2; selected = j; }
    }
    if (best < 1e-20) return null;
    [columns[k], columns[selected]] = [columns[selected], columns[k]];
    [order[k], order[selected]] = [order[selected], order[k]];
    const column = columns[k];
    let norm = 0;
    for (let i = k; i < m; i++) norm += column[i] ** 2;
    norm = Math.sqrt(norm);
    const alpha = column[k] >= 0 ? -norm : norm;
    const vector = Array(m - k);
    for (let i = k; i < m; i++) vector[i - k] = column[i];
    vector[0] -= alpha;
    const length2 = vector.reduce((sum, value) => sum + value * value, 0);
    if (length2 < 1e-20) return null;
    const beta = 2 / length2;
    for (let j = k; j < n; j++) {
      let dot = 0;
      for (let i = k; i < m; i++) dot += vector[i - k] * columns[j][i];
      const factor = beta * dot;
      for (let i = k; i < m; i++) columns[j][i] -= factor * vector[i - k];
    }
    let dot = 0;
    for (let i = k; i < m; i++) dot += vector[i - k] * rhs[i];
    const factor = beta * dot;
    for (let i = k; i < m; i++) rhs[i] -= factor * vector[i - k];
    columns[k][k] = alpha;
    for (let i = k + 1; i < m; i++) columns[k][i] = 0;
    largest = Math.max(largest, Math.abs(alpha));
    smallest = Math.min(smallest, Math.abs(alpha));
  }
  if (smallest / largest < 1e-8) return null;
  const pivoted = Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let sum = rhs[i];
    for (let j = i + 1; j < n; j++) sum -= columns[j][i] * pivoted[j];
    pivoted[i] = sum / columns[i][i];
  }
  const solution = Array(n);
  for (let i = 0; i < n; i++) solution[order[i]] = pivoted[i];
  return solution.every(Number.isFinite) ? solution : null;
}
function apply(matrix, point) {
  const [x, y] = point;
  const denominator = matrix[6] * x + matrix[7] * y + matrix[8];
  if (!Number.isFinite(denominator) || Math.abs(denominator) < 1e-10) return null;
  const eastMeters = (matrix[0] * x + matrix[1] * y + matrix[2]) / denominator;
  const northMeters = (matrix[3] * x + matrix[4] * y + matrix[5]) / denominator;
  return Number.isFinite(eastMeters) && Number.isFinite(northMeters)
    ? { eastMeters, northMeters } : null;
}
function summary(errors) {
  return { count: errors.length,
    rmseMeters: Math.sqrt(errors.reduce((sum, e) => sum + e.errorMeters ** 2, 0) / errors.length),
    maxErrorMeters: Math.max(...errors.map(e => e.errorMeters)) };
}
export function fitCalibration(points) {
  if (!Array.isArray(points) || points.length < 4) return invalid('at-least-four-fit-points-required');
  if (points.some(p => !p || !finitePair(p.image) || !finitePair(p.ground)
    || p.image.some(v => v < 0 || v > 1) || !['fit', 'check'].includes(p.role)))
    return invalid('invalid-correspondence');
  const fit = points.filter(p => p.role === 'fit');
  if (fit.length < 4) return invalid('at-least-four-fit-points-required');
  const checks = points.filter(p => p.role === 'check');
  if (checks.some(p => fit.some(f => Math.hypot(p.image[0] - f.image[0], p.image[1] - f.image[1]) < 1e-6
    || Math.hypot(p.ground[0] - f.ground[0], p.ground[1] - f.ground[1]) < 1e-6)))
    return invalid('check-point-reuses-fit-control');
  const imageTransform = spread(fit.map(p => p.image));
  const groundTransform = spread(fit.map(p => p.ground));
  if (!imageTransform || !groundTransform) return invalid('degenerate-control-geometry');
  const rows = [], values = [];
  for (const point of fit) {
    const [x, y] = normalized(point.image, imageTransform);
    const [east, north] = normalized(point.ground, groundTransform);
    rows.push([x, y, 1, 0, 0, 0, -east * x, -east * y]);
    values.push(east);
    rows.push([0, 0, 0, x, y, 1, -north * x, -north * y]);
    values.push(north);
  }
  const solution = leastSquares(rows, values);
  if (!solution) return invalid('ill-conditioned-control-geometry');
  const imageMatrix = [imageTransform.scale, 0, -imageTransform.scale * imageTransform.mx,
    0, imageTransform.scale, -imageTransform.scale * imageTransform.my, 0, 0, 1];
  const groundInverse = [1 / groundTransform.scale, 0, groundTransform.mx,
    0, 1 / groundTransform.scale, groundTransform.my, 0, 0, 1];
  let matrix = multiply(groundInverse, multiply([...solution, 1], imageMatrix));
  const divisor = Math.abs(matrix[8]) > 1e-12
    ? matrix[8] : Math.hypot(...matrix);
  if (!Number.isFinite(divisor) || Math.abs(divisor) < 1e-15) return invalid('unstable-homography');
  matrix = matrix.map(v => v / divisor);
  const perPointErrors = [];
  for (let index = 0; index < points.length; index++) {
    const point = points[index], projectedGround = apply(matrix, point.image);
    if (!projectedGround) return invalid('control-projects-to-horizon');
    perPointErrors.push({ index, role: point.role,
      errorMeters: Math.hypot(projectedGround.eastMeters - point.ground[0],
        projectedGround.northMeters - point.ground[1]),
      projectedGround });
  }
  const fitErrors = perPointErrors.filter(e => e.role === 'fit');
  const checkErrors = perPointErrors.filter(e => e.role === 'check');
  return { status: 'fit', matrix, dimensions: DIMENSIONS,
    fit: summary(fitErrors), check: checkErrors.length ? summary(checkErrors) : null,
    perPointErrors, validationStatus: checkErrors.length ? 'checks-reported' : 'no-checks' };
}
export function projectCalibrated(point, calibration) {
  const pair = Array.isArray(point) ? point : [point?.x, point?.y];
  if (!calibration || calibration.status !== 'fit'
    || !Array.isArray(calibration.matrix) || calibration.matrix.length !== 9
    || !calibration.matrix.every(Number.isFinite) || !finitePair(pair)
    || pair.some(v => v < 0 || v > 1)) return null;
  return apply(calibration.matrix, pair);
}
