/** Planar perspective approximation; dimensions are authored, never speed calibration. */
function solve(matrix, values) {
  const rows = matrix.map((row, i) => [...row, values[i]]);
  for (let col = 0; col < 8; col++) {
    let pivot = col;
    for (let i = col + 1; i < 8; i++) if (Math.abs(rows[i][col]) > Math.abs(rows[pivot][col])) pivot = i;
    if (Math.abs(rows[pivot][col]) < 1e-10) return null;
    [rows[col], rows[pivot]] = [rows[pivot], rows[col]];
    const divisor = rows[col][col];
    for (let j = col; j <= 8; j++) rows[col][j] /= divisor;
    for (let i = 0; i < 8; i++) if (i !== col) {
      const factor = rows[i][col];
      for (let j = col; j <= 8; j++) rows[i][j] -= factor * rows[col][j];
    }
  }
  return [...rows.map(row => row[8]), 1];
}
const cache = new WeakMap();
export function homographyForQuad(quad) {
  if (!Array.isArray(quad) || quad.length !== 4 || quad.some(p => !Array.isArray(p) || p.length !== 2 || !p.every(Number.isFinite))) return null;
  const targets = [[-.5, 1], [.5, 1], [.5, 0], [-.5, 0]];
  const matrix = [], values = [];
  quad.forEach(([x, y], i) => {
    const [u, v] = targets[i];
    matrix.push([x, y, 1, 0, 0, 0, -u * x, -u * y], [0, 0, 0, x, y, 1, -v * x, -v * y]);
    values.push(u, v);
  });
  return solve(matrix, values);
}
export function transformPoint(h, point) {
  if (!h || !Number.isFinite(point?.x) || !Number.isFinite(point?.y)) return null;
  const {x,y} = point, denominator = h[6] * x + h[7] * y + h[8];
  if (Math.abs(denominator) < 1e-8) return null;
  const u = (h[0]*x+h[1]*y+h[2])/denominator;
  const v = (h[3]*x+h[4]*y+h[5])/denominator;
  return Number.isFinite(u) && Number.isFinite(v) ? {u,v} : null;
}
export function projectImagePoint(camera, point, config, viewSign) {
  if (![camera?.lon,camera?.lat,point?.x,point?.y].every(Number.isFinite)) return null;
  const origin = {x:(camera.lon-121.55281)*100700,z:(25.03316-camera.lat)*111320};
  const direction = viewSign ?? config?.assumedViewDirection ?? 'E';
  const north = direction === 'N';
  const sign = direction === 'W' || direction < 0 ? -1 : 1;
  if (!config?.perspectiveQuad) return north
    ? {x:origin.x+(point.x-.5)*11,z:origin.z-(8+(1-point.y)*100)}
    : {x:origin.x+sign*(1-point.y)*100,z:origin.z+(point.x-.5)*11};
  if (!cache.has(config)) cache.set(config, homographyForQuad(config.perspectiveQuad));
  const transformed = transformPoint(cache.get(config), point);
  if (!transformed || Math.abs(transformed.u)>1.1 || transformed.v<-.15 || transformed.v>1.4) return null;
  const width = config.approximateWidthMeters ?? 24;
  const length = config.approximateLengthMeters ?? 100;
  if (![width,length].every(v=>Number.isFinite(v)&&v>0)) return null;
  return north
    ? {x:origin.x+transformed.u*width,z:origin.z-(8+transformed.v*length)}
    : {x:origin.x+sign*(8+transformed.v*length),z:origin.z+sign*transformed.u*width};
}
