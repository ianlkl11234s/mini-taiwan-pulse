import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync, mkdirSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { refreshNamespace } from './refresh-gfw-hourly.mjs';
const hash = b => createHash('sha256').update(b).digest('hex');
function fixture(end = '2026-09-13') {
  const epoch = Date.parse(end + 'T00:00:00Z') - 6 * 86400000;
  const files = new Map(); const assets = [];
  function entry(kind, stamp, daily = false) {
    const body = Buffer.from(`${kind}:${stamp}`);
    const path = `releases/${end}/${kind}/${stamp.replaceAll(':', '-')}.bin`;
    const a = { path, bytes: body.length, sha256: hash(body) };
    files.set(path, body); assets.push(a);
    return { ...a, [daily ? 'display_date' : 'observed_at']: stamp };
  }
  const hours = kind => Array.from({ length: 168 }, (_, i) => entry(kind, new Date(epoch + i * 3600000).toISOString()));
  const m = { schema_version: 3, release_id: end, latest_complete_date: end, date_start: new Date(epoch).toISOString().slice(0, 10), date_end: end,
    grid: { hours: hours('grid') }, dark_vessels: { hours: hours('sar') }, tracks: { frames: hours('frames'), days: Array.from({ length: 7 }, (_, i) => entry('days', new Date(epoch + i * 86400000).toISOString().slice(0, 10), true)) }, assets };
  files.set('manifest.json', Buffer.from(JSON.stringify(m)));
  return { m, files };
}
function setup(t) {
  const directory = mkdtempSync(join(tmpdir(), 'gfw-refresh-test-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  return directory;
}
function downloadFrom(files, calls = [], mutate = () => {}) {
  return async (key, destination) => {
    const relative = key.replace('prefix/', ''); calls.push(relative); mutate(relative);
    const body = files.get(relative); if (!body) return null;
    writeFileSync(destination, body);
  };
}
test('pins candidate, verifies all assets, ignores archived releases and reuses exact bytes', async t => {
  const directory = setup(t); const { m, files } = fixture(); const calls = [];
  files.set('releases/old/archive.bin', Buffer.from('do not mirror'));
  const result = await refreshNamespace({ directory, prefix: 'prefix', download: downloadFrom(files, calls) });
  assert.equal(result.downloaded, 511); assert.equal(result.releaseId, m.release_id);
  assert.equal(calls.filter(v => v === 'manifest.json').length, 1);
  assert.ok(!calls.includes('releases/old/archive.bin'));
  calls.length = 0;
  const again = await refreshNamespace({ directory, prefix: 'prefix', download: downloadFrom(files, calls) });
  assert.equal(again.downloaded, 0); assert.deepEqual(calls, ['manifest.json']);
});
test('partial fetch and checksum mismatch both preserve prior root and prior assets', async t => {
  const directory = setup(t); const old = fixture('2026-09-12');
  await refreshNamespace({ directory, prefix: 'prefix', download: downloadFrom(old.files) });
  const before = readFileSync(join(directory, 'manifest.json'));
  for (const corrupt of [false, true]) {
    const next = fixture(); const a = next.m.assets[3];
    if (corrupt) next.files.set(a.path, Buffer.from('bad')); else next.files.delete(a.path);
    await assert.rejects(refreshNamespace({ directory, prefix: 'prefix', download: downloadFrom(next.files) }), /verification failed/);
    assert.deepEqual(readFileSync(join(directory, 'manifest.json')), before);
    assert.ok(existsSync(join(directory, old.m.assets[0].path)));
  }
});
test('upstream changes root during download: installs only the initially pinned release', async t => {
  const directory = setup(t); const original = fixture(); const newer = fixture('2026-09-14');
  const download = downloadFrom(original.files, [], key => { if (key !== 'manifest.json') original.files.set('manifest.json', newer.files.get('manifest.json')); });
  await refreshNamespace({ directory, prefix: 'prefix', download });
  assert.equal(JSON.parse(readFileSync(join(directory, 'manifest.json'))).release_id, '2026-09-13');
});
test('rejects path traversal, missing hour, inconsistent index and rollback before cutover', async t => {
  const directory = setup(t); const current = fixture();
  await refreshNamespace({ directory, prefix: 'prefix', download: downloadFrom(current.files) });
  for (const mutate of [m => m.assets[0].path = '../escape', m => m.grid.hours.pop(), m => m.grid.hours[0].sha256 = '0'.repeat(64)]) {
    const f = fixture('2026-09-14'); mutate(f.m); f.files.set('manifest.json', Buffer.from(JSON.stringify(f.m)));
    await assert.rejects(refreshNamespace({ directory, prefix: 'prefix', download: downloadFrom(f.files) }));
  }
  await assert.rejects(refreshNamespace({ directory, prefix: 'prefix', download: downloadFrom(fixture('2026-09-12').files) }), /regression/);
  assert.equal(JSON.parse(readFileSync(join(directory, 'manifest.json'))).release_id, '2026-09-13');
});
test('rejects immutable same-date mutation and symlink destinations', async t => {
  const directory = setup(t); const f = fixture();
  await refreshNamespace({ directory, prefix: 'prefix', download: downloadFrom(f.files) });
  f.m.assets[0].type = 'changed'; f.files.set('manifest.json', Buffer.from(JSON.stringify(f.m)));
  await assert.rejects(refreshNamespace({ directory, prefix: 'prefix', download: downloadFrom(f.files) }), /immutable/);
  const another = setup(t); mkdirSync(join(another, 'outside')); symlinkSync(join(another, 'outside'), join(another, 'releases'));
  await assert.rejects(refreshNamespace({ directory: another, prefix: 'prefix', download: downloadFrom(fixture().files) }), /symlink/);
});
test('missing initial root is optional, but disappearance of installed root fails', async t => {
  const directory = setup(t);
  assert.deepEqual(await refreshNamespace({ directory, prefix: 'prefix', download: async () => null }), { status: 'absent' });
  await refreshNamespace({ directory, prefix: 'prefix', download: downloadFrom(fixture().files) });
  await assert.rejects(refreshNamespace({ directory, prefix: 'prefix', download: async () => null }), /disappeared/);
});
test('optional v4 pins and verifies release-manifest pointer and its artifacts', async t => {
  const directory = setup(t); const id = '2026-09-13__gfw-v4.0'; const body = Buffer.from('pmtiles');
  const a = { path: `releases/${id}/tracks/day.pmtiles`, bytes: body.length, sha256: hash(body) };
  const release = Buffer.from(JSON.stringify({ schema_version: 4, release_id: id, production_cutover: true, immutable: true, release_truth: { tier1_status: 'passed', tier2_status: 'passed', readback_status: 'passed' }, artifacts: [a] }));
  const ref = { path: `releases/${id}/manifest.json`, bytes: release.length, sha256: hash(release) };
  const root = Buffer.from(JSON.stringify({ schema_version: 4, production_cutover: true, release_id: id, selected_utc_date: '2026-09-13', release_manifest: ref }));
  const files = new Map([['manifest.json', root], [ref.path, release], [a.path, body]]);
  const result = await refreshNamespace({ directory, prefix: 'prefix', download: downloadFrom(files) });
  assert.equal(result.assets, 2); assert.deepEqual(readFileSync(join(directory, 'manifest.json')), root);
  files.set(ref.path, Buffer.from('corrupted'));
  await assert.rejects(refreshNamespace({ directory, prefix: 'prefix', download: downloadFrom(files) }), /manifest verification failed/);
  assert.deepEqual(readFileSync(join(directory, 'manifest.json')), root);
});
test('local cache expires only after eight days retired; current and unindexed files remain', async t => {
  const { pruneServingCache } = await import('./refresh-gfw-hourly.mjs');
  const directory = setup(t); const old = fixture('2026-09-12'); const next = fixture(); const now = 1800000000000;
  await refreshNamespace({ directory, prefix: 'prefix', download: downloadFrom(old.files), now });
  const unindexed = join(directory, `releases/${old.m.release_id}/operator-note.txt`); writeFileSync(unindexed, 'keep');
  await refreshNamespace({ directory, prefix: 'prefix', download: downloadFrom(next.files), now });
  pruneServingCache(directory, next.m.release_id, now + 7 * 86400000);
  assert.ok(existsSync(join(directory, old.m.assets[0].path)));
  pruneServingCache(directory, next.m.release_id, now + 8 * 86400000);
  assert.ok(!existsSync(join(directory, old.m.assets[0].path)));
  assert.ok(existsSync(join(directory, next.m.assets[0].path)));
  assert.ok(existsSync(unindexed));
  assert.equal(JSON.parse(readFileSync(join(directory, 'manifest.json'))).release_id, next.m.release_id);
});
