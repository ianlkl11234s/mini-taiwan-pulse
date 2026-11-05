// node --test deploy/cloudflare/sync-rotating.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { assertWritableKey, syncGfwNamespace, syncClimate, pruneGfwNamespace, contentType, CACHE } from './sync-rotating.mjs';

const hash = b => createHash('sha256').update(b).digest('hex');
const md5 = b => createHash('md5').update(b).digest('hex');

function fixture(end = '2026-09-13') {
  const epoch = Date.parse(end + 'T00:00:00Z') - 6 * 86400000;
  const files = new Map(); const assets = [];
  function entry(kind, stamp) {
    const body = Buffer.from(`${kind}:${stamp}`);
    const path = `releases/${end}/${kind}/${stamp.replaceAll(':', '-')}.json.gz`;
    const a = { path, bytes: body.length, sha256: hash(body) };
    files.set(path, body); assets.push(a);
    return { ...a };
  }
  const hours = Array.from({ length: 168 }, (_, i) => new Date(epoch + i * 3600000).toISOString());
  const days = Array.from({ length: 7 }, (_, i) => new Date(epoch + i * 86400000).toISOString().slice(0, 10));
  const manifest = {
    schema_version: 2, release_id: end, date_start: days[0], date_end: end, latest_complete_date: end,
    grid: { hours: hours.map(h => ({ observed_at: h, ...entry('grid', h) })) },
    dark_vessels: { hours: hours.map(h => ({ observed_at: h, ...entry('dark', h) })) },
    tracks: { days: days.map(d => ({ display_date: d, ...entry('tracks', d) })) },
  };
  manifest.assets = assets;
  return { manifest, files };
}

function fakes(srcFiles, dstFiles = new Map()) {
  const puts = [];
  const etag = b => md5(b);
  const list = (m) => async (prefix) => new Map([...m].filter(([k]) => k.startsWith(prefix)).map(([k, b]) => [k, { size: b.length, etag: etag(b), lastModified: 0 }]));
  return {
    puts, dstFiles,
    src: {
      list: list(srcFiles),
      get: async k => srcFiles.get(k) ?? null,
      async download(k, path) {
        const b = srcFiles.get(k); if (!b) return null;
        writeFileSync(path, b);
        return { bytes: b.length, sha256: hash(b), md5: md5(b), etag: etag(b) };
      },
    },
    dst: {
      list: list(dstFiles),
      get: async k => dstFiles.get(k) ?? null,
      head: async k => dstFiles.has(k) ? { size: dstFiles.get(k).length, etag: etag(dstFiles.get(k)), metadata: {} } : null,
      async put(k, { file, body }) { puts.push(k); dstFiles.set(k, body ?? (await import('node:fs')).readFileSync(file)); },
      async del(keys) { for (const k of keys) dstFiles.delete(k); },
    },
  };
}

const S = 'deploy-assets/global-maritime/gfw-hourly';
const D = 'site/global-maritime/gfw-hourly';
function srcOf({ manifest, files }, mutate) {
  const m = new Map();
  for (const [p, b] of files) m.set(`${S}/${p}`, b);
  m.set(`${S}/manifest.json`, Buffer.from(JSON.stringify(manifest)));
  mutate?.(m);
  return m;
}

test('key guard only allows the two rotating prefixes', () => {
  assert.equal(assertWritableKey('site/climate/frames/manifest.json'), 'site/climate/frames/manifest.json');
  assert.ok(assertWritableKey('site/global-maritime/gfw-hourly/releases/2026-11-01/a.json.gz'));
  for (const bad of ['site/geo/x.pmtiles', 'climate/x.png', 'site/global-maritime/ais/x', 'site/climate/../geo/x', 'site/climate//x', '/site/climate/x', 'site/climatex/y', 'site/global-maritime/gfw-hourly/a b']) {
    assert.throws(() => assertWritableKey(bad), /refusing/, bad);
  }
});

test('invalid manifest never writes anything, root untouched', async () => {
  const fx = fixture();
  fx.manifest.grid.hours.pop(); // 167 小時
  const f = fakes(srcOf(fx));
  const work = mkdtempSync(join(tmpdir(), 'sr-'));
  try {
    await assert.rejects(syncGfwNamespace({ ns: '', ...f, execute: true, work }), /seven-day/);
    assert.equal(f.puts.length, 0);
  } finally { rmSync(work, { recursive: true, force: true }); }
});

test('asset hash mismatch aborts before root switch', async () => {
  const fx = fixture();
  const f = fakes(srcOf(fx, m => m.set(`${S}/${fx.manifest.assets[5].path}`, Buffer.from('tampered!!'))));
  const work = mkdtempSync(join(tmpdir(), 'sr-'));
  try {
    await assert.rejects(syncGfwNamespace({ ns: '', ...f, execute: true, work, concurrency: 2 }), /root not switched/);
    assert.ok(!f.puts.includes(`${D}/manifest.json`));
  } finally { rmSync(work, { recursive: true, force: true }); }
});

test('happy path uploads assets then root last; second run is a no-op', async () => {
  const fx = fixture();
  const f = fakes(srcOf(fx));
  const work = mkdtempSync(join(tmpdir(), 'sr-'));
  try {
    const s = await syncGfwNamespace({ ns: '', ...f, execute: true, work });
    assert.equal(s.status, 'installed');
    assert.equal(f.puts.at(-1), `${D}/manifest.json`);
    assert.equal(f.puts.length, fx.manifest.assets.length + 1);
    f.puts.length = 0;
    const again = await syncGfwNamespace({ ns: '', ...f, execute: true, work });
    assert.equal(again.status, 'current');
    assert.equal(f.puts.length, 0);
    // 日期倒退拒絕
    const older = fixture('2026-09-12');
    const g = fakes(srcOf(older), f.dstFiles);
    await assert.rejects(syncGfwNamespace({ ns: '', ...g, execute: true, work }), /regression/);
  } finally { rmSync(work, { recursive: true, force: true }); }
});

test('absent namespace is skipped; dry-run writes nothing', async () => {
  const f = fakes(new Map());
  assert.equal((await syncGfwNamespace({ ns: 'v4', ...f, execute: true, work: tmpdir() })).status, 'absent');
  const g = fakes(srcOf(fixture()));
  const s = await syncGfwNamespace({ ns: '', ...g, execute: false, work: tmpdir() });
  assert.equal(s.status, 'dry-run');
  assert.equal(g.puts.length, 0);
});

test('prune deletes only unreferenced releases retired > 8 days', async () => {
  const now = Date.parse('2026-11-20T00:00:00Z');
  const dst = new Map([
    [`${D}/manifest.json`, Buffer.from(JSON.stringify({ release_id: '2026-11-19', published_releases: [{ manifest_key: `${S}/releases/2026-11-18/manifest.json` }] }))],
    [`${D}/releases/2026-11-19/a`, Buffer.from('1')],
    [`${D}/releases/2026-11-18/a`, Buffer.from('1')],
    [`${D}/releases/2026-11-05/a`, Buffer.from('1')],
    [`${D}/releases/2026-11-10/a`, Buffer.from('1')],
    [`${D}/.retired/2026-11-05.json`, Buffer.from(JSON.stringify({ releaseId: '2026-11-05', retiredAt: now - 9 * 86400000 }))],
    [`${D}/.retired/2026-11-10.json`, Buffer.from(JSON.stringify({ releaseId: '2026-11-10', retiredAt: now - 3 * 86400000 }))],
  ]);
  const f = fakes(new Map(), dst);
  const s = await pruneGfwNamespace({ ns: '', dst: f.dst, execute: true, now });
  assert.equal(s.deleted, 1);
  assert.ok(!dst.has(`${D}/releases/2026-11-05/a`));
  for (const id of ['2026-11-19', '2026-11-18', '2026-11-10']) assert.ok(dst.has(`${D}/releases/${id}/a`), id);
});

test('climate uploads pointers last and in order', async () => {
  const src = new Map([
    ['deploy-assets/climate/frames/manifest.json', Buffer.from('{}')],
    ['deploy-assets/climate/wind10m_latest.json', Buffer.from('{"a":1}')],
    ['deploy-assets/climate/wind10m_latest.png', Buffer.from('png')],
    ['deploy-assets/climate/frames/wind10m/20261101T0000Z.png', Buffer.from('frame')],
  ]);
  const f = fakes(src);
  const work = mkdtempSync(join(tmpdir(), 'sr-'));
  try {
    await syncClimate({ ...f, execute: true, work });
    assert.deepEqual(f.puts, ['site/climate/frames/wind10m/20261101T0000Z.png', 'site/climate/wind10m_latest.png', 'site/climate/wind10m_latest.json', 'site/climate/frames/manifest.json']);
    f.puts.length = 0;
    await syncClimate({ ...f, execute: true, work });
    assert.equal(f.puts.length, 0);
  } finally { rmSync(work, { recursive: true, force: true }); }
});

test('content types and cache values', () => {
  assert.equal(contentType('a/b.json.gz'), 'application/octet-stream');
  assert.equal(contentType('a/b.pmtiles'), 'application/vnd.pmtiles');
  assert.equal(CACHE.gfwRelease, 'public,max-age=604800,s-maxage=604800,immutable');
});
