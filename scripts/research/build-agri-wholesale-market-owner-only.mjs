import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const analytics = '/Users/migu/Desktop/資料庫/gen_ai_try/ichef_工作用/GIS/taipei-gis-analytics';
const raw = resolve(analytics, 'data/raw/agriculture/agri_wholesale_market_companies/agri_wholesale_market_companies_20260522.csv');
const processed = resolve(analytics, 'data/processed/agriculture/agri_wholesale_market_companies/agri_wholesale_market_companies.geojson');
const display = resolve('public/agriculture/agri_wholesale_market_companies.geojson');
const output = resolve('../runtime/owner-only/agri-wholesale-market/agri-wholesale-market-owner-20260525.geojson');
const sha = value => createHash('sha256').update(value).digest('hex');
const required = async (file, expected) => { const bytes = await readFile(file); if (sha(bytes) !== expected) throw new Error(`SOURCE_SHA_MISMATCH:${file}`); return bytes; };
const rawBytes = await required(raw, 'f69f564eefc4d77437b9d01750540af7955ab1bdb0dfa813b43fa448288dcde1');
const sourceBytes = await required(processed, 'cb53e333f57dfe1cefa8d17b606da37ff8315c6ccc85b5150b9eb8adf3764e4f');
await required(display, 'cb53e333f57dfe1cefa8d17b606da37ff8315c6ccc85b5150b9eb8adf3764e4f');
const source = JSON.parse(sourceBytes);
if (source.type !== 'FeatureCollection' || source.features.length !== 53 || rawBytes.toString('utf8').split('\n').length < 116) throw new Error('SOURCE_COUNT_MISMATCH');
const ids = new Set();
const features = source.features.map((feature, i) => {
  const p = feature.properties; const c = feature.geometry?.coordinates;
  if (feature.geometry?.type !== 'Point' || !Array.isArray(c) || c.length !== 2 || !c.every(Number.isFinite) || c[0] < 118 || c[0] > 123 || c[1] < 21 || c[1] > 27 || p['公司狀態'] !== '核准設立' || p.business_type !== 'wholesale_market' || ids.has(p['統一編號'])) throw new Error('SOURCE_SEMANTICS_MISMATCH');
  ids.add(p['統一編號']);
  return { type: 'Feature', geometry: feature.geometry, properties: { row_id: i, company_name: p['公司名稱'], capital_text: p['資本總額'], status: p['公司狀態'], produced_at: p['產製日期'] } };
});
if (ids.size !== 53) throw new Error('SOURCE_ID_MISMATCH');
const bytes = Buffer.from(`${JSON.stringify({ type: 'FeatureCollection', features })}\n`);
await mkdir(dirname(output), { recursive: true }); await writeFile(output, bytes);
console.log(JSON.stringify({ rawSha256: sha(rawBytes), sourceSha256: sha(sourceBytes), rows: 53, output, outputSha256: sha(bytes), bytes: bytes.length }));
