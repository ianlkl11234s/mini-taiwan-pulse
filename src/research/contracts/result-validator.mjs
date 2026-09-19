/**
 * Canonical validator for the Phase A synthetic research-result/0.1 envelope.
 * It is deliberately dependency-free and only validates in-memory JSON data.
 */
export const RESULT_SCHEMA_VERSION = 'research-result/0.1';
export const MAX_RESULT_BYTES = 5 * 1024 * 1024;
export const MAX_FEATURES = 10_000;
export const MAX_VERTICES = 200_000;
export const MAX_TEXT_BYTES = 2048;
export const MAX_ERRORS = 100;
export const MAX_TABLE_COLUMNS = 100;
export const MAX_TABLE_ROWS = 10_000;
export const MAX_RING_VERTICES = 512;
export const MAX_SEGMENT_PAIR_COMPARISONS = 1_000_000;

const encoder = new TextEncoder();
const metricStatuses = new Set(['valid', 'partial', 'unknown', 'suppressed', 'undefined', 'not_comparable', 'error']);
const nullValueStatuses = new Set(['unknown', 'suppressed', 'undefined', 'not_comparable', 'error']);
const coverageStatuses = new Set(['complete', 'partial', 'none', 'unknown']);
const freshnessStatuses = new Set(['fresh', 'stale', 'unknown', 'not_applicable']);
const executionStatuses = new Set(['succeeded', 'partial', 'failed', 'cancelled']);
const scalar = (value) => value === null || typeof value === 'string' || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value));

export function validateResult(input) {
  const errors = [];
  const add = (path, code, message) => { if (errors.length < MAX_ERRORS) errors.push({ path: path.length > 256 ? `${path.slice(0, 253)}...` : path, code, message }); };
  let byteSize;
  try {
    byteSize = encoder.encode(JSON.stringify(input)).byteLength;
  } catch {
    add('$', 'NOT_JSON_VALUE', 'Result must be a JSON-serializable value.');
    return { valid: false, errors };
  }
  if (byteSize > MAX_RESULT_BYTES) {
    add('$', 'RESULT_TOO_LARGE', `Result exceeds ${MAX_RESULT_BYTES} UTF-8 bytes.`);
    return { valid: false, errors };
  }
  if (!plainObject(input)) {
    add('$', 'TYPE', 'Result must be an object.');
    return { valid: false, errors };
  }

  exactKeys(input, ['schemaVersion', 'artifactId', 'title', 'createdAt', 'inputMode', 'inputs', 'method', 'geojson', 'table', 'metrics', 'quality', 'sourceRefs', 'licenseRefs', 'limitations'], '$', add);
  requiredKeys(input, ['schemaVersion', 'artifactId', 'title', 'createdAt', 'inputMode', 'inputs', 'method', 'geojson', 'table', 'metrics', 'quality', 'sourceRefs', 'licenseRefs', 'limitations'], '$', add);
  if (input.schemaVersion !== RESULT_SCHEMA_VERSION) add('$.schemaVersion', 'SCHEMA_VERSION', `schemaVersion must be ${RESULT_SCHEMA_VERSION}.`);
  text(input.artifactId, '$.artifactId', add, { pattern: /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u, label: 'a safe artifact id' });
  text(input.title, '$.title', add, { min: 1 });
  instant(input.createdAt, '$.createdAt', add);
  if (input.inputMode !== 'synthetic') add('$.inputMode', 'UNSUPPORTED_INPUT_MODE', 'Phase A accepts only inputMode="synthetic".');
  if (!Array.isArray(input.inputs)) add('$.inputs', 'TYPE', 'inputs must be an array.');
  else if (input.inputs.length !== 0) add('$.inputs', 'SYNTHETIC_INPUTS', 'Synthetic results must not claim acquisition inputs or receipts.');
  validateMethod(input.method, '$.method', add);
  if (input.geojson !== null) validateFeatureCollection(input.geojson, '$.geojson', add);
  if (input.geojson !== null && input.table !== null) {
    // A result may deliberately provide both spatial display and a table.
  }
  if (input.geojson === null && input.table === null) add('$', 'EMPTY_RESULT', 'At least one of geojson or table must be present.');
  validateTable(input.table, '$.table', add);
  validateMetrics(input.metrics, '$.metrics', input.quality?.coverage?.status, add);
  validateQuality(input.quality, '$.quality', input.inputs, add);
  stringArray(input.sourceRefs, '$.sourceRefs', add, { min: 1, synthetic: true });
  stringArray(input.licenseRefs, '$.licenseRefs', add, { min: 1, synthetic: true });
  stringArray(input.limitations, '$.limitations', add, { min: 1 });
  return { valid: errors.length === 0, errors };
}

export function assertValidResult(input) {
  const result = validateResult(input);
  if (!result.valid) {
    const error = new Error(`RESULT_INVALID: ${result.errors.map((item) => `${item.path} ${item.code}`).join('; ')}`);
    error.code = 'RESULT_INVALID';
    error.errors = result.errors;
    throw error;
  }
  return input;
}

function validateMethod(value, path, add) {
  if (!plainObject(value)) return add(path, 'TYPE', 'method must be an object.');
  exactKeys(value, ['name', 'version', 'parameters', 'scriptHash', 'environmentRef'], path, add);
  requiredKeys(value, ['name', 'version', 'parameters', 'scriptHash', 'environmentRef'], path, add);
  text(value.name, `${path}.name`, add, { min: 1 });
  text(value.version, `${path}.version`, add, { min: 1 });
  jsonData(value.parameters, `${path}.parameters`, add);
  text(value.scriptHash, `${path}.scriptHash`, add, { pattern: /^[a-f0-9]{64}$/u, label: 'a lowercase SHA-256 hex digest' });
  text(value.environmentRef, `${path}.environmentRef`, add, { min: 1 });
}

function validateFeatureCollection(value, path, add) {
  if (!plainObject(value)) { add(path, 'TYPE', 'geojson must be a FeatureCollection or null.'); return 0; }
  exactKeys(value, ['type', 'features', 'bbox'], path, add, ['bbox']);
  requiredKeys(value, ['type', 'features'], path, add);
  if (value.type !== 'FeatureCollection') add(`${path}.type`, 'GEOJSON_TYPE', 'geojson.type must be FeatureCollection.');
  if (!Array.isArray(value.features)) { add(`${path}.features`, 'TYPE', 'features must be an array.'); return 0; }
  if (value.features.length > MAX_FEATURES) { add(`${path}.features`, 'FEATURE_LIMIT', `features exceeds ${MAX_FEATURES}.`); return 0; }
  let allPositions = [];
  let vertices = 0;
  const complexity = { segmentPairs: 0 };
  for (let index = 0; index < value.features.length; index += 1) {
    const outcome = validateFeature(value.features[index], `${path}.features[${index}]`, add, complexity);
    vertices += outcome.vertices;
    allPositions = allPositions.concat(outcome.positions);
    if (vertices > MAX_VERTICES) { add(`${path}.features`, 'VERTEX_LIMIT', `GeoJSON exceeds ${MAX_VERTICES} vertices.`); return vertices; }
  }
  validateBbox(value.bbox, allPositions, `${path}.bbox`, add);
  return vertices;
}

function validateFeature(value, path, add, complexity) {
  if (!plainObject(value)) { add(path, 'TYPE', 'Feature must be an object.'); return { vertices: 0, positions: [] }; }
  exactKeys(value, ['type', 'geometry', 'properties', 'id', 'bbox'], path, add, ['id', 'bbox']);
  requiredKeys(value, ['type', 'geometry', 'properties'], path, add);
  if (value.type !== 'Feature') add(`${path}.type`, 'GEOJSON_TYPE', 'Feature.type must be Feature.');
  if (!plainObject(value.properties)) add(`${path}.properties`, 'TYPE', 'Feature.properties must be an object.');
  else if (Object.keys(value.properties).length > 100) add(`${path}.properties`, 'PROPERTY_LIMIT', 'At most 100 properties are supported.');
  else Object.entries(value.properties).forEach(([key, item]) => {
    text(key, `${path}.properties key`, add, { min: 1 });
    if (!scalar(item)) add(`${path}.properties.*`, 'PROPERTY_SCALAR', 'Feature property values must be scalar JSON values.');
    else if (typeof item === 'string') text(item, `${path}.properties.*`, add);
  });
  if (value.id !== undefined && !(typeof value.id === 'string' || (typeof value.id === 'number' && Number.isFinite(value.id)))) add(`${path}.id`, 'FEATURE_ID', 'Feature id must be a string or finite number.');
  if (typeof value.id === 'string') text(value.id, `${path}.id`, add);
  const geometry = value.geometry === null ? { vertices: 0, positions: [] } : validateGeometry(value.geometry, `${path}.geometry`, add, complexity);
  validateBbox(value.bbox, geometry.positions, `${path}.bbox`, add);
  return geometry;
}

function validateGeometry(value, path, add, complexity) {
  if (!plainObject(value)) { add(path, 'TYPE', 'geometry must be an object or null.'); return { vertices: 0, positions: [] }; }
  exactKeys(value, ['type', 'coordinates', 'bbox'], path, add, ['bbox']);
  requiredKeys(value, ['type', 'coordinates'], path, add);
  const allowed = new Set(['Point', 'MultiPoint', 'LineString', 'MultiLineString', 'Polygon']);
  if (!allowed.has(value.type)) add(`${path}.type`, 'UNSUPPORTED_GEOMETRY', 'GeometryCollection and unsupported geometry types are rejected.');
  const positions = [];
  const position = (candidate, candidatePath) => {
    if (!Array.isArray(candidate) || candidate.length !== 2 || !candidate.every((part) => typeof part === 'number' && Number.isFinite(part))) {
      add(candidatePath, 'POSITION', 'Position must be a finite [lng, lat] pair.'); return;
    }
    const [lng, lat] = candidate;
    if (lng < -180 || lng > 180 || lat < -90 || lat > 90) add(candidatePath, 'EPSG4326_RANGE', 'Position must be within EPSG:4326 lng/lat bounds.');
    positions.push(candidate);
  };
  const line = (candidate, candidatePath) => {
    if (!Array.isArray(candidate) || candidate.length < 2) { add(candidatePath, 'LINE_MINIMUM', 'LineString must contain at least two positions.'); return; }
    candidate.forEach((item, index) => position(item, `${candidatePath}[${index}]`));
  };
  const ring = (candidate, candidatePath) => {
    if (!Array.isArray(candidate) || candidate.length < 4) { add(candidatePath, 'RING_MINIMUM', 'Polygon ring must contain at least four positions.'); return; }
    if (candidate.length > MAX_RING_VERTICES) { add(candidatePath, 'GEOMETRY_COMPLEXITY_LIMIT', `Polygon rings are limited to ${MAX_RING_VERTICES} vertices.`); return; }
    candidate.forEach((item, index) => position(item, `${candidatePath}[${index}]`));
    if (!samePosition(candidate[0], candidate.at(-1))) add(candidatePath, 'RING_CLOSED', 'Polygon ring must be closed.');
    const unique = new Set(candidate.slice(0, -1).map((item) => Array.isArray(item) ? item.join(',') : String(item)));
    if (unique.size < 3) add(candidatePath, 'RING_MINIMUM', 'Polygon ring needs at least three distinct vertices.');
    if (!candidate.every((item) => Array.isArray(item) && item.length === 2 && item.every((part) => typeof part === 'number' && Number.isFinite(part))) || !samePosition(candidate[0], candidate.at(-1))) return;
    const segmentCount = candidate.length - 1;
    const comparisonCount = (segmentCount * (segmentCount - 1)) / 2;
    if (complexity.segmentPairs + comparisonCount > MAX_SEGMENT_PAIR_COMPARISONS) { add(candidatePath, 'GEOMETRY_COMPLEXITY_LIMIT', `Segment comparison budget exceeds ${MAX_SEGMENT_PAIR_COMPARISONS}.`); return; }
    complexity.segmentPairs += comparisonCount;
    if (Math.abs(signedRingArea(candidate)) === 0) add(candidatePath, 'ZERO_AREA_POLYGON', 'Polygon ring must have non-zero area.');
    for (let first = 0; first < segmentCount; first += 1) {
      for (let second = first + 1; second < segmentCount; second += 1) {
        if (second === first + 1 || (first === 0 && second === segmentCount - 1)) continue;
        if (segmentsIntersect(candidate[first], candidate[first + 1], candidate[second], candidate[second + 1])) { add(candidatePath, 'SELF_INTERSECTION', 'Polygon ring must not self-intersect.'); return; }
      }
    }
  };
  switch (value.type) {
    case 'Point': position(value.coordinates, `${path}.coordinates`); break;
    case 'MultiPoint':
      if (!Array.isArray(value.coordinates) || value.coordinates.length < 1) add(`${path}.coordinates`, 'POINT_MINIMUM', 'MultiPoint must contain at least one position.');
      else value.coordinates.forEach((item, index) => position(item, `${path}.coordinates[${index}]`));
      break;
    case 'LineString': line(value.coordinates, `${path}.coordinates`); break;
    case 'MultiLineString':
      if (!Array.isArray(value.coordinates) || value.coordinates.length < 1) add(`${path}.coordinates`, 'LINE_MINIMUM', 'MultiLineString must contain at least one line.');
      else value.coordinates.forEach((item, index) => line(item, `${path}.coordinates[${index}]`));
      break;
    case 'Polygon':
      if (!Array.isArray(value.coordinates) || value.coordinates.length < 1) add(`${path}.coordinates`, 'RING_MINIMUM', 'Polygon must contain at least one ring.');
      else if (value.coordinates.length !== 1) add(`${path}.coordinates`, 'POLYGON_HOLES_UNSUPPORTED', 'Phase A accepts exactly one exterior polygon ring and no holes.');
      else ring(value.coordinates[0], `${path}.coordinates[0]`);
      break;
    default: break;
  }
  validateBbox(value.bbox, positions, `${path}.bbox`, add);
  return { vertices: positions.length, positions };
}

function validateBbox(value, positions, path, add) {
  if (value === undefined) return;
  if (!Array.isArray(value) || value.length !== 4 || !value.every((part) => typeof part === 'number' && Number.isFinite(part))) { add(path, 'BBOX', 'bbox must be four finite [minLng, minLat, maxLng, maxLat] values.'); return; }
  if (positions.length === 0) { add(path, 'BBOX_NO_GEOMETRY', 'bbox requires at least one geometry position.'); return; }
  let minLng = Infinity; let minLat = Infinity; let maxLng = -Infinity; let maxLat = -Infinity;
  for (const [lng, lat] of positions) { minLng = Math.min(minLng, lng); minLat = Math.min(minLat, lat); maxLng = Math.max(maxLng, lng); maxLat = Math.max(maxLat, lat); }
  const expected = [minLng, minLat, maxLng, maxLat];
  if (!value.every((part, index) => part === expected[index])) add(path, 'BBOX_MISMATCH', 'bbox must exactly match the contained EPSG:4326 positions.');
}

function validateTable(value, path, add) {
  if (value === null) return;
  if (!plainObject(value)) return add(path, 'TYPE', 'table must be an object or null.');
  exactKeys(value, ['columns', 'rows'], path, add); requiredKeys(value, ['columns', 'rows'], path, add);
  if (Array.isArray(value.columns) && value.columns.length > MAX_TABLE_COLUMNS) return add(`${path}.columns`, 'TABLE_COLUMN_LIMIT', `table.columns exceeds ${MAX_TABLE_COLUMNS}.`);
  if (!Array.isArray(value.columns) || !value.columns.every((column, index) => (text(column, `${path}.columns[${index}]`, add, { min: 1 }), typeof column === 'string'))) add(`${path}.columns`, 'TYPE', 'table.columns must be strings.');
  else if (new Set(value.columns).size !== value.columns.length) add(`${path}.columns`, 'UNIQUE_COLUMNS', 'table.columns must be unique.');
  if (!Array.isArray(value.rows)) return add(`${path}.rows`, 'TYPE', 'table.rows must be an array.');
  if (value.rows.length > MAX_TABLE_ROWS) return add(`${path}.rows`, 'TABLE_ROW_LIMIT', `table.rows exceeds ${MAX_TABLE_ROWS}.`);
  value.rows.forEach((row, rowIndex) => {
    if (!Array.isArray(row)) return add(`${path}.rows[${rowIndex}]`, 'TYPE', 'Each table row must be an array.');
    if (Array.isArray(value.columns) && row.length !== value.columns.length) add(`${path}.rows[${rowIndex}]`, 'ROW_LENGTH', 'Each row must match columns length.');
    row.forEach((cell, cellIndex) => {
      if (!scalar(cell)) add(`${path}.rows[${rowIndex}][${cellIndex}]`, 'TABLE_SCALAR', 'Table cells must be scalar JSON values.');
      else if (typeof cell === 'string') text(cell, `${path}.rows[${rowIndex}][${cellIndex}]`, add);
    });
  });
}

function validateMetrics(value, path, qualityCoverage, add) {
  if (!Array.isArray(value)) return add(path, 'TYPE', 'metrics must be an array.');
  if (value.length > 100) return add(path, 'METRIC_LIMIT', 'At most 100 metrics are supported.');
  value.forEach((metric, index) => {
    const itemPath = `${path}[${index}]`;
    if (!plainObject(metric)) return add(itemPath, 'TYPE', 'metric must be an object.');
    exactKeys(metric, ['name', 'value', 'unit', 'status', 'scope', 'coverage', 'reason', 'numerator', 'denominator'], itemPath, add, ['reason', 'numerator', 'denominator']);
    requiredKeys(metric, ['name', 'value', 'unit', 'status', 'scope', 'coverage'], itemPath, add);
    text(metric.name, `${itemPath}.name`, add, { min: 1 }); text(metric.unit, `${itemPath}.unit`, add, { min: 1 });
    if (!metricStatuses.has(metric.status)) add(`${itemPath}.status`, 'METRIC_STATUS', 'Unknown metric status.');
    if (metric.value !== null && !(typeof metric.value === 'number' && Number.isFinite(metric.value))) add(`${itemPath}.value`, 'METRIC_VALUE', 'Metric value must be finite number or null.');
    if (nullValueStatuses.has(metric.status) && metric.value !== null) add(`${itemPath}.value`, 'NULL_VALUE_STATUS', `${metric.status} metric value must be null.`);
    if (metric.status === 'valid' && !(typeof metric.value === 'number' && Number.isFinite(metric.value))) add(`${itemPath}.value`, 'VALID_VALUE', 'valid metric requires a finite numeric value.');
    if (metric.status === 'valid' && metric.coverage !== 'complete') add(`${itemPath}.coverage`, 'VALID_REQUIRES_COMPLETE', 'valid metric requires complete coverage for its declared scope.');
    if (metric.status === 'valid' && qualityCoverage === 'none') add(`${itemPath}.coverage`, 'VALID_WITH_NO_RESULT_COVERAGE', 'valid metric cannot be backed by no result coverage.');
    validateMetricScope(metric.scope, `${itemPath}.scope`, add);
    if (!coverageStatuses.has(metric.coverage)) add(`${itemPath}.coverage`, 'COVERAGE_STATUS', 'Unknown metric coverage status.');
    if (metric.reason !== undefined) text(metric.reason, `${itemPath}.reason`, add, { min: 1 });
    if (metric.status === 'partial' && (typeof metric.reason !== 'string' || metric.reason.length === 0)) add(`${itemPath}.reason`, 'PARTIAL_REASON', 'partial metric requires a reason.');
    const hasNumerator = metric.numerator !== undefined; const hasDenominator = metric.denominator !== undefined;
    if (hasNumerator !== hasDenominator) add(itemPath, 'RATIO_PAIR', 'numerator and denominator must be supplied together.');
    if (hasNumerator) {
      validateComponent(metric.numerator, `${itemPath}.numerator`, add); validateComponent(metric.denominator, `${itemPath}.denominator`, add);
      if (metric.status === 'valid' && (metric.numerator.status !== 'valid' || !(typeof metric.numerator.value === 'number' && Number.isFinite(metric.numerator.value)))) add(`${itemPath}.numerator`, 'RATIO_NUMERATOR', 'A valid ratio requires a valid finite numerator.');
      if (metric.status === 'valid' && (metric.denominator.status !== 'valid' || !(typeof metric.denominator.value === 'number' && metric.denominator.value > 0))) add(`${itemPath}.denominator`, 'RATIO_DENOMINATOR', 'A valid ratio requires a valid denominator greater than zero.');
      if (metric.status === 'valid' && typeof metric.value === 'number' && Number.isFinite(metric.numerator.value) && typeof metric.denominator.value === 'number' && metric.denominator.value > 0) {
        const expected = metric.numerator.value / metric.denominator.value;
        if (Math.abs(metric.value - expected) > 1e-9 * Math.max(1, Math.abs(metric.value), Math.abs(expected))) add(`${itemPath}.value`, 'RATIO_VALUE', 'Ratio value must equal numerator/denominator within relative tolerance 1e-9.');
      }
      if (metric.status === 'suppressed' && (metric.numerator.value !== null || metric.denominator.value !== null)) add(itemPath, 'SUPPRESSED_LEAK', 'suppressed metric cannot transmit numerator or denominator values.');
    }
  });
}

function validateMetricScope(value, path, add) {
  if (!plainObject(value)) return add(path, 'TYPE', 'scope must be an object.');
  exactKeys(value, ['spatialRef', 'timeInterval'], path, add); requiredKeys(value, ['spatialRef', 'timeInterval'], path, add);
  text(value.spatialRef, `${path}.spatialRef`, add, { min: 1 }); validateTimeInterval(value.timeInterval, `${path}.timeInterval`, add);
}

function validateComponent(value, path, add) {
  if (!plainObject(value)) return add(path, 'TYPE', 'ratio component must be an object.');
  exactKeys(value, ['value', 'status', 'unit'], path, add); requiredKeys(value, ['value', 'status', 'unit'], path, add);
  if (!metricStatuses.has(value.status)) add(`${path}.status`, 'METRIC_STATUS', 'Unknown ratio component status.');
  if (value.value !== null && !(typeof value.value === 'number' && Number.isFinite(value.value))) add(`${path}.value`, 'METRIC_VALUE', 'Ratio component value must be finite number or null.');
  if ((nullValueStatuses.has(value.status) || value.status === 'suppressed') && value.value !== null) add(`${path}.value`, 'NULL_VALUE_STATUS', 'This ratio component status requires null value.');
  if (value.status === 'valid' && !(typeof value.value === 'number' && Number.isFinite(value.value))) add(`${path}.value`, 'VALID_VALUE', 'valid ratio component requires finite numeric value.');
  text(value.unit, `${path}.unit`, add, { min: 1 });
}

function validateQuality(value, path, inputs, add) {
  if (!plainObject(value)) return add(path, 'TYPE', 'quality must be an object.');
  exactKeys(value, ['executionStatus', 'coverage', 'freshness', 'exclusions', 'analysisComplete', 'displayTruncated'], path, add);
  requiredKeys(value, ['executionStatus', 'coverage', 'freshness', 'exclusions', 'analysisComplete', 'displayTruncated'], path, add);
  if (!executionStatuses.has(value.executionStatus)) add(`${path}.executionStatus`, 'EXECUTION_STATUS', 'Unknown executionStatus.');
  validateCoverage(value.coverage, `${path}.coverage`, add);
  validateFreshness(value.freshness, `${path}.freshness`, inputs, add);
  if (!plainObject(value.exclusions)) add(`${path}.exclusions`, 'TYPE', 'exclusions must be an object.');
  else {
    const names = ['missing_geometry', 'invalid_geometry', 'missing_value', 'duplicate', 'outside_scope'];
    exactKeys(value.exclusions, names, `${path}.exclusions`, add); requiredKeys(value.exclusions, names, `${path}.exclusions`, add);
    names.forEach((name) => { const count = value.exclusions[name]; if (count !== null && (!Number.isInteger(count) || count < 0)) add(`${path}.exclusions.${name}`, 'EXCLUSION_COUNT', 'Exclusion count must be a non-negative integer or null.'); });
  }
  if (typeof value.analysisComplete !== 'boolean') add(`${path}.analysisComplete`, 'TYPE', 'analysisComplete must be boolean.');
  if (typeof value.displayTruncated !== 'boolean') add(`${path}.displayTruncated`, 'TYPE', 'displayTruncated must be boolean.');
}

function validateCoverage(value, path, add) {
  if (!plainObject(value)) return add(path, 'TYPE', 'coverage must be an object.');
  exactKeys(value, ['status', 'requested', 'covered', 'dataVersion', 'validInputCount'], path, add);
  requiredKeys(value, ['status', 'requested', 'covered', 'dataVersion', 'validInputCount'], path, add);
  if (!coverageStatuses.has(value.status)) add(`${path}.status`, 'COVERAGE_STATUS', 'Unknown coverage status.');
  ['requested', 'covered'].forEach((name) => validateScopeReference(value[name], `${path}.${name}`, add));
  if (value.dataVersion !== null) text(value.dataVersion, `${path}.dataVersion`, add, { min: 1 });
  if (!Number.isInteger(value.validInputCount) || value.validInputCount < 0) add(`${path}.validInputCount`, 'INPUT_COUNT', 'validInputCount must be a non-negative integer.');
}

function validateScopeReference(value, path, add) {
  if (!plainObject(value)) return add(path, 'TYPE', 'coverage scope must be an object.');
  exactKeys(value, ['spatialRef', 'timeInterval'], path, add); requiredKeys(value, ['spatialRef', 'timeInterval'], path, add);
  if (value.spatialRef !== null) text(value.spatialRef, `${path}.spatialRef`, add, { min: 1 });
  validateTimeInterval(value.timeInterval, `${path}.timeInterval`, add);
}

function validateTimeInterval(value, path, add) {
  if (value === null) return;
  if (!plainObject(value)) return add(path, 'TYPE', 'timeInterval must be an object or null.');
  exactKeys(value, ['start', 'end'], path, add); requiredKeys(value, ['start', 'end'], path, add);
  if (value.start !== null) instant(value.start, `${path}.start`, add);
  if (value.end !== null) instant(value.end, `${path}.end`, add);
  if (typeof value.start === 'string' && typeof value.end === 'string' && Date.parse(value.start) > Date.parse(value.end)) add(path, 'TIME_INTERVAL', 'timeInterval start must not be after end.');
}

function validateFreshness(value, path, inputs, add) {
  if (!plainObject(value)) return add(path, 'TYPE', 'freshness must be an object.');
  exactKeys(value, ['status', 'evaluatedAt', 'observedAt', 'sourceVersion', 'thresholdPolicyRef'], path, add);
  requiredKeys(value, ['status', 'evaluatedAt', 'observedAt', 'sourceVersion', 'thresholdPolicyRef'], path, add);
  if (!freshnessStatuses.has(value.status)) add(`${path}.status`, 'FRESHNESS_STATUS', 'Unknown freshness status.');
  instant(value.evaluatedAt, `${path}.evaluatedAt`, add);
  if (value.observedAt !== null) instant(value.observedAt, `${path}.observedAt`, add);
  if (value.sourceVersion !== null) text(value.sourceVersion, `${path}.sourceVersion`, add, { min: 1 });
  if (value.thresholdPolicyRef !== null) text(value.thresholdPolicyRef, `${path}.thresholdPolicyRef`, add, { min: 1 });
  if ((value.status === 'fresh' || value.status === 'stale') && (value.observedAt === null || value.thresholdPolicyRef === null)) add(path, 'FRESHNESS_EVIDENCE', 'fresh/stale requires observedAt and thresholdPolicyRef.');
  if (value.status === 'unknown' && (value.observedAt !== null && value.thresholdPolicyRef !== null)) add(path, 'FRESHNESS_UNKNOWN', 'unknown freshness requires missing observedAt or threshold policy.');
  if (Array.isArray(inputs) && inputs.length === 0 && value.status !== 'not_applicable') add(`${path}.status`, 'SYNTHETIC_FRESHNESS', 'Synthetic results without source inputs must use not_applicable freshness.');
  if (value.status === 'not_applicable' && (value.observedAt !== null || value.thresholdPolicyRef !== null)) add(path, 'FRESHNESS_NOT_APPLICABLE', 'not_applicable freshness must not claim observedAt or policy.');
}

function stringArray(value, path, add, options = {}) {
  if (!Array.isArray(value)) return add(path, 'TYPE', 'Expected an array of strings.');
  if (value.length > 100) return add(path, 'STRING_ARRAY_LIMIT', 'At most 100 strings are supported.');
  if (options.min && value.length < options.min) add(path, 'MIN_ITEMS', `Expected at least ${options.min} item(s).`);
  value.forEach((item, index) => { text(item, `${path}[${index}]`, add, { min: 1 }); if (options.synthetic && typeof item === 'string' && !item.startsWith('synthetic:')) add(`${path}[${index}]`, 'SYNTHETIC_REFERENCE', 'Synthetic results must use synthetic: source/license references.'); });
}
function jsonData(value, path, add, depth = 0, budget = { nodes: 0 }) {
  if (depth > 32 || ++budget.nodes > 10000) return add(path, 'PARAMETER_COMPLEXITY_LIMIT', 'Parameters exceed the depth 32 or 10000 node limit.');
  if (scalar(value)) { if (typeof value === 'string') text(value, path, add); return; }
  if (Array.isArray(value)) return value.forEach((item, index) => jsonData(item, `${path}[${index}]`, add, depth + 1, budget));
  if (plainObject(value)) return Object.entries(value).forEach(([key, item]) => { text(key, `${path} key`, add, { min: 1 }); jsonData(item, `${path}.*`, add, depth + 1, budget); });
  add(path, 'JSON_DATA', 'parameters must contain JSON data only.');
}
function instant(value, path, add) {
  if (typeof value !== 'string') { add(path, 'TYPE', 'Expected an ISO-8601 UTC instant string.'); return; }
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/u.test(value) || !Number.isFinite(Date.parse(value))) add(path, 'INSTANT', 'Expected an ISO-8601 UTC instant string.');
  else text(value, path, add, { min: 1 });
}
function text(value, path, add, options = {}) {
  if (typeof value !== 'string') { add(path, 'TYPE', 'Expected a string.'); return; }
  const size = encoder.encode(value).byteLength;
  if (size > MAX_TEXT_BYTES) add(path, 'TEXT_LIMIT', `Text exceeds ${MAX_TEXT_BYTES} UTF-8 bytes.`);
  if (options.min && value.length < options.min) add(path, 'MIN_LENGTH', 'String must not be empty.');
  if (options.pattern && !options.pattern.test(value)) add(path, 'PATTERN', `Expected ${options.label ?? 'a valid value'}.`);
}
function exactKeys(value, names, path, add, optional = []) { const allowed = new Set(names); Object.keys(value).forEach((key) => { if (!allowed.has(key)) add(path, 'UNKNOWN_KEY', 'Unknown key is not allowed.'); }); }
function requiredKeys(value, names, path, add) { names.forEach((name) => { if (!(name in value)) add(`${path}.${name}`, 'REQUIRED', 'Required key is missing.'); }); }
function plainObject(value) { return value !== null && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype; }
function samePosition(a, b) { return Array.isArray(a) && Array.isArray(b) && a.length === 2 && b.length === 2 && a[0] === b[0] && a[1] === b[1]; }
function signedRingArea(ring) { let twiceArea = 0; for (let index = 0; index < ring.length - 1; index += 1) twiceArea += ring[index][0] * ring[index + 1][1] - ring[index + 1][0] * ring[index][1]; return twiceArea / 2; }
function orientation(a, b, c) { return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]); }
function onSegment(a, b, point) { return point[0] >= Math.min(a[0], b[0]) && point[0] <= Math.max(a[0], b[0]) && point[1] >= Math.min(a[1], b[1]) && point[1] <= Math.max(a[1], b[1]); }
function segmentsIntersect(a, b, c, d) {
  const first = orientation(a, b, c); const second = orientation(a, b, d); const third = orientation(c, d, a); const fourth = orientation(c, d, b);
  if (((first > 0 && second < 0) || (first < 0 && second > 0)) && ((third > 0 && fourth < 0) || (third < 0 && fourth > 0))) return true;
  return (first === 0 && onSegment(a, b, c)) || (second === 0 && onSegment(a, b, d)) || (third === 0 && onSegment(c, d, a)) || (fourth === 0 && onSegment(c, d, b));
}
