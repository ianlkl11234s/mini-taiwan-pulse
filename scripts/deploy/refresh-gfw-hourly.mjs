/** Manifest-bound local mirror. S3 is the archive; this volume is a serving cache. */
import { createHash } from 'node:crypto';
import { createReadStream, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, statSync, unlinkSync, readdirSync, rmdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const HASH = /^[a-f0-9]{64}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_MANIFEST = 16 * 1024 * 1024;
function fail(message) { throw new Error(message); }
function safePath(value) {
  if (typeof value !== 'string' || !value.split('/').every(p => /^[A-Za-z0-9.][A-Za-z0-9._-]*$/.test(p) && p !== '.' && p !== '..')) fail('unsafe artifact path');
  return value;
}
function plainPath(root, relative) {
  safePath(relative);
  let path = root;
  for (const part of relative.split('/')) {
    path = join(path, part);
    if (existsSync(path) && lstatSync(path).isSymbolicLink()) fail('symlink in serving path');
  }
  return path;
}
async function digest(file) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}
async function matches(file, asset) {
  return existsSync(file) && lstatSync(file).isFile() && statSync(file).size === asset.bytes && await digest(file) === asset.sha256;
}
function releaseDate(manifest) { return manifest.latest_complete_date ?? manifest.selected_utc_date; }
function readManifest(path) {
  if (statSync(path).size > MAX_MANIFEST) fail('manifest exceeds size limit');
  return JSON.parse(readFileSync(path, 'utf8'));
}
function validateAsset(asset, prefix) {
  if (!asset || !safePath(asset.path).startsWith(prefix) || !Number.isSafeInteger(asset.bytes) || asset.bytes < 0 || !HASH.test(asset.sha256)) fail('invalid artifact descriptor');
}
export function validateManifest(manifest) {
  if (![2, 3].includes(manifest.schema_version) || !DATE.test(manifest.release_id)) fail('unsupported GFW manifest');
  const end = Date.parse(manifest.date_end + 'T00:00:00Z');
  const start = Date.parse(manifest.date_start + 'T00:00:00Z');
  if (!Number.isFinite(end) || !Number.isFinite(start) || end - start !== 6 * 86400000 || manifest.latest_complete_date !== manifest.date_end || manifest.release_id !== manifest.date_end) fail('release must describe exactly seven UTC days');
  if (!Array.isArray(manifest.assets) || !manifest.assets.length) fail('missing artifacts');
  const prefix = `releases/${manifest.release_id}/`;
  const assets = new Map();
  for (const a of manifest.assets) {
    validateAsset(a, prefix);
    if (assets.has(a.path)) fail('duplicate artifact');
    assets.set(a.path, a);
  }
  const indexes = [[manifest.grid?.hours, 168, 'observed_at'], [manifest.dark_vessels?.hours, 168, 'observed_at'], [manifest.tracks?.days, 7, 'display_date']];
  if (manifest.schema_version === 3) indexes.push([manifest.tracks?.frames, 168, 'observed_at']);
  for (const [entries, count, timeKey] of indexes) {
    if (!Array.isArray(entries) || entries.length !== count) fail('incomplete seven-day index');
    const stamps = new Set();
    for (const entry of entries) {
      const stamp = Date.parse(timeKey === 'display_date' ? `${entry[timeKey]}T00:00:00Z` : entry[timeKey]);
      const interval = timeKey === 'display_date' ? 86400000 : 3600000;
      if (!Number.isFinite(stamp) || stamp < start || stamp >= end + 86400000 || (stamp - start) % interval || stamps.has(stamp)) fail('invalid index timestamps');
      stamps.add(stamp);
      for (const ref of [entry, ...(entry.detail_buckets ?? [])]) {
        const a = assets.get(ref.path);
        if (!a || a.bytes !== ref.bytes || a.sha256 !== ref.sha256) fail('index differs from artifact inventory');
      }
    }
  }
  return [...assets.values()];
}

const CACHE_GRACE_MS = 8 * 86400000; // immutable cache 7d plus root/edge grace
function rememberRetired(directory, installed, now) {
  const prefix = `releases/${installed.release_id}/`;
  let assets = installed.assets;
  if (installed.schema_version === 4) {
    const ref = installed.release_manifest;
    validateAsset(ref, prefix);
    const prior = readManifest(plainPath(directory, ref.path));
    assets = [...prior.artifacts, ref];
  }
  if (!Array.isArray(assets)) fail('cannot safely retire unindexed cache');
  for (const a of assets) validateAsset(a, prefix);
  const receiptDir = plainPath(directory, '.gfw-cache');
  mkdirSync(receiptDir, { recursive: true });
  const receipt = plainPath(directory, `.gfw-cache/${installed.release_id}.json`);
  if (!existsSync(receipt)) writeFileSync(receipt, JSON.stringify({ releaseId: installed.release_id, retiredAt: now, assets }));
}
export function pruneServingCache(directory, currentId, now = Date.now()) {
  const receipts = plainPath(directory, '.gfw-cache');
  if (!existsSync(receipts)) return;
  for (const name of readdirSync(receipts)) {
    if (!/^\d{4}-\d{2}-\d{2}(?:__[A-Za-z0-9][A-Za-z0-9._-]{0,127})?\.json$/.test(name)) continue;
    const receiptPath = plainPath(directory, `.gfw-cache/${name}`);
    const r = readManifest(receiptPath);
    if (name !== `${r.releaseId}.json` || r.releaseId === currentId || !Number.isFinite(r.retiredAt) || now - r.retiredAt < CACHE_GRACE_MS) continue;
    if (!Array.isArray(r.assets)) fail('invalid cache retirement receipt');
    const paths = r.assets.map(a => {
      validateAsset(a, `releases/${r.releaseId}/`);
      const path = plainPath(directory, a.path);
      if (existsSync(path) && !lstatSync(path).isFile()) fail('non-file in retired cache');
      return path;
    });
    for (const path of paths) {
      if (existsSync(path)) unlinkSync(path);
      let parent = dirname(path);
      while (parent !== directory && parent.startsWith(directory + '/')) {
        try { rmdirSync(parent); } catch { break; }
        parent = dirname(parent);
      }
    }
    unlinkSync(receiptPath); // Only verified, enumerated local cache paths removed.
  }
}

/** download(key, path) must leave the exact stored bytes. null means confirmed missing. */
export async function refreshNamespace({ directory, prefix, download, now = Date.now() }) {
  mkdirSync(directory, { recursive: true });
  if (lstatSync(directory).isSymbolicLink()) fail('symlink namespace');
  const stage = mkdtempSync(join(directory, '.gfw-stage-'));
  const root = plainPath(directory, 'manifest.json');
  try {
    const candidate = join(stage, 'manifest.json');
    if (await download(`${prefix}/manifest.json`, candidate) === null) {
      if (existsSync(root)) fail('upstream root disappeared; keeping installed release');
      return { status: 'absent' };
    }
    const manifest = readManifest(candidate);
    let assets;
    if (manifest.schema_version === 4) {
      if (manifest.production_cutover !== true || manifest.poc === true || manifest.shadow_only === true) fail('v4 root is not published');
      if (!/^\d{4}-\d{2}-\d{2}__[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(manifest.release_id) || manifest.selected_utc_date !== manifest.release_id.slice(0, 10)) fail('invalid v4 root');
      const ref = manifest.release_manifest;
      const releasePrefix = `releases/${manifest.release_id}/`;
      validateAsset(ref, releasePrefix);
      if (ref.path !== releasePrefix + 'manifest.json') fail('invalid v4 pointer');
      const releasePath = join(stage, 'release.json');
      if (await download(`${prefix}/${ref.path}`, releasePath) === null || !await matches(releasePath, ref)) fail('v4 release manifest verification failed');
      const release = readManifest(releasePath);
      if (release.schema_version !== 4 || release.release_id !== manifest.release_id || !Array.isArray(release.artifacts) || !release.artifacts.length) fail('invalid v4 release');
      if (release.production_cutover !== true || release.immutable !== true || !['tier1_status', 'tier2_status', 'readback_status'].every(k => release.release_truth?.[k] === 'passed')) fail('v4 release acceptance gate failed');
      assets = [...release.artifacts, ref];
      const paths = new Set();
      for (const a of assets) {
        validateAsset(a, releasePrefix);
        if (paths.has(a.path)) fail('duplicate v4 artifact');
        paths.add(a.path);
      }
    } else assets = validateManifest(manifest);
    let installed;
    if (existsSync(root)) {
      installed = readManifest(root);
      if (releaseDate(installed) > releaseDate(manifest)) fail('refusing release date regression');
      if (installed.release_id === manifest.release_id && JSON.stringify(installed.assets ?? installed.release_manifest) !== JSON.stringify(manifest.assets ?? manifest.release_manifest)) fail('immutable release changed');
    }
    let downloaded = 0;
    for (const a of assets) {
      const destination = plainPath(directory, a.path);
      if (await matches(destination, a)) continue;
      const temp = join(stage, `asset-${downloaded++}`);
      if (await download(`${prefix}/${a.path}`, temp) === null || !await matches(temp, a)) fail('artifact download/hash/bytes verification failed');
      mkdirSync(dirname(destination), { recursive: true });
      renameSync(temp, destination);
    }
    // Candidate is never re-fetched: concurrent upstream publication cannot swap
    // in an unverified manifest after these bytes have been downloaded.
    if (installed && installed.release_id !== manifest.release_id) rememberRetired(directory, installed, now);
    renameSync(candidate, root);
    // Cleanup is a cache-only operation after cutover; S3 archive is untouched.
    try { pruneServingCache(directory, manifest.release_id, now); }
    catch (error) { console.warn(`[gfw-refresh] cache cleanup retained files: ${error.message}`); }
    return { status: 'installed', releaseId: manifest.release_id, assets: assets.length, downloaded };
  } finally { rmSync(stage, { recursive: true, force: true }); }
}

export function awsDownload(bucket, key, destination) {
  try {
    execFileSync('aws', ['s3', 'cp', `s3://${bucket}/${safePath(key)}`, destination, '--no-progress', '--only-show-errors'], { stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (error) {
    // Authentication, network and permission failures must not become "absent".
    if (/\(404\)|\(NoSuchKey\)/.test(String(error.stderr))) return null;
    throw new Error('S3 download failed; preserving installed manifest');
  }
}
export async function main() {
  const base = resolve(process.env.GFW_SERVING_DIR || '/data/global-maritime/gfw-hourly');
  const bucket = process.env.S3_BUCKET || 'migu-gis-data-collector';
  mkdirSync(base, { recursive: true });
  let failed = false;
  for (const ns of ['', 'v3-shadow', 'v4']) {
    try {
      const result = await refreshNamespace({ directory: join(base, ns), prefix: `deploy-assets/global-maritime/gfw-hourly${ns ? '/' + ns : ''}`, download: (key, path) => awsDownload(bucket, key, path) });
      console.log(`[gfw-refresh] ${ns || 'canonical'} ${JSON.stringify(result)}`);
    } catch (error) { failed = true; console.error(`[gfw-refresh] ${ns || 'canonical'} ${error.message}`); }
  }
  // Absent v4 is a no-op; its independently published pointer is verified
  // without enabling any publisher, migration or schedule.
  if (failed) process.exitCode = 1;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main().catch(error => { console.error(`[gfw-refresh] ${error.message}`); process.exitCode = 1; });
