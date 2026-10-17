/** Run with vite-node --script; local read-only materialization, never publication. */
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { createPopulationSnapshotAdapter } from '../../src/research/populationDatasetAdapter';
import { QueryExecutor } from '../../src/research/queryExecutor';
import { compareRegions } from '../../src/research/regionComparison';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const root = resolve('../runtime');
const receiptPath = resolve(root, 'population-preview/local-preview-receipt.json');
const receipt = JSON.parse(await readFile(receiptPath, 'utf8'));
const gate = JSON.parse(await readFile(resolve(root, 'population-source-gate-20260923.json'), 'utf8'));
if (receipt.status !== 'PASS_LOCAL_PREVIEW_ONLY' || !receipt.not_published) throw Error('LOCAL_PREVIEW_REQUIRED');
if (!/^[a-f0-9]{64}\.json$/.test(receipt.artifact.path)) throw Error('CONTENT_ADDRESSED_ARTIFACT_REQUIRED');
const bytes = new Uint8Array(await readFile(resolve(dirname(receiptPath), receipt.artifact.path)));
const artifact = JSON.parse(new TextDecoder().decode(bytes));
const rawBoundary = await readFile(gate.receipts.county_boundary.path);
const boundarySha = hash(rawBoundary);
if (boundarySha !== gate.receipts.county_boundary.sha256 || boundarySha !== receipt.checks.county_boundary_sha256) throw Error('BOUNDARY_RAW_SHA_MISMATCH');
const release = artifact.values.release;
const adapter = createPopulationSnapshotAdapter({
  contract: { datasetId: release.dataset_id, indicatorId: release.indicator_id, releaseId: release.release_id, level: 'county', periodStart: release.period_start, periodEnd: release.period_end, dimensions: artifact.local_preview_contract.dimensions, unit: artifact.sources.source.unit, label: '2025-12 行政區人口數', expectedAreas: 22, populationLabel: '行政區人口數' },
  receipt: { status: receipt.status, notPublished: receipt.not_published, artifact: receipt.artifact },
  readArtifact: async () => bytes,
  loadBoundary: async () => ({ receipt: { sourceId: 'population-county-boundary', version: release.boundary_version, acquiredAt: new Date().toISOString(), checksumSha256: boundarySha, reference: artifact.geometry.geometry.resource }, boundaryVersion: release.boundary_version, sha256: boundarySha, codeProperty: '行政區域代碼', nameProperty: '名稱', features: JSON.parse(rawBoundary).features }),
});
const started = performance.now();
const query = await new QueryExecutor([adapter]).executeDetailed({ datasetId: release.dataset_id, parameters: { releaseId: release.release_id }, select: ['area_code','area_name','value','status','source_population_scope_note'], limit: 22 });
const source = { ...query.envelope, rows: query.materializedRows, geometry: query.descriptor.geometry, units: { value: '人' } };
const result = compareRegions(source, { areaCodes: ['63000', '65000'], baselineAreaCode: '65000' });
const sourceRows = new Map(gate.county_rows.map(row => [row.area_code, row]));
if (query.materializedRows.length !== 22 || query.materializedRows.some(row => row.value !== sourceRows.get(row.area_code)?.value)) throw Error('RAW_SOURCE_ORACLE_MISMATCH');
const report = { status: 'PASS_LOCAL_MATERIALIZATION_ONLY', browserVerified: false, published: false, totalPopulation: query.materializedRows.reduce((n,row) => n+row.value,0), artifactSha: hash(bytes), boundarySha, elapsedMs: Math.round(performance.now()-started), comparison: result.rows.map(({geometry,...row})=>row), limitations: ['No published standalone population release', 'No proven compatible annual county facility numerator', 'Public statistics boundary SHA differs; alignment guard remains strict'] };
await writeFile(resolve(root, 'n02-population-materialization.json'), JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
