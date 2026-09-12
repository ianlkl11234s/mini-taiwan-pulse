#!/usr/bin/env node
// Consumers vendor byte-identical canonical files; never edit the copies.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const args = process.argv.slice(2);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const value = name => { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : undefined; };
const analytics = value('--analytics');
if (!analytics) throw new Error('Usage: node scripts/research/sync-contracts.mjs --analytics <analytics-root> [--check] [--consumer <contracts-directory>]');
const destination = resolve(value('--consumer') ?? resolve(root, 'src/research/contracts'));
const source = resolve(analytics, 'src/analysis/contracts');
const files = [
  ['result-validator.mjs', 'result-validator.mjs'],
  ['result-validator.d.ts', 'result-validator.d.mts'],
  ['result.schema.json', 'result.schema.json'],
  ['dataset.schema.json', 'dataset.schema.json'],
  ['query-result.schema.json', 'query-result.schema.json'],
  ['../../../tests/analysis/fixtures/research-result-synthetic.json', 'fixture.json'],
];
const manifest = { source: 'taipei-gis-analytics/src/analysis/contracts', schemaVersion: 'research-result/0.1', contractVersions: ['research-result/0.1', 'pulse-dataset/0.1', 'pulse-query-result/0.1'], files: {} };
if (!args.includes('--check')) await mkdir(destination, { recursive: true });
for (const [from, to] of files) {
  const bytes = await readFile(resolve(source, from));
  manifest.files[to] = createHash('sha256').update(bytes).digest('hex');
  if (args.includes('--check')) {
    const copied = await readFile(resolve(destination, to));
    if (!bytes.equals(copied)) throw new Error(`CONTRACT_DRIFT: ${to}`);
  } else await writeFile(resolve(destination, to), bytes);
}
const lock = `${JSON.stringify(manifest, null, 2)}\n`;
if (args.includes('--check')) {
  if (await readFile(resolve(destination, 'provenance.json'), 'utf8') !== lock) throw new Error('CONTRACT_DRIFT: provenance.json');
} else await writeFile(resolve(destination, 'provenance.json'), lock);
console.log(`${args.includes('--check') ? 'Verified' : 'Synced'} ${files.length} canonical files.`);
